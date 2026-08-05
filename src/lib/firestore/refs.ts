import {
  collection,
  doc,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  BudgetGoal,
  Category,
  RecurringTransaction,
  Transaction,
  Wallet,
} from "@/lib/types";

function converter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T): DocumentData {
      const { id: _id, ...data } = model;
      return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return { id: snapshot.id, ...snapshot.data() } as T;
    },
  };
}

export const walletConverter = converter<Wallet>();
export const transactionConverter = converter<Transaction>();
export const categoryConverter = converter<Category>();
export const recurringTransactionConverter = converter<RecurringTransaction>();
export const budgetGoalConverter = converter<BudgetGoal>();

export function walletsRef(uid: string) {
  return collection(db, "users", uid, "wallets").withConverter(walletConverter);
}

export function walletRef(uid: string, walletId: string) {
  return doc(db, "users", uid, "wallets", walletId).withConverter(walletConverter);
}

export function transactionsRef(uid: string) {
  return collection(db, "users", uid, "transactions").withConverter(transactionConverter);
}

export function transactionRef(uid: string, txId: string) {
  return doc(db, "users", uid, "transactions", txId).withConverter(transactionConverter);
}

export function recurringTransactionsRef(uid: string) {
  return collection(db, "users", uid, "recurringTransactions").withConverter(
    recurringTransactionConverter
  );
}

export function recurringTransactionRef(uid: string, scheduleId: string) {
  return doc(db, "users", uid, "recurringTransactions", scheduleId).withConverter(
    recurringTransactionConverter
  );
}

export function categoriesRef(uid: string) {
  return collection(db, "users", uid, "categories").withConverter(categoryConverter);
}

export function categoryRef(uid: string, categoryId: string) {
  return doc(db, "users", uid, "categories", categoryId).withConverter(categoryConverter);
}

/** Collection containing all budget goals of one user. */
export function budgetGoalsRef(uid: string) {
  return collection(db, "users", uid, "budgetGoals").withConverter(
    budgetGoalConverter
  );
}

/** Reference to one particular budget goal. */
export function budgetGoalRef(uid: string, goalId: string) {
  return doc(db, "users", uid, "budgetGoals", goalId).withConverter(
    budgetGoalConverter
  );
}

export function userRef(uid: string) {
  return doc(db, "users", uid);
}
