// require() is Node's way to import packages — like "import" in other languages
// Load environment variables from .env file into process.env
require('dotenv').config();

const express = require('express'); // Express is the web framework that handles routing and HTTP
const { createClient } = require('@supabase/supabase-js'); // Supabase client for database access
const { PlaidApi, PlaidEnvironments, Configuration, Products, CountryCode } = require('plaid'); // Plaid SDK for bank connections

// Configure the Plaid SDK: tell it which environment to use (sandbox = fake test bank, production = real banks)
// and attach our API credentials so Plaid knows who is making requests
// process.env reads values loaded from the .env file — secrets never go directly in source code
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig); // the object we call to interact with Plaid's API

const app = express(); // creates the Express application — this IS the server

// Middleware runs on every incoming request before any route handler executes
// express.json() reads the raw request body and parses it as JSON into req.body
// without this line, req.body would be undefined in all POST and PUT routes
app.use(express.json());

// Connect to Supabase using the service role key — bypasses RLS for trusted server operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// --- Helpers ---

// Fetches the user's live bank balance via Plaid and distributes it across their active pockets
// proportionally based on each pocket's income_percent. The last pocket absorbs any rounding
// remainder so the total always equals the bank balance exactly.
// Returns { distributed: true, totalBalance } on success, or { distributed: false } if the user
// has no linked bank, no eligible pockets, or all income_percent values are zero.
async function initializePocketBalances(userId) {
  // Look up the Plaid access token stored for this user
  const { data: plaidItem } = await supabase
    .from('plaid_items').select('access_token').eq('user_id', userId).single();
  if (!plaidItem) return { distributed: false };

  // Fetch live account balances from Plaid and sum all depository (checking/savings) accounts.
  // Uses current (posted) balance, not available — available already deducts pending transactions,
  // which would cause double-counting when those pending transactions later settle and get imported.
  const balanceResponse = await plaidClient.accountsGet({
    access_token: plaidItem.access_token,
  });
  const accounts = balanceResponse.data.accounts;
  const chequingBalance = accounts
    .filter(a => a.type === 'depository')
    .reduce((sum, a) => sum + (a.balances.current ?? a.balances.available ?? 0), 0);
  const creditOwed = accounts
    .filter(a => a.type === 'credit')
    .reduce((sum, a) => sum + (a.balances.current ?? 0), 0);
  const totalBalance = Math.round((chequingBalance - creditOwed) * 100) / 100;

  // Fetch all active (non-archived) pockets for this user
  const { data: pockets } = await supabase
    .from('pockets').select('*').eq('user_id', userId).is('archived_at', null);

  // Only named pockets (not Unsorted) with an income_percent participate in the distribution
  const eligible = (pockets || []).filter(p => p.income_percent != null && !p.is_unsorted);
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

  // Ensure the Unsorted pocket exists. At initialization all balance is distributed to named
  // pockets, so Unsorted starts at 0. It gets pegged on every subsequent sync.
  const existingUnsorted = (pockets || []).find(p => p.is_unsorted);
  if (!existingUnsorted) {
    await supabase.from('pockets').insert({
      user_id: userId, name: 'Unsorted', color: '#4A5E78', balance: 0, is_unsorted: true,
    });
  } else {
    await supabase.from('pockets').update({ balance: 0 }).eq('id', existingUnsorted.id);
  }

  return { distributed: true, totalBalance };
}

// --- Icon helpers (shared by sync and refresh-icons routes) ---

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

