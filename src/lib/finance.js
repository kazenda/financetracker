import { daysElapsedInMonth, lastDayOfMonth, percentDelta, shiftMonth } from './format.js';

/**
 * Balance = opening balance +/- every transaction touching the account.
 * Transfers leave one account and land in another, so they hit both sides.
 * Loans leave an account when made and return (possibly a different amount,
 * possibly nothing) when settled.
 *
 * `asOf` (an ISO date) rewinds the balance to what it was on that day, which
 * is how the net worth chart reconstructs history.
 */
export const computeBalance = (acc, transactions, asOf = null) =>
  transactions.reduce((bal, tx) => {
    if (asOf && tx.date > asOf) return bal;

    if (tx.type === 'loan') {
      let next = bal;
      if (tx.accountId === acc.id) next -= tx.amount;
      // Repayment only counts once it has actually happened.
      const repaid = tx.settledDate && (!asOf || tx.settledDate <= asOf);
      if (repaid && tx.settledAccountId === acc.id) next += (tx.settledAmount || 0);
      return next;
    }

    if (tx.type === 'transfer') {
      if (tx.accountId === acc.id) return bal - tx.amount;
      if (tx.toAccountId === acc.id) return bal + tx.amount;
      return bal;
    }

    if (tx.accountId !== acc.id) return bal;
    return tx.type === 'income' ? bal + tx.amount : bal - tx.amount;
  }, acc.openingBalance);

// --- Loans (money you fronted that is coming back) -------------------------

export const openLoans = (transactions) =>
  transactions
    .filter((t) => t.type === 'loan' && t.status === 'open')
    .sort((a, b) => (a.date < b.date ? -1 : 1));

export const outstandingTotal = (transactions) =>
  openLoans(transactions).reduce((s, t) => s + t.amount, 0);

/** Loans still unpaid on a given date — an asset, so net worth counts them. */
export const outstandingAt = (transactions, asOf) =>
  transactions
    .filter((t) => t.type === 'loan' && t.date <= asOf && (!t.settledDate || t.settledDate > asOf))
    .reduce((s, t) => s + t.amount, 0);

export const inMonth = (transactions, key) =>
  transactions.filter((t) => t.date.startsWith(key));

/** Transfers are money moving between your own pockets — never income or spending. */
export const sumType = (transactions, type) =>
  transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

export const monthTotals = (transactions, key) => {
  const txs = inMonth(transactions, key);
  const income = sumType(txs, 'income');
  const expense = sumType(txs, 'expense');
  return { txs, income, expense, net: income - expense };
};

/**
 * The month's change in spendable cash — what `net` alone gets wrong.
 *
 * Money moved into a savings pot or fronted as a loan leaves your pocket
 * without ever being an expense, so income − expense can read as a healthy
 * surplus in a month you actually ran a deficit. This subtracts both.
 *
 * Loans are counted by principal only — out when made, back when settled — so
 * this composes with `income`/`expense`, which already carry the settlement
 * difference row that `settleLoan` posts. Repayments need no special case, and
 * a write-off nets to zero in the month it is written off because its cash
 * already left in the month the loan was made.
 *
 * Caveat: income logged directly against a savings account (interest on a pot)
 * counts here as spendable. It is real income and usually small, but it is not
 * cash you can actually reach without a withdrawal.
 */
export const monthFlow = (transactions, accounts, key) => {
  const { income, expense, net, txs } = monthTotals(transactions, key);
  const isSavings = (id) => accounts.some((a) => a.id === id && a.kind === 'savings');

  let toSavings = 0;
  let lentOut = 0;

  for (const tx of txs) {
    // Only crossing the savings line matters. Moving between two spending
    // accounts — or between two pots — changes nothing about what you can spend.
    if (tx.type === 'transfer') {
      if (isSavings(tx.toAccountId) && !isSavings(tx.accountId)) toSavings += tx.amount;
      if (isSavings(tx.accountId) && !isSavings(tx.toAccountId)) toSavings -= tx.amount;
    }
    if (tx.type === 'loan') lentOut += tx.amount;
  }

  // Principal coming back belongs to the month it was repaid, which is often
  // not the month the loan was made — so this scans the whole list, not `txs`.
  for (const tx of transactions) {
    if (tx.type === 'loan' && tx.settledDate && tx.settledDate.startsWith(key)) {
      lentOut -= tx.amount;
    }
  }

  const used = expense + toSavings + lentOut;
  return {
    income,
    expense,
    net,
    toSavings,
    lentOut,
    surplus: net - toSavings - lentOut,
    usedShare: income > 0 ? (used / income) * 100 : 0,
  };
};

/**
 * Expense totals per category, with subcategory detail and share of total.
 * Built from the transactions themselves, so categories deleted from settings
 * still show their historical spending instead of vanishing.
 */
