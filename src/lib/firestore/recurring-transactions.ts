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
import type { CurrencyCode, PaymentFrequency, RecurringTransaction } from "@/lib/types";
import { recurringTransactionRef, recurringTransactionsRef } from "./refs";

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
): Promise<void> {
  if (input.amountMinor <= 0) throw new Error("Transaction amount must be greater than zero");
  if (input.dayOfMonth < 1 || input.dayOfMonth > 31) throw new Error("Invalid payment day");

  const { startDate, ...schedule } = input;
  await addDoc(recurringTransactionsRef(uid), {
    id: "",
    ...schedule,
    nextRunAt: Timestamp.fromDate(firstRunAt(startDate, input.dayOfMonth)),
    isActive: true,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  });
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
  await updateDoc(recurringTransactionRef(uid, scheduleId), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export function deleteRecurringTransaction(uid: string, scheduleId: string): Promise<void> {
  return deleteDoc(recurringTransactionRef(uid, scheduleId));
}