// Plaid's detailed categories — much more specific than primary, covers most cases automatically
const DETAILED_CATEGORY_ICONS = {
  // Food & Drink
  'FOOD_AND_DRINK_COFFEE':                '☕',
  'FOOD_AND_DRINK_FAST_FOOD':             '🍔',
  'FOOD_AND_DRINK_GROCERIES':             '🛒',
  'FOOD_AND_DRINK_RESTAURANT':            '🍽️',
  'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR':  '🍺',
  'FOOD_AND_DRINK_VENDING_MACHINES':      '🥤',
  'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK':  '🍴',
  // Transportation
  'TRANSPORTATION_GAS':                   '⛽',
  'TRANSPORTATION_PARKING':               '🅿️',
  'TRANSPORTATION_PUBLIC_TRANSIT':        '🚌',
  'TRANSPORTATION_TAXIS_AND_RIDE_SHARING':'🚗',
  'TRANSPORTATION_TOLLS':                 '🛣️',
  'TRANSPORTATION_BIKES_AND_SCOOTERS':    '🚲',
  'TRANSPORTATION_OTHER_TRANSPORTATION':  '🚗',
  // Travel
  'TRAVEL_FLIGHTS':                       '✈️',
  'TRAVEL_LODGING':                       '🏨',
  'TRAVEL_RENTAL_CARS':                   '🚗',
  'TRAVEL_OTHER_TRAVEL':                  '✈️',
  // Entertainment
  'ENTERTAINMENT_MUSIC_AND_AUDIO':        '🎵',
  'ENTERTAINMENT_TV_AND_MOVIES':          '📺',
  'ENTERTAINMENT_VIDEO_GAMES':            '🎮',
  'ENTERTAINMENT_CASINOS_AND_GAMBLING':   '🎰',
  'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS': '🎡',
  'ENTERTAINMENT_OTHER_ENTERTAINMENT':    '🎬',
  // General Merchandise
  'GENERAL_MERCHANDISE_SUPERSTORES':                  '🛒',
  'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES':          '📦',
  'GENERAL_MERCHANDISE_ELECTRONICS':                  '🖥️',
  'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES':     '👕',
  'GENERAL_MERCHANDISE_DEPARTMENT_STORES':            '🏬',
  'GENERAL_MERCHANDISE_DISCOUNT_STORES':              '🛍️',
  'GENERAL_MERCHANDISE_CONVENIENCE_STORES':           '🏪',
  'GENERAL_MERCHANDISE_SPORTING_GOODS':               '⚽',
  'GENERAL_MERCHANDISE_PET_SUPPLIES':                 '🐾',
  'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS':    '📚',
  'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES':          '🎁',
  'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE':    '🛍️',
  // Home Improvement
  'HOME_IMPROVEMENT_FURNITURE':            '🛋️',
  'HOME_IMPROVEMENT_HARDWARE':             '🔨',
  'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE':'🔧',
  'HOME_IMPROVEMENT_SECURITY':             '🔒',
  'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT':'🏠',
  // Medical
  'MEDICAL_DENTAL_CARE':                  '🦷',
  'MEDICAL_EYE_CARE':                     '👓',
  'MEDICAL_PHARMACIES_AND_SUPPLEMENTS':   '💊',
  'MEDICAL_PRIMARY_CARE':                 '🏥',
  'MEDICAL_VETERINARY_SERVICES':          '🐾',
  'MEDICAL_NURSING_CARE':                 '🏥',
  'MEDICAL_OTHER_MEDICAL':                '💊',
  // Personal Care
  'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS':'💪',
  'PERSONAL_CARE_HAIR_AND_BEAUTY':        '💅',
  'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING':'👕',
  'PERSONAL_CARE_OTHER_PERSONAL_CARE':    '💅',
  // General Services
  'GENERAL_SERVICES_AUTOMOTIVE':          '🔧',
  'GENERAL_SERVICES_EDUCATION':           '📚',
  'GENERAL_SERVICES_INSURANCE':           '🛡️',
  'GENERAL_SERVICES_ONLINE_SERVICES':     '💻',
  'GENERAL_SERVICES_CHILDCARE':           '👶',
  'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING': '📊',
  'GENERAL_SERVICES_PRINTING_AND_SHIPPING':'📦',
  'GENERAL_SERVICES_STORAGE':             '📦',
  'GENERAL_SERVICES_OTHER_GENERAL_SERVICES':'🔧',
  // Rent & Utilities
  'RENT_AND_UTILITIES_RENT':              '🏠',
  'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY':'💡',
  'RENT_AND_UTILITIES_INTERNET_AND_CABLE':'🌐',
  'RENT_AND_UTILITIES_TELEPHONE':         '📱',
  'RENT_AND_UTILITIES_WATER':             '💧',
  'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT': '🗑️',
  'RENT_AND_UTILITIES_OTHER_UTILITIES':   '🏠',
  // Income
  'INCOME_WAGES':                         '💰',
  'INCOME_DIVIDENDS':                     '📈',
  'INCOME_TAX_REFUND':                    '💰',
  'INCOME_INTEREST_EARNED':               '📈',
  'INCOME_OTHER_INCOME':                  '💰',
  // Government
  'GOVERNMENT_AND_NON_PROFIT_DONATIONS':           '❤️',
  'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS':'🏛️',
  'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT':         '🏛️',
};

