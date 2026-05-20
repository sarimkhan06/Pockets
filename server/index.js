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

// GET /pockets — fetch all pockets from the database
app.get('/pockets', async (req, res) => {
  // supabase.from('pockets') = target the pockets table
  // .select('*') = get all columns
  const { data, error } = await supabase.from('pockets').select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /pockets — insert a new pocket into the database
app.post('/pockets', async (req, res) => {
  const { name, budget, color } = req.body;

  // .insert() adds a new row, .select() returns the newly created row
  const { data, error } = await supabase
    .from('pockets')
    .insert({ name, budget, spent: 0, color })
    .select()
    .single(); // .single() means we expect one row back, not an array

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /pockets/:id — delete a pocket by id
app.delete('/pockets/:id', async (req, res) => {
  const id = req.params.id; // uuid stays as a string, no parseInt needed

  // .delete() removes rows, .eq('id', id) means "where id equals this value"
  const { error } = await supabase.from('pockets').delete().eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /transactions — fetch all transactions from the database
app.get('/transactions', async (req, res) => {
  const { data, error } = await supabase.from('transactions').select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
