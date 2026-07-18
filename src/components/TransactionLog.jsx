import { useMemo, useState } from 'react';
import { Search, X, Pencil, Trash2, Tag, ChevronRight, ArrowRight } from 'lucide-react';
import { C } from '../lib/constants';
import { formatIDR, dayLabel, monthLabel } from '../lib/format';
import { filterTransactions, groupByDay, allTags } from '../lib/finance';
import { EmptyState } from './ui';

const TYPE_BADGE = {
  income: { label: 'IN', color: C.greenBright, bg: 'rgba(90,138,106,0.12)' },
  expense: { label: 'OUT', color: C.redBright, bg: 'rgba(158,90,90,0.12)' },
  transfer: { label: 'MOVE', color: C.blueBright, bg: 'rgba(74,110,158,0.12)' },
  loan: { label: 'LOAN', color: C.accent, bg: 'rgba(201,150,74,0.12)' },
};

const LOAN_STATUS = {
  open: { label: 'open', color: C.accent },
  settled: { label: 'repaid', color: C.greenBright },
  'written-off': { label: 'written off', color: C.redBright },
};

function TransactionRow({ tx, accounts, isEditing, onEdit, onDelete, onTagClick }) {
  const badge = TYPE_BADGE[tx.type] || TYPE_BADGE.expense;
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || 'Unknown';
  const isLoan = tx.type === 'loan';
  // Settlement differences carry no account — the loan record moved the money.
  const isSettlement = Boolean(tx.loanId);
  const sign = tx.type === 'income' ? '+' : (tx.type === 'transfer' || isLoan ? '' : '−');
  const amountColor = tx.type === 'income' ? C.greenBright
    : (tx.type === 'transfer' ? C.blueBright : (isLoan ? C.accent : C.textBright));

  return (
    <div
      className="card tx-card"
      style={{ padding: '12px 14px', transition: 'border-color 0.15s', borderColor: isEditing ? C.accent : C.border }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              padding: '2px 6px', borderRadius: 3, background: badge.bg, color: badge.color,
            }}>{badge.label}</span>

            {tx.type === 'transfer' ? (
              <span style={{ fontSize: 12, color: C.text, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {accountName(tx.accountId)}
                <ArrowRight size={11} style={{ color: C.muted }} />
                {accountName(tx.toAccountId)}
              </span>
            ) : isLoan ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tx.person || 'Someone'}</span>
                <span style={{ fontSize: 11, color: LOAN_STATUS[tx.status]?.color || C.muted }}>
                  · {LOAN_STATUS[tx.status]?.label || tx.status}
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tx.category}</span>
                <span style={{ fontSize: 12, color: C.muted }}>· {tx.subcategory}</span>
              </>
            )}
          </div>

          {isLoan && tx.status === 'settled' && (
            <p style={{ fontSize: 11, color: C.faint, margin: '2px 0 0' }}>
              {accountName(tx.accountId)} → repaid {formatIDR(tx.settledAmount || 0)} into {accountName(tx.settledAccountId)}
            </p>
          )}
          {isLoan && tx.status !== 'settled' && (
            <p style={{ fontSize: 11, color: C.faint, margin: '2px 0 0' }}>Paid from {accountName(tx.accountId)}</p>
          )}
          {isSettlement && (
            <p style={{ fontSize: 11, color: C.faint, margin: '2px 0 0' }}>Loan settlement difference</p>
          )}
          {!isLoan && !isSettlement && tx.type !== 'transfer' && (
            <p style={{ fontSize: 11, color: C.faint, margin: '2px 0 0' }}>{accountName(tx.accountId)}</p>
          )}
          {tx.note && (
            <p style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', margin: '3px 0 0' }}>"{tx.note}"</p>
          )}
          {tx.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
              {tx.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className="chip"
                  style={{ fontSize: 10, padding: '1px 7px' }}
                  title={`Filter by #${tag}`}
                >
                  <Tag size={8} /> {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: amountColor, margin: 0 }}>
            {sign}{formatIDR(tx.amount)}
          </p>
        </div>
      </div>

      <div className="tx-actions" style={{
        display: 'flex', justifyContent: 'flex-end', gap: 16,
        marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => onEdit(tx)} className="btn-ghost"
          style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={() => onDelete(tx)} className="btn-ghost btn-danger"
          style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

export default function TransactionLog({
  transactions, monthTransactions, accounts, viewMonth,
  editingTxId, filters, onFiltersChange, onEdit, onDelete, children,
}) {
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());

  const scoped = filters.scope === 'all' ? transactions : monthTransactions;
  const filtered = useMemo(
    () => filterTransactions(scoped, filters, accounts),
    [scoped, filters, accounts],
  );
  const days = useMemo(() => groupByDay(filtered), [filtered]);
  const tags = useMemo(() => allTags(scoped), [scoped]);

  const toggleDay = (date) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const allCollapsed = days.length > 0 && days.every((d) => collapsedDays.has(d.date));
  const toggleAll = () => {
    setCollapsedDays(allCollapsed ? new Set() : new Set(days.map((d) => d.date)));
  };

  const set = (patch) => onFiltersChange({ ...filters, ...patch });
  const hasActiveFilter = filters.q || filters.accountId !== 'all' || filters.type !== 'all' || filters.tag;

  return (
    <div className="col col-log">
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Transactions</span>
        {days.length > 0 && (
          <button
            onClick={toggleAll}
            style={{ background: 'none', border: 'none', fontSize: 10, color: C.muted, letterSpacing: '0.08em', padding: 0 }}
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>

      {children}

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input
            className="input-base"
            style={{ paddingLeft: 30, paddingRight: filters.q ? 30 : 10 }}
            placeholder="Search notes, categories, tags, amounts…"
            aria-label="Search transactions"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
          />
          {filters.q && (
            <button
              onClick={() => set({ q: '' })} aria-label="Clear search" className="btn-ghost"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <select
            className="input-base" style={{ fontSize: 12 }} aria-label="Filter by account"
            value={filters.accountId} onChange={(e) => set({ accountId: e.target.value })}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            className="input-base" style={{ fontSize: 12 }} aria-label="Filter by type"
            value={filters.type} onChange={(e) => set({ type: e.target.value })}
          >
            <option value="all">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="loan">Loan</option>
          </select>
          <select
            className="input-base" style={{ fontSize: 12, maxWidth: 130 }} aria-label="Filter by period"
            value={filters.scope} onChange={(e) => set({ scope: e.target.value })}
          >
            <option value="month">{monthLabel(viewMonth, { month: 'short', year: 'numeric' })}</option>
            <option value="all">All time</option>
          </select>
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {tags.slice(0, 12).map((tag) => (
              <button
                key={tag}
                className={`chip ${filters.tag === tag ? 'active' : ''}`}
                onClick={() => set({ tag: filters.tag === tag ? null : tag })}
              >
                <Tag size={8} /> {tag}
              </button>
            ))}
          </div>
        )}

        {hasActiveFilter && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.muted }}>
              {filtered.length} match{filtered.length === 1 ? '' : 'es'}
            </span>
            <button
              onClick={() => set({ q: '', accountId: 'all', type: 'all', tag: null })}
              style={{ background: 'none', border: 'none', fontSize: 11, color: C.accent, padding: 0 }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Day-grouped list */}
      <div className="scrollbar tx-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
        {days.length === 0 ? (
          <EmptyState height={160}>
            {scoped.length === 0
              ? 'No transactions in this period. Log one above.'
              : 'Nothing matches those filters.'}
          </EmptyState>
        ) : (
          days.map((day) => {
            const isOpen = !collapsedDays.has(day.date);
            const net = day.income - day.expense;
            return (
              <div key={day.date}>
                <button className="day-header" onClick={() => toggleDay(day.date)} aria-expanded={isOpen}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <ChevronRight size={13} className={`day-chevron ${isOpen ? 'open' : ''}`} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{dayLabel(day.date)}</span>
                    <span style={{ fontSize: 11, color: C.faint }}>
                      {day.txs.length} item{day.txs.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexShrink: 0 }}>
                    {day.income > 0 && (
                      <span style={{ fontSize: 11, color: C.greenBright }}>+{formatIDR(day.income)}</span>
                    )}
                    {day.expense > 0 && (
                      <span style={{ fontSize: 11, color: C.redBright }}>−{formatIDR(day.expense)}</span>
                    )}
                    {day.income > 0 && day.expense > 0 && (
                      <span style={{ fontSize: 11, color: C.muted }}>
                        ({net >= 0 ? '+' : '−'}{formatIDR(Math.abs(net))})
                      </span>
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 12px' }}>
                    {day.txs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        accounts={accounts}
                        isEditing={editingTxId === tx.id}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onTagClick={(tag) => set({ tag: filters.tag === tag ? null : tag })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