// Small list only for services Plaid broadly lumps as "GENERAL_SERVICES_ONLINE_SERVICES"
// or other imprecise categories — AI tools, streaming, big tech subscriptions
const MERCHANT_ICONS = {
  'anthropic': '🤖', 'openai': '🤖', 'chatgpt': '🤖',
  'netflix': '📺', 'disney': '🏰', 'crave': '📺', 'hulu': '📺', 'hbo': '📺',
  'spotify': '🎵', 'tidal': '🎵', 'apple music': '🎵',
  'youtube': '🎬', 'twitch': '🎮',
  'apple': '🍎', 'icloud': '🍎',
  'google': '🔍',
  'microsoft': '🖥️', 'xbox': '🎮',
  'adobe': '🎨', 'dropbox': '☁️', 'slack': '💬', 'zoom': '📹', 'github': '💻',
  'doordash': '🛵', 'uber eats': '🛵', 'skipthedishes': '🛵', 'instacart': '🛒',
  'amazon': '📦',
};

const getMerchantIcon = (name) => {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [keyword, icon] of Object.entries(MERCHANT_ICONS)) {
    if (lower.includes(keyword)) return icon;
  }
  return null;
};

// --- Routes ---

// GET /pockets — fetch active (non-archived) pockets, filtered by userId if provided
// app.get/post/put/delete registers a handler for that HTTP method + URL path
// req (request)  = everything the client sent (body, URL params, query string, headers)
// res (response) = the object we use to send something back to the client
app.get('/pockets', async (req, res) => {
  const { userId } = req.query; // req.query = URL query string params, e.g. /pockets?userId=abc
  // Supabase uses a query builder that chains like SQL:
  // .from() picks the table, .select() picks columns (* = all), .eq()/.is() add WHERE conditions
  // await executes the query and returns { data, error }
  let query = supabase.from('pockets').select('*').is('archived_at', null);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;

  // HTTP status codes: 200 = OK (default), 201 = Created, 400 = bad request, 500 = server error
  if (error) return res.status(500).json({ error: error.message });
  res.json(data); // res.json() sends the JS object back as JSON and ends the request
});

