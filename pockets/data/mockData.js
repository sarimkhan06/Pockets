export const pockets = [
  { id: 1, name: 'Rent',      budget: 1500, spent: 1500, color: '#FF5252' },
  { id: 2, name: 'Groceries', budget: 400,  spent: 230,  color: '#00D4AA' },
  { id: 3, name: 'Gym',       budget: 50,   spent: 50,   color: '#448AFF' },
  { id: 4, name: 'Dining',    budget: 200,  spent: 180,  color: '#FF9F43' },
  { id: 5, name: 'Savings',   budget: 500,  spent: 200,  color: '#B39DDB' },
];

export const transactions = [
  { id: 1,  merchant: 'Whole Foods',   amount: -45.20,  date: 'May 12', pocketId: 2, icon: '🛒' },
  { id: 2,  merchant: 'Netflix',       amount: -15.99,  date: 'May 11', pocketId: 4, icon: '🎬' },
  { id: 3,  merchant: 'Salary',        amount: 3000.00, date: 'May 10', pocketId: null, icon: '💼' },
  { id: 4,  merchant: 'Shell Gas',     amount: -52.40,  date: 'May 9',  pocketId: null, icon: '⛽' },
  { id: 5,  merchant: 'Planet Fitness',amount: -25.00,  date: 'May 8',  pocketId: 3, icon: '💪' },
  { id: 6,  merchant: 'Chipotle',      amount: -18.50,  date: 'May 8',  pocketId: 4, icon: '🌯' },
  { id: 7,  merchant: 'Amazon',        amount: -67.99,  date: 'May 7',  pocketId: null, icon: '📦' },
  { id: 8,  merchant: 'Spotify',       amount: -9.99,   date: 'May 6',  pocketId: 4, icon: '🎵' },
  { id: 9,  merchant: 'TD Bank',       amount: -1500,   date: 'May 1',  pocketId: 1, icon: '🏠' },
  { id: 10, merchant: 'Costco',        amount: -112.40, date: 'Apr 30', pocketId: 2, icon: '🛒' },
];

// Transactions that just came in and haven't been assigned to a pocket yet
export const inboxTransactions = [
  { id: 11, merchant: 'Shell Gas',  amount: -52.40,  date: 'Today',     icon: '⛽' },
  { id: 12, merchant: 'Amazon',     amount: -67.99,  date: 'Yesterday', icon: '📦' },
  { id: 13, merchant: 'E-Transfer', amount: 150.00,  date: 'Yesterday', icon: '💸' },
];
