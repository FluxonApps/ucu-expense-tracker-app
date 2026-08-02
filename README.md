# Spendly expense tracker app 💰

Personal expense tracker: multiple wallets in different currencies, income/expense
tracking with categories, transfers between wallets, and a stats dashboard.

Stack: Next.js (App Router, TypeScript), Firebase (Auth + Firestore), Tailwind,
shadcn/ui, Recharts. Currency rates come from the public Monobank API.

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)

## Setup

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Copy the env template and fill it with your web app config
   (Project settings → General → Your apps):

   ```sh
   cp .env.example .env.local
   ```

3. The seed script talks to Firebase through the Admin SDK, so download a service
   account key (Project settings → Service accounts → Generate new private key) and
   save it as `serviceAccountKey.json` in the project root — that's the path
   `GOOGLE_APPLICATION_CREDENTIALS` points to in `.env.example`.

4. Seed some data:

   ```sh
   pnpm seed
   ```

   Creates the account `demo@expense-tracker.test` / `demo1234` — sign in with those
   credentials on the login page — and fills it with 4 wallets and about 4 months of
   transactions.

   Any other email works too, and the account is created if it doesn't exist yet. If
   several people share one Firebase project, seed your own account so you don't
   overwrite each other's data:

   ```sh
   pnpm seed --email you@spendly.test --password yourpassword
   ```

   Re-running the script wipes that account's wallets, transactions and categories and
   writes the same dataset again; other accounts are left alone. See `pnpm seed --help`
   for the full list of options.

5. Run the dev server:

   ```sh
   pnpm dev
   ```

## Scripts

- `pnpm dev` — dev server
- `pnpm build` / `pnpm start` — production build and server
- `pnpm lint` — ESLint
- `pnpm seed [--email <email>] [--password <password>] [--name <name>]` — (re)create
  an account and its demo data
- `pnpm reset-user --email <email>` — delete all data of one account; asks for that
  account's password first, `--delete-account` also removes it from Auth
