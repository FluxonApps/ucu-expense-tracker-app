/**
 * Shared Firebase Admin bootstrap for the maintenance scripts (seed, reset-user).
 */
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ quiet: true });
config({ path: ".env.local", override: true, quiet: true });

/** Firestore caps a batch at 500 writes. */
const BATCH_SIZE = 400;

/** Collections that hold everything belonging to a single account. */
export const USER_SUBCOLLECTIONS = ["transactions", "wallets", "categories"] as const;

export interface Admin {
  auth: Auth;
  db: Firestore;
}

export function initAdmin(): Admin {
  if (getApps().length === 0) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      console.error("GOOGLE_APPLICATION_CREDENTIALS is not set (see .env.example)");
      process.exit(1);
    }
    const keyFile = resolve(credentialsPath);
    if (!existsSync(keyFile)) {
      console.error(`Service account key not found at ${keyFile} (see .env.example)`);
      process.exit(1);
    }
    initializeApp({ credential: cert(JSON.parse(readFileSync(keyFile, "utf8"))) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

/** Deletes every document in a collection. Returns how many were removed. */
export async function clearCollection(db: Firestore, path: string): Promise<number> {
  const snapshot = await db.collection(path).get();
  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of snapshot.docs.slice(i, i + BATCH_SIZE)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
  return snapshot.size;
}

export async function countDocuments(db: Firestore, path: string): Promise<number> {
  const snapshot = await db.collection(path).count().get();
  return snapshot.data().count;
}
