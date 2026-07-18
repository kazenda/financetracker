import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import localforage from 'localforage';
import {
  Settings, ChevronLeft, ChevronRight, CalendarDays,
  Wallet, PiggyBank, ShieldAlert,
} from 'lucide-react';

import {
  C, INITIAL_ACCOUNTS, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES,
  DEFAULT_SETTINGS, LOAN_CATEGORY, BACKUP_STALE_DAYS,
} from './lib/constants';
import {
  currentMonthKey, monthKey, monthLabel, shiftMonth, todayISO, daysSince, formatIDR,
} from './lib/format';
import {
  monthTotals, categoryBreakdown, cashflowSeries, buildRecap, inMonth, netWorthSeries,
} from './lib/finance';

import Overview from './components/Overview';
import BalancesCard from './components/BalancesCard';
import Loans from './components/Loans';
import Analytics from './components/Analytics';
import NetWorth from './components/NetWorth';
import Recap from './components/Recap';
import TransactionForm from './components/TransactionForm';
import TransactionLog from './components/TransactionLog';
import SettingsModal from './components/SettingsModal';
import { Toast } from './components/ui';

const STORE_KEYS = {
  transactions: 'transactions_v2',
  accounts: 'accounts_v2',
  expenseCategories: 'expenseCategories',
  incomeCategories: 'incomeCategories',
  settings: 'settings',
};

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [expenseCategories, setExpenseCategories] = useState(INITIAL_EXPENSE_CATEGORIES);
  const [incomeCategories, setIncomeCategories] = useState(INITIAL_INCOME_CATEGORIES);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Guards the save effect: without it, the first render writes empty state
  // over whatever is in storage before the async load has come back.
  const [isLoaded, setIsLoaded] = useState(false);

  const [viewMonth, setViewMonth] = useState(currentMonthKey);
  const [editingTxId, setEditingTxId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({
    q: '', accountId: 'all', type: 'all', tag: null, scope: 'month',
  });

  const fileInputRef = useRef(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const notify = (message, extra = {}) => setToast({ message, ...extra });

  // --- Persistence ---------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const [tx, acc, expCat, incCat, saved] = await Promise.all(
          Object.values(STORE_KEYS).map((k) => localforage.getItem(k)),
        );
        if (tx) setTransactions(tx);
        // Accounts saved before savings pots existed have no `kind`.
        if (acc) setAccounts(acc.map((a) => ({ kind: 'spending', ...a })));
        if (expCat) setExpenseCategories(expCat);
        if (incCat) setIncomeCategories(incCat);
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      } catch {
        notify('Could not read saved data.');
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localforage.setItem(STORE_KEYS.transactions, transactions);
    localforage.setItem(STORE_KEYS.accounts, accounts);
    localforage.setItem(STORE_KEYS.expenseCategories, expenseCategories);
    localforage.setItem(STORE_KEYS.incomeCategories, incomeCategories);
    localforage.setItem(STORE_KEYS.settings, settings);
  }, [isLoaded, transactions, accounts, expenseCategories, incomeCategories, settings]);

  // --- Derived -------------------------------------------------------------
  const totals = useMemo(() => monthTotals(transactions, viewMonth), [transactions, viewMonth]);
  const prevTotals = useMemo(
    () => monthTotals(transactions, shiftMonth(viewMonth, -1)),
    [transactions, viewMonth],
  );
  const breakdown = useMemo(() => categoryBreakdown(totals.txs), [totals.txs]);
  const cashflow = useMemo(() => cashflowSeries(transactions, viewMonth), [transactions, viewMonth]);
  const recap = useMemo(
    () => buildRecap(transactions, shiftMonth(viewMonth, -1)),
    [transactions, viewMonth],
  );
  const monthTransactions = useMemo(() => inMonth(transactions, viewMonth), [transactions, viewMonth]);
  const editingTx = useMemo(
    () => transactions.find((t) => t.id === editingTxId) || null,
    [transactions, editingTxId],
  );
  const netWorth = useMemo(
    () => netWorthSeries(transactions, accounts, viewMonth),
    [transactions, accounts, viewMonth],
  );

  const spendingAccounts = useMemo(() => accounts.filter((a) => a.kind !== 'savings'), [accounts]);
  const savingsAccounts = useMemo(() => accounts.filter((a) => a.kind === 'savings'), [accounts]);

  const isCurrentMonth = viewMonth === currentMonthKey();
  const backupAge = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;
  const backupStale = transactions.length > 0
    && (backupAge === null || backupAge >= BACKUP_STALE_DAYS);

  // --- Transactions --------------------------------------------------------
  const saveTransaction = (data) => {
    if (editingTxId) {
      setTransactions((prev) => prev.map((t) => (t.id === editingTxId ? { ...t, ...data } : t)));
      setEditingTxId(null);
      notify('Transaction updated.');
    } else {
      const tx = { ...data, id: crypto.randomUUID(), createdAt: Date.now() };
      setTransactions((prev) => [tx, ...prev]);
      // Jump to the month the entry landed in, so it doesn't silently vanish.
      const key = monthKey(tx.date);
      if (key !== viewMonth) {
        setViewMonth(key);
        notify(`Saved to ${monthLabel(key, { month: 'long', year: 'numeric' })}.`);
      }
    }
  };

  const deleteTransaction = (tx) => {
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    if (editingTxId === tx.id) setEditingTxId(null);
    notify('Transaction deleted.', {
      actionLabel: 'Undo',
      onAction: () => setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]),
    });
  };

  // --- Loans ---------------------------------------------------------------
  /**
   * Settling a loan records the repayment on the loan itself (which is what
   * moves the money), and posts only the *difference* as a real transaction.
   * That difference carries no accountId, so it lands in the monthly totals
   * and the category breakdown without double-counting any balance.
   */
  const settleLoan = (loan, { settledAmount, settledAccountId, settledDate }) => {
    const difference = settledAmount - loan.amount;

    setTransactions((prev) => {
      const updated = prev.map((t) => (
        t.id === loan.id
          ? { ...t, status: 'settled', settledAmount, settledAccountId, settledDate }
          : t
      ));

      if (difference === 0) return updated;

      const adjustment = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        loanId: loan.id,
        type: difference > 0 ? 'income' : 'expense',
        amount: Math.abs(difference),
        accountId: null, // the loan record already moved the cash
        category: LOAN_CATEGORY,
        subcategory: loan.person || 'Loan',
        date: settledDate,
        note: difference > 0
          ? `${loan.person} repaid more than lent`
          : `${loan.person} repaid less than lent`,
        tags: [],
      };
      return [adjustment, ...updated];
    });

    notify(
      difference === 0
        ? `${loan.person} settled up.`
        : difference > 0
          ? `Settled — ${formatIDR(difference)} logged as income.`
          : `Settled — ${formatIDR(-difference)} logged as spending.`,
    );
  };

  const writeOffLoan = (loan) => {
    const date = todayISO();
    setTransactions((prev) => [
      {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        loanId: loan.id,
        type: 'expense',
        amount: loan.amount,
        accountId: null,
        category: LOAN_CATEGORY,
        subcategory: loan.person || 'Loan',
        date,
        note: `Written off — ${loan.person} did not repay`,
        tags: [],
      },
      ...prev.map((t) => (
        t.id === loan.id
          ? { ...t, status: 'written-off', settledAmount: 0, settledAccountId: null, settledDate: date }
          : t
      )),
    ]);
    notify(`Wrote off ${loan.person} — logged as spending.`);
  };

  // --- Accounts ------------------------------------------------------------
  const addAccount = (name, openingBalance, kind = 'spending') => {
    setAccounts((prev) => [...prev, { id: crypto.randomUUID(), name, openingBalance, kind }]);
  };

  const updateAccount = (id, patch) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const deleteAccount = (id) => {
    const account = accounts.find((a) => a.id === id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    if (filters.accountId === id) setFilters((f) => ({ ...f, accountId: 'all' }));
    notify(`Deleted ${account?.name}.`, {
      actionLabel: 'Undo',
      onAction: () => setAccounts((prev) => (prev.some((a) => a.id === id) ? prev : [...prev, account])),
    });
  };

  // --- Categories ----------------------------------------------------------
  const categorySetter = (kind) => (kind === 'income' ? setIncomeCategories : setExpenseCategories);

  const addCategory = (kind, name) => {
    categorySetter(kind)((prev) => (prev[name] ? prev : { ...prev, [name]: [] }));
  };

  /** Renaming rewrites matching transactions and budgets so history stays linked. */
  const renameCategory = (kind, from, to) => {
    if (from === to || !to) return;
    categorySetter(kind)((prev) => {
      if (prev[to]) return prev; // name already taken
      return Object.fromEntries(
        Object.entries(prev).map(([k, v]) => (k === from ? [to, v] : [k, v])),
      );
    });
    setTransactions((prev) => prev.map((t) => (
      t.type === kind && t.category === from ? { ...t, category: to } : t
    )));
    if (kind === 'expense') {
      setSettings((prev) => {
        if (!prev.budgets?.[from]) return prev;
        const budgets = { ...prev.budgets, [to]: prev.budgets[from] };
        delete budgets[from];
        return { ...prev, budgets };
      });
    }
  };

  const deleteCategory = (kind, name) => {
    const setter = categorySetter(kind);
    let removed;
    setter((prev) => {
      removed = prev[name];
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (kind === 'expense') {
      setSettings((prev) => {
        if (!prev.budgets?.[name]) return prev;
        const budgets = { ...prev.budgets };
        delete budgets[name];
        return { ...prev, budgets };
      });
    }
    // Past transactions keep their label — the breakdown reads from the
    // transactions themselves, so nothing disappears from history.
    notify(`Removed "${name}" from the picker.`, {
      actionLabel: 'Undo',
      onAction: () => setter((prev) => ({ ...prev, [name]: removed || [] })),
    });
  };

  const addSubcategory = (kind, category, sub) => {
    categorySetter(kind)((prev) => {
      const subs = prev[category] || [];
      if (subs.includes(sub)) return prev;
      return { ...prev, [category]: [...subs, sub] };
    });
  };

  const deleteSubcategory = (kind, category, sub) => {
    categorySetter(kind)((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((s) => s !== sub),
    }));
  };

  // --- Import / export -----------------------------------------------------
  const handleExport = () => {
    const data = { transactions, accounts, expenseCategories, incomeCategories, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSettings((prev) => ({ ...prev, lastBackupAt: Date.now() }));
    notify('Backup downloaded.');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!Array.isArray(data.transactions)) throw new Error('missing transactions');
        setTransactions(data.transactions);
        setAccounts(data.accounts?.length ? data.accounts : INITIAL_ACCOUNTS);
        setExpenseCategories(data.expenseCategories || INITIAL_EXPENSE_CATEGORIES);
        setIncomeCategories(data.incomeCategories || INITIAL_INCOME_CATEGORIES);
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
        notify(`Imported ${data.transactions.length} transactions.`);
      } catch {
        notify('That file is not a valid backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // let the same file be re-selected
  };

  const actions = {
    addAccount, updateAccount, deleteAccount,
    addCategory, renameCategory, deleteCategory, addSubcategory, deleteSubcategory,
  };

  return (
    <div className="app">
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 28, gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <h1 className="serif h1-title" style={{
            fontSize: 36, fontWeight: 600, color: C.textBright, margin: 0, letterSpacing: '-0.02em',
          }}>
            Finance Tracker
          </h1>

          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button
              className="btn-icon" style={{ padding: 5 }} aria-label="Previous month"
              onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{
              color: C.muted, fontSize: 12, letterSpacing: '0.08em',
              textTransform: 'uppercase', minWidth: 130, textAlign: 'center',
            }}>
              {monthLabel(viewMonth)}
            </span>
            <button
              className="btn-icon" style={{ padding: 5 }} aria-label="Next month"
              disabled={isCurrentMonth}
              onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            >
              <ChevronRight size={15} />
            </button>
            {!isCurrentMonth && (
              <button
                className="chip" onClick={() => setViewMonth(currentMonthKey())}
                style={{ marginLeft: 4 }}
              >
                <CalendarDays size={10} /> This month
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {backupStale && (
            <button
              className="chip"
              onClick={() => setIsSettingsOpen(true)}
              style={{ color: C.accent, borderColor: 'rgba(201,150,74,0.35)', padding: '6px 10px' }}
              title="Your data lives only in this browser — export a backup"
            >
              <ShieldAlert size={12} />
              {backupAge === null ? 'Never backed up' : `Backed up ${backupAge}d ago`}
            </button>
          )}
          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="grid-main">
        <div className="col col-overview">
          <Overview totals={totals} prevTotals={prevTotals} settings={settings} />

          <Loans
            transactions={transactions}
            accounts={accounts}
            onSettle={settleLoan}
            onWriteOff={writeOffLoan}
          />

          <BalancesCard
            title="Accounts"
            icon={<Wallet size={15} />}
            accounts={spendingAccounts}
            transactions={transactions}
            onUpdateAccount={updateAccount}
            hint="Balance = opening + transactions. Manage accounts in Settings."
            emptyHint="No spending accounts yet — add one in Settings."
          />

          <BalancesCard
            title="Savings"
            icon={<PiggyBank size={15} />}
            accounts={savingsAccounts}
            transactions={transactions}
            onUpdateAccount={updateAccount}
            hint="Transfer money in; log growth as income into the account."
            emptyHint="Tag an account as Savings in Settings to track it here."
          />
        </div>

        <div className="col col-analytics">
          <Analytics
            breakdown={breakdown}
            cashflow={cashflow}
            totalExpense={totals.expense}
            budgets={settings.budgets}
            onFilterCategory={(category) => {
              setFilters((f) => ({ ...f, q: category, type: 'expense', scope: 'month' }));
            }}
          />
          <NetWorth series={netWorth} />
          <Recap recap={recap} onJumpToMonth={setViewMonth} />
        </div>

        <TransactionLog
          transactions={transactions}
          monthTransactions={monthTransactions}
          accounts={accounts}
          viewMonth={viewMonth}
          editingTxId={editingTxId}
          filters={filters}
          onFiltersChange={setFilters}
          onEdit={(tx) => setEditingTxId(tx.id)}
          onDelete={deleteTransaction}
        >
          <TransactionForm
            key={editingTxId || 'new'}
            accounts={accounts}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            editingTx={editingTx}
            onSave={saveTransaction}
            onCancelEdit={() => setEditingTxId(null)}
            onAddSubcategory={addSubcategory}
          />
        </TransactionLog>
      </div>

      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSettingsChange={setSettings}
          accounts={accounts}
          transactions={transactions}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          actions={actions}
          fileInputRef={fileInputRef}
          onExport={handleExport}
          onImport={handleImport}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
