import React, { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { 
  Plus, Wallet, TrendingUp, TrendingDown, Target, X, Tag, 
  Settings, Download, Upload, Pencil, Trash2, Check
} from 'lucide-react';

// --- Utility: IDR Formatter ---
const formatIDR = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const formatIDRShort = (amount) => {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`;
  return amount.toString();
};

// --- Palette (muted dark, warm stone base, amber accent) ---
// bg:    #131416  surface: #1c1d1f  border: #2a2b2e
// text:  #c9c5bc  muted: #6b6760  accent: #c9964a
// green: #5a8a6a  red: #9e5a5a  blue: #4a6e9e

// --- Initial Data ---
const INITIAL_ACCOUNTS = [
  { id: 'acc1', name: 'Debit Mandiri', openingBalance: 5000000 },
  { id: 'acc2', name: 'GoPay', openingBalance: 250000 },
  { id: 'acc3', name: 'ShopeePay', openingBalance: 100000 },
  { id: 'acc4', name: 'OVO', openingBalance: 150000 },
  { id: 'acc5', name: 'Cash', openingBalance: 300000 },
];

// Separated income and expense categories
const INITIAL_EXPENSE_CATEGORIES = {
  "FnB": ["Groceries", "Coffee", "Restaurants"],
  "Daily Needs": ["Transport", "Household"],
  "Bills & Utilities": ["Electricity", "Internet"],
  "People": ["Gifts", "Family Support"],
  "Health": ["Medicine", "Gym"],
  "Entertainment": ["Movies", "Games"],
  "Shopping": ["Clothes", "Electronics"],
  "Personal": ["Miscellaneous"]
};

const INITIAL_INCOME_CATEGORIES = {
  "Salary": ["Base Salary", "Bonus"],
  "Freelance": ["Project", "Consultation"],
  "Investment": ["Dividends", "Interest"],
  "Other Income": ["Gift Received", "Misc Income"]
};

const PIE_COLORS = ['#c9964a', '#5a8a6a', '#4a6e9e', '#8a6a9e', '#9e5a5a', '#6a8a5a', '#9e8a4a', '#5a7a8a'];

// Compute account balance from opening balance + transactions
const computeBalance = (acc, transactions) => {
  return transactions.reduce((bal, tx) => {
    if (tx.accountId !== acc.id) return bal;
    return tx.type === 'income' ? bal + tx.amount : bal - tx.amount;
  }, acc.openingBalance);
};

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [expenseCategories, setExpenseCategories] = useState(INITIAL_EXPENSE_CATEGORIES);
  const [incomeCategories, setIncomeCategories] = useState(INITIAL_INCOME_CATEGORIES);
  const [settings, setSettings] = useState({ savingGoal: 2000000 });
  
  // UI States
  const [editingTxId, setEditingTxId] = useState(null);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [tempOpeningBalance, setTempOpeningBalance] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const defaultExpenseCat = Object.keys(INITIAL_EXPENSE_CATEGORIES)[0];
  const defaultIncomeCat = Object.keys(INITIAL_INCOME_CATEGORIES)[0];

  const [formData, setFormData] = useState({
    type: 'expense', amount: '', accountId: 'acc1', 
    category: defaultExpenseCat,
    subcategory: INITIAL_EXPENSE_CATEGORIES[defaultExpenseCat][0], 
    date: new Date().toISOString().split('T')[0], note: '', tags: ''
  });

  // --- Load & Save Data ---
  useEffect(() => {
    const loadData = async () => {
      const savedTx = await localforage.getItem('transactions_v2');
      const savedAcc = await localforage.getItem('accounts_v2');
      const savedExpCat = await localforage.getItem('expenseCategories');
      const savedIncCat = await localforage.getItem('incomeCategories');
      const savedSettings = await localforage.getItem('settings');
      if (savedTx) setTransactions(savedTx);
      if (savedAcc) setAccounts(savedAcc);
      if (savedExpCat) setExpenseCategories(savedExpCat);
      if (savedIncCat) setIncomeCategories(savedIncCat);
      if (savedSettings) setSettings(savedSettings);
    };
    loadData();
  }, []);

  useEffect(() => {
    localforage.setItem('transactions_v2', transactions);
    localforage.setItem('accounts_v2', accounts);
    localforage.setItem('expenseCategories', expenseCategories);
    localforage.setItem('incomeCategories', incomeCategories);
    localforage.setItem('settings', settings);
  }, [transactions, accounts, expenseCategories, incomeCategories, settings]);

  // --- Calculations ---
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const totalIncome = monthlyTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = monthlyTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  
  const goalProgress = Math.min((netSavings / settings.savingGoal) * 100, 100);
  const isGoalMet = netSavings >= settings.savingGoal;
  const progressColor = netSavings < 0 ? '#9e5a5a' : (goalProgress < 50 ? '#c9964a' : '#5a8a6a');

  const expenseByCategory = Object.keys(expenseCategories).map(cat => ({
    name: cat,
    value: monthlyTx.filter(t => t.type === 'expense' && t.category === cat).reduce((sum, t) => sum + t.amount, 0)
  })).filter(d => d.value > 0);

  // Monthly cashflow: last 6 months
  const monthlyCashflow = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('id-ID', { month: 'short' });
      const txs = transactions.filter(t => t.date.startsWith(key));
      const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      months.push({ label, income: inc, expense: exp });
    }
    return months;
  })();

  // Current category set based on type
  const currentCategories = formData.type === 'expense' ? expenseCategories : incomeCategories;

  // --- Handlers ---
  const resetForm = () => {
    const cats = formData.type === 'expense' ? expenseCategories : incomeCategories;
    const firstCat = Object.keys(cats)[0];
    setFormData(prev => ({
      type: prev.type, amount: '', accountId: prev.accountId,
      category: firstCat, subcategory: cats[firstCat][0],
      date: prev.date, note: '', tags: ''
    }));
    setEditingTxId(null);
  };

  const handleTypeChange = (newType) => {
    const cats = newType === 'expense' ? expenseCategories : incomeCategories;
    const firstCat = Object.keys(cats)[0];
    setFormData(prev => ({
      ...prev, type: newType,
      category: firstCat, subcategory: cats[firstCat][0]
    }));
  };

  const handleCategoryChange = (newCat) => {
    const cats = formData.type === 'expense' ? expenseCategories : incomeCategories;
    setFormData(prev => ({ ...prev, category: newCat, subcategory: cats[newCat][0] }));
  };

  const handleEditClick = (tx) => {
    setEditingTxId(tx.id);
    setFormData({
      type: tx.type, amount: tx.amount.toString(), accountId: tx.accountId,
      category: tx.category, subcategory: tx.subcategory, date: tx.date, 
      note: tx.note || '', tags: Array.isArray(tx.tags) ? tx.tags.join(', ') : ''
    });
  };

  const handleSaveTransaction = (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!amount) return;

    const newTx = {
      id: editingTxId ? editingTxId : Date.now().toString(),
      ...formData, amount,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t)
    };

    if (editingTxId) {
      setTransactions([newTx, ...transactions.filter(t => t.id !== editingTxId)]);
    } else {
      setTransactions([newTx, ...transactions]);
    }

    resetForm();
  };

  const handleDeleteTransaction = (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    setTransactions(transactions.filter(t => t.id !== id));
    if (editingTxId === id) resetForm();
  };

  const handleAddSubcategory = () => {
    const cats = formData.type === 'expense' ? expenseCategories : incomeCategories;
    const newSub = prompt(`New subcategory under ${formData.category}:`);
    if (newSub && !cats[formData.category].includes(newSub)) {
      const updated = { ...cats, [formData.category]: [...cats[formData.category], newSub] };
      if (formData.type === 'expense') setExpenseCategories(updated);
      else setIncomeCategories(updated);
      setFormData(prev => ({ ...prev, subcategory: newSub }));
    }
  };

  // --- Opening Balance Edit ---
  const startEditAccount = (acc) => {
    setEditingAccountId(acc.id);
    setTempOpeningBalance(acc.openingBalance.toString());
  };

  const saveOpeningBalance = (accId) => {
    const newBal = parseFloat(tempOpeningBalance);
    if (isNaN(newBal)) return;
    setAccounts(accounts.map(a => a.id === accId ? { ...a, openingBalance: newBal } : a));
    setEditingAccountId(null);
  };

  // --- Export / Import ---
  const handleExport = () => {
    const data = { transactions, accounts, expenseCategories, incomeCategories, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setTransactions(data.transactions || []);
        setAccounts(data.accounts || INITIAL_ACCOUNTS);
        setExpenseCategories(data.expenseCategories || INITIAL_EXPENSE_CATEGORIES);
        setIncomeCategories(data.incomeCategories || INITIAL_INCOME_CATEGORIES);
        setSettings(data.settings || { savingGoal: 2000000 });
        alert('Imported successfully.');
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#131416', color: '#c9c5bc', fontFamily: 'Inter, sans-serif', padding: '24px 32px' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .serif { font-family: 'Playfair Display', serif; }
        .card { background: #1c1d1f; border: 1px solid #2a2b2e; border-radius: 12px; }
        .input-base { background: #131416; border: 1px solid #2a2b2e; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #c9c5bc; outline: none; width: 100%; font-family: Inter, sans-serif; transition: border-color 0.15s; }
        .input-base:focus { border-color: #c9964a; }
        .input-base option { background: #1c1d1f; }
        .scrollbar::-webkit-scrollbar { width: 5px; }
        .scrollbar::-webkit-scrollbar-track { background: transparent; }
        .scrollbar::-webkit-scrollbar-thumb { background: #2a2b2e; border-radius: 3px; }
        .scrollbar::-webkit-scrollbar-thumb:hover { background: #3a3b3e; }
        .row-hover:hover { border-color: #3a3b3e !important; }
        .tx-actions { opacity: 0; transition: opacity 0.15s; }
        .tx-card:hover .tx-actions { opacity: 1; }
        .type-btn { padding: 6px 14px; border-radius: 5px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; background: transparent; color: #6b6760; }
        .type-btn.active-expense { background: rgba(158,90,90,0.15); color: #c47070; border-color: rgba(158,90,90,0.3); }
        .type-btn.active-income { background: rgba(90,138,106,0.15); color: #7aaa8a; border-color: rgba(90,138,106,0.3); }
        .type-btn:hover:not(.active-expense):not(.active-income) { color: #c9c5bc; border-color: #2a2b2e; }
        button { cursor: pointer; }
      `}</style>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 36, fontWeight: 600, color: '#e8e4dc', margin: 0, letterSpacing: '-0.02em' }}>Finance Tracker</h1>
          <p style={{ color: '#6b6760', fontSize: 12, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', border: '1px solid #2a2b2e', borderRadius: 8, padding: '8px 10px', color: '#6b6760', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c9c5bc'; e.currentTarget.style.borderColor = '#3a3b3e'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b6760'; e.currentTarget.style.borderColor = '#2a2b2e'; }}>
          <Settings size={18} />
        </button>
      </header>

      {/* 3-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.4fr', gap: 24 }}>

        {/* COL 1: Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel>Overview</SectionLabel>

          <StatCard icon={<TrendingUp size={16} />} label="Monthly Income" value={formatIDR(totalIncome)} color="#7aaa8a" iconBg="rgba(90,138,106,0.12)" />
          <StatCard icon={<TrendingDown size={16} />} label="Monthly Spending" value={formatIDR(totalExpense)} color="#c47070" iconBg="rgba(158,90,90,0.12)" />

          {/* Savings goal */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ padding: '6px', background: 'rgba(201,150,74,0.12)', borderRadius: 7, color: '#c9964a', display: 'flex' }}><Target size={16} /></span>
              <span style={{ color: '#6b6760', fontSize: 12, fontWeight: 500 }}>Net vs Goal</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 600, color: netSavings < 0 ? '#c47070' : '#c9964a', margin: '0 0 4px' }}>
              {formatIDR(netSavings)}
              <span style={{ fontSize: 12, color: '#6b6760', fontWeight: 400, marginLeft: 6 }}>/ {formatIDR(settings.savingGoal)}</span>
            </p>
            <div style={{ background: '#2a2b2e', borderRadius: 999, height: 4, marginTop: 10 }}>
              <div style={{ height: 4, borderRadius: 999, background: progressColor, width: `${Math.max(goalProgress, 0)}%`, transition: 'width 0.6s ease' }} />
            </div>
            <p style={{ fontSize: 11, color: '#6b6760', marginTop: 6, textAlign: 'right' }}>
              {isGoalMet ? '✓ Goal met' : `${Math.max(goalProgress, 0).toFixed(0)}% reached`}
            </p>
          </div>

          {/* Accounts */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Wallet size={15} style={{ color: '#6b6760' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#c9c5bc' }}>Accounts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {accounts.map(acc => {
                const balance = computeBalance(acc, transactions);
                return (
                  <div key={acc.id} className="row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#131416', borderRadius: 7, border: '1px solid #2a2b2e', transition: 'border-color 0.15s' }}>
                    {editingAccountId === acc.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <span style={{ fontSize: 12, color: '#c9c5bc', width: 80, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                        <input type="number" className="input-base" style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                          value={tempOpeningBalance} onChange={e => setTempOpeningBalance(e.target.value)} autoFocus />
                        <button onClick={() => saveOpeningBalance(acc.id)} style={{ background: 'none', border: 'none', color: '#7aaa8a', padding: 2 }}><Check size={16} /></button>
                        <button onClick={() => setEditingAccountId(null)} style={{ background: 'none', border: 'none', color: '#6b6760', padding: 2 }}><X size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize: 12, color: '#c9c5bc' }}>{acc.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: balance < 0 ? '#c47070' : '#e8e4dc' }}>{formatIDR(balance)}</span>
                          <button onClick={() => startEditAccount(acc)} style={{ background: 'none', border: 'none', color: '#3a3b3e', padding: 0 }}
                            title="Edit opening balance"
                            onMouseEnter={e => e.currentTarget.style.color = '#c9964a'}
                            onMouseLeave={e => e.currentTarget.style.color = '#3a3b3e'}>
                            <Pencil size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <p style={{ fontSize: 10, color: '#4a4b4e', marginTop: 4 }}>Pencil edits opening balance · balance = opening + transactions</p>
            </div>
          </div>
        </div>

        {/* COL 2: Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionLabel>Analytics</SectionLabel>

          {/* Pie chart */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#c9c5bc', marginBottom: 4 }}>Spending Breakdown</p>
            <p style={{ fontSize: 11, color: '#6b6760', marginBottom: 12 }}>Current month by category</p>
            {expenseByCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                      {expenseByCategory.map((entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1c1d1f', border: '1px solid #2a2b2e', borderRadius: 8, color: '#c9c5bc', fontSize: 12 }}
                      itemStyle={{ color: '#c9c5bc' }} formatter={(v) => formatIDR(v)} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
                  {expenseByCategory.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#6b6760' }}>{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3b3e', fontSize: 13 }}>No expenses logged this month</div>
            )}
          </div>

          {/* Monthly Cashflow Bar Chart */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#c9c5bc', marginBottom: 4 }}>Monthly Cashflow</p>
            <p style={{ fontSize: 11, color: '#6b6760', marginBottom: 12 }}>Last 6 months · income vs spending</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyCashflow} barCategoryGap="30%" barGap={3}>
                <CartesianGrid vertical={false} stroke="#2a2b2e" strokeDasharray="0" />
                <XAxis dataKey="label" tick={{ fill: '#6b6760', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatIDRShort} tick={{ fill: '#6b6760', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: '#1c1d1f', border: '1px solid #2a2b2e', borderRadius: 8, color: '#c9c5bc', fontSize: 12 }}
                  itemStyle={{ color: '#c9c5bc' }} formatter={(v) => formatIDR(v)} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="income" name="Income" fill="#5a8a6a" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name="Spending" fill="#9e5a5a" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* COL 3: Log */}
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
          <SectionLabel>Transactions</SectionLabel>

          {/* Form */}
          <div className="card" style={{ padding: '16px 18px', marginBottom: 14, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#c9c5bc' }}>{editingTxId ? 'Edit Transaction' : 'Log Transaction'}</span>
              {editingTxId && (
                <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6b6760', textDecoration: 'underline' }}>Cancel</button>
              )}
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, background: '#131416', borderRadius: 7, padding: 4 }}>
              <button className={`type-btn ${formData.type === 'expense' ? 'active-expense' : ''}`} style={{ flex: 1 }}
                onClick={() => handleTypeChange('expense')}>Expense</button>
              <button className={`type-btn ${formData.type === 'income' ? 'active-income' : ''}`} style={{ flex: 1 }}
                onClick={() => handleTypeChange('income')}>Income</button>
            </div>

            <form onSubmit={handleSaveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input type="number" placeholder="Amount" className="input-base"
                  value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                <input type="date" className="input-base" style={{ colorScheme: 'dark' }}
                  value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
              </div>

              <select className="input-base" value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })}>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <select className="input-base" value={formData.category} onChange={e => handleCategoryChange(e.target.value)}>
                  {Object.keys(currentCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div style={{ position: 'relative' }}>
                  <select className="input-base" style={{ paddingRight: 28 }} value={formData.subcategory}
                    onChange={e => setFormData({ ...formData, subcategory: e.target.value })}>
                    {(currentCategories[formData.category] || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                  <button type="button" onClick={handleAddSubcategory}
                    style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#c9964a', display: 'flex', padding: 2 }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <input type="text" placeholder="Note (optional)" className="input-base"
                value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />

              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Tag size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#6b6760' }} />
                  <input type="text" placeholder="Tags (comma separated)" className="input-base" style={{ paddingLeft: 26 }}
                    value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} />
                </div>
                <button type="submit" style={{
                  padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                  background: editingTxId ? 'rgba(201,150,74,0.15)' : (formData.type === 'expense' ? 'rgba(158,90,90,0.15)' : 'rgba(90,138,106,0.15)'),
                  color: editingTxId ? '#c9964a' : (formData.type === 'expense' ? '#c47070' : '#7aaa8a'),
                  border: `1px solid ${editingTxId ? 'rgba(201,150,74,0.3)' : (formData.type === 'expense' ? 'rgba(158,90,90,0.3)' : 'rgba(90,138,106,0.3)')}`,
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                }}>
                  {editingTxId ? <><Check size={14} /> Update</> : <><Plus size={14} /> Save</>}
                </button>
              </div>
            </form>
          </div>

          {/* Transaction List */}
          <div className="scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
            {transactions.length === 0 ? (
              <p style={{ color: '#3a3b3e', textAlign: 'center', marginTop: 40, fontSize: 13 }}>No transactions yet. Start logging above.</p>
            ) : (
              [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).map(tx => (
                <div key={tx.id} className="card tx-card" style={{
                  padding: '12px 14px', transition: 'border-color 0.15s',
                  borderColor: editingTxId === tx.id ? '#c9964a' : '#2a2b2e'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          padding: '2px 6px', borderRadius: 3,
                          background: tx.type === 'income' ? 'rgba(90,138,106,0.12)' : 'rgba(158,90,90,0.12)',
                          color: tx.type === 'income' ? '#7aaa8a' : '#c47070'
                        }}>{tx.type === 'income' ? 'IN' : 'OUT'}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#c9c5bc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.category}</span>
                        <span style={{ fontSize: 12, color: '#6b6760' }}>· {tx.subcategory}</span>
                      </div>
                      {tx.note && <p style={{ fontSize: 11, color: '#6b6760', fontStyle: 'italic', margin: '2px 0' }}>"{tx.note}"</p>}
                      {tx.tags && tx.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {tx.tags.map((tag, i) => (
                            <span key={i} style={{ fontSize: 10, background: '#1c1d1f', border: '1px solid #2a2b2e', color: '#6b6760', padding: '1px 6px', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Tag size={7} /> {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: tx.type === 'income' ? '#7aaa8a' : '#e8e4dc', margin: 0 }}>
                        {tx.type === 'income' ? '+' : '−'}{formatIDR(tx.amount)}
                      </p>
                      <p style={{ fontSize: 11, color: '#4a4b4e', marginTop: 2 }}>{tx.date}</p>
                    </div>
                  </div>
                  <div className="tx-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a2b2e' }}>
                    <button onClick={() => handleEditClick(tx)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6b6760', display: 'flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#c9964a'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6b6760'}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => handleDeleteTransaction(tx.id)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6b6760', display: 'flex', alignItems: 'center', gap: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#c47070'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6b6760'}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setIsSettingsOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#6b6760' }}
              onMouseEnter={e => e.currentTarget.style.color = '#c9c5bc'}
              onMouseLeave={e => e.currentTarget.style.color = '#6b6760'}>
              <X size={18} />
            </button>
            <h2 className="serif" style={{ fontSize: 22, color: '#e8e4dc', marginBottom: 20 }}>Settings & Data</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6b6760', marginBottom: 6 }}>Monthly Saving Goal (IDR)</label>
                <input type="number" className="input-base"
                  value={settings.savingGoal} onChange={e => setSettings({ ...settings, savingGoal: parseFloat(e.target.value) || 0 })} />
              </div>

              <div style={{ paddingTop: 16, borderTop: '1px solid #2a2b2e' }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: '#c9c5bc', marginBottom: 10 }}>Data Management</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleExport} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1c1d1f', border: '1px solid #2a2b2e', borderRadius: 7, padding: '10px', color: '#c9c5bc', fontSize: 13 }}>
                    <Download size={14} /> Export JSON
                  </button>
                  <button onClick={() => fileInputRef.current.click()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1c1d1f', border: '1px solid #2a2b2e', borderRadius: 7, padding: '10px', color: '#c9c5bc', fontSize: 13 }}>
                    <Upload size={14} /> Import JSON
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
                </div>
                <p style={{ fontSize: 11, color: '#4a4b4e', marginTop: 8 }}>Export regularly to back up your data. Import overwrites current data.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: '#4a4b4e', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #2a2b2e', paddingBottom: 8, marginBottom: 4 }}>
      {children}
    </p>
  );
}

function StatCard({ icon, label, value, color, iconBg }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ padding: 6, background: iconBg, borderRadius: 7, color, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#6b6760', fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 600, color, margin: 0 }}>{value}</p>
    </div>
  );
}