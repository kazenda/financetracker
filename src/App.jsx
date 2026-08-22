import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import localforage from 'localforage';
import {
  Settings, ChevronLeft, ChevronRight, CalendarDays,
  Wallet, PiggyBank, ShieldAlert, FileUp,
} from 'lucide-react';

import {
  C, INITIAL_ACCOUNTS, INITIAL_EXPENSE_CATEGORIES, INITIAL_INCOME_CATEGORIES,
  DEFAULT_SETTINGS, LOAN_CATEGORY, BACKUP_STALE_DAYS, STORE_KEYS,
} from './lib/constants';
import {
  currentMonthKey, monthKey, monthLabel, shiftMonth, todayISO, daysSince, formatIDR,
} from './lib/format';
import {
  monthTotals, monthFlow, categoryBreakdown, cashflowSeries, buildRecap, inMonth, netWorthSeries,
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
import ImportCsvModal from './components/ImportCsvModal';
import { csvToDrafts, accountIdFromFilename } from './lib/csv';
import { Toast } from './components/ui';

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
  const [csvDrafts, setCsvDrafts] = useState(null); // parsed rows awaiting review
  const [csvAccountGuess, setCsvAccountGuess] = useState('');
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
  const flow = useMemo(
    () => monthFlow(transactions, accounts, viewMonth),
    [transactions, accounts, viewMonth],
  );
  const breakdown = useMemo(() => categoryBreakdown(totals.txs, 'expense'), [totals.txs]);
  const incomeBreakdown = useMemo(() => categoryBreakdown(totals.txs, 'income'), [totals.txs]);
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
      setTransactions((prev) => prev.map((t) => {
        if (t.id !== editingTxId) return t;
        const merged = { ...t, ...data };
        // Turning a loan into a plain expense/income would otherwise leave its
        // settlement fields behind, where computeBalance keeps acting on them.
        if (merged.type !== 'loan') {
          delete merged.status;
          delete merged.settledAmount;
          delete merged.settledAccountId;
          delete merged.settledDate;
        }
        return merged;
      }));
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

  /**
   * A settled loan is two rows — the loan itself, and the row carrying the
   * difference between what was lent and what came back. They describe one
   * event, so deleting either one takes both, and Undo brings both back.
   * Without this the difference row survives as an orphan that keeps moving
   * the monthly totals for a loan that no longer exists.
   */
  const deleteTransaction = (tx) => {
    const loanId = tx.type === 'loan' ? tx.id : tx.loanId;
    const removed = loanId
      ? transactions.filter((t) => t.id === loanId || t.loanId === loanId)
      : [tx];
    const removedIds = new Set(removed.map((t) => t.id));

    setTransactions((prev) => prev.filter((t) => !removedIds.has(t.id)));
    if (removedIds.has(editingTxId)) setEditingTxId(null);

    notify(
      removed.length > 1 ? 'Loan and its settlement deleted.' : 'Transaction deleted.',
      {
        actionLabel: 'Undo',
        onAction: () => setTransactions((prev) => [
          ...removed,
          ...prev.filter((t) => !removedIds.has(t.id)),
        ]),
      },
    );
  };

  // --- Loans ---------------------------------------------------------------
  /**
   * Settling a loan records the repayment on the loan itself (which is what
   * moves the money), and posts only the *difference* as a real transaction.
   * That difference carries no accountId, so it lands in the monthly totals
   * and the category breakdown without double-counting any balance.
   *
   * `category`/`subcategory` come from the settle form and describe what the
   * difference actually was: who paid you the extra, or what the shortfall
   * was spent on. They fall back to the generic Loans label.
   */
  const settleLoan = (loan, {
    settledAmount, settledAccountId, settledDate, category, subcategory,
  }) => {
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
        category: category || LOAN_CATEGORY,
        subcategory: subcategory?.trim()
          || (difference > 0 ? loan.person : '')
          || 'Unspecified',
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

  /**
   * Puts a settled (or written-off) loan back to open and removes the row
   * holding its difference, so it can be settled again with the right numbers.
   *
   * This is the only way to correct a mistyped repayment: the settle form
   * lives on the Open Loans card, which a settled loan has already left.
   */
  const undoSettlement = (loan) => {
    const removed = transactions.filter((t) => t.loanId === loan.id);
    const removedIds = new Set(removed.map((t) => t.id));

    setTransactions((prev) => prev
      .filter((t) => !removedIds.has(t.id))
      .map((t) => {
        if (t.id !== loan.id) return t;
        const reopened = { ...t, status: 'open' };
        delete reopened.settledAmount;
        delete reopened.settledAccountId;
        delete reopened.settledDate;
        return reopened;
      }));

    notify(`${loan.person || 'That loan'} is open again — settle it with the right numbers.`, {
      actionLabel: 'Undo',
      onAction: () => setTransactions((prev) => [
        ...removed,
        ...prev.map((t) => (t.id === loan.id ? loan : t)),
      ]),
    });
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
  const downloadBackup = (filename) => {
    const data = { transactions, accounts, expenseCategories, incomeCategories, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    downloadBackup(`finance-backup-${todayISO()}.json`);
    setSettings((prev) => ({ ...prev, lastBackupAt: Date.now() }));
    notify('Backup downloaded.');
  };

  /**
   * A record missing `id` or a well-formed `date` breaks rendering everywhere
   * (inMonth, groupByDay). ErrorBoundary would catch the crash, but it is far
   * better never to let a bad file in. Reject it at the door instead.
   */
  const isValidTransaction = (t) => (
    t && typeof t === 'object'
    && typeof t.id === 'string'
    && typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
    && Number.isFinite(t.amount)
  );

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!Array.isArray(data.transactions)) throw new Error('missing transactions');

        const bad = data.transactions.filter((t) => !isValidTransaction(t)).length;
        if (bad > 0) {
          notify(`That backup has ${bad} damaged transaction${bad === 1 ? '' : 's'} — nothing was imported.`);
          return;
        }

        // Importing replaces everything and cannot be undone, so make the
        // trade explicit and put the current data safely on disk first.
        const confirmed = window.confirm(
          'Replace all data in this app?\n\n'
          + `Right now: ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}\n`
          + `This file: ${data.transactions.length} transaction${data.transactions.length === 1 ? '' : 's'}\n\n`
          + 'Your current data will be downloaded as a backup first. This cannot be undone.',
        );
        if (!confirmed) return;

        if (transactions.length > 0) {
          downloadBackup(`finance-before-import-${todayISO()}.json`);
        }

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

  // --- CSV statement import -----------------------------------------------
  const csvInputRef = useRef(null);

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const drafts = csvToDrafts(event.target.result);
      if (drafts.length === 0) {
        notify('No usable rows found — the CSV needs date and amount columns.');
        return;
      }
      // The filename doubles as the account id: "debitmandiri_agustus.csv"
      // pre-fills every row's account from the name match.
      setCsvAccountGuess(accountIdFromFilename(file.name, accounts));
      setCsvDrafts(drafts);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /**
   * Turns confirmed drafts into real transactions. Amount sign in the CSV
   * decides the type (positive = income, negative = expense) unless the user
   * overrode it to transfer/loan in the review modal.
   */
  const confirmCsvImport = (drafts) => {
    const imported = drafts.map((d) => ({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      type: d.type,
      amount: Math.abs(d.amount),
      accountId: d.accountId,
      toAccountId: d.type === 'transfer' ? d.toAccountId : undefined,
      person: d.type === 'loan' ? (d.person || 'Unknown').trim() : undefined,
      status: d.type === 'loan' ? 'open' : undefined,
      category: d.category || 'Uncategorised',
      subcategory: d.subcategory || '',
      date: d.date,
      note: d.note.trim(),
      tags: [],
    }));

    setTransactions((prev) => [...imported, ...prev]);
    setCsvDrafts(null);

    // Jump to the month most of the statement covers so the rows are visible.
    const monthCounts = imported.reduce((acc, t) => {
      acc[monthKey(t.date)] = (acc[monthKey(t.date)] || 0) + 1;
      return acc;
    }, {});
    const busiest = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0][0];
    if (busiest !== viewMonth) setViewMonth(busiest);

    notify(`Imported ${imported.length} transaction${imported.length === 1 ? '' : 's'} from CSV.`, {
      actionLabel: 'Undo',
      onAction: () => setTransactions((prev) => {
        const ids = new Set(imported.map((t) => t.id));
        return prev.filter((t) => !ids.has(t.id));
      }),
    });
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
          <button className="btn-icon" onClick={() => csvInputRef.current?.click()} aria-label="Import CSV bank statement" title="Import CSV bank statement">
            <FileUp size={18} />
          </button>
          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="grid-main">
        <div className="col col-overview">
          <Overview flow={flow} prevTotals={prevTotals} />

          <Loans
            transactions={transactions}
            accounts={accounts}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            onSettle={settleLoan}
            onWriteOff={writeOffLoan}
            onAddSubcategory={addSubcategory}
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
            incomeBreakdown={incomeBreakdown}
            cashflow={cashflow}
            totalExpense={totals.expense}
            totalIncome={totals.income}
            budgets={settings.budgets}
            onFilterCategory={(category, type) => {
              setFilters((f) => ({ ...f, q: category, type, scope: 'month' }));
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
          onUndoSettlement={undoSettlement}
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

      {csvDrafts && (
        <ImportCsvModal
          drafts={csvDrafts}
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          defaultAccountId={csvAccountGuess}
          onConfirm={confirmCsvImport}
          onClose={() => setCsvDrafts(null)}
          onAddSubcategory={addSubcategory}
        />
      )}

      <input type="file" ref={csvInputRef} onChange={handleCsvFile} accept=".csv,text/csv" style={{ display: 'none' }} />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
