import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { C } from '../lib/constants';
import { formatIDR, formatAmountInput, parseAmountInput } from '../lib/format';
import { computeBalance } from '../lib/finance';

/**
 * A list of accounts with live balances. Used for both spending accounts and
 * savings pots — they are the same thing, just tagged differently.
 */
export default function BalancesCard({
  title, icon, accounts, transactions, onUpdateAccount, hint, emptyHint,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  const total = accounts.reduce((s, a) => s + computeBalance(a, transactions), 0);

  const startEdit = (acc) => {
    setEditingId(acc.id);
    setDraft(formatAmountInput(String(Math.abs(acc.openingBalance))));
  };

  const commit = (acc) => {
    onUpdateAccount(acc.id, { openingBalance: parseAmountInput(draft) });
    setEditingId(null);
  };

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.muted, display: 'flex' }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{title}</span>
        </div>
        {accounts.length > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright }}>{formatIDR(total)}</span>
        )}
      </div>

      {accounts.length === 0 ? (
        <p style={{ fontSize: 11, color: C.faint, margin: 0 }}>{emptyHint}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.map((acc) => {
            const balance = computeBalance(acc, transactions);
            return (
              <div
                key={acc.id}
                className="row-hover"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', background: C.bg, borderRadius: 7, border: `1px solid ${C.border}`,
                }}
              >
                {editingId === acc.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <span style={{
                      fontSize: 12, color: C.text, width: 78, flexShrink: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{acc.name}</span>
                    <input
                      className="input-base"
                      style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                      inputMode="numeric"
                      aria-label={`Opening balance for ${acc.name}`}
                      value={draft}
                      onChange={(e) => setDraft(formatAmountInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(acc);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button onClick={() => commit(acc)} aria-label="Save" className="btn-ghost" style={{ color: C.greenBright }}>
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} aria-label="Cancel" className="btn-ghost">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acc.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: balance < 0 ? C.redBright : C.textBright }}>
                        {formatIDR(balance)}
                      </span>
                      <button
                        onClick={() => startEdit(acc)}
                        aria-label={`Edit opening balance for ${acc.name}`}
                        title="Edit opening balance"
                        className="btn-ghost"
                        style={{ color: C.borderHover, padding: 0 }}
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {hint && <p style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>{hint}</p>}
        </div>
      )}
    </div>
  );
}
