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
- A free [Expo account](https://expo.dev/signup) — required to build the app
- A free [Supabase](https://supabase.com/) account
- A [Plaid](https://plaid.com/) account (sandbox is free)
- **Android:** any Android phone
- **iPhone:** requires a paid Apple Developer account or a Mac — see [step 5](#5-frontend)

## Setup

### 1. Clone

```bash
git clone https://github.com/sarimkhan06/Pockets.git
cd Pockets
```

### 2. Database (Supabase)

1. Create a new Supabase project.
2. Open the **SQL editor** and run the contents of [`schema.sql`](schema.sql) to create the tables.
3. From **Settings → Data API**, copy your **Project URL**.
4. From **Settings → API Keys**, copy your **anon public** and **service_role** keys (you'll need all three below).

### 3. Bank integration (Plaid)

1. Create a Plaid account and open the dashboard.
2. On the Home page, go to **Explore** and click **Test Sandbox** (or **Sandbox** in the left nav → **Test Sandbox**).
3. From there, copy your **client ID** and **secret**.

#### Start with Sandbox

Sandbox is free and needs no approval, so start here — no real bank required. Set `PLAID_ENV=sandbox` and use your Sandbox secret. When Plaid Link opens in the app, pick any bank and log in with Plaid's test credentials:

| Field | Value |
|---|---|
| Username | `user_good` |
| Password | `pass_good` |
| 2FA code (if asked) | `1234` |

You'll get realistic fake accounts and transactions — enough to try every feature.

#### Connecting your own real bank

Real bank data requires Plaid's Production environment. Two ways in:

- **Trial plan** — free, and the simplest route. Teams in the US/Canada created on or after April 15, 2026 get a Trial plan supporting up to **10 live connections** with most OAuth banks, with no wait for full approval.
- **Full Production** — request it in the Plaid dashboard. Requires completing your application profile, company profile, and a security questionnaire. Expect a few business days.

Either way, in `server/.env` set `PLAID_ENV=production` **and** replace `PLAID_SECRET` with your Production secret — Plaid issues a different secret per environment, which is easy to miss.

> This app requests `country_codes: [CA, US]`, so Plaid Link will show Canadian and US institutions.

Real connections behave differently from Sandbox — see [Notes & limitations](#notes--limitations) before relying on one.

### 4. Backend
> **Note:** You'll need two terminal windows/tabs open at once — one for the backend, one for the frontend (step 5) — since both need to keep running simultaneously.

```bash
cd server
cp .env.example .env      # then fill in your Supabase + Plaid values in .env
npm install
npm run dev               # or: node index.js
```

The server runs on **port 3000**.

### 5. Frontend

Set up your Supabase credentials and install dependencies:

```bash
cd pockets
cp .env.example .env      # then fill in your Supabase URL + anon key in .env
npm install
```

The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from that file. If either is missing the app fails immediately with a clear message, rather than silently pointing at the wrong project.

> **Why not Expo Go?** Pockets uses `react-native-plaid-link-sdk`, a *native* module, to connect banks. Expo Go only contains Expo's own native modules, so bank connection can't work there. Instead you install a **development build** — a one-time custom build of this app that includes it. Afterwards the workflow is identical to Expo Go: same QR code, same live reload.

#### Android

```bash
npm install -g eas-cli
eas login                 # free Expo account
eas init                  # creates your own Expo project
eas build --profile development --platform android
```

Don't skip `eas init`. The project ID committed in `app.json` belongs to someone else's Expo account, so EAS will reject your build. `eas init` swaps in a project on your own account.

Builds in Expo's cloud (~10–15 min), then gives you a link. Open it on your phone, download the APK, and allow "install from unknown sources." You now have a **Pockets** dev app installed.

Because `.env` is gitignored it isn't uploaded to EAS, so cloud builds need the same two values stored with Expo:

```bash
eas env:push --environment development --path .env
```

#### iPhone

Apple requires a signing certificate to install any app on a physical device:

| Option | Cost | Notes |
|---|---|---|
| Apple Developer Program | $99/year | `eas build --profile development --platform ios` — works like Android |
| Mac + Xcode | Free | `npx expo run:ios --device` with a free Apple ID; the app expires after 7 days and must be reinstalled |
| iOS Simulator | Free | Add `"simulator": true` to the iOS development profile in `eas.json`; requires a Mac |

There's no free way to get a lasting install on a physical iPhone. That's Apple's policy.

### 6. Run it

Two terminals:

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — app
cd pockets && npx expo start
```

Open the **Pockets** dev app on your phone and it will connect to Metro. Your phone and computer must be on the same WiFi network.

The app auto-detects your computer's IP from the Expo bundler, so no manual IP editing is needed.

**You only build once.** JS changes hot-reload over Metro — you'd only rebuild if native dependencies change.

### Troubleshooting

**`JSON Parse error: Unexpected character: <`** — the app reached something that returned a web page instead of your API. Almost always the backend isn't reachable: the server isn't running, or your phone is on a different network than your computer (mobile data instead of WiFi will do it). To check, open `http://<your-computer-ip>:3000/plaid/status?userId=test` in your phone's browser — you should get JSON back, even if it's an error.

**Scanning the QR does nothing** — you're likely scanning with Expo Go rather than the development build from step 5. Expo Go can't run this project.

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
- The backend runs on your own computer. Your phone talks to it over local WiFi via the development build, so both need to be on the same network with the server running — it isn't deployed anywhere.
- Plaid's **Sandbox** environment (fake test banks) is enough to exercise the whole app. Connecting a real bank requires Production access — see [step 3](#3-bank-integration-plaid).

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
