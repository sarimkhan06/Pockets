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
- **Expense splitting** — charge one pocket, split a purchase across several on purpose, or auto-overflow into a second pocket if the first can't cover it
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

1. You sign up and pick a budgeting method (a set of starter pockets with income percentages).
2. You connect your bank through Plaid.
3. Your live **net balance** — chequing (and savings) **minus** what you owe on a connected credit card — is split across your pockets.
4. Tap **Sync** to pull new transactions into your inbox.
5. Assign each expense to one pocket (or split it across several on purpose), or distribute income across pockets by method / all-in-one / custom amounts.
6. Your pockets always sum to your real net balance; the **Unsorted** pocket holds any gap until the transaction explaining it is assigned.

### Why pockets can subtract from your bank's displayed balance

If you connect a credit card alongside your chequing account, Pockets will show a **lower** total than your chequing account alone. This is intentional, not a bug.

A credit card purchase doesn't touch your chequing account right away — it just increases what you owe. That money is already spent, even though the cash is still sitting in your chequing account until the bill is paid. Pockets subtracts what you owe on the card the moment you swipe, so the number it shows you is money you can actually spend without going into debt — not just whatever your chequing screen happens to say.

### Why there's an "Unsorted" pocket

Plaid exposes two separate feeds for a connected bank: your **balance**, and your **list of transactions**. These two feeds don't update at the same speed — a transaction can show up in one before the other, sometimes by days. If pockets tried to track your balance purely by subtracting transactions one by one, that lag would cause double-counting or under-counting.

Instead, every sync re-reads your live bank balance directly and forces your pockets to add up to it. Any gap between what your named pockets add up to and your real balance goes into **Unsorted** — money that's known to have moved, but hasn't been explained by an assigned transaction yet. Once the transaction behind it arrives and you assign it, Unsorted returns to zero.

## Notes & limitations

This is a development / learning project, not a hosted product.

**Running it:**
- The backend runs on your own computer. Your phone talks to it over local WiFi via Expo Go, so both need to be on the same network with the server running — it isn't deployed anywhere.
- Plaid's **sandbox** environment (fake test banks) is enough to try the whole app. Real bank data requires Plaid's **production** environment, which needs approval from Plaid and is subject to their review process.

**Bank behavior (this affects real bank connections, not sandbox):**
- **One bank connection per user.** Connecting accounts at two different banks (separate Plaid connections) isn't supported yet — only multiple accounts *within* the same connected institution (e.g. chequing + credit card at the same bank).
- **Some banks revoke access on their own.** A few institutions (RBC, in particular) are aggressive about expiring Plaid's access — sometimes with no clear trigger — and will require you to reconnect. This is the bank's fraud detection, not something the app can prevent. When it happens, Pockets flags it and prompts a reconnect in Settings; nothing about your pockets, balances, or history is lost when you do.
- **New transactions aren't instant.** A purchase appears in your real bank immediately, but can take anywhere from minutes to a couple of days to reach Plaid, especially while it's still "pending" rather than fully posted.

**Security, if you self-host this:**
- Real secrets (Plaid keys, Supabase service key) live only in `server/.env`, which is gitignored and never committed.
- Supabase's anon key (used by the frontend) is meant to be public — but it can read/write any table that doesn't have **Row Level Security** enabled. `schema.sql` enables RLS on every table; if you add new tables of your own, do the same. This matters most for `plaid_items`, which stores bank access tokens.
- The backend currently trusts whatever `userId` a request sends — there's no server-side check that a request is actually coming from that user. That's an acceptable tradeoff for a personal, local-only project, but it would need real backend auth (verifying the Supabase session token per-request) before this could safely run somewhere multiple people could reach it.

**Scope:**
- **No AI layer.** The original idea included a natural-language chat panel ("I spent $60 on groceries," "how much did I spend on food?"). It was deliberately scoped out to keep this project focused on getting the underlying money logic — balances, credit cards, and Plaid's quirks — correct first.
