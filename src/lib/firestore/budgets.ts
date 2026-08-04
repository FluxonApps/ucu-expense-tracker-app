import { differenceInCalendarDays, startOfDay } from "date-fns";
import {
  doc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import type { BudgetGoal, CurrencyCode } from "@/lib/types";
import { budgetGoalRef, budgetGoalsRef } from "./refs";

/**
 * Data received from the create/edit form.
 * deadline is converted into periodDays before saving.
 */
export interface BudgetGoalInput {
  categoryId: string;
  limitMinor: number;
  currency: CurrencyCode;
  startDate: Date;
  deadline: Date;
}

/**
 * Calculates the inclusive cycle length.
 *
 * Example:
 * 4 August → 13 August = 10 days.
 */
function calculatePeriodDays(startDate: Date, deadline: Date): number {
  return (
    differenceInCalendarDays(
      startOfDay(deadline),
      startOfDay(startDate)
    ) + 1
  );
}

/**
 * Realtime subscription to the user's budget goals.
 * The callback runs whenever a goal is created or edited.
 */
export function subscribeToBudgetGoals(
  uid: string,
  callback: (goals: BudgetGoal[]) => void
): () => void {
  const goalsQuery = query(
    budgetGoalsRef(uid),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(goalsQuery, (snapshot) => {
    callback(snapshot.docs.map((document) => document.data()));
  });
}

/**
 * Creates a new budget goal.
 */
export async function createBudgetGoal(
  uid: string,
  input: BudgetGoalInput
): Promise<void> {
  if (input.limitMinor <= 0) {
    throw new Error("Budget limit must be greater than zero");
  }

  const periodDays = calculatePeriodDays(
    input.startDate,
    input.deadline
  );

  if (periodDays <= 0) {
    throw new Error("Deadline cannot be before the start date");
  }

  const goalRef = doc(budgetGoalsRef(uid));

  await setDoc(goalRef, {
    id: goalRef.id,
    categoryId: input.categoryId,
    limitMinor: input.limitMinor,
    currency: input.currency,
    startDate: Timestamp.fromDate(startOfDay(input.startDate)),
    periodDays,
    createdAt: serverTimestamp() as unknown as Timestamp,
  });
}

/**
 * Updates all editable goal parameters.
 *
 * Editing starts a new cycle from today and calculates
 * a new period length from the selected deadline.
 */
export async function updateBudgetGoal(
  uid: string,
  goalId: string,
  input: BudgetGoalInput
): Promise<void> {
  if (input.limitMinor <= 0) {
    throw new Error("Budget limit must be greater than zero");
  }

  const periodDays = calculatePeriodDays(
    input.startDate,
    input.deadline
  );

  if (periodDays <= 0) {
    throw new Error("Deadline cannot be before the start date");
  }

  await updateDoc(budgetGoalRef(uid, goalId), {
    categoryId: input.categoryId,
    limitMinor: input.limitMinor,
    currency: input.currency,
    startDate: Timestamp.fromDate(startOfDay(input.startDate)),
    periodDays,
  });
}

export async function deleteBudgetGoal(
  uid: string,
  goalId: string
): Promise<void> {
  await deleteDoc(budgetGoalRef(uid, goalId));
}