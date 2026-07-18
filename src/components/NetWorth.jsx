import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { C } from '../lib/constants';
import { formatIDR, formatIDRShort } from '../lib/format';

const BANDS = [
  { key: 'liquid', label: 'Spendable', color: C.blue },
  { key: 'savings', label: 'Savings', color: C.green },
  { key: 'lent', label: 'Lent out', color: C.accent },
];

function NetWorthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '10px 12px', fontSize: 12,
    }}>
      <p style={{ margin: '0 0 6px', color: C.textBright, fontWeight: 600 }}>
        {label} · {formatIDR(point.total)}
      </p>
      {BANDS.map((band) => (
        point[band.key] !== 0 && (
          <p key={band.key} style={{ margin: '2px 0', color: C.text, display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <span style={{ color: band.color }}>{band.label}</span>
            <span>{formatIDR(point[band.key])}</span>
          </p>
        )
      ))}
    </div>
  );
}

export default function NetWorth({ series }) {
  const latest = series[series.length - 1];
  const first = series[0];
  const change = latest.total - first.total;
  const hasSavings = series.some((p) => p.savings !== 0);

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 4px' }}>
            {hasSavings ? 'Net Worth & Savings' : 'Net Worth'}
          </p>
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 12px' }}>Last 12 months · all accounts</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: C.textBright, margin: 0 }}>{formatIDR(latest.total)}</p>
          <p style={{ fontSize: 11, margin: '2px 0 0', color: change >= 0 ? C.greenBright : C.redBright }}>
            {change >= 0 ? '▲' : '▼'} {formatIDR(Math.abs(change))} in 12mo
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            {BANDS.map((band) => (
              <linearGradient key={band.key} id={`fill-${band.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={band.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={band.color} stopOpacity={0.08} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={C.border} />
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatIDRShort} tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<NetWorthTooltip />} cursor={{ stroke: C.borderHover }} />
          {BANDS.map((band) => (
            <Area
              key={band.key}
              type="monotone"
              dataKey={band.key}
              name={band.label}
              stackId="networth"
              stroke={band.color}
              strokeWidth={1.5}
              fill={`url(#fill-${band.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {BANDS.map((band) => (
          <div key={band.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: band.color }} />
            <span style={{ fontSize: 11, color: C.muted }}>{band.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
