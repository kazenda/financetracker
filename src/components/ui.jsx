import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { C } from '../lib/constants';

export function SectionLabel({ children, right }) {
  return (
    <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

export function StatCard({ icon, label, value, color, iconBg, delta, deltaGoodWhenDown }) {
  // delta is a percentage vs the previous month; null means no baseline yet.
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const up = hasDelta && delta > 0;
  const good = deltaGoodWhenDown ? !up : up;

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ padding: 6, background: iconBg, borderRadius: 7, color, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 22, fontWeight: 600, color, margin: 0 }}>{value}</p>
        {hasDelta && Math.abs(delta) >= 0.5 && (
          <span
            title="vs previous month"
            style={{ fontSize: 11, fontWeight: 500, color: good ? C.greenBright : C.redBright }}
          >
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function Bar({ value, max, color, height = 4 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="bar-track" style={{ height }}>
      <div className="bar-fill" style={{ width: `${Math.max(pct, 0)}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ children, height = 120 }) {
  return (
    <div style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C.faint, fontSize: 13, textAlign: 'center', padding: '0 12px',
    }}>
      {children}
    </div>
  );
}

/** Modal with Esc-to-close, backdrop click, and focus moved into the panel. */
export function Modal({ title, onClose, children }) {
  const panelRef = useRef(null);
  // Callers pass a fresh inline onClose every render. Reading it through a ref
  // keeps the effect below on an empty dep list, so it does not tear down and
  // re-run — and re-focus the panel — on every keystroke inside the modal.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="card modal-panel scrollbar"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="btn-ghost"
          style={{ position: 'absolute', top: 16, right: 16 }}
        >
          <X size={18} />
        </button>
        <h2 className="serif" style={{ fontSize: 22, color: C.textBright, margin: '0 0 20px' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Transient message, optionally with a single action (used for undo). */
export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onDismiss, toast.duration ?? 6000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <button
          onClick={() => { toast.onAction?.(); onDismiss(); }}
          style={{
            background: 'none', border: 'none', color: C.accent,
            fontSize: 13, fontWeight: 600, padding: 0, whiteSpace: 'nowrap',
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss" className="btn-ghost" style={{ marginLeft: -6 }}>
        <X size={14} />
      </button>
    </div>
  );
}
