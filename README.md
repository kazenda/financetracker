# Finance Tracker

A personal finance tracker for Indonesian Rupiah. It runs entirely in your
browser — no backend, no account, no sign-up. Everything you enter is stored
locally on your own machine.

Built with React 19 and Vite.

## What it does

- **Transactions** — income, expenses, transfers between accounts, and money
  lent to people, all in one log with search, filters, and tags.
- **Accounts** — split into spending accounts and savings pots. Balances are
  always recomputed from the full transaction history, never stored.
- **Loans** — track money you've fronted to someone, then settle it when they
  pay you back. If they repaid more or less than you lent, the difference is
  posted as its own income or expense so your monthly totals stay honest.
- **Monthly view** — income, expenses, and cashflow for whichever month you're
  looking at, plus a recap of the month before.
- **Analytics** — category breakdowns, a six-month cashflow chart, and a
  twelve-month net worth history split into liquid, savings, and lent-out.
- **Budgets** — an optional monthly limit per expense category.
- **CSV import** — drop in a bank statement export and review each row before
  it's added. An unfinished review is saved, so you can close it and pick up
  where you left off.
- **Backup and restore** — export everything to a JSON file, import it back.

## Your data

All data lives in your browser's IndexedDB storage, via `localforage`. Nothing
is uploaded anywhere. The only way data leaves your machine is the JSON export
in Settings.

The flip side of that: **clearing your browser data will delete everything.**
The app nags you to export a backup if it's been more than two weeks. Take it
seriously.

If the app ever crashes on render, an error boundary catches it and offers a
rescue download that reads straight from storage — so a bug can't strand your
data with no way to get it out.

## Running it

You need [Node.js](https://nodejs.org) installed.

```bash
npm install     # install dependencies (first time only)
npm run dev     # start the dev server, then open the URL it prints
```

Other commands:

```bash
npm run build     # production build into dist/
npm run preview   # serve the built dist/ locally
npm run lint      # eslint over the repo
```

## Project layout

```
src/
  App.jsx           all application state and mutations
  lib/
    finance.js      every derived value (balances, totals, charts, filters)
    format.js       IDR and date formatting
    csv.js          bank statement CSV parsing
    constants.js    colors, defaults, storage keys
  components/       presentational components, data passed in as props
  index.css         semantic CSS classes and the color palette
```

State is deliberately kept in one place. `App.jsx` owns it, `lib/finance.js`
derives from it, and components just render what they're given.

`CLAUDE.md` documents the architecture in more depth, including the parts that
are subtler than they look.
