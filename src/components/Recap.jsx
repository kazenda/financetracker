import { useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { C, PIE_COLORS } from '../lib/constants';
import { formatIDR, monthLabel } from '../lib/format';
import { EmptyState } from './ui';

function Delta({ value, goodWhenDown }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span style={{ fontSize: 11, color: C.faint }}>no prior data</span>;
  }
  if (Math.abs(value) < 0.5) {
    return <span style={{ fontSize: 11, color: C.muted }}>flat</span>;
  }
  const up = value > 0;
  const good = goodWhenDown ? !up : up;
  return (
    <span style={{ fontSize: 11, color: good ? C.greenBright : C.redBright }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function Stat({ label, value, color, delta, goodWhenDown }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 600, color, margin: '0 0 2px' }}>{value}</p>
      {delta !== undefined && <Delta value={delta} goodWhenDown={goodWhenDown} />}
    </div>
  );
}

/**
 * Summary of the month before the one being viewed — a closed book you can
 * actually learn from, unlike the half-finished current month.
 */
export default function Recap({ recap, onJumpToMonth }) {
  const [open, setOpen] = useState(true);
  const label = monthLabel(recap.key, { month: 'long', year: 'numeric' });

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', padding: 0, textAlign: 'left',
        }}
      >
        <ChevronRight size={13} className={`day-chevron ${open ? 'open' : ''}`} />
        <Sparkles size={14} style={{ color: C.accent, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>
          Recap · {label}
        </span>
      </button>

      {open && (
        !recap.hasData ? (
          <EmptyState height={90}>Nothing was logged in {label}</EmptyState>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <Stat label="Earned" value={formatIDR(recap.income)} color={C.greenBright}
                delta={recap.hasBaseline ? recap.incomeDelta : null} />
              <Stat label="Spent" value={formatIDR(recap.expense)} color={C.redBright}
                delta={recap.hasBaseline ? recap.expenseDelta : null} goodWhenDown />
              <Stat label="Net" value={formatIDR(recap.net)}
                color={recap.net < 0 ? C.redBright : C.accent} />
            </div>

            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap',
              paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 11, color: C.muted }}>
                {recap.txCount} transaction{recap.txCount === 1 ? '' : 's'}
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>
                {formatIDR(recap.avgPerDay)}/day average
              </span>
              {recap.hasBaseline && (
                <span style={{ fontSize: 11, color: recap.netDelta >= 0 ? C.greenBright : C.redBright }}>
                  {recap.netDelta >= 0 ? '+' : '−'}{formatIDR(Math.abs(recap.netDelta))} net vs month before
                </span>
              )}
            </div>

            {recap.topCategories.length > 0 && (
              <>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 8px' }}>Where it went</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                  {recap.topCategories.map((cat, i) => (
                    <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                        background: PIE_COLORS[i % PIE_COLORS.length],
                      }} />
                      <span style={{
                        fontSize: 12, color: C.text, flex: 1, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{cat.name}</span>
                      <Delta value={cat.delta} goodWhenDown />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textBright, minWidth: 92, textAlign: 'right' }}>
                        {formatIDR(cat.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {recap.biggest && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px' }}>Biggest single expense</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {recap.biggest.subcategory}
                    {recap.biggest.note ? ` · ${recap.biggest.note}` : ''}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textBright, flexShrink: 0 }}>
                    {formatIDR(recap.biggest.amount)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => onJumpToMonth(recap.key)}
              style={{ background: 'none', border: 'none', padding: '10px 0 0', fontSize: 11, color: C.accent }}
            >
              View {label} in full →
            </button>
          </div>
        )
      )}
    </div>
  );
}
