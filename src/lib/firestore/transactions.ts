import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryConstraint,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CurrencyCode, Transaction, TransactionType } from "@/lib/types";
import { transactionRef, transactionsRef, walletRef } from "./refs";

export interface TransactionInput {
  type: "income" | "expense";
  amountMinor: number;
  currency: CurrencyCode;
  walletId: string;
  categoryId: string;
  date: Date;
  note: string;
}

export interface TransferInput {
  amountMinor: number;
  currency: CurrencyCode;
  walletId: string;
  toWalletId: string;
  /** Amount credited to the destination wallet (after conversion). */
  toAmountMinor: number;
  date: Date;
  note: string;
}

export interface TransactionFilters {
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
  dateFrom?: Date;
  dateTo?: Date;
}

export const TRANSACTIONS_PAGE_SIZE = 20;

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function createTransaction(
  uid: string,
  input: TransactionInput
): Promise<void> {
  if (input.amountMinor <= 0) {
    throw new Error("Transaction amount must be greater than zero");
  }

  const txRef = doc(transactionsRef(uid));
  const wRef = walletRef(uid, input.walletId);

  const walletSnap = await getDoc(wRef);
  if (!walletSnap.exists()) throw new Error("Wallet not found");
  const wallet = walletSnap.data();

  const delta = input.type === "income" ? input.amountMinor : -input.amountMinor;
  const newBalance = wallet.balanceMinor + delta;

  if (newBalance < 0) {
    throw new Error("Insufficient balance: this expense would make the wallet negative");
  }

  await setDoc(txRef, {
    id: txRef.id,
    type: input.type,
    amountMinor: input.amountMinor,
    currency: input.currency,
    walletId: input.walletId,
    categoryId: input.categoryId,
    date: Timestamp.fromDate(input.date),
    note: input.note,
    createdAt: serverTimestamp() as unknown as Timestamp,
  });
  await updateDoc(wRef, { balanceMinor: newBalance });
}

export async function updateTransaction(
  uid: string,
  txId: string,
  input: TransactionInput
): Promise<void> {
  if (input.amountMinor <= 0) {
    throw new Error("Transaction amount must be greater than zero");
  }

  const txRef = transactionRef(uid, txId);
  const wRef = walletRef(uid, input.walletId);

  await runTransaction(db, async (t) => {
    const txSnap = await t.get(txRef);
    if (!txSnap.exists()) throw new Error("Transaction not found");
    const oldTx = txSnap.data();
    if (oldTx.type === "transfer") throw new Error("Transfers cannot be edited");

    const walletSnap = await t.get(wRef);
    if (!walletSnap.exists()) throw new Error("Wallet not found");
    const wallet = walletSnap.data();

    const oldDelta = oldTx.type === "income" ? -oldTx.amountMinor : oldTx.amountMinor;
    const newDelta = input.type === "income" ? input.amountMinor : -input.amountMinor;

    const newBalance = wallet.balanceMinor + oldDelta + newDelta;

    if (newBalance < 0) {
      throw new Error("Insufficient balance: this change would make the wallet negative");
    }

    t.update(txRef, {
      type: input.type,
      amountMinor: input.amountMinor,
      currency: input.currency,
      walletId: input.walletId,
      categoryId: input.categoryId,
      date: Timestamp.fromDate(input.date),
      note: input.note,
    });
    t.update(wRef, { balanceMinor: newBalance });
  });
}

export async function deleteTransaction(uid: string, txId: string): Promise<void> {
  await deleteDoc(transactionRef(uid, txId));
}

export async function createTransfer(uid: string, input: TransferInput): Promise<void> {
  if (input.walletId === input.toWalletId) {
    throw new Error("Cannot transfer to the same wallet");
  }

  if (input.amountMinor <= 0 || input.toAmountMinor <= 0) {
    throw new Error("Transfer amount must be greater than zero");
  }

  const txRef = doc(transactionsRef(uid));
  const fromRef = walletRef(uid, input.walletId);
  const toRef = walletRef(uid, input.toWalletId);

  await runTransaction(db, async (t) => {
    const fromSnap = await t.get(fromRef);
    const toSnap = await t.get(toRef);
    if (!fromSnap.exists() || !toSnap.exists()) throw new Error("Wallet not found");

    const newFromBalance = fromSnap.data().balanceMinor - input.amountMinor;
    if (newFromBalance < 0) {
      throw new Error("Insufficient balance: this transfer would make the wallet negative");
    }

    t.set(txRef, {
      id: txRef.id,
      type: "transfer",
      amountMinor: input.amountMinor,
      currency: input.currency,
      walletId: input.walletId,
      toWalletId: input.toWalletId,
      toAmountMinor: input.toAmountMinor,
      date: Timestamp.fromDate(input.date),
      note: input.note,
      createdAt: serverTimestamp() as unknown as Timestamp,
    });
    t.update(fromRef, { balanceMinor: fromSnap.data().balanceMinor - input.amountMinor });
    t.update(toRef, { balanceMinor: toSnap.data().balanceMinor + input.toAmountMinor });
  });
}

export interface TransactionsPage {
  transactions: Transaction[];
  /** Cursor for the next page; null when there are no more results. */
  cursor: Timestamp | null;
}

function buildConstraints(filters: TransactionFilters): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (filters.walletId) constraints.push(where("walletId", "==", filters.walletId));
  if (filters.categoryId) constraints.push(where("categoryId", "==", filters.categoryId));
  if (filters.type) constraints.push(where("type", "==", filters.type));
  if (filters.dateFrom) {
    constraints.push(where("date", ">=", Timestamp.fromDate(filters.dateFrom)));
  }
  if (filters.dateTo) {
    constraints.push(where("date", "<=", Timestamp.fromDate(endOfDay(filters.dateTo))));
  }
  constraints.push(orderBy("date", "desc"));
  return constraints;
}

export async function fetchTransactionsPage(
  uid: string,
  filters: TransactionFilters,
  cursor?: Timestamp | null
): Promise<TransactionsPage> {
  const constraints = buildConstraints(filters);
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(TRANSACTIONS_PAGE_SIZE));

  const snapshot = await getDocs(query(transactionsRef(uid), ...constraints));
  const transactions = snapshot.docs.map((d) => d.data());
  const nextCursor =
    snapshot.docs.length === TRANSACTIONS_PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1].data().date
      : null;
  return { transactions, cursor: nextCursor };
}

/** Live subscription to all transactions in a date range (used by the dashboard). */
export function subscribeToTransactionsInRange(
  uid: string,
  from: Date,
  to: Date,
  callback: (transactions: Transaction[]) => void
): () => void {
  const q = query(
    transactionsRef(uid),
    where("date", ">=", Timestamp.fromDate(from)),
    where("date", "<=", Timestamp.fromDate(endOfDay(to))),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => d.data()));
  });
}
