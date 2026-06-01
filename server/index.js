// Load environment variables from .env file into process.env
require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid');

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

const app = express();
app.use(express.json());

// Connect to Supabase using the URL and key from .env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --- Helpers ---

// Distributes the user's current bank balance across their active pockets by income_percent
async function initializePocketBalances(userId) {
  const { data: plaidItem } = await supabase
    .from('plaid_items').select('access_token').eq('user_id', userId).single();
  if (!plaidItem) return { distributed: false };

  const balanceResponse = await plaidClient.accountsBalanceGet({
    access_token: plaidItem.access_token,
  });
  const totalBalance = balanceResponse.data.accounts
    .filter(a => a.type === 'depository')
    .reduce((sum, a) => sum + (a.balances.available ?? a.balances.current ?? 0), 0);

  const { data: pockets } = await supabase
    .from('pockets').select('*').eq('user_id', userId).is('archived_at', null);

  const eligible = (pockets || []).filter(p => p.income_percent != null);
  if (eligible.length === 0) return { distributed: false, totalBalance };

  const totalPercent = eligible.reduce((sum, p) => sum + p.income_percent, 0);
  if (totalPercent === 0) return { distributed: false, totalBalance };

  let remaining = Math.round(totalBalance * 100) / 100;
  for (let i = 0; i < eligible.length; i++) {
    const pocket = eligible[i];
    const share = i === eligible.length - 1
      ? Math.round(remaining * 100) / 100
      : Math.round((pocket.income_percent / totalPercent) * totalBalance * 100) / 100;
    remaining -= share;
    await supabase.from('pockets').update({ balance: share }).eq('id', pocket.id);
  }
  return { distributed: true, totalBalance };
}

// --- Routes ---

