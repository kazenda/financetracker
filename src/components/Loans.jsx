import { useState } from 'react';
import { HandCoins, Check, X } from 'lucide-react';
import { C } from '../lib/constants';
import { formatIDR, formatAmountInput, parseAmountInput, todayISO, daysSince } from '../lib/format';
import { openLoans, outstandingTotal } from '../lib/finance';

/**
 * Money you fronted for someone that hasn't come back yet. Lives in the left
 * column rather than the log because it is cross-month state — a loan made in
 * June must stay visible while you are looking at August.
 */
export default function Loans({
  transactions, accounts, expenseCategories, incomeCategories, onSettle, onWriteOff,
}) {
  const [settlingId, setSettlingId] = useState(null);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');

  const loans = openLoans(transactions);
  if (loans.length === 0) return null; // stay out of the way when nothing is open

  const total = outstandingTotal(transactions);

  const startSettle = (loan) => {
    setSettlingId(loan.id);
    setAmount(formatAmountInput(String(loan.amount))); // repaid in full is the common case
    setAccountId(loan.accountId || accounts[0]?.id || '');
    setDate(todayISO());
    setCategory(''); // '' means "use the default for whichever direction it lands in"
    setSubcategory('');
  };

  /**
   * A surplus is money coming in, so it belongs to an income category; a
   * shortfall is money that ended up spent, so it belongs to an expense one.
   * Typing in the amount box can flip the direction, which would leave a
   * category selected from the wrong list — so resolve it at render time
   * rather than trying to keep the stored value in sync.
   */
  const resolveCategory = (isSurplus) => {
    const names = Object.keys(isSurplus ? incomeCategories : expenseCategories);
    if (names.includes(category)) return category;
    if (isSurplus && names.includes('People')) return 'People';
    return names[0] || '';
  };

  const confirmSettle = (loan, isSurplus) => {
    onSettle(loan, {
      settledAmount: parseAmountInput(amount),
      settledAccountId: accountId,
      settledDate: date,
      category: resolveCategory(isSurplus),
      subcategory,
    });
    setSettlingId(null);
  };

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HandCoins size={15} style={{ color: C.blueBright }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Open Loans</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.blueBright }}>{formatIDR(total)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loans.map((loan) => {
          const age = daysSince(new Date(loan.date).getTime());
          const isSettling = settlingId === loan.id;
          const difference = isSettling ? parseAmountInput(amount) - loan.amount : 0;
          const isSurplus = difference > 0;

          return (
            <div
              key={loan.id}
              style={{ background: C.bg, borderRadius: 7, border: `1px solid ${C.border}`, padding: '9px 10px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loan.person || 'Someone'}
                  </p>
                  <p style={{ fontSize: 10, color: C.faint, margin: '2px 0 0' }}>
                    {loan.note ? `${loan.note} · ` : ''}{age <= 0 ? 'today' : `${age}d ago`}
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright, flexShrink: 0 }}>
                  {formatIDR(loan.amount)}
                </span>
              </div>

              {isSettling ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    className="input-base" style={{ fontSize: 12, padding: '6px 8px' }}
                    inputMode="numeric" aria-label="Amount repaid" autoFocus
                    value={amount}
                    onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      className="input-base" style={{ fontSize: 12, padding: '6px 8px' }}
                      aria-label="Repaid into" value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input
                      type="date" className="input-base"
                      style={{ fontSize: 12, padding: '6px 8px', colorScheme: 'dark' }}
                      aria-label="Date repaid" value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  {difference !== 0 && (
                    <>
                      <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>
                        {isSurplus
                          ? `${formatIDR(difference)} extra will be logged as income.`
                          : `${formatIDR(-difference)} short will be logged as spending.`}
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="input-base" style={{ fontSize: 12, padding: '6px 8px' }}
                          aria-label={isSurplus ? 'Income category for the extra' : 'Expense category for the shortfall'}
                          value={resolveCategory(isSurplus)}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          {Object.keys(isSurplus ? incomeCategories : expenseCategories)
                            .map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                          className="input-base" style={{ fontSize: 12, padding: '6px 8px' }}
                          aria-label={isSurplus ? 'Who the extra came from' : 'What the shortfall went on'}
                          placeholder={isSurplus ? `From? e.g. ${loan.person || 'Mom'}` : 'For? e.g. Dinner'}
                          value={subcategory}
                          onChange={(e) => setSubcategory(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn" style={{ flex: 1, padding: '6px', fontSize: 12, color: C.greenBright }}
                      onClick={() => confirmSettle(loan, isSurplus)}
                    >
                      <Check size={13} /> Settle
                    </button>
                    <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setSettlingId(null)}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, marginTop: 7 }}>
                  <button
                    onClick={() => startSettle(loan)}
                    className="btn-ghost"
                    style={{ fontSize: 11, color: C.accent, padding: 0 }}
                  >
                    Mark repaid
                  </button>
                  <button
                    onClick={() => onWriteOff(loan)}
                    className="btn-ghost btn-danger"
                    style={{ fontSize: 11, padding: 0 }}
                    title="Give up on it — logs the full amount as spending"
                  >
                    Write off
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: C.faint, marginTop: 8 }}>
        Open loans stay out of income and spending. Only the difference counts when settled.
      </p>
    </div>
  );
}
