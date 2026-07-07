# Pockets — Envelope Budgeting App

## Project Overview
A personal finance mobile app. Users connect their bank via Plaid, and their real balance is organized into spending envelopes ("pockets") — money for rent, groceries, savings, etc. — without needing separate bank accounts. Pockets always reflects the user's true net position, including credit card debt.

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Bank Integration**: Plaid

## Project Structure
- `pockets/` — React Native frontend (Expo)
- `server/` — Node.js + Express backend
- `schema.sql` — database tables (run in Supabase to set up a new project)

## How the App Works
1. User signs up and picks a budgeting template (starter pockets + income percentages)
2. User connects their bank through Plaid
3. Live balance (chequing − credit card owed) is split across pockets
4. User taps Sync to pull new transactions into an inbox
5. Each transaction is assigned to a pocket (expenses) or distributed across pockets (income)
6. Pockets always sum to the live net balance — an "Unsorted" pocket absorbs any gap until transactions are assigned

## Core Features
- Connect bank account via Plaid, live balances and transactions
- Envelope-style pockets with percentage-based income distribution
- Pocket total always pegged to the real bank balance, every sync
- Credit card awareness — card debt subtracted from net position immediately on purchase
- Inbox flow for reviewing and assigning new transactions
- Income distribution: by method, all-in-one, or custom amounts (recorded per-pocket)
- Expense assignment: single pocket, overflow into a second pocket, or a deliberate custom split
- Bank disconnection detection + reconnect flow that preserves all existing data
- Auth via Supabase: sign up/login, two-factor auth, password reset

## Project Status
- [x] React Native frontend — UI layout
- [x] Backend — Node.js + Express server
- [x] Database — Supabase setup
- [x] Plaid integration — bank connection + live transactions
- [x] Envelope system — create, manage, assign, distribute, split
- [x] Credit card net-position tracking
- [ ] Multiple bank connections per user
- [ ] Hosted deployment (currently runs locally only)

Natural-language AI chat was part of the original concept but was scoped out of this build — see the README for why.

---

## Working with This Developer

**This is the developer's first fullstack project.** They are actively learning React and building toward React Native.

### Communication style
- Explain new concepts before implementing them
- When introducing a new technology: what it is → why we're using it → then build it
- Keep explanations plain and concise — define any jargon used
- No theory dumps — learn by building

### Code style
- Build incrementally, one layer at a time
- Don't introduce abstractions or patterns beyond what the current step needs
- Prefer simple, readable code over clever code
- Match the complexity level to what has been introduced so far in the project
