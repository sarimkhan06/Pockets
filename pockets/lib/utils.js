// Utility functions shared across multiple screens.
// Keeping them here avoids duplicating the same logic everywhere.

// Month name → zero-based month index (Jan = 0, Dec = 11).
// Used to convert "May 26" strings into real Date objects for comparison.
const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

// Converts a date string like "May 26" into a JavaScript Date object.
// We assume the current year, which is fine since Plaid dates are recent.
// Returns null if the string doesn't match the expected format.
function parseTxDate(dateStr) {
  const [month, day] = dateStr.split(' ');
  if (MONTHS[month] === undefined) return null;
  return new Date(new Date().getFullYear(), MONTHS[month], parseInt(day, 10));
}

// Returns "Today", "Yesterday", or the original date string (e.g. "May 24").
// Used in transaction lists so recent dates are human-readable.
export function formatDate(dateStr) {
  const txDate = parseTxDate(dateStr);
  if (!txDate) return dateStr; // If we can't parse it, return it unchanged

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1); // Subtract 1 day from today

  // toDateString() gives "Thu May 26 2024" — comparing these ignores the time component
  if (txDate.toDateString() === today.toDateString()) return 'Today';
  if (txDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dateStr; // Anything older shows the original string, e.g. "May 20"
}

// Formats a number like 1234.5 into "1,234.50" (US currency format without the $ sign).
// The $ sign is added separately in JSX so we can style them independently.
export function formatCurrency(amount) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Returns a new sorted array with the most recent transaction first.
// The spread [...txList] creates a copy so we don't mutate the original array.
// Sorting by (db - da) means larger (more recent) dates come first.
export function sortTxNewestFirst(txList) {
  return [...txList].sort((a, b) => {
    const da = parseTxDate(a.date);
    const db = parseTxDate(b.date);
    if (!da || !db) return 0; // If either date is unparseable, treat them as equal
    return db - da; // Descending: newer dates first
  });
}
