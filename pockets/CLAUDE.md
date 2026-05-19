# Pockets — AI Budget Manager

## Project Overview
An AI-powered personal finance mobile app. Users connect their bank via Plaid, money is organized into spending envelopes, and they can manage their budget through natural language chat.

## Tech Stack
- **Frontend**: React Native (iOS + Android)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API
- **Bank Integration**: Plaid

## Project Structure
- `pockets/` — React Native frontend (Expo, blank template)
- Backend and database have not been set up yet

## How the App Works
1. User logs in
2. User connects their bank through Plaid
3. Plaid sends transactions to the backend
4. Backend stores them in Supabase
5. AI reads transactions and envelopes, responds to natural language queries
6. React Native displays everything on the mobile frontend

## Core Features
- Connect bank account via Plaid
- Live transactions pulled automatically
- Envelopes (rent, groceries, gym, savings, etc.)
- Transactions auto-categorized into envelopes
- Balance tracking per envelope

## AI Features
- Natural language input — "I spent $60 on groceries", "move $200 to savings"
- Questions — "how much did I spend on food this month?"
- Insights — proactive spending alerts and summaries

## App Layout
- **Dashboard** — envelopes with balances, recent transactions, notifications
- **AI Chat Panel** — always accessible, talk to your budget naturally

## Build Order
1. React Native frontend — UI layout (dashboard + AI chat panel)
2. Node.js + Express backend
3. Supabase database
4. Plaid integration
5. OpenAI AI layer
6. Envelope auto-categorization logic

## Project Status
- [ ] React Native frontend — UI layout
- [ ] Backend — Node.js + Express server
- [ ] Database — Supabase setup
- [ ] Plaid integration — bank connection + live transactions
- [ ] AI layer — natural language chat with OpenAI
- [ ] Envelope system — create, manage, auto-categorize

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
