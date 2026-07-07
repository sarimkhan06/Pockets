# Pockets

An envelope-budgeting mobile app. Connect your bank, and Pockets organizes your real balance into labeled "pockets" (rent, groceries, savings, etc.) so you always know how much you can actually spend.

Instead of opening a separate bank account to set money aside for something, you create a pocket for it — the money stays in your real account, but it's earmarked.

## Features

- **Real bank data** via Plaid — live balances and transactions
- **Envelope budgeting** — split your balance into pockets by percentage
- **Always matches your bank** — pockets total is pegged to your live balance on every sync, with an "Unsorted" pocket absorbing anything not yet assigned
- **Credit-card aware** — tracks your true net position (chequing − what you owe on the card), so credit purchases reduce your pockets the moment you swipe
- **Inbox flow** — new transactions land in an inbox; you assign each one to a pocket
- **Income distribution** — split a paycheck across pockets by method, all-in-one, or custom amounts
- **Accounts & security** — sign up / log in, two-factor auth, password reset (via Supabase)

## Tech stack

- **Frontend:** React Native (Expo)
- **Backend:** Node.js + Express
- **Database & Auth:** Supabase (PostgreSQL)
- **Bank integration:** Plaid

## Project structure

```
Pockets/
├── pockets/        # React Native (Expo) frontend
├── server/         # Node.js + Express backend
├── schema.sql      # Database tables — run in Supabase
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- The **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- A free [Supabase](https://supabase.com/) account
- A [Plaid](https://plaid.com/) account (sandbox is free)

## Setup

### 1. Clone

```bash
git clone https://github.com/sarimkhan06/Pockets.git
cd Pockets
```

### 2. Database (Supabase)

1. Create a new Supabase project.
2. Open the **SQL editor** and run the contents of [`schema.sql`](schema.sql) to create the tables.
3. From **Settings → API**, copy your **Project URL**, **anon key**, and **service role key** (you'll need them below).

### 3. Bank integration (Plaid)

1. Create a Plaid account and open the dashboard.
2. From **Team Settings → Keys**, copy your **client ID** and **secret**.
3. Start with the **sandbox** environment (fake test banks) — no real bank needed to try the app.

### 4. Backend

```bash
cd server
cp .env.example .env      # then fill in your Supabase + Plaid values
npm install
npm run dev               # or: node index.js
```

The server runs on **port 3000**.

### 5. Frontend

1. Open `pockets/lib/supabase.js` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your own project's values.
2. Then:

```bash
cd pockets
npm install
npx expo start
```

3. Scan the QR code with **Expo Go** on your phone.

The app auto-detects your computer's IP from the Expo bundler, so the phone knows where to reach the backend — no manual IP editing needed.

## How it works

1. You sign up and pick a budgeting method (a set of starter pockets).
2. You connect your bank through Plaid.
3. Your live balance is split across your pockets.
4. Tap **Sync** to pull new transactions into your inbox.
5. Assign each transaction to a pocket — its balance drops accordingly.
6. Your pockets always add up to your real bank balance; the **Unsorted** pocket holds anything not yet assigned.

## Notes & limitations

This is a development / learning project, not a hosted product:

- **The backend runs on your computer.** Your phone talks to it over your local WiFi, so both must be on the same network and the server must be running.
- **One bank connection per user.** Multiple banks (separate Plaid connections) aren't supported yet.
- **Bank disconnections happen.** Some banks (e.g. RBC) aggressively expire Plaid access; when that happens the app prompts you to reconnect in Settings — your pockets and balances are preserved.
- **No AI layer.** The natural-language chat idea was scoped out of this build.
