/**
 * Seed script: creates an account with realistic demo data.
 *
 * Usage:
 *   pnpm seed                                  # demo@expense-tracker.test / demo1234
 *   pnpm seed --email you@spendly.test         # seed your own account
 *   pnpm seed --email you@spendly.test --password s3cret --name "Ann"
 *
 * The account is created if it does not exist yet; otherwise its password is
 * reset to the given one. Re-running the script wipes that account's wallets,
 * transactions and categories and writes the same dataset again, so it is safe
 * to run any time. Everything lives under users/{uid}, so team members seeding
 * different emails never touch each other's data.
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS in .env.local pointing to a
 * service account key JSON.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { parseArgs } from "node:util";
import { DEFAULT_CATEGORIES } from "../src/lib/default-categories";
import { clearCollection, initAdmin } from "./lib/admin";

const DEFAULT_EMAIL = "demo@expense-tracker.test";
const DEFAULT_PASSWORD = "demo1234";

const USAGE = `Usage: pnpm seed [--email <email>] [--password <password>] [--name <name>]

  --email, -e     account to seed (default: ${DEFAULT_EMAIL})
  --password, -p  password to set on the account (default: ${DEFAULT_PASSWORD})
  --name, -n      display name (default: derived from the email)
  --help, -h      show this message`;

function parseOptions() {
  try {
    return parseArgs({
      options: {
        email: { type: "string", short: "e" },
        password: { type: "string", short: "p" },
        name: { type: "string", short: "n" },
        help: { type: "boolean", short: "h" },
      },
    }).values;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`\n${USAGE}`);
    process.exit(1);
  }
}

const options = parseOptions();
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

function displayNameFor(email: string): string {
  if (email === DEFAULT_EMAIL) return "Demo User";
  const localPart = email.split("@")[0].replace(/[._-]+/g, " ");
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const USER_EMAIL = options.email ?? process.env.SEED_EMAIL ?? DEFAULT_EMAIL;
const USER_PASSWORD = options.password ?? process.env.SEED_PASSWORD ?? DEFAULT_PASSWORD;
const USER_NAME = options.name ?? displayNameFor(USER_EMAIL);

const { auth, db } = initAdmin();

/** Deterministic RNG so the seed produces the same data every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260724);

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Local date at a fixed hour to keep it stable across timezones. */
function dateAt(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month, day, hour, 0, 0);
}

async function ensureUser(): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(USER_EMAIL);
    await auth.updateUser(existing.uid, {
      password: USER_PASSWORD,
      displayName: USER_NAME,
    });
    return existing.uid;
  } catch {
    const created = await auth.createUser({
      email: USER_EMAIL,
      password: USER_PASSWORD,
      displayName: USER_NAME,
      emailVerified: true,
    });
    return created.uid;
  }
}

interface SeedWallet {
  id: string;
  name: string;
  currency: "UAH" | "USD" | "EUR" | "PLN";
  icon: string;
  color: string;
  initialBalanceMinor: number;
  balanceMinor: number;
}

