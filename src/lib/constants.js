// --- Palette (muted dark, warm stone base, amber accent) ---
export const C = {
  bg: '#131416',
  surface: '#1c1d1f',
  border: '#2a2b2e',
  borderHover: '#3a3b3e',
  text: '#c9c5bc',
  textBright: '#e8e4dc',
  muted: '#6b6760',
  faint: '#4a4b4e',
  accent: '#c9964a',
  green: '#5a8a6a',
  greenBright: '#7aaa8a',
  red: '#9e5a5a',
  redBright: '#c47070',
  blue: '#4a6e9e',
  blueBright: '#7a9ece',
};

export const PIE_COLORS = [
  '#c9964a', '#5a8a6a', '#4a6e9e', '#8a6a9e',
  '#9e5a5a', '#6a8a5a', '#9e8a4a', '#5a7a8a',
];

export const INITIAL_ACCOUNTS = [
  { id: 'acc1', name: 'Debit Mandiri', openingBalance: 5000000 },
  { id: 'acc2', name: 'GoPay', openingBalance: 250000 },
  { id: 'acc3', name: 'ShopeePay', openingBalance: 100000 },
  { id: 'acc4', name: 'OVO', openingBalance: 150000 },
  { id: 'acc5', name: 'Cash', openingBalance: 300000 },
];

export const INITIAL_EXPENSE_CATEGORIES = {
  'FnB': ['Groceries', 'Coffee', 'Restaurants'],
  'Daily Needs': ['Transport', 'Household'],
  'Bills & Utilities': ['Electricity', 'Internet'],
  'People': ['Gifts', 'Family Support'],
  'Health': ['Medicine', 'Gym'],
  'Entertainment': ['Movies', 'Games'],
  'Shopping': ['Clothes', 'Electronics'],
  'Personal': ['Miscellaneous'],
};

export const INITIAL_INCOME_CATEGORIES = {
  'Salary': ['Base Salary', 'Bonus'],
  'Freelance': ['Project', 'Consultation'],
  'Investment': ['Dividends', 'Interest'],
  'People': ['Family', 'Friends'],
  'Other Income': ['Gift Received', 'Misc Income'],
};

export const DEFAULT_SETTINGS = {
  savingGoal: 2000000,
  budgets: {}, // { [expenseCategory]: monthlyLimitIDR }
  lastBackupAt: null, // epoch ms of the last JSON export
};

// Quick-add amounts for the form, in IDR.
export const QUICK_AMOUNTS = [10000, 25000, 50000, 100000];

export const TRANSFER_CATEGORY = 'Transfer';
export const LOAN_CATEGORY = 'Loans';

// Accounts you spend from vs. accounts you park money in. Savings accounts are
// ordinary accounts — transfers move money in, and growth is logged as income.
export const ACCOUNT_KINDS = { spending: 'Spending', savings: 'Savings' };

// Nudge to export a backup once it has been this long, since everything lives
// in this browser's storage and nothing else.
export const BACKUP_STALE_DAYS = 14;

// localforage keys. Shared with the error boundary, which reads storage
// directly to rescue data when the app itself has failed to render.
// The _v2 suffixes mark shapes that changed after the first release.
export const STORE_KEYS = {
  transactions: 'transactions_v2',
  accounts: 'accounts_v2',
  expenseCategories: 'expenseCategories',
  incomeCategories: 'incomeCategories',
  settings: 'settings',
};
