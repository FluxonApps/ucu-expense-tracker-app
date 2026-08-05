import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CurrencyCode, PaymentFrequency, RecurringTransaction } from "@/lib/types";
import {
  recurringTransactionRef,
  recurringTransactionsRef,
  transactionsRef,
  walletRef,
} from "./refs";

export interface RecurringTransactionInput {
  type: "income" | "expense";
  amountMinor: number;
  currency: CurrencyCode;
  walletId: string;
  walletName: string;
  categoryId: string;
  note: string;
  frequency: PaymentFrequency;
  dayOfMonth: number;
  /** The date from which the selected day should first apply. */
  startDate: Date;
}

const FREQUENCY_MONTHS: Record<PaymentFrequency, number> = {
  monthly: 1,
  everyTwoMonths: 2,
  semiannual: 6,
  yearly: 12,
};

/**
 * Returns a valid calendar date. For example, a payment selected for the 31st
 * runs on February 28th/29th because that is the last day of that month.
 */
export function dateForPaymentDay(year: number, month: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDay), 12, 0, 0, 0);
}

/** Finds the first scheduled payment on or after startDate. */
export function firstRunAt(startDate: Date, dayOfMonth: number): Date {
  const candidate = dateForPaymentDay(startDate.getFullYear(), startDate.getMonth(), dayOfMonth);
  if (candidate >= startDate) return candidate;
  return dateForPaymentDay(startDate.getFullYear(), startDate.getMonth() + 1, dayOfMonth);
}

/** Used by the scheduler after it creates one occurrence. */
export function nextRunAt(
  currentRunAt: Date,
  frequency: PaymentFrequency,
  dayOfMonth: number
): Date {
  const months = FREQUENCY_MONTHS[frequency];
  return dateForPaymentDay(
    currentRunAt.getFullYear(),
    currentRunAt.getMonth() + months,
    dayOfMonth
  );
}

export function subscribeToRecurringTransactions(
  uid: string,
  callback: (schedules: RecurringTransaction[]) => void
): () => void {
  const schedulesQuery = query(recurringTransactionsRef(uid), orderBy("nextRunAt", "asc"));
  return onSnapshot(schedulesQuery, (snapshot) => {
    callback(snapshot.docs.map((schedule) => schedule.data()));
  });
}

export async function createRecurringTransaction(
  uid: string,
  input: RecurringTransactionInput
): Promise<boolean> {
  if (input.amountMinor <= 0) throw new Error("Transaction amount must be greater than zero");
  if (input.dayOfMonth < 1 || input.dayOfMonth > 31) throw new Error("Invalid payment day");

  const { startDate, ...schedule } = input;
  const firstPaymentAt = firstRunAt(startDate, input.dayOfMonth);

  // Future schedules only need their rule saved. If the first chosen payment
  // is already due, create its history entry and update the balance right now
  // instead of waiting for the next Cloud Scheduler invocation.
  if (firstPaymentAt > new Date()) {
    await addDoc(recurringTransactionsRef(uid), {
      id: "",
      ...schedule,
      nextRunAt: Timestamp.fromDate(firstPaymentAt),
      isActive: true,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    });
    return false;
  }

  const scheduleRef = doc(recurringTransactionsRef(uid));
  const paymentRef = doc(
    transactionsRef(uid),
    `${scheduleRef.id}_${firstPaymentAt.toISOString().slice(0, 10)}`
  );
  const sourceWalletRef = walletRef(uid, input.walletId);

  await runTransaction(db, async (transaction) => {
    const walletSnapshot = await transaction.get(sourceWalletRef);
    if (!walletSnapshot.exists()) throw new Error("Wallet not found");

    const wallet = walletSnapshot.data();
    const delta = input.type === "income" ? input.amountMinor : -input.amountMinor;
    if (wallet.balanceMinor + delta < 0) {
      throw new Error("Insufficient balance: this expense would make the wallet negative");
    }

    transaction.set(scheduleRef, {
      id: scheduleRef.id,
      ...schedule,
      nextRunAt: Timestamp.fromDate(nextRunAt(firstPaymentAt, input.frequency, input.dayOfMonth)),
      isActive: true,
      createdAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    });
    transaction.set(paymentRef, {
      id: paymentRef.id,
      type: input.type,
      amountMinor: input.amountMinor,
      currency: input.currency,
      walletId: input.walletId,
      walletName: wallet.name ?? input.walletName,
      categoryId: input.categoryId,
      date: Timestamp.fromDate(firstPaymentAt),
      note: input.note,
      isAutomatic: true,
      recurringTransactionId: scheduleRef.id,
      createdAt: serverTimestamp() as unknown as Timestamp,
    });
    transaction.update(sourceWalletRef, { balanceMinor: wallet.balanceMinor + delta });
  });

  return true;
}

export async function updateRecurringTransaction(
  uid: string,
  scheduleId: string,
  input: RecurringTransactionInput
): Promise<void> {
  if (input.amountMinor <= 0) throw new Error("Transaction amount must be greater than zero");
  if (input.dayOfMonth < 1 || input.dayOfMonth > 31) throw new Error("Invalid payment day");

  const { startDate, ...schedule } = input;
  await updateDoc(recurringTransactionRef(uid, scheduleId), {
    ...schedule,
    nextRunAt: Timestamp.fromDate(firstRunAt(startDate, input.dayOfMonth)),
    updatedAt: serverTimestamp(),
  });
}

export async function setRecurringTransactionActive(
  uid: string,
  scheduleId: string,
  isActive: boolean
): Promise<void> {
  const scheduleRef = recurringTransactionRef(uid, scheduleId);

  if (!isActive) {
    await updateDoc(scheduleRef, {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await runTransaction(db, async (transaction) => {
    const scheduleSnapshot = await transaction.get(scheduleRef);
    if (!scheduleSnapshot.exists()) throw new Error("Automatic payment not found");

    const schedule = scheduleSnapshot.data();
    const now = new Date();
    let next = schedule.nextRunAt.toDate();

    // Do not create payments for the time a schedule was paused. Resume it at
    // the next valid occurrence instead of letting the server backfill old ones.
    while (next <= now) {
      next = nextRunAt(next, schedule.frequency, schedule.dayOfMonth);
    }

    transaction.update(scheduleRef, {
      isActive: true,
      nextRunAt: Timestamp.fromDate(next),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Updates the future cadence of several schedules without changing their next payment date. */
export async function updateRecurringTransactionsFrequency(
  uid: string,
  scheduleIds: string[],
  frequency: PaymentFrequency
): Promise<void> {
  const ids = [...new Set(scheduleIds)];
  if (ids.length === 0) return;

  // Firestore permits no more than 500 writes in one batch.
  for (let start = 0; start < ids.length; start += 500) {
    const batch = writeBatch(db);
    ids.slice(start, start + 500).forEach((scheduleId) => {
      batch.update(recurringTransactionRef(uid, scheduleId), {
        frequency,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

export function deleteRecurringTransaction(uid: string, scheduleId: string): Promise<void> {
  return deleteDoc(recurringTransactionRef(uid, scheduleId));
}
