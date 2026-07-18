const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const PLAIN = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export const formatIDR = (amount) => IDR.format(Number(amount) || 0);

/** Compact form for chart axes: 1.5jt, 250rb, 800. */
export const formatIDRShort = (amount) => {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}rb`;
  return `${sign}${Math.round(abs)}`;
};

/** Digits typed by the user -> "1.500.000" for display in the amount field. */
export const formatAmountInput = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits ? PLAIN.format(Number(digits)) : '';
};

/** "1.500.000" -> 1500000 */
export const parseAmountInput = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

// --- Dates. All local-time: toISOString() is UTC and rolls the date over
// early evening / late night in WIB, which mis-files transactions by a day.
export const toISODate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const todayISO = () => toISODate(new Date());

export const monthKey = (date = new Date()) => toISODate(date).slice(0, 7);

export const currentMonthKey = () => monthKey(new Date());

/** Shift a "YYYY-MM" key by n months. */
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

export const monthLabel = (key, opts = { month: 'long', year: 'numeric' }) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('id-ID', opts);
};

export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

/** "2026-07" -> "2026-07-31", for as-of balance snapshots. */
export const lastDayOfMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return toISODate(new Date(y, m, 0));
};

export const daysSince = (timestamp) =>
  Math.floor((Date.now() - timestamp) / 86_400_000);

/** Days of the month that have actually happened (for fair daily averages). */
export const daysElapsedInMonth = (key) => {
  const now = new Date();
  if (key === monthKey(now)) return now.getDate();
  if (key > monthKey(now)) return 0;
  return daysInMonth(key);
};

/** "2026-08-10" -> "10 Agu", for compact references to another day. */
export const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

/** "Today" / "Yesterday" / "Sen, 14 Jul" for day group headers. */
export const dayLabel = (iso) => {
  if (iso === todayISO()) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === toISODate(y)) return 'Yesterday';
  const [yy, mm, dd] = iso.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
};

export const percentDelta = (current, previous) => {
  if (!previous) return current ? null : 0; // null = no baseline to compare against
  return ((current - previous) / Math.abs(previous)) * 100;
};
