import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

const db = getFirestore();

type PaymentFrequency = "monthly" | "everyTwoMonths" | "semiannual" | "yearly";

interface RecurringPaymentData {
  type: "income" | "expense";
  amountMinor: number;
  currency: string;
  walletId: string;
  walletName?: string;
  categoryId: string;
  note: string;
  frequency: PaymentFrequency;
  dayOfMonth: number;
  nextRunAt: Timestamp;
  isActive: boolean;
}

const monthsByFrequency: Record<PaymentFrequency, number> = {
  monthly: 1,
  everyTwoMonths: 2,
  semiannual: 6,
  yearly: 12,
};

function dateForPaymentDay(year: number, month: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDay), 12, 0, 0, 0);
}

function followingRunAt(currentRunAt: Date, frequency: PaymentFrequency, dayOfMonth: number): Date {
  return dateForPaymentDay(
    currentRunAt.getFullYear(),
    currentRunAt.getMonth() + monthsByFrequency[frequency],
    dayOfMonth
  );
}

function occurrenceId(scheduleId: string, scheduledFor: Date): string {
  return `${scheduleId}_${scheduledFor.toISOString().slice(0, 10)}`;
}

/**
 * Runs once a day in the user's expected timezone. It turns due payment rules
 * into normal transactions and updates the wallet balance atomically.
 */
export const processRecurringPayments = onSchedule(
  { schedule: "5 0 * * *", timeZone: "Europe/Kyiv", region: "europe-west1" },
  async () => {
    const now = Timestamp.now();
    const dueSchedules = await db
      .collectionGroup("recurringTransactions")
      .where("isActive", "==", true)
      .where("nextRunAt", "<=", now)
      .get();

    await Promise.all(
      dueSchedules.docs.map(async (scheduleSnapshot) => {
        const scheduleRef = scheduleSnapshot.ref;
        const path = scheduleRef.path.split("/");
        const uid = path[1];
        if (!uid) return;

        await db.runTransaction(async (transaction) => {
          const freshSchedule = await transaction.get(scheduleRef);
          if (!freshSchedule.exists) return;

          const schedule = freshSchedule.data() as RecurringPaymentData;
          if (!schedule.isActive || schedule.nextRunAt.toMillis() > now.toMillis()) return;

          const scheduledFor = schedule.nextRunAt.toDate();
          const nextRunAt = followingRunAt(scheduledFor, schedule.frequency, schedule.dayOfMonth);
          const walletRef = db.doc(`users/${uid}/wallets/${schedule.walletId}`);
          const walletSnapshot = await transaction.get(walletRef);

          // A removed wallet must not keep producing payments forever.
          if (!walletSnapshot.exists) {
            transaction.update(scheduleRef, {
              isActive: false,
              lastRunStatus: "paused_wallet_missing",
              updatedAt: FieldValue.serverTimestamp(),
            });
            return;
          }

          const wallet = walletSnapshot.data();
          if (!wallet) return;
          const balanceMinor = wallet.balanceMinor as number;
          const delta = schedule.type === "income" ? schedule.amountMinor : -schedule.amountMinor;

          // Skip an expense which cannot be paid. The schedule advances so the
          // same payment is not attempted and reported repeatedly every day.
          if (balanceMinor + delta < 0) {
            transaction.update(scheduleRef, {
              nextRunAt: Timestamp.fromDate(nextRunAt),
              lastRunStatus: "skipped_insufficient_funds",
              lastAttemptAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            return;
          }

          const paymentRef = db.doc(
            `users/${uid}/transactions/${occurrenceId(scheduleRef.id, scheduledFor)}`
          );
          const existingPayment = await transaction.get(paymentRef);
          if (existingPayment.exists) return;

          transaction.create(paymentRef, {
            id: paymentRef.id,
            type: schedule.type,
            amountMinor: schedule.amountMinor,
            currency: schedule.currency,
            walletId: schedule.walletId,
            walletName: wallet.name ?? schedule.walletName ?? "Deleted wallet",
            categoryId: schedule.categoryId,
            date: Timestamp.fromDate(scheduledFor),
            note: schedule.note,
            isAutomatic: true,
            recurringTransactionId: scheduleRef.id,
            createdAt: FieldValue.serverTimestamp(),
          });
          transaction.update(walletRef, { balanceMinor: balanceMinor + delta });
          transaction.update(scheduleRef, {
            nextRunAt: Timestamp.fromDate(nextRunAt),
            lastRunStatus: "created",
            lastRunAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
      })
    );
  }
);
