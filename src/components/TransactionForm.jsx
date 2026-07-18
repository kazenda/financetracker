import { useEffect, useRef, useState } from 'react';
import { Plus, Check, Tag, ArrowRight } from 'lucide-react';
import { C, QUICK_AMOUNTS, TRANSFER_CATEGORY, LOAN_CATEGORY } from '../lib/constants';
import { formatAmountInput, parseAmountInput, formatIDRShort, todayISO } from '../lib/format';

const blankForm = (accounts, categories) => {
  const firstCat = Object.keys(categories)[0] || '';
  return {
    type: 'expense',
    amount: '',
    accountId: accounts[0]?.id || '',
    toAccountId: accounts[1]?.id || '',
    category: firstCat,
    subcategory: categories[firstCat]?.[0] || '',
    date: todayISO(),
    note: '',
    tags: '',
    person: '',
  };
};

export default function TransactionForm({
  accounts, expenseCategories, incomeCategories, editingTx,
  onSave, onCancelEdit, onAddSubcategory,
}) {
  // App remounts this component (via `key`) when the edit target changes, so
  // the initialiser is the whole sync story — no state-syncing effect needed.
  const [form, setForm] = useState(() => (
    editingTx
      ? {
        type: editingTx.type,
        amount: formatAmountInput(String(editingTx.amount)),
        accountId: editingTx.accountId,
        toAccountId: editingTx.toAccountId || accounts.find((a) => a.id !== editingTx.accountId)?.id || '',
        category: editingTx.category,
        subcategory: editingTx.subcategory,
        date: editingTx.date,
        note: editingTx.note || '',
        tags: (editingTx.tags || []).join(', '),
        person: editingTx.person || '',
      }
      : blankForm(accounts, expenseCategories)
  ));
  const [error, setError] = useState('');
  const [newSub, setNewSub] = useState(null); // null = inline sub input hidden
  const amountRef = useRef(null);

  const categories = form.type === 'income' ? incomeCategories : expenseCategories;
  const isTransfer = form.type === 'transfer';
  const isLoan = form.type === 'loan';

  // Focusing on mount is a DOM effect, not state sync.
  useEffect(() => {
    if (editingTx) amountRef.current?.focus();
  }, [editingTx]);

  const reset = () => {
    setForm((prev) => ({
      ...blankForm(accounts, prev.type === 'income' ? incomeCategories : expenseCategories),
      type: prev.type,
      accountId: prev.accountId,
      date: prev.date, // keep the date — backfilling a day at a time is common
    }));
    setError('');
  };

  const changeType = (type) => {
    const cats = type === 'income' ? incomeCategories : expenseCategories;
    const firstCat = Object.keys(cats)[0] || '';
    const fixedLabel = { transfer: TRANSFER_CATEGORY, loan: LOAN_CATEGORY }[type];
    setForm((prev) => ({
      ...prev,
      type,
      category: fixedLabel || firstCat,
      subcategory: fixedLabel || (cats[firstCat]?.[0] || ''),
      toAccountId: prev.toAccountId || accounts.find((a) => a.id !== prev.accountId)?.id || '',
    }));
    setError('');
  };

  const changeCategory = (name) => {
    setForm((prev) => ({ ...prev, category: name, subcategory: categories[name]?.[0] || '' }));
  };

  const commitNewSub = () => {
    const value = (newSub || '').trim();
    if (!value) { setNewSub(null); return; }
    onAddSubcategory(form.type, form.category, value);
    setForm((prev) => ({ ...prev, subcategory: value }));
    setNewSub(null);
  };

  const bumpAmount = (delta) => {
    setForm((prev) => ({ ...prev, amount: formatAmountInput(String(parseAmountInput(prev.amount) + delta)) }));
    amountRef.current?.focus();
  };

  const submit = (e) => {
    e.preventDefault();
    const amount = parseAmountInput(form.amount);

    if (amount <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (!form.accountId) { setError('Pick an account.'); return; }
    if (isTransfer && form.accountId === form.toAccountId) {
      setError('Transfer needs two different accounts.'); return;
    }
    if (isLoan && !form.person.trim()) { setError('Who is this for?'); return; }

    const fixedLabel = { transfer: TRANSFER_CATEGORY, loan: LOAN_CATEGORY }[form.type];

    onSave({
      type: form.type,
      amount,
      accountId: form.accountId,
      toAccountId: isTransfer ? form.toAccountId : undefined,
      person: isLoan ? form.person.trim() : undefined,
      status: isLoan ? 'open' : undefined,
      category: fixedLabel || form.category,
      subcategory: fixedLabel || form.subcategory,
      date: form.date,
      note: form.note.trim(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });

    if (!editingTx) reset();
  };

  const movesSideways = isTransfer || isLoan; // neither counts as income or spending
  const accentColor = movesSideways ? C.blueBright : (form.type === 'income' ? C.greenBright : C.redBright);
  const accentBg = movesSideways ? 'rgba(74,110,158,0.15)'
    : (form.type === 'income' ? 'rgba(90,138,106,0.15)' : 'rgba(158,90,90,0.15)');
  const accentBorder = movesSideways ? 'rgba(74,110,158,0.3)'
    : (form.type === 'income' ? 'rgba(90,138,106,0.3)' : 'rgba(158,90,90,0.3)');

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 14, flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
          {editingTx ? 'Edit Transaction' : 'Log Transaction'}
        </span>
        {editingTx && (
          <button
            onClick={() => { onCancelEdit(); reset(); }}
            style={{ background: 'none', border: 'none', fontSize: 11, color: C.muted, textDecoration: 'underline' }}
          >
            Cancel
          </button>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        {[['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer'], ['loan', 'Loan']].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`type-btn ${form.type === value ? `active-${value}` : ''}`}
            aria-pressed={form.type === value}
            onClick={() => changeType(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <input
            ref={amountRef}
            className={`input-base ${error && parseAmountInput(form.amount) <= 0 ? 'invalid' : ''}`}
            inputMode="numeric"
            placeholder="Amount"
            aria-label="Amount in rupiah"
            value={form.amount}
            onChange={(e) => { setForm({ ...form, amount: formatAmountInput(e.target.value) }); setError(''); }}
          />
          <input
            type="date"
            className="input-base"
            style={{ colorScheme: 'dark' }}
            aria-label="Date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map((amt) => (
            <button key={amt} type="button" className="chip" onClick={() => bumpAmount(amt)}>
              +{formatIDRShort(amt)}
            </button>
          ))}
          {parseAmountInput(form.amount) > 0 && (
            <button
              type="button" className="chip"
              onClick={() => setForm({ ...form, amount: '' })}
            >
              clear
            </button>
          )}
        </div>

        {isTransfer ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center' }}>
            <select
              className="input-base" aria-label="From account"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ArrowRight size={14} style={{ color: C.muted }} />
            <select
              className="input-base" aria-label="To account"
              value={form.toAccountId}
              onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        ) : isLoan ? (
          <>
            <select
              className="input-base" aria-label="Paid from"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>Paid from {a.name}</option>)}
            </select>
            <input
              className={`input-base ${error && !form.person.trim() ? 'invalid' : ''}`}
              placeholder="Who owes you back? (e.g. Mom)"
              aria-label="Who owes you back"
              value={form.person}
              onChange={(e) => { setForm({ ...form, person: e.target.value }); setError(''); }}
            />
          </>
        ) : (
          <>
            <select
              className="input-base" aria-label="Account"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
            >
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <select
                className="input-base" aria-label="Category"
                value={form.category}
                onChange={(e) => changeCategory(e.target.value)}
              >
                {Object.keys(categories).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                {newSub === null ? (
                  <>
                    <select
                      className="input-base" style={{ paddingRight: 28 }} aria-label="Subcategory"
                      value={form.subcategory}
                      onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    >
                      {(categories[form.category] || []).map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setNewSub('')}
                      aria-label={`Add subcategory to ${form.category}`}
                      title={`Add subcategory to ${form.category}`}
                      style={{
                        position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: C.accent, display: 'flex', padding: 2,
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </>
                ) : (
                  <input
                    className="input-base"
                    placeholder={`New in ${form.category}`}
                    aria-label={`New subcategory in ${form.category}`}
                    value={newSub}
                    autoFocus
                    onChange={(e) => setNewSub(e.target.value)}
                    onBlur={commitNewSub}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitNewSub(); }
                      if (e.key === 'Escape') setNewSub(null);
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}

        <input
          className="input-base" placeholder="Note (optional)" aria-label="Note"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Tag size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input
              className="input-base" style={{ paddingLeft: 26 }}
              placeholder="Tags (comma separated)" aria-label="Tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: editingTx ? 'rgba(201,150,74,0.15)' : accentBg,
              color: editingTx ? C.accent : accentColor,
              border: `1px solid ${editingTx ? 'rgba(201,150,74,0.3)' : accentBorder}`,
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}
          >
            {editingTx ? <><Check size={14} /> Update</> : <><Plus size={14} /> Save</>}
          </button>
        </div>

        {error && <p role="alert" style={{ fontSize: 11, color: C.redBright, margin: 0 }}>{error}</p>}
      </form>
    </div>
  );
}
