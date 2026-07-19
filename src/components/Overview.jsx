import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { C } from '../lib/constants';
import { formatIDR } from '../lib/format';
import { SectionLabel, StatCard } from './ui';

/**
 * Month-level position: what came in, what went out, and whether you ended the
 * month up or down once savings transfers and loans are taken off. Account
 * balances live in BalancesCard, loans in Loans.
 */
export default function Overview({ flow, prevTotals }) {
  const { income, expense, toSavings, lentOut, surplus, usedShare } = flow;
  const isDeficit = surplus < 0;
  const barColor = usedShare > 100 ? C.red : (usedShare > 80 ? C.accent : C.green);

  // Named so the headline number can be explained without opening the log.
  const deductions = [
    toSavings > 0 && `${formatIDR(toSavings)} to savings`,
    toSavings < 0 && `${formatIDR(-toSavings)} out of savings`,
    lentOut > 0 && `${formatIDR(lentOut)} lent out`,
    lentOut < 0 && `${formatIDR(-lentOut)} repaid to you`,
  ].filter(Boolean);

  const delta = (current, previous) => {
    if (!previous) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  return (
    <>
      <SectionLabel>Overview</SectionLabel>

      <StatCard
        icon={<TrendingUp size={16} />} label="Income" value={formatIDR(income)}
        color={C.greenBright} iconBg="rgba(90,138,106,0.12)"
        delta={delta(income, prevTotals.income)}
      />
      <StatCard
        icon={<TrendingDown size={16} />} label="Spending" value={formatIDR(expense)}
        color={C.redBright} iconBg="rgba(158,90,90,0.12)"
        delta={delta(expense, prevTotals.expense)} deltaGoodWhenDown
      />

      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ padding: 6, background: 'rgba(201,150,74,0.12)', borderRadius: 7, color: C.accent, display: 'flex' }}>
            <Wallet size={16} />
          </span>
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 500 }}>
            {isDeficit ? 'Deficit' : 'Surplus'}
          </span>
        </div>
        <p style={{ fontSize: 22, fontWeight: 600, color: isDeficit ? C.redBright : C.accent, margin: '0 0 4px' }}>
          {formatIDR(surplus)}
        </p>
        {deductions.length > 0 && (
          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
            after {deductions.join(', ')}
          </p>
        )}
        <div className="bar-track" style={{ marginTop: 10 }}>
          <div className="bar-fill" style={{ width: `${Math.min(usedShare, 100)}%`, background: barColor }} />
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: 'right' }}>
          {income > 0
            ? `${usedShare.toFixed(0)}% of income used`
            : 'No income this month'}
        </p>
      </div>
    </>
  );
}
