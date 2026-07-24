import { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ChevronRight } from 'lucide-react';
import { C, PIE_COLORS } from '../lib/constants';
import { formatIDR, formatIDRShort } from '../lib/format';
import { SectionLabel, EmptyState, Bar as ProgressBar } from './ui';

const tooltipStyle = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 12,
};

export default function Analytics({
  breakdown, incomeBreakdown, cashflow, totalExpense, totalIncome, budgets, onFilterCategory,
}) {
  const [expanded, setExpanded] = useState(null);
  const [mode, setMode] = useState('expense'); // which side of the ledger to break down
  const isIncome = mode === 'income';

  const data = isIncome ? incomeBreakdown : breakdown;
  const total = isIncome ? totalIncome : totalExpense;

  const switchMode = (next) => {
    setMode(next);
    setExpanded(null); // a category open in one ledger has no counterpart in the other
  };

  // The .col wrapper lives in App so Recap can sit in the same column.
  return (
    <>
      <SectionLabel>Analytics</SectionLabel>

      {/* By-category breakdown — chart + itemised amounts, toggling in/out */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px' }}>
              {isIncome ? 'Income Breakdown' : 'Spending Breakdown'}
            </p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
              {total > 0 ? `${formatIDR(total)} across ${data.length} categories` : 'By category'}
            </p>
          </div>
          <div className="tabs" style={{ flexShrink: 0 }}>
            {[['expense', 'Spending'], ['income', 'Income']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`tab ${mode === value ? 'active' : ''}`}
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {data.length === 0 ? (
          <EmptyState height={180}>{isIncome ? 'No income logged this month' : 'No expenses logged this month'}</EmptyState>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value" stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.85} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: C.text }}
                  formatter={(v, _n, p) => [`${formatIDR(v)} · ${p.payload.share.toFixed(0)}%`, p.payload.name]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Itemised list: amount, share, budget, and subcategories on click */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.map((cat, i) => {
                const color = PIE_COLORS[i % PIE_COLORS.length];
                const isOpen = expanded === cat.name;
                // Budgets are a spending concept; income categories have none.
                const budget = isIncome ? 0 : (budgets?.[cat.name] || 0);
                const overBudget = budget > 0 && cat.value > budget;

                return (
                  <div key={cat.name}>
                    <button
                      className="breakdown-row"
                      onClick={() => setExpanded(isOpen ? null : cat.name)}
                      aria-expanded={isOpen}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ChevronRight size={12} className={`day-chevron ${isOpen ? 'open' : ''}`} />
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: 11, color: C.faint, flexShrink: 0 }}>
                          {cat.count}×
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.textBright, flexShrink: 0, minWidth: 92, textAlign: 'right' }}>
                          {formatIDR(cat.value)}
                        </span>
                        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                          {cat.share.toFixed(0)}%
                        </span>
                      </div>

                      {budget > 0 && (
                        <div style={{ marginTop: 6, marginLeft: 28 }}>
                          <ProgressBar
                            value={cat.value} max={budget}
                            color={overBudget ? C.red : (cat.value / budget > 0.8 ? C.accent : C.green)}
                            height={3}
                          />
                          <p style={{
                            fontSize: 10, margin: '4px 0 0',
                            color: overBudget ? C.redBright : C.muted,
                          }}>
                            {overBudget
                              ? `${formatIDR(cat.value - budget)} over budget`
                              : `${formatIDR(budget - cat.value)} left of ${formatIDR(budget)}`}
                          </p>
                        </div>
                      )}
                    </button>

                    {isOpen && (
                      <div style={{ margin: '2px 0 8px 28px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {cat.subs.map((sub) => (
                          <div key={sub.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sub.name}
                            </span>
                            <span style={{ fontSize: 11, color: C.text, flexShrink: 0 }}>{formatIDR(sub.value)}</span>
                          </div>
                        ))}
                        <button
                          onClick={() => onFilterCategory(cat.name, mode)}
                          style={{
                            alignSelf: 'flex-start', background: 'none', border: 'none', padding: '2px 0',
                            fontSize: 11, color: C.accent,
                          }}
                        >
                          Show these transactions →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Cashflow */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px' }}>Monthly Cashflow</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 12px' }}>Last 6 months · income vs spending</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={cashflow} barCategoryGap="30%" barGap={3}>
            <CartesianGrid vertical={false} stroke={C.border} strokeDasharray="0" />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatIDRShort} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              contentStyle={tooltipStyle} itemStyle={{ color: C.text }}
              formatter={(v, name) => [formatIDR(v), name]}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="income" name="Income" fill={C.green} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Spending" fill={C.red} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          {[['Income', C.green], ['Spending', C.red]].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
