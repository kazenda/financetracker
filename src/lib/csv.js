// Minimal RFC-4180-ish CSV parser. Bank exports quote fields that contain
// commas ("Pembayaran QR ke KETAN SUSU TEMBALANG., BN"), so splitting on \n
// and , is not enough — quotes have to be honoured character by character.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } // escaped quote
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f.trim() !== '')) rows.push(row); // drop blank lines
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  // final field when the file does not end with a newline
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

/**
 * Turns raw CSV rows into draft transactions for the import modal.
 * Expects a header row naming `date`, `description` and `amount` columns
 * (any order). Positive amounts are money in, negative money out.
 */
export function csvToDrafts(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    date: header.indexOf('date'),
    description: header.indexOf('description'),
    amount: header.indexOf('amount'),
  };
  if (idx.date === -1 || idx.amount === -1) return [];

  return rows.slice(1).map((cells, i) => ({
    key: `row-${i}`,
    date: cells[idx.date]?.trim() || '',
    description: (idx.description !== -1 ? cells[idx.description] : '')?.trim() || '',
    amount: Number(cells[idx.amount]),
  })).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && Number.isFinite(d.amount) && d.amount !== 0);
}

/**
 * Guesses the account from the CSV filename. "debitmandiri_agustus.csv"
 * matches "Debit Mandiri" because the name's word "mandiri" appears inside
 * the filename — concatenated ("debitmandiri") or separated ("mandiri_aug")
 * both work. Returns '' when nothing matches.
 */
export function accountIdFromFilename(filename, accounts) {
  const stem = String(filename || '').replace(/\.[^.]+$/, '').toLowerCase();
  if (!stem) return '';

  const scored = accounts
    .map((acc) => {
      const hits = acc.name
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w && stem.includes(w)).length;
      return { acc, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits); // most name-words found wins

  return scored[0]?.acc.id || '';
}

/**
 * Initial review rows for a freshly parsed CSV. Used by App when a file is
 * chosen; lives here (not in the modal) so modal stays a pure component.
 */
export function buildDraftRows(drafts, accounts, defaultAccountId = '') {
  return drafts.map((d) => ({
    ...d,
    type: d.amount > 0 ? 'income' : 'expense',
    accountId: defaultAccountId || accounts[0]?.id || '',
    category: '',
    subcategory: '',
    note: d.description,
    skip: false,
  }));
}
