// Load environment variables from .env file into process.env
require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Connect to Supabase using the URL and key from .env
// This is our connection to the database — all queries go through this client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --- Routes ---

// GET /pockets — fetch pockets, filtered by userId if provided
app.get('/pockets', async (req, res) => {
  const { userId } = req.query;
  let query = supabase.from('pockets').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /pockets — insert a new pocket into the database
app.post('/pockets', async (req, res) => {
  const { name, balance, color, income_percent, userId } = req.body;

  const { data, error } = await supabase
    .from('pockets')
    .insert({ name, balance: balance ?? 0, color, income_percent: income_percent ?? null, user_id: userId ?? null })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /pockets/:id — update a pocket's name, balance, color, or income_percent
app.put('/pockets/:id', async (req, res) => {
  const id = req.params.id;
  const { name, balance, color, income_percent } = req.body;

  const updates = { name, color };
  if (balance !== undefined) updates.balance = balance;
  if (income_percent !== undefined) updates.income_percent = income_percent;

  const { data, error } = await supabase
    .from('pockets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /pockets/user/:userId — delete all pockets for a user (used when retaking the quiz)
app.delete('/pockets/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { error } = await supabase.from('pockets').delete().eq('user_id', userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /pockets/:id — delete a pocket by id
app.delete('/pockets/:id', async (req, res) => {
  const id = req.params.id; // uuid stays as a string, no parseInt needed

  // .delete() removes rows, .eq('id', id) means "where id equals this value"
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
    const { data: userPockets } = await supabase.from('pockets').select('id').eq('user_id', userId);
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
  const { userId, methodId } = req.body;

  // upsert = insert if not exists, update if it does
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, method_id: methodId }, { onConflict: 'user_id' })
    .select()
    .single();

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

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