export const categoryBreakdown = (transactions) => {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const map = new Map();

  for (const tx of expenses) {
    const cat = tx.category || 'Uncategorized';
    if (!map.has(cat)) map.set(cat, { name: cat, value: 0, count: 0, subs: new Map() });
    const entry = map.get(cat);
    entry.value += tx.amount;
    entry.count += 1;
    const sub = tx.subcategory || 'Unspecified';
    entry.subs.set(sub, (entry.subs.get(sub) || 0) + tx.amount);
  }

  return [...map.values()]
    .map((e) => ({
      ...e,
      share: total ? (e.value / total) * 100 : 0,
      subs: [...e.subs.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.value - a.value);
};

/** Income/expense per month for the 6 months ending at `endKey`. */
export const cashflowSeries = (transactions, endKey, months = 6) => {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonth(endKey, -i);
    const { income, expense } = monthTotals(transactions, key);
    const [y, m] = key.split('-').map(Number);
    out.push({
      key,
      label: new Date(y, m - 1, 1).toLocaleString('id-ID', { month: 'short' }),
      income,
      expense,
    });
  }
  return out;
};

/**
 * Net worth split into its parts for the last N months ending at `endKey`:
 * spendable cash, savings, and money lent out but not yet repaid. Fronting
 * cash for someone moves value between bands rather than destroying it.
 */
export const netWorthSeries = (transactions, accounts, endKey, months = 12) => {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonth(endKey, -i);
    const asOf = lastDayOfMonth(key);

    let liquid = 0;
    let savings = 0;
    for (const acc of accounts) {
      const bal = computeBalance(acc, transactions, asOf);
      if (acc.kind === 'savings') savings += bal; else liquid += bal;
    }
    const lent = outstandingAt(transactions, asOf);

    const [y, m] = key.split('-').map(Number);
    out.push({
      key,
      label: new Date(y, m - 1, 1).toLocaleString('id-ID', { month: 'short' }),
      liquid,
      savings,
      lent,
      total: liquid + savings + lent,
    });
  }
  return out;
};

/**
 * Everything the month-recap card needs: totals, movement against the month
 * before it, the categories that did the damage, and the single biggest hit.
 */
export const buildRecap = (transactions, key) => {
  const { txs, income, expense, net } = monthTotals(transactions, key);
  const prevKey = shiftMonth(key, -1);
  const prev = monthTotals(transactions, prevKey);

  const expenses = txs.filter((t) => t.type === 'expense');
  const biggest = expenses.reduce(
    (max, t) => (!max || t.amount > max.amount ? t : max),
    null,
  );

  const days = daysElapsedInMonth(key) || 1;
  const prevBreakdown = new Map(
    categoryBreakdown(prev.txs).map((c) => [c.name, c.value]),
  );

  return {
    key,
    prevKey,
    income,
    expense,
    net,
    txCount: txs.length,
    avgPerDay: expense / days,
    hasData: txs.length > 0,
    hasBaseline: prev.txs.length > 0,
    incomeDelta: percentDelta(income, prev.income),
    expenseDelta: percentDelta(expense, prev.expense),
    netDelta: net - prev.net,
    biggest,
    topCategories: categoryBreakdown(expenses).slice(0, 3).map((c) => ({
      ...c,
      delta: percentDelta(c.value, prevBreakdown.get(c.name) || 0),
    })),
  };
};

/** Free-text + facet filtering for the transaction log. */
export const filterTransactions = (transactions, { q, accountId, type, tag }, accounts) => {
  const needle = (q || '').trim().toLowerCase();
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '';

  return transactions.filter((tx) => {
    if (type && type !== 'all' && tx.type !== type) return false;
    if (accountId && accountId !== 'all'
      && tx.accountId !== accountId
      && tx.toAccountId !== accountId
      && tx.settledAccountId !== accountId) return false;
    if (tag && !(tx.tags || []).includes(tag)) return false;
    if (!needle) return true;

    const haystack = [
      tx.category, tx.subcategory, tx.note, tx.person,
      accountName(tx.accountId), accountName(tx.toAccountId),
      ...(tx.tags || []),
      String(tx.amount),
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(needle);
  });
};

/** Newest first, grouped into days, with each day's own in/out totals. */
export const groupByDay = (transactions) => {
  const map = new Map();
  for (const tx of transactions) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date).push(tx);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, txs]) => ({
      date,
      txs: [...txs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      income: sumType(txs, 'income'),
      expense: sumType(txs, 'expense'),
    }));
};

/**
 * A loan and the row carrying its settlement difference are one event, so when
 * they fall on the same day the log draws them as a single card. On different
 * days they stay where they are — each belongs to the month its money actually
 * counts in — and the log points them at each other by date instead.
 *
 * Takes one day's transactions, returns one entry per card to draw.
 */
export const pairSameDayLoans = (dayTransactions) => {
  const ids = new Set(dayTransactions.map((t) => t.id));
  return dayTransactions
    // Drawn inside its loan's card instead, so skip the standalone copy.
    .filter((tx) => !(tx.loanId && ids.has(tx.loanId)))
    .map((tx) => ({
      tx,
      settlement: tx.type === 'loan'
        ? dayTransactions.find((t) => t.loanId === tx.id) || null
        : null,
    }));
};

export const allTags = (transactions) => {
  const set = new Set();
  for (const tx of transactions) for (const t of tx.tags || []) set.add(t);
  return [...set].sort();
};
