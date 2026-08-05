import {
  addDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CurrencyCode, Wallet, WalletType } from "@/lib/types";
import { transactionsRef, walletRef, walletsRef } from "./refs";

export interface WalletInput {
  name: string;
  currency: CurrencyCode;
  icon: string;
  color: string;
  /** Starting balance in minor units. */
  initialBalanceMinor: number;
  walletType: WalletType;
  /** Required when walletType is "credit", minor units. */
  creditLimitMinor?: number;
  /** Required when walletType is "credit", day of month (1-31). */
  creditDueDay?: number;
}

export function subscribeToWallets(
  uid: string,
  callback: (wallets: Wallet[]) => void
): () => void {
  const q = query(walletsRef(uid), orderBy("createdAt"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => d.data()));
  });
}

export async function createWallet(uid: string, input: WalletInput): Promise<string> {
  if (input.walletType === "credit" && (!input.creditLimitMinor || input.creditLimitMinor <= 0)) {
    throw new Error("Credit wallets require a positive credit limit");
  }

  // Credit wallets start at full available credit (balanceMinor === limit).
  // Standard wallets start at whatever the user typed as a starting balance.
  const balanceMinor =
    input.walletType === "credit" ? input.creditLimitMinor! : input.initialBalanceMinor;

  const ref = await addDoc(walletsRef(uid), {
    id: "",
    name: input.name,
    currency: input.currency,
    balanceMinor,
    icon: input.icon,
    color: input.color,
    walletType: input.walletType,
    ...(input.walletType === "credit"
      ? {
          creditLimitMinor: input.creditLimitMinor,
          creditDueDay: input.creditDueDay,
        }
      : {}),
    createdAt: serverTimestamp() as unknown as Timestamp,
  });
  return ref.id;
}

export async function updateWallet(
  uid: string,
  walletId: string,
  input: Pick<WalletInput, "name" | "icon" | "color">
): Promise<void> {
  await updateDoc(walletRef(uid, walletId), {
    name: input.name,
    icon: input.icon,
    color: input.color,
  });
}

export async function deleteWallet(uid: string, walletId: string): Promise<void> {
  const batch = writeBatch(db);

  // A wallet can be referenced by a transaction two ways:
  // - as the primary wallet (income/expense/transfer source)
  // - as the destination of a transfer (toWalletId)
  const [ownedSnap, receivedSnap] = await Promise.all([
    getDocs(query(transactionsRef(uid), where("walletId", "==", walletId))),
    getDocs(query(transactionsRef(uid), where("toWalletId", "==", walletId))),
  ]);

  const seen = new Set<string>();
  for (const docSnap of [...ownedSnap.docs, ...receivedSnap.docs]) {
    if (seen.has(docSnap.id)) continue;
    seen.add(docSnap.id);
    batch.delete(docSnap.ref);
  }

  batch.delete(walletRef(uid, walletId));

  await batch.commit();
}
