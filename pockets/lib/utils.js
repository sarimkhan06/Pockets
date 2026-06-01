const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

// Parses "May 26" into a Date object (assumes current year)
function parseTxDate(dateStr) {
  const [month, day] = dateStr.split(' ');
  if (MONTHS[month] === undefined) return null;
  return new Date(new Date().getFullYear(), MONTHS[month], parseInt(day, 10));
}

// Returns "Today", "Yesterday", or the original string (e.g. "May 24")
export function formatDate(dateStr) {
  const txDate = parseTxDate(dateStr);
  if (!txDate) return dateStr;

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (txDate.toDateString() === today.toDateString()) return 'Today';
  if (txDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dateStr;
}

export function formatCurrency(amount) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Sorts an array of transaction objects newest-first using their date field
export function sortTxNewestFirst(txList) {
  return [...txList].sort((a, b) => {
    const da = parseTxDate(a.date);
    const db = parseTxDate(b.date);
    if (!da || !db) return 0;
    return db - da;
  });
}