// GET /pockets — fetch active (non-archived) pockets, filtered by userId if provided
app.get('/pockets', async (req, res) => {
  const { userId } = req.query;
  let query = supabase.from('pockets').select('*').is('archived_at', null);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /pockets — insert a new pocket; sources = [{ pocketId, amount }] transfers balance from those pockets
app.post('/pockets', async (req, res) => {
  const { name, balance, color, income_percent, userId, sources } = req.body;

  if (sources && sources.length > 0 && balance > 0) {
    const total = sources.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(total - balance) > 0.01) {
      return res.status(400).json({ error: 'Source amounts must add up to the starting balance' });
    }
    for (const { pocketId, amount } of sources) {
      const { data: src, error: srcErr } = await supabase
        .from('pockets').select('balance').eq('id', pocketId).single();
      if (srcErr) return res.status(500).json({ error: srcErr.message });
      if (src.balance < amount) {
        return res.status(400).json({ error: `A source pocket doesn't have enough balance` });
      }
    }
  }

  const { data, error } = await supabase
    .from('pockets')
    .insert({ name, balance: balance ?? 0, color, income_percent: income_percent ?? null, user_id: userId ?? null })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (sources && sources.length > 0 && balance > 0) {
    for (const { pocketId, amount } of sources) {
      const { data: src } = await supabase
        .from('pockets').select('balance').eq('id', pocketId).single();
      await supabase.from('pockets')
        .update({ balance: src.balance - amount })
        .eq('id', pocketId);
    }
  }

  res.status(201).json(data);
});

// PUT /pockets/:id — update a pocket; transfers = [{ pocketId, amount }] moves money to/from others
app.put('/pockets/:id', async (req, res) => {
  const id = req.params.id;
  const { name, balance, color, income_percent, transfers } = req.body;

  // Validate source pockets have enough when amount is negative (taking from them)
  if (transfers?.length > 0) {
    for (const { pocketId, amount } of transfers) {
      if (amount < 0) {
        const { data: tp } = await supabase.from('pockets').select('balance').eq('id', pocketId).single();
        if (!tp || tp.balance < Math.abs(amount)) {
          return res.status(400).json({ error: `A source pocket doesn't have enough balance` });
        }
      }
    }
  }

  const updates = { name, color };
  if (balance !== undefined) updates.balance = balance;
  if (income_percent !== undefined) updates.income_percent = income_percent;

  const { data, error } = await supabase
    .from('pockets').update(updates).eq('id', id).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Apply each transfer
  for (const { pocketId, amount } of (transfers || [])) {
    const { data: tp } = await supabase.from('pockets').select('balance').eq('id', pocketId).single();
    await supabase.from('pockets').update({ balance: tp.balance + amount }).eq('id', pocketId);
  }

  res.json(data);
});

// DELETE /pockets/user/:userId — archive active pockets (keeps one recoverable backup)
app.delete('/pockets/user/:userId', async (req, res) => {
  const { userId } = req.params;

  // Capture the current method before anything changes so restore can flip back to it
  const { data: currentSettings } = await supabase.from('user_settings')
    .select('method_id').eq('user_id', userId).single();
  console.log('[DELETE /pockets/user] current method_id:', currentSettings?.method_id);
  if (currentSettings?.method_id) {
    const { error: prevErr } = await supabase.from('user_settings')
      .update({ previous_method_id: currentSettings.method_id })
      .eq('user_id', userId);
    console.log('[DELETE /pockets/user] saved previous_method_id, error:', prevErr?.message ?? 'none');
  }

  // Permanently remove any previous backup first (only keep one backup at a time)
  await supabase.from('pockets').delete().eq('user_id', userId).not('archived_at', 'is', null);
  // Soft-delete current active pockets
  const { error } = await supabase.from('pockets')
    .update({ archived_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('archived_at', null);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /pockets/backup — check if a restorable backup exists for this user
app.get('/pockets/backup', async (req, res) => {
  const { userId } = req.query;
  const { data } = await supabase.from('pockets')
    .select('id, name, color').eq('user_id', userId).not('archived_at', 'is', null);
  const { data: settings } = await supabase.from('user_settings')
    .select('previous_method_id').eq('user_id', userId).single();
  res.json({
    hasBackup: !!(data && data.length > 0),
    pocketCount: data?.length || 0,
    previousMethodId: settings?.previous_method_id || null,
  });
});

// POST /pockets/backup/restore — restore archived pockets, delete current ones, re-init balances
app.post('/pockets/backup/restore', async (req, res) => {
  const { userId, targetMethodId } = req.body;
  const { data: archived } = await supabase.from('pockets')
    .select('*').eq('user_id', userId).not('archived_at', 'is', null);
  if (!archived || archived.length === 0) {
    return res.status(400).json({ error: 'No backup found' });
  }

  // Delete current active pockets
  await supabase.from('pockets').delete().eq('user_id', userId).is('archived_at', null);

  // Un-archive the backup
  await supabase.from('pockets').update({ archived_at: null })
    .eq('user_id', userId).not('archived_at', 'is', null);

  // Swap method IDs — use previous_method_id from DB, or targetMethodId passed from client
  const { data: settings } = await supabase.from('user_settings')
    .select('method_id, previous_method_id').eq('user_id', userId).single();
  console.log('[RESTORE] DB method_id:', settings?.method_id, '| DB previous_method_id:', settings?.previous_method_id, '| client targetMethodId:', targetMethodId);
  const restoredMethodId = settings?.previous_method_id || targetMethodId || null;
  console.log('[RESTORE] restoredMethodId:', restoredMethodId);
  if (restoredMethodId) {
    await supabase.from('user_settings').update({
      method_id: restoredMethodId,
      previous_method_id: settings.method_id,
    }).eq('user_id', userId);
  }

  // Re-initialize balances from bank
  try { await initializePocketBalances(userId); } catch (e) {}

  res.json({ success: true, restoredMethodId });
});

// DELETE /pockets/:id — delete a pocket, return its transactions to inbox, split balance across pockets
app.delete('/pockets/:id', async (req, res) => {
  const id = req.params.id;
  const { transfers } = req.body; // [{ pocketId, amount }]

  // Return all assigned transactions to the inbox
  await supabase.from('transactions').update({ pocket_id: null }).eq('pocket_id', id);

  // Distribute the balance across destination pockets
  for (const { pocketId, amount } of (transfers || [])) {
    if (amount > 0) {
      const { data: dest } = await supabase.from('pockets').select('balance').eq('id', pocketId).single();
      if (dest) {
        await supabase.from('pockets').update({ balance: dest.balance + amount }).eq('id', pocketId);
      }
    }
  }

  const { error } = await supabase.from('pockets').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /transactions — insert a new transaction (unassigned, no pocket yet)
app.post('/transactions', async (req, res) => {
  const { merchant, amount, date, icon, userId } = req.body;

  const { data, error } = await supabase
    .from('transactions')
    .insert({ merchant, amount, date, icon, pocket_id: null, user_id: userId ?? null })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /transactions — fetch transactions belonging to the user
app.get('/transactions', async (req, res) => {
  const { userId } = req.query;
  if (userId) {
    const { data: userPockets } = await supabase.from('pockets').select('id').eq('user_id', userId).is('archived_at', null);
    const pocketIds = userPockets.map(p => p.id);
    let query = supabase.from('transactions').select('*');
    if (pocketIds.length > 0) {
      query = query.or(`pocket_id.in.(${pocketIds.join(',')}),user_id.eq.${userId}`);
    } else {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /transactions/pocket/:pocketId — fetch all transactions assigned to a specific pocket
app.get('/transactions/pocket/:pocketId', async (req, res) => {
  const { pocketId } = req.params;

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('pocket_id', pocketId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /transactions/inbox — fetch unassigned transactions for this user
app.get('/transactions/inbox', async (req, res) => {
  const { userId } = req.query;
  let query = supabase.from('transactions').select('*').is('pocket_id', null);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /transactions/assign — assign a transaction to a pocket
// Also updates the pocket's spent amount
app.post('/transactions/assign', async (req, res) => {
  const { transactionId, pocketId } = req.body;

  // Step 1: get the transaction so we know the amount
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('id', transactionId)
    .single();

  if (txError) return res.status(500).json({ error: txError.message });

  // Step 2: get the pocket's current balance
  const { data: pocket, error: pocketError } = await supabase
    .from('pockets')
    .select('balance')
    .eq('id', pocketId)
    .single();

  if (pocketError) return res.status(500).json({ error: pocketError.message });

  // Step 3: update the transaction — set its pocket_id
  const { error: updateTxError } = await supabase
    .from('transactions')
    .update({ pocket_id: pocketId })
    .eq('id', transactionId);

  if (updateTxError) return res.status(500).json({ error: updateTxError.message });

  // Step 4: subtract transaction amount from pocket balance
  const { error: updatePocketError } = await supabase
    .from('pockets')
    .update({ balance: pocket.balance - Math.abs(transaction.amount) })
    .eq('id', pocketId);

  if (updatePocketError) return res.status(500).json({ error: updatePocketError.message });

  res.json({ success: true });
});

// POST /transactions/assign-overflow — assign a transaction that exceeds one pocket's budget
// The primary pocket absorbs what it can, the overflow pocket covers the rest
app.post('/transactions/assign-overflow', async (req, res) => {
  const { transactionId, primaryPocketId, overflowPocketId } = req.body;

  const { data: transaction, error: txError } = await supabase
    .from('transactions').select('amount').eq('id', transactionId).single();
  if (txError) return res.status(500).json({ error: txError.message });

  const { data: primaryPocket, error: primaryError } = await supabase
    .from('pockets').select('balance').eq('id', primaryPocketId).single();
  if (primaryError) return res.status(500).json({ error: primaryError.message });

  const { data: overflowPocket, error: overflowError } = await supabase
    .from('pockets').select('balance').eq('id', overflowPocketId).single();
  if (overflowError) return res.status(500).json({ error: overflowError.message });

  const txAmount = Math.abs(transaction.amount);
  const overflowAmount = txAmount - primaryPocket.balance;

  // Assign transaction to primary pocket
  const { error: updateTxError } = await supabase
    .from('transactions').update({ pocket_id: primaryPocketId }).eq('id', transactionId);
  if (updateTxError) return res.status(500).json({ error: updateTxError.message });

  // Primary pocket drains to 0
  const { error: updatePrimaryError } = await supabase
    .from('pockets').update({ balance: 0 }).eq('id', primaryPocketId);
  if (updatePrimaryError) return res.status(500).json({ error: updatePrimaryError.message });

  // Overflow pocket covers the rest
  const { error: updateOverflowError } = await supabase
    .from('pockets').update({ balance: overflowPocket.balance - overflowAmount }).eq('id', overflowPocketId);
  if (updateOverflowError) return res.status(500).json({ error: updateOverflowError.message });

  res.json({ success: true, overflowAmount });
});

// GET /user-settings?userId=xxx — fetch the budgeting method for a user
app.get('/user-settings', async (req, res) => {
  const { userId } = req.query;
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  // PGRST116 = no rows found — that's fine, just means first time user
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json(data || null);
});

// POST /user-settings — save (or update) a user's budgeting method
app.post('/user-settings', async (req, res) => {
  const { userId, methodId, previousMethodId } = req.body;
  console.log('[POST /user-settings] methodId:', methodId, '| previousMethodId:', previousMethodId);

  const fields = { method_id: methodId };
  if (previousMethodId !== undefined) fields.previous_method_id = previousMethodId;

  // Use explicit insert-or-update instead of upsert so no unique constraint is needed
  const { data: existing, error: selectErr } = await supabase
    .from('user_settings').select('id').eq('user_id', userId).maybeSingle();
  console.log('[POST /user-settings] userId:', userId, '| existing row:', existing, '| selectErr:', selectErr?.message ?? 'none');

  let data, error;
  if (existing) {
    ({ data, error } = await supabase
      .from('user_settings').update(fields).eq('user_id', userId).select().single());
    console.log('[POST /user-settings] UPDATE result - data:', data, '| error:', error?.message ?? 'none');
  } else {
    ({ data, error } = await supabase
      .from('user_settings').insert({ user_id: userId, ...fields }).select().single());
    console.log('[POST /user-settings] INSERT result - data:', data, '| error:', error?.message ?? 'none');
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /pockets/bulk — create multiple pockets at once (used after onboarding)
app.post('/pockets/bulk', async (req, res) => {
  const { pockets } = req.body;
  const { data, error } = await supabase
    .from('pockets')
    .insert(pockets)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /transactions/distribute-income — split income across pockets by budget proportion
// Increments each pocket's budget by its share, then marks the transaction as handled
app.post('/transactions/distribute-income', async (req, res) => {
  const { transactionId, distributions } = req.body;
  // distributions = [{ pocketId, topUpAmount }, ...]

  for (const { pocketId, topUpAmount } of distributions) {
    const { data: pocket, error: getErr } = await supabase
      .from('pockets').select('balance').eq('id', pocketId).single();
    if (getErr) return res.status(500).json({ error: getErr.message });

    const { error: updateErr } = await supabase
      .from('pockets').update({ balance: pocket.balance + topUpAmount }).eq('id', pocketId);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
  }

  // Assign the transaction to the pocket that received the largest share
  const primary = distributions.reduce((a, b) => a.topUpAmount > b.topUpAmount ? a : b);
  const { error: txErr } = await supabase
    .from('transactions').update({ pocket_id: primary.pocketId }).eq('id', transactionId);
  if (txErr) return res.status(500).json({ error: txErr.message });

  res.json({ success: true });
});

// GET /plaid/status?userId=xxx — check if a user has a bank connected
app.get('/plaid/status', async (req, res) => {
  const { userId } = req.query;
  const { data, error } = await supabase
    .from('plaid_items')
    .select('item_id')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json({ connected: !!data });
});

// POST /plaid/create-link-token — creates a token that opens Plaid Link in the app
app.post('/plaid/create-link-token', async (req, res) => {
  const { userId } = req.body;
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Pockets',
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca, CountryCode.Us],
      language: 'en',
      redirect_uri: undefined,
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid create-link-token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// POST /plaid/exchange-token — exchanges the public token from Plaid Link for a permanent access token
app.post('/plaid/exchange-token', async (req, res) => {
  const { publicToken, userId } = req.body;
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Store the access token — update if exists, insert if not
    const { data: existing } = await supabase
      .from('plaid_items').select('id').eq('user_id', userId).single();

    const { error } = existing
      ? await supabase.from('plaid_items').update({ access_token: accessToken, item_id: itemId }).eq('user_id', userId)
      : await supabase.from('plaid_items').insert({ user_id: userId, access_token: accessToken, item_id: itemId });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('Plaid exchange-token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// POST /plaid/sync-transactions — pulls latest transactions from the bank and adds them to inbox
app.post('/plaid/sync-transactions', async (req, res) => {
  const { userId } = req.body;
  try {
    // Get the stored access token for this user
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) return res.status(400).json({ error: 'No bank connected' });

    // Fetch the last 30 days of transactions from Plaid
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);

    const response = await plaidClient.transactionsGet({
      access_token: plaidItem.access_token,
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });

    const skipCategories = ['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS', 'BANK_FEES'];
    const plaidTransactions = response.data.transactions.filter(tx => {
      if (tx.transaction_type === 'special') return false;
      if (skipCategories.includes(tx.personal_finance_category?.primary)) return false;
      return true;
    });

    // Convert Plaid's "YYYY-MM-DD" date to our "Mon D" format
    const formatPlaidDate = (isoDate) => {
      const d = new Date(isoDate + 'T12:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const CATEGORY_ICONS = {
      FOOD_AND_DRINK:          '🍔',
      GROCERIES:               '🛒',
      TRAVEL:                  '✈️',
      TRANSPORTATION:          '🚗',
      ENTERTAINMENT:           '🎬',
      GENERAL_MERCHANDISE:     '🛍️',
      HOME_IMPROVEMENT:        '🔨',
      MEDICAL:                 '💊',
      PERSONAL_CARE:           '💅',
      GENERAL_SERVICES:        '🔧',
      GOVERNMENT_AND_NON_PROFIT: '🏛️',
      RENT_AND_UTILITIES:      '🏠',
      INCOME:                  '💰',
      TRANSFER_IN:             '📥',
      TRANSFER_OUT:            '📤',
      LOAN_PAYMENTS:           '🏦',
      BANK_FEES:               '🏦',
    };

    const toInsert = plaidTransactions.map(tx => ({
      merchant: tx.merchant_name || tx.name,
      amount: tx.amount * -1, // Plaid uses positive for debits, we use negative
      date: formatPlaidDate(tx.date),
      icon: CATEGORY_ICONS[tx.personal_finance_category?.primary] ?? '💳',
      pocket_id: null,
      user_id: userId,
      plaid_transaction_id: tx.transaction_id,
    }));

    // Get existing plaid transaction IDs to avoid duplicates
    const { data: existing } = await supabase
      .from('transactions')
      .select('plaid_transaction_id')
      .eq('user_id', userId)
      .not('plaid_transaction_id', 'is', null);

    const existingIds = new Set((existing || []).map(t => t.plaid_transaction_id));
    const newTransactions = toInsert.filter(tx => !existingIds.has(tx.plaid_transaction_id));

    if (newTransactions.length > 0) {
      const { error: insertError } = await supabase.from('transactions').insert(newTransactions);
      if (insertError) return res.status(500).json({ error: insertError.message });
    }

    res.json({ success: true, count: newTransactions.length });
  } catch (err) {
    console.error('Plaid sync error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to sync transactions' });
  }
});

// POST /plaid/initialize-pocket-balances — fetches real account balance and distributes it across pockets
app.post('/plaid/initialize-pocket-balances', async (req, res) => {
  const { userId } = req.body;
  try {
    const result = await initializePocketBalances(userId);
    if (!result.distributed && result.totalBalance === undefined) {
      return res.status(400).json({ error: 'No bank connected' });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Initialize pocket balances error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initialize pocket balances' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
