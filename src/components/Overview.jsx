import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { C } from '../lib/constants';
import { formatIDR } from '../lib/format';
import { SectionLabel, StatCard } from './ui';

/**
 * Month-level position: what came in, what went out, and progress toward the
 * saving goal. Account balances live in BalancesCard, loans in Loans.
 */
export default function Overview({ totals, prevTotals, settings }) {
  const { income, expense, net } = totals;
  const goal = settings.savingGoal || 0;
  const goalProgress = goal > 0 ? Math.min((net / goal) * 100, 100) : 0;
  const isGoalMet = goal > 0 && net >= goal;
  const progressColor = net < 0 ? C.red : (goalProgress < 50 ? C.accent : C.green);

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
            <Target size={16} />
          </span>
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 500 }}>Net vs Goal</span>
        </div>
        <p style={{ fontSize: 22, fontWeight: 600, color: net < 0 ? C.redBright : C.accent, margin: '0 0 4px' }}>
          {formatIDR(net)}
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginLeft: 6 }}>/ {formatIDR(goal)}</span>
        </p>
        <div className="bar-track" style={{ marginTop: 10 }}>
          <div className="bar-fill" style={{ width: `${Math.max(goalProgress, 0)}%`, background: progressColor }} />
        </div>
        <p style={{ fontSize: 11, color: C.muted, marginTop: 6, textAlign: 'right' }}>
          {isGoalMet ? '✓ Goal met' : `${Math.max(goalProgress, 0).toFixed(0)}% reached`}
        </p>
      </div>
    </>
  );
}
