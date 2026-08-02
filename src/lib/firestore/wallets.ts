import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { CurrencyCode, Wallet } from "@/lib/types";
import { walletRef, walletsRef } from "./refs";

export interface WalletInput {
  name: string;
  currency: CurrencyCode;
  icon: string;
  color: string;
  /** Starting balance in minor units. */
  initialBalanceMinor: number;
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
  await deleteDoc(walletRef(uid, walletId));
}