// POST /pockets — insert a new pocket; sources = [{ pocketId, amount }] transfers balance from those pockets
app.post('/pockets', async (req, res) => {
  const { name, balance, color, income_percent, userId, sources } = req.body; // req.body = the JSON payload sent in the request body

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
  const id = req.params.id; // req.params captures path segments prefixed with : — /pockets/123 → id = '123'
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
  if (currentSettings?.method_id) {
    await supabase.from('user_settings')
      .update({ previous_method_id: currentSettings.method_id })
      .eq('user_id', userId);
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
  const restoredMethodId = settings?.previous_method_id || targetMethodId || null;
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

// GET /transactions/pocket/:pocketId — fetch all transactions for a specific pocket.
// Two sources combine here:
//   1. Direct transactions (expenses / all-in-one income) whose pocket_id is this pocket,
//      shown at their full amount.
//   2. Distributed-income shares: this pocket's slice of a split paycheck, pulled from
//      transaction_allocations and shown at the allocated amount (not the full paycheck).
app.get('/transactions/pocket/:pocketId', async (req, res) => {
  const { pocketId } = req.params;

  // 1. Direct transactions
  const { data: direct, error: directErr } = await supabase
    .from('transactions').select('*').eq('pocket_id', pocketId);
  if (directErr) return res.status(500).json({ error: directErr.message });

  // 2. This pocket's allocation shares
  const { data: allocs, error: allocErr } = await supabase
    .from('transaction_allocations').select('*').eq('pocket_id', pocketId);
  if (allocErr) return res.status(500).json({ error: allocErr.message });

  let allocTxs = [];
  if (allocs && allocs.length > 0) {
    const txIds = allocs.map(a => a.transaction_id);
    const { data: txs } = await supabase.from('transactions').select('*').in('id', txIds);
    const txById = Object.fromEntries((txs || []).map(t => [t.id, t]));
    // Build a display row using the paycheck's merchant/date/icon but this pocket's share amount.
    // The id is prefixed so it can't collide with a real transaction id in the list's keys.
    allocTxs = allocs
      .map(a => {
        const t = txById[a.transaction_id];
        return t ? { ...t, amount: a.amount, id: `alloc-${a.id}` } : null;
      })
      .filter(Boolean);
  }

  res.json([...(direct || []), ...allocTxs]);
});

// GET /transactions/inbox — fetch unassigned transactions for this user.
// Distributed income has a null pocket_id too, so we also exclude distributed=true
// to keep already-handled paychecks out of the inbox.
app.get('/transactions/inbox', async (req, res) => {
  const { userId } = req.query;
  let query = supabase.from('transactions').select('*').is('pocket_id', null).eq('distributed', false);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /transactions/assign — assign a transaction to a pocket.
// Moves the transaction's amount from Unsorted into the target pocket,
// so the pocket total stays equal to the live bank balance.
app.post('/transactions/assign', async (req, res) => {
  const { transactionId, pocketId } = req.body;

  const { data: transaction, error: txError } = await supabase
    .from('transactions').select('amount, user_id').eq('id', transactionId).single();
  if (txError) return res.status(500).json({ error: txError.message });

  const { data: pocket, error: pocketError } = await supabase
    .from('pockets').select('balance').eq('id', pocketId).single();
  if (pocketError) return res.status(500).json({ error: pocketError.message });

  const { error: updateTxError } = await supabase
    .from('transactions').update({ pocket_id: pocketId }).eq('id', transactionId);
  if (updateTxError) return res.status(500).json({ error: updateTxError.message });

  // target pocket absorbs the signed amount (negative = spending reduces it, positive = income grows it)
  const { error: updatePocketError } = await supabase
    .from('pockets').update({ balance: pocket.balance + transaction.amount }).eq('id', pocketId);
  if (updatePocketError) return res.status(500).json({ error: updatePocketError.message });

  // Unsorted moves in the opposite direction — total stays the same
  const { data: unsorted } = await supabase
    .from('pockets').select('id, balance').eq('user_id', transaction.user_id).eq('is_unsorted', true).single();
  if (unsorted) {
    await supabase.from('pockets')
      .update({ balance: unsorted.balance - transaction.amount }).eq('id', unsorted.id);
  }

  res.json({ success: true });
});

// POST /transactions/assign-overflow — split an expense across two pockets.
// Primary absorbs what it has, overflow covers the rest. Both draw from Unsorted.
app.post('/transactions/assign-overflow', async (req, res) => {
  const { transactionId, primaryPocketId, overflowPocketId } = req.body;

  const { data: transaction, error: txError } = await supabase
    .from('transactions').select('amount, user_id').eq('id', transactionId).single();
  if (txError) return res.status(500).json({ error: txError.message });

  const { data: primaryPocket, error: primaryError } = await supabase
    .from('pockets').select('balance').eq('id', primaryPocketId).single();
  if (primaryError) return res.status(500).json({ error: primaryError.message });

  const { data: overflowPocket, error: overflowError } = await supabase
    .from('pockets').select('balance').eq('id', overflowPocketId).single();
  if (overflowError) return res.status(500).json({ error: overflowError.message });

  const txAmount = Math.abs(transaction.amount);
  const primaryCoverage = Math.min(primaryPocket.balance, txAmount);
  const overflowCoverage = txAmount - primaryCoverage;

  const { error: updateTxError } = await supabase
    .from('transactions').update({ pocket_id: primaryPocketId }).eq('id', transactionId);
  if (updateTxError) return res.status(500).json({ error: updateTxError.message });

  await supabase.from('pockets').update({ balance: primaryPocket.balance - primaryCoverage }).eq('id', primaryPocketId);
  await supabase.from('pockets').update({ balance: overflowPocket.balance - overflowCoverage }).eq('id', overflowPocketId);

  // Unsorted comes back up by the full transaction amount — it was holding it
  const { data: unsorted } = await supabase
    .from('pockets').select('id, balance').eq('user_id', transaction.user_id).eq('is_unsorted', true).single();
  if (unsorted) {
    await supabase.from('pockets').update({ balance: unsorted.balance + txAmount }).eq('id', unsorted.id);
  }

  res.json({ success: true, overflowAmount: overflowCoverage });
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
  const fields = { method_id: methodId };
  if (previousMethodId !== undefined) fields.previous_method_id = previousMethodId;

  // Use explicit insert-or-update instead of upsert so no unique constraint is needed
  const { data: existing, error: selectErr } = await supabase
    .from('user_settings').select('id').eq('user_id', userId).maybeSingle();
  let data, error;
  if (existing) {
    ({ data, error } = await supabase
      .from('user_settings').update(fields).eq('user_id', userId).select().single());
  } else {
    ({ data, error } = await supabase
      .from('user_settings').insert({ user_id: userId, ...fields }).select().single());
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

  // Mark the transaction as distributed (keeps it out of the inbox) and record the
  // per-pocket breakdown in transaction_allocations. We leave pocket_id null because
  // the money was split across several pockets, not owned by any single one — each
  // pocket's share is stored as its own allocation row instead.
  const { error: txErr } = await supabase
    .from('transactions').update({ distributed: true }).eq('id', transactionId);
  if (txErr) return res.status(500).json({ error: txErr.message });

  const allocationRows = distributions.map(d => ({
    transaction_id: transactionId, pocket_id: d.pocketId, amount: d.topUpAmount,
  }));
  const { error: allocErr } = await supabase.from('transaction_allocations').insert(allocationRows);
  if (allocErr) return res.status(500).json({ error: allocErr.message });

  // Subtract total distributed from Unsorted — income moved from Unsorted into named pockets
  const { data: txData } = await supabase.from('transactions').select('user_id').eq('id', transactionId).single();
  const totalDistributed = distributions.reduce((sum, d) => sum + d.topUpAmount, 0);
  const { data: unsorted } = await supabase
    .from('pockets').select('id, balance').eq('user_id', txData.user_id).eq('is_unsorted', true).single();
  if (unsorted) {
    await supabase.from('pockets').update({ balance: unsorted.balance - totalDistributed }).eq('id', unsorted.id);
  }

  res.json({ success: true });
});

// GET /plaid/status?userId=xxx — check if a user has a bank connected
app.get('/plaid/status', async (req, res) => {
  const { userId } = req.query;
  const { data, error } = await supabase
    .from('plaid_items')
    .select('item_id, needs_reconnect')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json({ connected: !!data, needsReconnect: data?.needs_reconnect || false });
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
      ? await supabase.from('plaid_items').update({ access_token: accessToken, item_id: itemId, needs_reconnect: false }).eq('user_id', userId)
      : await supabase.from('plaid_items').insert({ user_id: userId, access_token: accessToken, item_id: itemId, needs_reconnect: false });

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
    // Get the stored access token and connection date for this user
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('access_token, created_at')
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

    // Skip credit card payment transactions only — these appear on both the bank side (debit out)
    // and the credit card side (credit received). Filtering them prevents double-counting since
    // individual credit card purchases are tracked separately from the CC account.
    const plaidTransactions = response.data.transactions.filter(tx =>
      tx.personal_finance_category?.detailed !== 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'
    );

    // Convert Plaid's "YYYY-MM-DD" date to our "Mon D" format
    const formatPlaidDate = (isoDate) => {
      const d = new Date(isoDate + 'T12:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const toInsert = plaidTransactions.map(tx => ({
      merchant: tx.merchant_name || tx.name,
      amount: tx.amount * -1, // Plaid uses positive for debits, we use negative
      date: formatPlaidDate(tx.date),
      icon: getMerchantIcon(tx.merchant_name || tx.name)
        ?? DETAILED_CATEGORY_ICONS[tx.personal_finance_category?.detailed]
        ?? CATEGORY_ICONS[tx.personal_finance_category?.primary]
        ?? '💳',
      pocket_id: null,
      user_id: userId,
      plaid_transaction_id: tx.transaction_id,
    }));

    // Get existing transactions to avoid duplicates — check both plaid_transaction_id
    // and (merchant + amount + date) as a fallback for when Plaid assigns new IDs after reconnect
    const { data: existing } = await supabase
      .from('transactions')
      .select('plaid_transaction_id, merchant, amount, date')
      .eq('user_id', userId);

    // Only import transactions from the day the user connected their bank onwards.
    // This prevents old history from flooding the inbox — the initial bank balance
    // already reflects all past spending, so importing old transactions would double-count.
    const connectedAt = new Date(plaidItem.created_at);
    connectedAt.setHours(0, 0, 0, 0);
    const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const candidates = toInsert.filter(tx => {
      const [month, day] = tx.date.split(' ');
      if (MONTHS[month] === undefined) return true;
      const txDate = new Date(new Date().getFullYear(), MONTHS[month], parseInt(day, 10));
      return txDate >= connectedAt;
    });

    const existingIds = new Set((existing || []).filter(t => t.plaid_transaction_id).map(t => t.plaid_transaction_id));
    const existingFingerprints = new Set((existing || []).map(t => `${t.merchant}|${t.amount}|${t.date}`));

    const newTransactions = candidates.filter(tx => {
      if (existingIds.has(tx.plaid_transaction_id)) return false;
      if (existingFingerprints.has(`${tx.merchant}|${tx.amount}|${tx.date}`)) return false;
      return true;
    });

    if (newTransactions.length > 0) {
      const { error: insertError } = await supabase.from('transactions').insert(newTransactions);
      if (insertError) return res.status(500).json({ error: insertError.message });
    }

    // Peg Unsorted pocket to live balance every sync.
    // Unsorted = live bank balance − sum of all named pocket balances.
    // This means any gap caused by Plaid's feeds arriving at different speeds lands in
    // Unsorted, and pocket totals always equal the real bank balance.
    try {
      const balanceRes = await plaidClient.accountsGet({ access_token: plaidItem.access_token });
      const accounts = balanceRes.data.accounts;

      // Net position = chequing balance − credit card balance owed.
      // Credit card purchases reduce your true net worth immediately even though
      // the cash hasn't left your chequing account yet.
      const chequingBalance = accounts
        .filter(a => a.type === 'depository')
        .reduce((sum, a) => sum + (a.balances.current ?? 0), 0);
      const creditOwed = accounts
        .filter(a => a.type === 'credit')
        .reduce((sum, a) => sum + (a.balances.current ?? 0), 0);
      const liveBalance = Math.round((chequingBalance - creditOwed) * 100) / 100;

      const { data: allPockets } = await supabase
        .from('pockets').select('id, balance, is_unsorted').eq('user_id', userId).is('archived_at', null);

      let unsortedPocket = allPockets?.find(p => p.is_unsorted);
      if (!unsortedPocket) {
        const { data: created } = await supabase
          .from('pockets')
          .insert({ user_id: userId, name: 'Unsorted', color: '#4A5E78', balance: 0, is_unsorted: true })
          .select().single();
        unsortedPocket = created;
      }

      const namedTotal = Math.round(
        (allPockets || []).filter(p => !p.is_unsorted).reduce((sum, p) => sum + p.balance, 0) * 100
      ) / 100;

      await supabase.from('pockets')
        .update({ balance: Math.round((liveBalance - namedTotal) * 100) / 100 })
        .eq('id', unsortedPocket.id);
    } catch (e) {} // Non-fatal — sync still succeeded even if pegging fails

    res.json({ success: true, count: newTransactions.length });
  } catch (err) {
    // ITEM_LOGIN_REQUIRED is expected and handled — the bank connection expired and the user
    // needs to reconnect. Log a short line instead of the full error dump.
    if (err.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
      console.log('[sync] Bank connection expired — user needs to reconnect');
      await supabase.from('plaid_items').update({ needs_reconnect: true }).eq('user_id', userId);
      return res.status(400).json({ error: 'bank_login_required' });
    }
    // Anything else is genuinely unexpected — keep the full details for debugging.
    console.error('Plaid sync error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to sync transactions' });
  }
});

// POST /transactions/refresh-icons — re-assigns icons to all existing transactions using the latest merchant/category logic
app.post('/transactions/refresh-icons', async (req, res) => {
  const { userId } = req.body;
  const { data: txs, error } = await supabase.from('transactions').select('id, merchant').eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });

  let updated = 0;
  for (const tx of txs) {
    const icon = getMerchantIcon(tx.merchant) ?? '💳';
    await supabase.from('transactions').update({ icon }).eq('id', tx.id);
    updated++;
  }
  res.json({ success: true, updated });
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

// GET /reset-password — serves the password reset page linked from Supabase emails
app.get('/reset-password', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset Password — Pockets</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #0B1120; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #151F32; border-radius: 20px; padding: 28px; width: 100%; max-width: 400px; border: 1px solid rgba(255,255,255,0.07); }
    .logo { font-size: 28px; font-weight: 800; color: #00D4AA; margin-bottom: 8px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; color: #8899AA; margin-bottom: 24px; line-height: 1.5; }
    label { font-size: 12px; font-weight: 600; color: #8899AA; display: block; margin-bottom: 6px; }
    input { width: 100%; background: #1C2B45; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 16px; font-size: 14px; color: #fff; margin-bottom: 16px; }
    input.code { font-size: 24px; font-weight: 800; letter-spacing: 8px; text-align: center; }
    button { width: 100%; background: #00D4AA; color: #0B1120; border: none; border-radius: 14px; padding: 15px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 4px; }
    button:disabled { background: #1C2B45; color: #4A5E78; cursor: not-allowed; }
    .msg { font-size: 14px; margin-top: 16px; text-align: center; }
    .error { color: #FF5252; }
    .success { color: #00D4AA; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Pockets</div>

    <!-- Step 1: MFA verification -->
    <div id="mfaStep">
      <h1>Verify your identity</h1>
      <p>Enter the 6-digit code from your authenticator app to continue.</p>
      <label>Authenticator Code</label>
      <input type="number" id="mfaCode" class="code" placeholder="000000" maxlength="6" />
      <button id="mfaBtn" onclick="verifyMFA()">Verify</button>
      <div id="mfaMsg" class="msg"></div>
    </div>

    <!-- Step 2: New password -->
    <div id="passwordStep" class="hidden">
      <h1>Reset your password</h1>
      <p>Choose a new password for your account.</p>
      <label>New Password</label>
      <input type="password" id="password" placeholder="••••••••" />
      <label>Confirm Password</label>
      <input type="password" id="confirm" placeholder="••••••••" />
      <button id="pwBtn" onclick="resetPassword()">Update Password</button>
      <div id="pwMsg" class="msg"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@upabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script>
    const { createClient } = supabase;
    const client = createClient('${supabaseUrl}', '${supabaseKey}');

    let factorId = null;
    let challengeId = null;

    async function init() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        document.getElementById('mfaMsg').innerHTML = '<span class="error">Invalid or expired reset link. Please request a new one.</span>';
        document.getElementById('mfaBtn').disabled = true;
        return;
      }

      await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

      // Check if MFA is enrolled
      const { data: factors } = await client.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];

      if (totp) {
        factorId = totp.id;
        const { data: challenge } = await client.auth.mfa.challenge({ factorId });
        challengeId = challenge.id;
      } else {
        // No MFA — skip straight to password step
        showPasswordStep();
      }
    }

    async function verifyMFA() {
      const code = document.getElementById('mfaCode').value.trim();
      const msg = document.getElementById('mfaMsg');
      const btn = document.getElementById('mfaBtn');
      if (code.length !== 6) { msg.innerHTML = '<span class="error">Enter the 6-digit code.</span>'; return; }
      btn.disabled = true;
      btn.textContent = 'Verifying...';
      const { error } = await client.auth.mfa.verify({ factorId, challengeId, code });
      if (error) {
        msg.innerHTML = '<span class="error">Invalid code. Please try again.</span>';
        btn.disabled = false;
        btn.textContent = 'Verify';
      } else {
        showPasswordStep();
      }
    }

    function showPasswordStep() {
      document.getElementById('mfaStep').classList.add('hidden');
      document.getElementById('passwordStep').classList.remove('hidden');
    }

    async function resetPassword() {
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      const msg = document.getElementById('pwMsg');
      const btn = document.getElementById('pwBtn');
      if (password.length < 6) { msg.innerHTML = '<span class="error">Password must be at least 6 characters.</span>'; return; }
      if (password !== confirm) { msg.innerHTML = '<span class="error">Passwords do not match.</span>'; return; }
      btn.disabled = true;
      btn.textContent = 'Updating...';
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        msg.innerHTML = '<span class="error">' + error.message + '</span>';
        btn.disabled = false;
        btn.textContent = 'Update Password';
      } else {
        msg.innerHTML = '<span class="success">Password updated! You can now log in to Pockets.</span>';
        btn.textContent = 'Done';
      }
    }

    init();
  </script>
</body>
</html>`);
});

// Start the HTTP server and begin listening for requests on port 3000
// The callback runs once the server is ready — you'll see this message in the terminal
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