async function main() {
  console.log(`Seeding ${USER_EMAIL}...`);
  const uid = await ensureUser();

  await clearCollection(db, `users/${uid}/transactions`);
  await clearCollection(db, `users/${uid}/wallets`);
  await clearCollection(db, `users/${uid}/categories`);

  await db.doc(`users/${uid}`).set({
    displayName: USER_NAME,
    email: USER_EMAIL,
    baseCurrency: "UAH",
    createdAt: FieldValue.serverTimestamp(),
  });

  // Categories
  const categoryIds = new Map<string, string>();
  {
    const batch = db.batch();
    for (const cat of DEFAULT_CATEGORIES) {
      const ref = db.collection(`users/${uid}/categories`).doc();
      batch.set(ref, { ...cat, isDefault: true });
      categoryIds.set(cat.name, ref.id);
    }
    await batch.commit();
  }

  // Wallets
  const wallets: SeedWallet[] = [
    {
      id: "",
      name: "Mono Black",
      currency: "UAH",
      icon: "credit-card",
      color: "#171717",
      initialBalanceMinor: 1250000, // 12 500 UAH
      balanceMinor: 0,
    },
    {
      id: "",
      name: "Cash",
      currency: "UAH",
      icon: "wallet",
      color: "#22c55e",
      initialBalanceMinor: 340000, // 3 400 UAH
      balanceMinor: 0,
    },
    {
      id: "",
      name: "Dollar Stash",
      currency: "USD",
      icon: "piggy-bank",
      color: "#3b82f6",
      initialBalanceMinor: 180000, // 1 800 USD
      balanceMinor: 0,
    },
    {
      id: "",
      name: "Revolut EUR",
      currency: "EUR",
      icon: "smartphone",
      color: "#8b5cf6",
      initialBalanceMinor: 42000, // 420 EUR
      balanceMinor: 0,
    },
  ];

  for (const wallet of wallets) {
    const ref = db.collection(`users/${uid}/wallets`).doc();
    wallet.id = ref.id;
    wallet.balanceMinor = wallet.initialBalanceMinor;
  }

  const mono = wallets[0];
  const cash = wallets[1];
  const usd = wallets[2];
  const eur = wallets[3];

  interface SeedTx {
    type: "income" | "expense" | "transfer";
    amountMinor: number;
    currency: string;
    walletId: string;
    toWalletId?: string;
    toAmountMinor?: number;
    categoryId?: string;
    date: Date;
    note: string;
  }

  const txs: SeedTx[] = [];

  const expense = (
    wallet: SeedWallet,
    category: string,
    amountMinor: number,
    date: Date,
    note: string
  ) => {
    txs.push({
      type: "expense",
      amountMinor,
      currency: wallet.currency,
      walletId: wallet.id,
      categoryId: categoryIds.get(category),
      date,
      note,
    });
    wallet.balanceMinor -= amountMinor;
  };

  const income = (
    wallet: SeedWallet,
    category: string,
    amountMinor: number,
    date: Date,
    note: string
  ) => {
    txs.push({
      type: "income",
      amountMinor,
      currency: wallet.currency,
      walletId: wallet.id,
      categoryId: categoryIds.get(category),
      date,
      note,
    });
    wallet.balanceMinor += amountMinor;
  };

  const transfer = (
    from: SeedWallet,
    to: SeedWallet,
    amountMinor: number,
    toAmountMinor: number,
    date: Date,
    note: string
  ) => {
    txs.push({
      type: "transfer",
      amountMinor,
      currency: from.currency,
      walletId: from.id,
      toWalletId: to.id,
      toAmountMinor,
      date,
      note,
    });
    from.balanceMinor -= amountMinor;
    to.balanceMinor += toAmountMinor;
  };

  // ~4 months of history ending today.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 4, 1);

  const groceryNotes = ["Silpo", "ATB", "Novus", "Fora", "Metro"];
  const cafeNotes = ["Coffee", "Lunch with friends", "Pizza night", "Sushi", "Brunch"];
  const transportNotes = ["Metro top-up", "Uklon", "Bolt", "Train ticket"];
  const shoppingNotes = ["Zara", "Rozetka order", "New sneakers", "Book haul"];
  const entertainmentNotes = ["Cinema", "Concert tickets", "Bowling", "Museum"];

  for (
    let month = new Date(start);
    month <= now;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    const y = month.getFullYear();
    const m = month.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();
    const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

    // Salary on the 1st business-ish day
    if (dateAt(y, m, 1) <= now) {
      income(mono, "Salary", randInt(52000, 60000) * 100, dateAt(y, m, randInt(1, 3), 10), "Monthly salary");
    }
    // Occasional freelance income
    if (rand() < 0.6 && dateAt(y, m, 15) <= now) {
      income(usd, "Freelance", randInt(250, 600) * 100, dateAt(y, m, randInt(12, 20)), "Freelance project");
    }

    // Rent + utilities
    if (dateAt(y, m, 5) <= now) {
      expense(mono, "Housing & Utilities", randInt(16000, 18500) * 100, dateAt(y, m, randInt(3, 6)), "Rent + utilities");
    }
    // Subscriptions
    if (dateAt(y, m, 8) <= now) {
      expense(mono, "Subscriptions", 33900, dateAt(y, m, 8), "Netflix + Spotify");
      expense(mono, "Subscriptions", 9900, dateAt(y, m, 10), "iCloud storage");
    }

    // Groceries: ~10 times a month
    for (let i = 0; i < 10; i++) {
      const day = randInt(1, lastDay);
      expense(
        rand() < 0.8 ? mono : cash,
        "Groceries",
        randInt(300, 1600) * 100,
        dateAt(y, m, day, 19),
        pick(groceryNotes)
      );
    }
    // Cafes: ~6 times a month
    for (let i = 0; i < 6; i++) {
      const day = randInt(1, lastDay);
      expense(
        rand() < 0.6 ? mono : cash,
        "Cafes & Restaurants",
        randInt(180, 950) * 100,
        dateAt(y, m, day, 13),
        pick(cafeNotes)
      );
    }
    // Transport: ~8 times a month
    for (let i = 0; i < 8; i++) {
      const day = randInt(1, lastDay);
      expense(
        rand() < 0.5 ? mono : cash,
        "Transport",
        randInt(50, 350) * 100,
        dateAt(y, m, day, 8),
        pick(transportNotes)
      );
    }
    // Shopping: 1-3 times a month
    for (let i = 0; i < randInt(1, 3); i++) {
      const day = randInt(1, lastDay);
      expense(mono, "Shopping", randInt(800, 4500) * 100, dateAt(y, m, day), pick(shoppingNotes));
    }
    // Entertainment: 1-2 times
    for (let i = 0; i < randInt(1, 2); i++) {
      const day = randInt(1, lastDay);
      expense(mono, "Entertainment", randInt(300, 1200) * 100, dateAt(y, m, day, randInt(17, 23)), pick(entertainmentNotes));
    }
    // Health: sometimes
    if (rand() < 0.5) {
      expense(mono, "Health", randInt(400, 2500) * 100, dateAt(y, m, randInt(1, lastDay)), "Pharmacy");
    }
    // Education: sometimes
    if (rand() < 0.3) {
      expense(mono, "Education", randInt(500, 1500) * 100, dateAt(y, m, randInt(1, lastDay)), "Online course");
    }

    // Cash withdrawal (transfer Mono -> Cash) once a month
    if (dateAt(y, m, 12) <= now) {
      const amount = randInt(2000, 4000) * 100;
      transfer(mono, cash, amount, amount, dateAt(y, m, randInt(10, 14)), "ATM withdrawal");
    }
    // Savings: buy USD every other month
    if (m % 2 === 0 && dateAt(y, m, 20) <= now) {
      const usdAmount = randInt(100, 300) * 100;
      const rate = 41.5 + rand() * 1.5;
      transfer(mono, usd, Math.round((usdAmount / 100) * rate) * 100, usdAmount, dateAt(y, m, randInt(18, 22)), "Buying dollars");
    }
    // EUR spending while traveling: occasionally
    if (rand() < 0.4) {
      const day = randInt(1, lastDay);
      expense(eur, "Cafes & Restaurants", randInt(15, 60) * 100, dateAt(y, m, day), "Trip: dinner");
      expense(eur, "Transport", randInt(10, 40) * 100, dateAt(y, m, Math.min(day + 1, lastDay)), "Trip: train");
    }
  }

  // Drop future-dated txs (can happen for random days in the current month)
  const finalTxs = txs.filter((t) => t.date <= now);

  // Write transactions in batches
  for (let i = 0; i < finalTxs.length; i += 400) {
    const batch = db.batch();
    for (const tx of finalTxs.slice(i, i + 400)) {
      const ref = db.collection(`users/${uid}/transactions`).doc();
      const { date, ...rest } = tx;
      const data: Record<string, unknown> = {
        ...rest,
        date: Timestamp.fromDate(date),
        note: tx.note,
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.set(ref, data);
    }
    await batch.commit();
  }

  // Recompute exact balances from the final tx list to keep them consistent
  for (const wallet of wallets) {
    wallet.balanceMinor = wallet.initialBalanceMinor;
  }
  for (const tx of finalTxs) {
    const from = wallets.find((w) => w.id === tx.walletId);
    const to = tx.toWalletId ? wallets.find((w) => w.id === tx.toWalletId) : undefined;
    if (!from) continue;
    if (tx.type === "income") from.balanceMinor += tx.amountMinor;
    else from.balanceMinor -= tx.amountMinor;
    if (tx.type === "transfer" && to && tx.toAmountMinor) {
      to.balanceMinor += tx.toAmountMinor;
    }
  }

  {
    const batch = db.batch();
    for (const wallet of wallets) {
      batch.set(db.doc(`users/${uid}/wallets/${wallet.id}`), {
        name: wallet.name,
        currency: wallet.currency,
        balanceMinor: wallet.balanceMinor,
        icon: wallet.icon,
        color: wallet.color,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  console.log(`Created ${wallets.length} wallets and ${finalTxs.length} transactions.`);
  console.log(`Sign in as: ${USER_EMAIL} / ${USER_PASSWORD} (uid: ${uid})`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
