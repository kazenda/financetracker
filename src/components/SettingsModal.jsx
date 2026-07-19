import { useState } from 'react';
import { Download, Upload, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { C, BACKUP_STALE_DAYS } from '../lib/constants';
import { formatIDR, formatAmountInput, parseAmountInput, daysSince } from '../lib/format';
import { Modal } from './ui';

function Divider({ label }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 500, color: C.text,
      paddingTop: 16, marginTop: 4, marginBottom: 10, borderTop: `1px solid ${C.border}`,
    }}>{label}</p>
  );
}

function AccountsPanel({ accounts, transactions, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [kind, setKind] = useState('spending');
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');

  const usage = (id) => transactions.filter(
    (t) => t.accountId === id || t.toAccountId === id || t.settledAccountId === id,
  ).length;

  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), parseAmountInput(balance), kind);
    setName('');
    setBalance('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {accounts.map((acc) => {
        const count = usage(acc.id);
        return (
          <div key={acc.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px',
          }}>
            {editingId === acc.id ? (
              <>
                <input
                  className="input-base" style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                  aria-label="Account name" value={draftName} autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draftName.trim()) {
                      onUpdate(acc.id, { name: draftName.trim() });
                      setEditingId(null);
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <button
                  className="btn-ghost" aria-label="Save name" style={{ color: C.greenBright }}
                  onClick={() => { if (draftName.trim()) onUpdate(acc.id, { name: draftName.trim() }); setEditingId(null); }}
                >
                  <Check size={15} />
                </button>
                <button className="btn-ghost" aria-label="Cancel" onClick={() => setEditingId(null)}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {acc.name}
                  </p>
                  <p style={{ fontSize: 10, color: C.faint, margin: '2px 0 0' }}>
                    Opening {formatIDR(acc.openingBalance)} · {count} tx
                  </p>
                </div>
                <button
                  className={`chip ${acc.kind === 'savings' ? 'active' : ''}`}
                  style={{ flexShrink: 0 }}
                  aria-pressed={acc.kind === 'savings'}
                  title="Savings accounts are grouped separately and tracked in the net worth chart"
                  onClick={() => onUpdate(acc.id, { kind: acc.kind === 'savings' ? 'spending' : 'savings' })}
                >
                  {acc.kind === 'savings' ? 'Savings' : 'Spending'}
                </button>
                <button
                  className="btn-ghost" aria-label={`Rename ${acc.name}`}
                  onClick={() => { setEditingId(acc.id); setDraftName(acc.name); }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="btn-ghost btn-danger"
                  aria-label={`Delete ${acc.name}`}
                  disabled={count > 0 || accounts.length === 1}
                  title={
                    count > 0 ? 'Has transactions — reassign or delete them first'
                      : accounts.length === 1 ? 'Keep at least one account' : 'Delete account'
                  }
                  onClick={() => onDelete(acc.id)}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          className="input-base" style={{ flex: 1.4, fontSize: 12 }}
          placeholder="New account" aria-label="New account name"
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          className="input-base" style={{ flex: 1, fontSize: 12 }}
          placeholder="Opening" aria-label="Opening balance" inputMode="numeric"
          value={balance} onChange={(e) => setBalance(formatAmountInput(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <select
          className="input-base" style={{ width: 96, fontSize: 12 }} aria-label="Account kind"
          value={kind} onChange={(e) => setKind(e.target.value)}
        >
          <option value="spending">Spending</option>
          <option value="savings">Savings</option>
        </select>
        <button type="button" className="btn" onClick={add} disabled={!name.trim()} aria-label="Add account">
          <Plus size={14} />
        </button>
      </div>
      <p style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
        Tag an account as Savings to track it separately. Move money in with a Transfer;
        log growth as Income into that account.
      </p>
    </div>
  );
}

function CategoriesPanel({ kind, categories, transactions, onAddCategory, onRenameCategory, onDeleteCategory, onAddSub, onDeleteSub }) {
  const [newCat, setNewCat] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [subDrafts, setSubDrafts] = useState({});

  const usage = (cat) => transactions.filter((t) => t.type === kind && t.category === cat).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(categories).map(([cat, subs]) => (
        <div key={cat} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '10px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {editing === cat ? (
              <>
                <input
                  className="input-base" style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                  aria-label="Category name" value={draft} autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draft.trim()) { onRenameCategory(cat, draft.trim()); setEditing(null); }
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
                <button
                  className="btn-ghost" aria-label="Save" style={{ color: C.greenBright }}
                  onClick={() => { if (draft.trim()) onRenameCategory(cat, draft.trim()); setEditing(null); }}
                >
                  <Check size={14} />
                </button>
                <button className="btn-ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.text, flex: 1 }}>{cat}</span>
                <span style={{ fontSize: 10, color: C.faint }}>{usage(cat)} tx</span>
                <button className="btn-ghost" aria-label={`Rename ${cat}`} onClick={() => { setEditing(cat); setDraft(cat); }}>
                  <Pencil size={12} />
                </button>
                <button
                  className="btn-ghost btn-danger" aria-label={`Delete ${cat}`}
                  title="Delete category (past transactions keep their label)"
                  onClick={() => onDeleteCategory(cat)}
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {subs.map((sub) => (
              <span key={sub} className="chip" style={{ paddingRight: 4 }}>
                {sub}
                <button
                  className="btn-ghost" aria-label={`Delete ${sub}`} style={{ padding: 0, marginLeft: 2 }}
                  onClick={() => onDeleteSub(cat, sub)}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {subs.length === 0 && <span style={{ fontSize: 11, color: C.faint }}>No subcategories</span>}
          </div>

          <div style={{ display: 'flex', gap: 5 }}>
            <input
              className="input-base" style={{ padding: '4px 8px', fontSize: 11 }}
              placeholder="Add subcategory" aria-label={`Add subcategory to ${cat}`}
              value={subDrafts[cat] || ''}
              onChange={(e) => setSubDrafts({ ...subDrafts, [cat]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const value = (subDrafts[cat] || '').trim();
                if (value) { onAddSub(cat, value); setSubDrafts({ ...subDrafts, [cat]: '' }); }
              }}
            />
            <button
              type="button" className="btn" style={{ padding: '4px 9px' }}
              aria-label={`Add subcategory to ${cat}`}
              onClick={() => {
                const value = (subDrafts[cat] || '').trim();
                if (value) { onAddSub(cat, value); setSubDrafts({ ...subDrafts, [cat]: '' }); }
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input-base" style={{ fontSize: 12 }}
          placeholder="New category" aria-label="New category name"
          value={newCat} onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newCat.trim()) { onAddCategory(newCat.trim()); setNewCat(''); }
          }}
        />
        <button
          type="button" className="btn" disabled={!newCat.trim()} aria-label="Add category"
          onClick={() => { onAddCategory(newCat.trim()); setNewCat(''); }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function SettingsModal({
  onClose, settings, onSettingsChange, accounts, transactions,
  expenseCategories, incomeCategories, actions, fileInputRef, onExport, onImport,
}) {
  const [tab, setTab] = useState('general');
  const backupAgeDays = settings.lastBackupAt ? daysSince(settings.lastBackupAt) : null;

  const setBudget = (cat, raw) => {
    const value = parseAmountInput(raw);
    const budgets = { ...settings.budgets };
    if (value > 0) budgets[cat] = value; else delete budgets[cat];
    onSettingsChange({ ...settings, budgets });
  };

  return (
    <Modal title="Settings & Data" onClose={onClose}>
      <div className="tabs" style={{ marginBottom: 18 }}>
        {[['general', 'General'], ['accounts', 'Accounts'], ['categories', 'Categories']].map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Divider label="Monthly Budgets" />
          <p style={{ fontSize: 11, color: C.muted, margin: '0 0 10px' }}>
            Set a limit and the spending breakdown shows progress against it. Leave blank for none.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.keys(expenseCategories).map((cat) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label htmlFor={`budget-${cat}`} style={{ fontSize: 12, color: C.text, flex: 1, minWidth: 0 }}>{cat}</label>
                <input
                  id={`budget-${cat}`} className="input-base" inputMode="numeric" placeholder="No limit"
                  style={{ width: 130, fontSize: 12, padding: '6px 9px' }}
                  value={settings.budgets?.[cat] ? formatAmountInput(String(settings.budgets[cat])) : ''}
                  onChange={(e) => setBudget(cat, e.target.value)}
                />
              </div>
            ))}
          </div>

          <Divider label="Data Management" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={onExport}>
              <Download size={14} /> Export JSON
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Import JSON
            </button>
            <input type="file" ref={fileInputRef} onChange={onImport} accept=".json" style={{ display: 'none' }} />
          </div>
          <p style={{
            fontSize: 11, marginTop: 8,
            color: backupAgeDays === null || backupAgeDays >= BACKUP_STALE_DAYS ? C.accent : C.faint,
          }}>
            {backupAgeDays === null
              ? 'Never backed up. Everything lives in this browser only — clearing site data wipes it.'
              : `Last backup ${backupAgeDays === 0 ? 'today' : `${backupAgeDays} day${backupAgeDays === 1 ? '' : 's'} ago`}. Import replaces all current data.`}
          </p>
        </div>
      )}

      {tab === 'accounts' && (
        <AccountsPanel
          accounts={accounts}
          transactions={transactions}
          onAdd={actions.addAccount}
          onUpdate={actions.updateAccount}
          onDelete={actions.deleteAccount}
        />
      )}

      {tab === 'categories' && (
        <CategoriesTabs
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          transactions={transactions}
          actions={actions}
        />
      )}
    </Modal>
  );
}

function CategoriesTabs({ expenseCategories, incomeCategories, transactions, actions }) {
  const [kind, setKind] = useState('expense');
  const categories = kind === 'expense' ? expenseCategories : incomeCategories;

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 14 }}>
        {[['expense', 'Expense'], ['income', 'Income']].map(([id, label]) => (
          <button key={id} className={`tab ${kind === id ? 'active' : ''}`} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
      </div>
      <CategoriesPanel
        kind={kind}
        categories={categories}
        transactions={transactions}
        onAddCategory={(name) => actions.addCategory(kind, name)}
        onRenameCategory={(from, to) => actions.renameCategory(kind, from, to)}
        onDeleteCategory={(name) => actions.deleteCategory(kind, name)}
        onAddSub={(cat, sub) => actions.addSubcategory(kind, cat, sub)}
        onDeleteSub={(cat, sub) => actions.deleteSubcategory(kind, cat, sub)}
      />
    </div>
  );
}
