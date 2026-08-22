import { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { C, TRANSFER_CATEGORY, LOAN_CATEGORY } from '../lib/constants';
import { formatIDR, shortDate } from '../lib/format';
import { Modal } from './ui';

/**
 * Review screen for a bank-statement CSV import. Rows are controlled from App
 * (which also persists them), so closing the modal — or the browser — keeps
 * every categorisation; only Discard throws the session away.
 * Rows sharing a description get an "apply to all" shortcut so recurring
 * merchants only need categorising once.
 */
export default function ImportCsvModal({
  rows, onRowsChange, accounts, expenseCategories, incomeCategories,
  onConfirm, onClose, onDiscard, onAddSubcategory,
}) {
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');

  /** Empty bounds are open-ended: only the filled side filters. */
  const outOfRange = (r) => (
    (range.from && r.date < range.from) || (range.to && r.date > range.to)
  );

  const rangeExclusionReason = (date, r) => {
    if (r.from && date < r.from) return `Before ${shortDate(r.from)}`;
    if (r.to && date > r.to) return `After ${shortDate(r.to)}`;
    return 'Outside the selected range';
  };

  const included = rows.filter((r) => !r.skip && !outOfRange(r));
  const categories = (type) => (type === 'income' ? incomeCategories : expenseCategories);

  const repeatedDescriptions = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => counts.set(r.description, (counts.get(r.description) || 0) + 1));
    return new Set([...counts].filter(([, n]) => n > 1).map(([d]) => d));
  }, [rows]);

  const patchRow = (key, patch) => {
    onRowsChange(rows.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      if (patch.type && patch.type !== r.type) {
        // Switching type resets the picker to the right category list.
        if (patch.type === 'transfer' || patch.type === 'loan') {
          next.category = { transfer: TRANSFER_CATEGORY, loan: LOAN_CATEGORY }[patch.type];
          next.subcategory = '';
          next.toAccountId = next.toAccountId
            || accounts.find((a) => a.id !== next.accountId)?.id || '';
        } else {
          const cats = categories(patch.type);
          next.category = Object.keys(cats)[0] || '';
          next.subcategory = cats[next.category]?.[0] || '';
        }
      }
      return next;
    }));
    setError('');
  };

  /** Apply this row's type/category/account to every row with the same description. */
  const applyToAll = (row) => {
    onRowsChange(rows.map((r) => (
      r.description === row.description && r.key !== row.key
        ? { ...r, type: row.type, category: row.category, subcategory: row.subcategory, accountId: row.accountId }
        : r
    )));
  };

  const confirm = () => {
    if (included.length === 0) { onClose(); return; }
    if (included.some((r) => !r.accountId)) {
      setError('Pick an account for every row you want to import.');
      return;
    }
    onConfirm(included);
  };

  return (
    <Modal title={`Import CSV — ${included.length} of ${rows.length} rows`} onClose={onClose}>
      <p style={{ fontSize: 12, color: C.muted, margin: '-12px 0 10px', lineHeight: 1.6 }}>
        Your progress is saved automatically — close this any time and pick up
        where you left off via the import button.
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '8px 12px', marginBottom: 12,
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
      }}>
        <span style={{ fontSize: 12, color: C.muted }}>Only import between</span>
        <input
          type="date" className="input-base" style={{ colorScheme: 'dark' }}
          aria-label="Range start date"
          value={range.from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
        />
        <span style={{ fontSize: 12, color: C.muted }}>and</span>
        <input
          type="date" className="input-base" style={{ colorScheme: 'dark' }}
          aria-label="Range end date"
          value={range.to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
        />
        {(range.from || range.to) && (
          <button
            className="chip"
            onClick={() => setRange({ from: '', to: '' })}
            title="Clear the range and include every row again"
          >
            clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row) => (
          <RowEditor
            key={row.key}
            row={row}
            accounts={accounts}
            categories={categories(row.type)}
            repeated={repeatedDescriptions.has(row.description)}
            outOfRange={outOfRange(row)}
            excludedReason={rangeExclusionReason(row.date, range)}
            onChange={(patch) => patchRow(row.key, patch)}
            onApplyToAll={() => applyToAll(row)}
            onToggleSkip={() => patchRow(row.key, { skip: !row.skip })}
            onAddSubcategory={(sub) => row.category && onAddSubcategory(row.type, row.category, sub)}
          />
        ))}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 12, color: C.redBright, margin: '12px 0 0' }}>{error}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
        <button
          className="chip" onClick={onDiscard}
          title="Throw away this import session and everything categorised so far"
          style={{ color: C.redBright, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Trash2 size={12} /> Discard
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="chip" onClick={onClose}>Finish later</button>
          <button
            onClick={confirm}
            disabled={included.length === 0}
            style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: 'rgba(90,138,106,0.15)', color: C.greenBright,
              border: '1px solid rgba(90,138,106,0.3)',
              display: 'flex', alignItems: 'center', gap: 4,
              opacity: included.length === 0 ? 0.5 : 1,
            }}
          >
            <Check size={14} />
            Import {included.length} transaction{included.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RowEditor({
  row, accounts, categories, repeated, outOfRange, excludedReason,
  onChange, onApplyToAll, onToggleSkip, onAddSubcategory,
}) {
  // Local state for the inline "new subcategory" input, like TransactionForm.
  const [newSub, setNewSub] = useState(null);
  const isTransfer = row.type === 'transfer';
  const isLoan = row.type === 'loan';
  const isIncluded = !row.skip && !outOfRange;

  const commitNewSub = () => {
    const value = (newSub || '').trim();
    if (!value || !row.category) { setNewSub(null); return; }
    onAddSubcategory(value);
    onChange({ subcategory: value });
    setNewSub(null);
  };

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '10px 12px', opacity: isIncluded ? 1 : 0.45,
      background: C.bg,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span title={row.description} style={{
          fontSize: 12, color: C.text, flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.date.slice(5)} · {row.description}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: row.amount > 0 ? C.greenBright : C.redBright,
          flexShrink: 0,
        }}>
          {formatIDR(row.amount)}
        </span>
        <button
          className="chip" onClick={onToggleSkip} aria-pressed={row.skip}
          title={row.skip ? 'Include this row' : 'Skip this row'}
          style={{ flexShrink: 0 }}
        >
          {row.skip ? 'include' : 'skip'}
        </button>
      </div>

      {!isIncluded && (
        <p style={{ fontSize: 11, color: C.faint, margin: '4px 0 0' }}>
          {row.skip ? 'Skipped — will not be imported.' : `${excludedReason} — will not be imported.`}
        </p>
      )}

      {isIncluded && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
            <select
              className="input-base" aria-label="Type"
              value={row.type}
              onChange={(e) => onChange({ type: e.target.value })}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
              <option value="loan">Loan</option>
            </select>

            {isTransfer ? (
              <>
                <select
                  className="input-base" aria-label="From account"
                  value={row.accountId}
                  onChange={(e) => onChange({ accountId: e.target.value })}
                >
                  <option value="" disabled>From…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select
                  className="input-base" aria-label="To account"
                  value={row.toAccountId || ''}
                  onChange={(e) => onChange({ toAccountId: e.target.value })}
                >
                  <option value="" disabled>To…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </>
            ) : (
              <>
                <select
                  className="input-base" aria-label="Account"
                  value={row.accountId}
                  onChange={(e) => onChange({ accountId: e.target.value })}
                >
                  <option value="" disabled>Account…</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {isLoan ? (
                  <input
                    className="input-base"
                    placeholder="Who owes you?"
                    aria-label="Who owes you back"
                    value={row.person || ''}
                    onChange={(e) => onChange({ person: e.target.value })}
                  />
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select
                      className="input-base" style={{ paddingRight: 26 }} aria-label="Category"
                      value={row.category}
                      onChange={(e) => onChange({ category: e.target.value, subcategory: categories[e.target.value]?.[0] || '' })}
                    >
                      <option value="" disabled>Category…</option>
                      {Object.keys(categories).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    {!newSub && row.category && (
                      <button
                        type="button"
                        onClick={() => setNewSub('')}
                        aria-label={`Add subcategory to ${row.category}`}
                        title={`Add subcategory to ${row.category}`}
                        style={{
                          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: C.accent, display: 'flex', padding: 2,
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!isTransfer && !isLoan && newSub !== null && (
            <input
              className="input-base" style={{ marginTop: 6 }} autoFocus
              placeholder={`New in ${row.category}`}
              aria-label={`New subcategory in ${row.category}`}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onBlur={commitNewSub}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitNewSub(); }
                if (e.key === 'Escape') setNewSub(null);
              }}
            />
          )}

          {!isTransfer && !isLoan && (
            <select
              className="input-base" style={{ marginTop: 6 }} aria-label="Subcategory"
              value={row.subcategory}
              disabled={!row.category || newSub !== null}
              onChange={(e) => onChange({ subcategory: e.target.value })}
            >
              <option value="">Subcategory…</option>
              {(categories[row.category] || []).map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          )}

          {isLoan && (
            <p style={{ fontSize: 10, color: C.muted, margin: '4px 0 0' }}>
              Imports as an open loan — settle it from the Open Loans card as usual.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: repeated ? '1fr auto' : '1fr', gap: 6, marginTop: 6 }}>
            <input
              className="input-base"
              placeholder="Note" aria-label="Note"
              value={row.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
            {repeated && (
              <button
                className="chip" onClick={onApplyToAll}
                title={`Apply this categorisation to all "${row.description}" rows`}
                style={{ whiteSpace: 'nowrap' }}
              >
                apply to all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
