/**
 * Deletes all Firestore data belonging to a single account.
 *
 * Usage:
 *   pnpm reset-user --email you@spendly.test
 *   pnpm reset-user --email you@spendly.test --password s3cret
 *   pnpm reset-user --email you@spendly.test --delete-account
 *
 * The account password is required. The script signs in through the Firebase
 * Auth REST API first, so a service account key alone is not enough to wipe
 * somebody else's data. By default only the Firestore documents are removed and
 * the account itself stays; pass --delete-account to remove it from Auth too.
 */
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { clearCollection, countDocuments, initAdmin, USER_SUBCOLLECTIONS } from "./lib/admin";

const USAGE = `Usage: pnpm reset-user --email <email> [--password <password>] [--delete-account]

  --email, -e        account whose data should be deleted (required)
  --password, -p     account password; prompted for if omitted
  --delete-account   also delete the account from Firebase Auth
  --help, -h         show this message`;

const SIGN_IN_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

const AUTH_ERRORS: Record<string, string> = {
  EMAIL_NOT_FOUND: "No account with this email",
  INVALID_PASSWORD: "Wrong password",
  INVALID_LOGIN_CREDENTIALS: "Wrong email or password",
  USER_DISABLED: "This account is disabled",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many failed attempts, try again later",
};

function parseOptions() {
  try {
    return parseArgs({
      options: {
        email: { type: "string", short: "e" },
        password: { type: "string", short: "p" },
        "delete-account": { type: "boolean", default: false },
        help: { type: "boolean", short: "h" },
      },
    }).values;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`\n${USAGE}`);
    process.exit(1);
  }
}

/** Reads a line from stdin without echoing it back to the terminal. */
async function promptPassword(question: string): Promise<string> {
  process.stdout.write(question);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  (rl as unknown as { _writeToOutput: (chunk: string) => void })._writeToOutput = () => {};
  try {
    return await rl.question("");
  } finally {
    rl.close();
    process.stdout.write("\n");
  }
}

/** Verifies the password against Firebase Auth and returns the signed-in uid. */
async function verifyPassword(email: string, password: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set (see .env.example)");
  }

  const response = await fetch(`${SIGN_IN_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await response.json()) as {
    localId?: string;
    error?: { message?: string };
  };

  if (!response.ok || !body.localId) {
    const code = body.error?.message?.split(" ")[0] ?? "UNKNOWN_ERROR";
    throw new Error(AUTH_ERRORS[code] ?? `Sign-in failed: ${code}`);
  }
  return body.localId;
}

async function main() {
  const options = parseOptions();
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const email = options.email ?? process.env.SEED_EMAIL;
  if (!email) {
    console.error("--email is required\n");
    console.error(USAGE);
    process.exit(1);
  }

  const { auth, db } = initAdmin();
  const user = await auth.getUserByEmail(email).catch((error: unknown) => {
    if ((error as { code?: string }).code === "auth/user-not-found") return null;
    throw error;
  });
  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  const counts = await Promise.all(
    USER_SUBCOLLECTIONS.map(async (name) => ({
      name,
      count: await countDocuments(db, `users/${user.uid}/${name}`),
    }))
  );

  console.log(`Account: ${email} (uid: ${user.uid})`);
  console.log("About to delete:");
  for (const { name, count } of counts) {
    console.log(`  ${count} ${name}`);
  }
  if (options["delete-account"]) {
    console.log("  the account itself (Firebase Auth)");
  }

  const password = options.password ?? (await promptPassword("Password to confirm: "));
  const signedInUid = await verifyPassword(email, password);
  if (signedInUid !== user.uid) {
    throw new Error("Signed-in account does not match the requested one");
  }

  for (const { name } of counts) {
    const deleted = await clearCollection(db, `users/${user.uid}/${name}`);
    console.log(`Deleted ${deleted} ${name}`);
  }
  await db.doc(`users/${user.uid}`).delete();
  console.log("Deleted the user profile document");

  if (options["delete-account"]) {
    await auth.deleteUser(user.uid);
    console.log("Deleted the Firebase Auth account");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
