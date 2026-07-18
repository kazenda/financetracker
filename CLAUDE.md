# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About me
I'm new to coding. Please explain concepts in plain language,
avoid assuming I know jargon, and briefly explain what commands
do before running them.

## Commands

```
npm run dev       # Vite dev server with HMR
npm run build     # production build to dist/
npm run preview   # serve the built dist/
npm run lint      # eslint over the repo (dist/ ignored)
```

There is no test setup in this repo — no test runner, no test files. Verify changes by running the dev server.

## What this is

A single-user personal finance tracker for Indonesian Rupiah. React 19 + Vite, no backend, no router, no auth. All data lives in the user's browser via `localforage` (IndexedDB); the only way data leaves the machine is the JSON export in Settings.

## Architecture

**All state lives in `src/App.jsx`.** There is no state library and no context. `App` owns the five persisted slices — `transactions`, `accounts`, `expenseCategories`, `incomeCategories`, `settings` — plus UI state (viewed month, filters, editing id, toast). Every component is presentational and receives data + callbacks as props. When adding a feature, the state and the mutation function belong in `App`, and the derivation belongs in `src/lib/finance.js`.

**Persistence is two effects in `App`.** One loads all five keys from localforage on mount; the other writes all five whenever any changes. The `isLoaded` guard exists because without it the first render would overwrite storage with empty initial state before the async load returns — don't remove it. Storage keys live in `STORE_KEYS` in `src/lib/constants.js` — shared with the error boundary, which reads storage directly. `transactions_v2` / `accounts_v2` are versioned because their shapes changed, and the load path back-fills missing fields (e.g. accounts predating savings pots get `kind: 'spending'`).

**`ErrorBoundary` wraps `App` in `main.jsx`.** A render crash would otherwise unmount everything and leave the data stranded in IndexedDB with no UI to export it. The fallback reads storage directly and offers a rescue download. It is a class component because `componentDidCatch` has no hook equivalent. Import also validates every incoming record (`isValidTransaction`) so a malformed backup is refused rather than crashing the render.

**`src/lib/finance.js` holds every derivation.** Balances, category breakdowns, cashflow and net-worth series, the month recap, log filtering and day grouping. These are pure functions over `transactions`; `App` wraps each in `useMemo`. Nothing is precomputed or cached in state — balances are always recomputed by folding the whole transaction list.

**`src/lib/format.js` holds IDR and date formatting.** Dates are `YYYY-MM-DD` strings and months are `YYYY-MM` keys, compared and sliced as strings throughout. All date construction goes through `toISODate`, which reads local-time getters deliberately: `toISOString()` is UTC and shifts the date backwards in the evening in WIB, mis-filing transactions by a day. Never introduce `toISOString()` for a transaction date.

## The transaction model

One flat `transactions` array holds four `type` values, and the type decides how a record affects balances (see `computeBalance`):

- `income` / `expense` — signed against `accountId`.
- `transfer` — leaves `accountId`, lands in `toAccountId`; never counted as income or expense.
- `loan` — money fronted to `person`. Leaves `accountId` when made; comes back into `settledAccountId` only once `settledDate` is set. Carries `status: 'open' | 'settled' | 'written-off'`.

Loan settlement (`settleLoan` in `App`) is the subtle part: the loan record itself moves the cash, so only the *difference* between lent and repaid is posted as an extra income/expense transaction linked back by `loanId`, and that adjustment has `accountId: null` so it reaches the monthly totals and category breakdown without double-counting any balance. The settle form lets the user categorise that difference — income categories for a surplus, expense categories for a shortfall.

Those two rows are **one event across four places**, and all four must stay in step:
- `undoSettlement` reopens a closed loan: deletes the difference row, sets `status` back to `open`, and strips the `settled*` fields so it returns to the Open Loans card. This is the only route back to the settlement fields, since the settle form lives on that card. `TransactionForm` therefore locks the amount field on a non-open loan (`amountLocked`) — editing it would leave the already-computed difference row silently wrong.
- `deleteTransaction` cascades — removing either row removes both, and Undo restores both. Without this the difference row survives as an orphan that keeps moving monthly totals for a loan that no longer exists.
- `pairSameDayLoans` draws them as a single card *only* when they share a day. They often fall in different months, and each belongs to the month its money counts in — merging across months would leave a month whose visible rows disagree with its totals.
- `saveTransaction` preserves an existing loan's `status` on edit and strips settlement fields if the type changes away from `loan`.

`computeBalance` takes an optional `asOf` ISO date that rewinds a balance to a past day — that is how `netWorthSeries` reconstructs history, splitting net worth into liquid / savings / lent-out.

Accounts are distinguished only by `kind` (`'spending'` or `'savings'`); savings accounts are ordinary accounts that money is transferred into and whose growth is logged as income.

Categories are `{ [category]: [subcategory, ...] }` maps and act purely as a *picker* — the breakdown reads categories off the transactions themselves, so deleting a category never erases history. Renaming, however, rewrites matching transactions and the matching budget key so history stays linked (`renameCategory`).

## Styling

Tailwind v4 is installed via `@tailwindcss/vite`, but the app is **not** written in utility classes. Styling is semantic classes in `src/index.css` (`.card`, `.btn-icon`, `.chip`, `.grid-main`, …) plus inline `style` objects, with colors from the `C` palette in `src/lib/constants.js` — which mirrors the CSS custom properties at the top of `index.css`. If a color changes, change it in both places. Follow the existing pattern rather than introducing utility classes.

`src/components/ui.jsx` has the shared primitives: `Modal` (Esc + backdrop close, focus management), `Toast` (used for undo actions), `StatCard`, `Bar`, `EmptyState`, `SectionLabel`.

## Notes

- `README.md` is still the untouched Vite starter template and describes nothing about this app.
- Because data is browser-local, the app nags for a JSON backup after `BACKUP_STALE_DAYS` (14). Destructive-feeling actions (delete transaction, delete account, delete category) offer Undo through the toast instead of a confirm dialog.
