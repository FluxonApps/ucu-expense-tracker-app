import {
  addDoc,
  getDoc,
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
import type { CurrencyCode, Wallet } from "@/lib/types";
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
  const ref = await addDoc(walletsRef(uid), {
    id: "",
    name: input.name,
    currency: input.currency,
    balanceMinor: input.initialBalanceMinor,
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
  const wRef = walletRef(uid, walletId);
  const walletSnap = await getDoc(wRef);
  if (!walletSnap.exists()) throw new Error("Wallet not found");

  const walletName = walletSnap.data().name;
  const [sourceTransactions, destinationTransactions] = await Promise.all([
    getDocs(query(transactionsRef(uid), where("walletId", "==", walletId))),
    getDocs(query(transactionsRef(uid), where("toWalletId", "==", walletId))),
  ]);

  const batch = writeBatch(db);
  for (const transaction of sourceTransactions.docs) {
    batch.update(transaction.ref, { walletName });
  }
  for (const transaction of destinationTransactions.docs) {
    batch.update(transaction.ref, { toWalletName: walletName });
  }
  batch.delete(wRef);
  await batch.commit();
}
