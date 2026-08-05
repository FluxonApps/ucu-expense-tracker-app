"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  MoreVertical,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { AppIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CURRENCY_SYMBOLS, formatMoney } from "@/lib/currencies";
import {
  createBudgetGoal,
  deleteBudgetGoal,
  subscribeToBudgetGoals,
  updateBudgetGoal,
} from "@/lib/firestore/budgets";
import { subscribeToTransactionsInRange } from "@/lib/firestore/transactions";
import type {
  BudgetGoal,
  CurrencyCode,
  Transaction,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  convertMinor,
  useCurrencyRates,
} from "@/lib/use-currency-rates";

const BASE_CURRENCY: CurrencyCode = "UAH";

/**
 * Finds the active repeating cycle for a goal.
 *
 * No Firestore update is required when a cycle expires.
 * The active period is calculated from startDate and periodDays.
 */
function getCurrentGoalCycle(goal: BudgetGoal, currentDate: Date) {
  const firstStart = startOfDay(goal.startDate.toDate());
  const today = startOfDay(currentDate);

  const elapsedDays = Math.max(
    differenceInCalendarDays(today, firstStart),
    0
  );

  const cycleIndex = Math.floor(elapsedDays / goal.periodDays);

  const cycleStart = addDays(
    firstStart,
    cycleIndex * goal.periodDays
  );

  const cycleEnd = addDays(
    cycleStart,
    goal.periodDays - 1
  );

  const daysLeft = differenceInCalendarDays(
    cycleEnd,
    today
  );

  return {
    cycleStart,
    cycleEnd,
    daysLeft,
    isLastDay: daysLeft === 0,
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { wallets, categories, walletsLoading } = useData();
  const { displayCurrency } = useDisplayCurrency();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // Budget goals loaded from Firestore.
  const [budgetGoals, setBudgetGoals] = useState<BudgetGoal[]>([]);
  const [budgetGoalsLoading, setBudgetGoalsLoading] = useState(true);

  // Create/edit dialog.
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<BudgetGoal | null>(null);

  // Form fields.
  const [goalCategoryId, setGoalCategoryId] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  // Confirmation before editing.
  const [editConfirmationOpen, setEditConfirmationOpen] = useState(false);

  // Delete confirmation.
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] =
    useState(false);

  const [goalToDelete, setGoalToDelete] =
    useState<BudgetGoal | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
  const timer = window.setInterval(() => {
    setNow(new Date());
  }, 24 * 60 * 60 * 1000);

  return () => window.clearInterval(timer);
}, []);

  const rangeStart = useMemo(() => startOfMonth(subMonths(now, 5)), [now]);
  const rangeEnd = useMemo(() => endOfMonth(now), [now]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTransactionsInRange(
      user.uid,
      rangeStart,
      rangeEnd,
      (next) => {
        setTransactions(next);
        setTxLoading(false);
      }
    );
    return unsubscribe;
  }, [user, rangeStart, rangeEnd]);

  useEffect(() => {
  // Якщо користувач вийшов із профілю,
  // очищаємо цілі, які належали попередньому користувачу.
    if (!user) {
      setBudgetGoals([]);
      setBudgetGoalsLoading(false);
      return;
    }

  /*
   * Підписуємося на колекцію budgetGoals у Firestore.
   *
   * Функція setBudgetGoals буде викликана:
   * - після першого завантаження;
   * - після створення цілі;
   * - після редагування цілі.
   */
    const unsubscribe = subscribeToBudgetGoals(
      user.uid,
      (nextGoals) => {
        setBudgetGoals(nextGoals);
        setBudgetGoalsLoading(false);
      }
    );

  // React викликає unsubscribe, коли сторінка закривається
  // або змінюється користувач.
    return unsubscribe;
  }, [user]);

  // Get the currency rates
  const { rates, loading: ratesLoading, error: ratesError } = useCurrencyRates();
  /** Converts an amount into the currently selected display currency. */
  const toBase = useMemo(() => {
    return (amountMinor: number, _currency: CurrencyCode): number => {
      return convertMinor(amountMinor, _currency, displayCurrency, rates) ?? 0;
    };
  }, [rates, displayCurrency]);

  const totalBalanceMinor = useMemo(
    () => wallets.reduce((sum, w) => sum + toBase(w.balanceMinor, w.currency), 0),
    [wallets, toBase]
  );

  const monthStart = useMemo(() => startOfMonth(now), [now]);
  const monthTxs = useMemo(
    () => transactions.filter((tx) => tx.date.toDate() >= monthStart),
    [transactions, monthStart]
  );

  const monthIncomeMinor = useMemo(
    () =>
      monthTxs
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + toBase(tx.amountMinor, tx.currency), 0),
    [monthTxs, toBase]
  );

  const monthExpense = useMemo(
    () =>
      monthTxs
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + toBase(tx.amountMinor, tx.currency), 0),
    [monthTxs, toBase]
  );

  // Pie: current-month expenses by category
  const pieData = useMemo(() => {
    return categories
      .filter((category) => category.type === "expense")
      .map((category) => {
        const valueMinor = monthTxs
          .filter((tx) => tx.type === "expense" && tx.categoryId === category.id)
          .reduce((sum, tx) => sum + toBase(tx.amountMinor, tx.currency), 0);
        return {
          name: category.name,
          color: category.color,
          value: Math.round(valueMinor / 100),
        };
      })
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value);
  }, [monthTxs, categories, toBase]);

// Bars: income vs expenses per month for the last 6 months
  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i);
      months.push({
        key: format(month, "yyyy-MM"),
        label: format(month, "MMM"),
        income: 0,
        expense: 0,
      });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const tx of transactions) {
      if (tx.type === "transfer") continue;
      const key = format(tx.date.toDate(), "yyyy-MM");
      const bucket = byKey.get(key);
      if (!bucket) continue;
      const amountMinor = toBase(tx.amountMinor, tx.currency);
      if (tx.type === "income") bucket.income += amountMinor;
      else bucket.expense += amountMinor;
    }
    return months.map((m) => ({
      ...m,
      income: Math.round(m.income / 100),
      expense: Math.round(m.expense / 100),
    }));
  }, [transactions, now, toBase]);

  // Daily spending for the current month
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: now });
    const buckets = days.map((day) => ({
      key: format(day, "yyyy-MM-dd"),
      label: format(day, "d"),
      expense: 0,
    }));
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const tx of monthTxs) {
      if (tx.type !== "expense") continue;
      const bucket = byKey.get(format(tx.date.toDate(), "yyyy-MM-dd"));
      if (bucket) bucket.expense += toBase(tx.amountMinor, tx.currency);
    }
    return buckets.map((b) => ({ ...b, expense: Math.round(b.expense / 100) }));
  }, [monthTxs, monthStart, now, toBase]);

  const recentTxs = useMemo(() => transactions.slice(0, 8), [transactions]);

  const topCategories = pieData.slice(0, 5);

  /**
 * Відкриває порожню форму створення нової цілі.
 */
  const openCreateGoalDialog = () => {
    // null означає, що ми створюємо нову ціль,
    // а не редагуємо наявну.
    setEditingGoal(null);

    // Очищаємо поля попередньої форми.
    setGoalCategoryId("");
    setGoalAmount("");

    /*
    * За замовчуванням пропонуємо дедлайн через 30 днів.
    * 29 додається тому, що перший день також входить у період.
    */
    setGoalDeadline(format(addDays(now, 29), "yyyy-MM-dd"));

    setGoalError(null);
    setGoalDialogOpen(true);
  };

  /**
   * Відкриває форму редагування і заповнює її
   * поточними значеннями цілі.
   */
  const openEditGoalDialog = (goal: BudgetGoal) => {
    const cycle = getCurrentGoalCycle(goal, now);

    setEditingGoal(goal);
    setGoalCategoryId(goal.categoryId);

    // У Firestore сума зберігається в копійках,
    // а у форму потрібно показати гривні.
    setGoalAmount((goal.limitMinor / 100).toString());

    // HTML input type="date" потребує формат yyyy-MM-dd.
    setGoalDeadline(format(addDays(now, goal.periodDays - 1), "yyyy-MM-dd"));

    setGoalError(null);
    setGoalDialogOpen(true);
  };

  /**
 * Формує список категорій, які можна вибрати для нової цілі.
 */
  const availableGoalCategories = useMemo(() => {
    /*
    * Збираємо id категорій, для яких уже існує budget goal.
    *
    * Якщо зараз редагуємо ціль, її власну категорію
    * не виключаємо зі списку.
    */
    const usedCategoryIds = new Set(
      budgetGoals
        .filter((goal) => goal.id !== editingGoal?.id)
        .map((goal) => goal.categoryId)
    );

    return categories.filter(
      (category) =>
        category.type === "expense" &&
        !usedCategoryIds.has(category.id)
    );
  }, [categories, budgetGoals, editingGoal]);

  const validateGoalForm = (): boolean => {
  if (!goalCategoryId) {
    setGoalError("Choose a category");
    return false;
  }

  const amount = Number(goalAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    setGoalError("Enter an amount greater than zero");
    return false;
  }

  if (!goalDeadline) {
    setGoalError("Choose a deadline");
    return false;
  }

  const deadline = startOfDay(
    new Date(`${goalDeadline}T00:00:00`)
  );

  const today = startOfDay(now);

  if (deadline < today) {
    setGoalError("Deadline cannot be in the past");
    return false;
  }

  setGoalError(null);
  return true;
};

const createGoal = async () => {
  if (!user || !validateGoalForm()) return;

  setGoalSaving(true);

  try {
    await createBudgetGoal(user.uid, {
      categoryId: goalCategoryId,
      limitMinor: Math.round(Number(goalAmount) * 100),
      currency: BASE_CURRENCY,
      startDate: now,
      deadline: new Date(`${goalDeadline}T00:00:00`),
    });

    setGoalDialogOpen(false);
  } catch (error) {
    setGoalError(
      error instanceof Error
        ? error.message
        : "Could not create the budget goal"
    );
  } finally {
    setGoalSaving(false);
  }
};

/**
 * Opens the delete confirmation for the selected goal.
 */
const requestGoalDelete = (goal: BudgetGoal) => {
  setGoalToDelete(goal);
  setDeleteConfirmationOpen(true);
};

const requestGoalUpdate = () => {
  if (!validateGoalForm()) return;

  setEditConfirmationOpen(true);
};

const confirmGoalUpdate = async () => {
  if (!user || !editingGoal) return;

  setGoalSaving(true);

  try {
    await updateBudgetGoal(user.uid, editingGoal.id, {
      categoryId: goalCategoryId,
      limitMinor: Math.round(Number(goalAmount) * 100),
      currency: BASE_CURRENCY,
      startDate: now,
      deadline: new Date(`${goalDeadline}T00:00:00`),
    });

    setEditConfirmationOpen(false);
    setGoalDialogOpen(false);
    setEditingGoal(null);
  } catch (error) {
    setGoalError(
      error instanceof Error
        ? error.message
        : "Could not update the budget goal"
    );
  } finally {
    setGoalSaving(false);
  }
};

   /**
 * Deletes the selected goal after confirmation.
 */

  const confirmGoalDelete = async () => {
  if (!user || !goalToDelete) return;

  setGoalSaving(true);

  try {
    await deleteBudgetGoal(user.uid, goalToDelete.id);

    setDeleteConfirmationOpen(false);
    setGoalToDelete(null);
  } catch (error) {
    setGoalError(
      error instanceof Error
        ? error.message
        : "Could not delete the budget goal"
    );
  } finally {
    setGoalSaving(false);
  }
};

    const loading =
      walletsLoading ||
      txLoading ||
      ratesLoading ||
      budgetGoalsLoading;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }


  const categoryOf = (id?: string) => categories.find((c) => c.id === id);
  const walletName = (id: string, storedName?: string) =>
    wallets.find((w) => w.id === id)?.name ?? storedName ?? "Deleted wallet";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your finances for {format(now, "MMMM yyyy")}
          </p>
        </div>
        <CurrencySwitcher />
      </div>


      {ratesError && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="size-5 shrink-0" />
          <p>
            <strong>Cannot update currency rates.</strong> Converted totals may be inaccurate.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(totalBalanceMinor, displayCurrency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {wallets.length} wallet{wallets.length === 1 ? "" : "s"}, converted
              to {displayCurrency}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums text-green-600 dark:text-green-500">
              <TrendingUp className="size-5" />
              {formatMoney(monthIncomeMinor, displayCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spent this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums text-red-600 dark:text-red-500">
              <TrendingDown className="size-5" />
              {formatMoney(monthExpense, displayCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

            {/* Budget goals */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Budget goals
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Track spending limits for selected categories
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCreateGoalDialog}
          >
            <Plus className="size-4" />
            Add goal
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {budgetGoals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No budget goals yet
            </p>
          ) : (
            budgetGoals.map((goal) => {
              const category = categories.find(
                (item) => item.id === goal.categoryId
              );

              if (!category) return null;

              const cycle = getCurrentGoalCycle(goal, now);
              const cycleEndExclusive = addDays(cycle.cycleEnd, 1);

              const spentMinor = transactions
                .filter((tx) => {
                  if (
                    tx.type !== "expense" ||
                    tx.categoryId !== goal.categoryId
                  ) {
                    return false;
                  }

                  const transactionDate = tx.date.toDate();

                  return (
                    transactionDate >= cycle.cycleStart &&
                    transactionDate < cycleEndExclusive
                  );
                })
                .reduce(
                  (sum, tx) =>
                    sum + toBase(tx.amountMinor, tx.currency),
                  0
                );

              const percentage = Math.min(
                (spentMinor / goal.limitMinor) * 100,
                100
              );

              const remainingMinor = Math.max(
                goal.limitMinor - spentMinor,
                0
              );

              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor: category.color,
                        }}
                      />

                      <p className="font-medium">
                        {category.name}
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {Math.round(percentage)}%
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative h-10 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: category.color,
                        }}
                      />

                      <span className="absolute inset-y-0 left-4 flex items-center text-sm font-medium">
                        {formatMoney(spentMinor, BASE_CURRENCY)} spent
                      </span>

                      <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium">
                        {formatMoney(remainingMinor, BASE_CURRENCY)} left
                      </span>
                    </div>

                    <div className="sm:w-44">
                      <p
                        className={cn(
                          "text-sm",
                          cycle.isLastDay
                            ? "font-medium text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {cycle.isLastDay
                          ? "Last day"
                          : `${cycle.daysLeft} day${
                              cycle.daysLeft === 1 ? "" : "s"
                            } left`}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Ends {format(cycle.cycleEnd, "d MMM yyyy")}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${category.name}`}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            openEditGoalDialog(goal)
                          }
                        >
                          Edit goal
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            requestGoalDelete(goal)
                          }
                        >
                          Delete goal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>


      <Dialog
  open={goalDialogOpen}
  onOpenChange={(open) => {
    if (!goalSaving) {
      setGoalDialogOpen(open);
    }
  }}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>
        {editingGoal
          ? "Edit budget goal"
          : "Add budget goal"}
      </DialogTitle>

      <DialogDescription>
        Choose an expense category, spending limit and deadline.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="goal-category">
          Category
        </Label>

        <Select
          value={goalCategoryId}
          onValueChange={setGoalCategoryId}
        >
          <SelectTrigger
            id="goal-category"
            className="w-full"
          >
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>

          <SelectContent>
            {availableGoalCategories.map((category) => (
              <SelectItem
                key={category.id}
                value={category.id}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor: category.color,
                  }}
                />

                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-amount">
          Budget amount, UAH
        </Label>

        <Input
          id="goal-amount"
          type="number"
          min="0.01"
          step="0.01"
          value={goalAmount}
          onChange={(event) =>
            setGoalAmount(event.target.value)
          }
          placeholder="5000"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-deadline">
          Deadline
        </Label>

        <Input
          id="goal-deadline"
          type="date"
          min={format(now, "yyyy-MM-dd")}
          max={format(addDays(now, 89), "yyyy-MM-dd")}
          value={goalDeadline}
          onChange={(event) =>
            setGoalDeadline(event.target.value)
          }
        />
      </div>

      {goalError && (
        <p className="text-sm text-destructive">
          {goalError}
        </p>
      )}
    </div>

    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        disabled={goalSaving}
        onClick={() => setGoalDialogOpen(false)}
      >
        Cancel
      </Button>

      <Button
        type="button"
        disabled={goalSaving}
        onClick={
          editingGoal
            ? requestGoalUpdate
            : createGoal
        }
      >
        {goalSaving
          ? "Saving..."
          : editingGoal
            ? "Update goal"
            : "Create goal"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      <AlertDialog
  open={editConfirmationOpen}
  onOpenChange={setEditConfirmationOpen}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        Change this budget goal?
      </AlertDialogTitle>

      <AlertDialogDescription>
        The current cycle will end. A new repeating cycle
        will start today with the selected category,
        amount and deadline.
      </AlertDialogDescription>
    </AlertDialogHeader>

    <AlertDialogFooter>
      <AlertDialogCancel disabled={goalSaving}>
        Cancel
      </AlertDialogCancel>

      <AlertDialogAction
        disabled={goalSaving}
        onClick={(event) => {
          event.preventDefault();
          void confirmGoalUpdate();
        }}
      >
        {goalSaving
          ? "Saving..."
          : "Confirm changes"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

            {/* Confirmation before deleting a budget goal */}
      <AlertDialog
        open={deleteConfirmationOpen}
        onOpenChange={(open) => {
          // Не дозволяємо закрити вікно під час видалення.
          if (goalSaving) return;

          setDeleteConfirmationOpen(open);

          // Якщо користувач натиснув Cancel або закрив вікно,
          // більше не зберігаємо вибрану для видалення ціль.
          if (!open) {
            setGoalToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this budget goal?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This will permanently remove the budget goal.
              The category and its transactions will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={goalSaving}>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={goalSaving}
              onClick={(event) => {
                // Не закриваємо AlertDialog раніше,
                // ніж завершиться запит до Firestore.
                event.preventDefault();
                void confirmGoalDelete();
              }}
            >
              {goalSaving ? "Deleting..." : "Delete goal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No expenses this month yet
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString("uk-UA")} ${CURRENCY_SYMBOLS[displayCurrency]}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5 sm:w-52">
                  {topCategories.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="flex-1 truncate">{entry.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {entry.value.toLocaleString("uk-UA")} {CURRENCY_SYMBOLS[displayCurrency]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs expenses (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={50} />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString("uk-UA")} ${CURRENCY_SYMBOLS[displayCurrency]}`,
                    name === "income" ? "Income" : "Expenses",
                  ]}
                />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily spending this month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={0} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={50} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toLocaleString("uk-UA")} ${CURRENCY_SYMBOLS[displayCurrency]}`, "Spent"]}
                />
                <Bar dataKey="expense" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent transactions</CardTitle>
            <Link
              href="/transactions"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTxs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions yet
              </p>
            ) : (
              recentTxs.map((tx) => {
                const category = categoryOf(tx.categoryId);
                return (
                  <div key={tx.id} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        tx.type === "income" &&
                          "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
                        tx.type === "expense" &&
                          "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
                        tx.type === "transfer" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {tx.type === "income" ? (
                        <ArrowDownLeft className="size-4" />
                      ) : tx.type === "expense" ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowLeftRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {tx.type === "transfer"
                          ? `${walletName(tx.walletId, tx.walletName)} → ${walletName(
                              tx.toWalletId ?? "",
                              tx.toWalletName
                            )}`
                          : tx.note || category?.name || "Transaction"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(tx.date.toDate(), "d MMM")}
                        {tx.type !== "transfer" && category ? (
                          <> · {category.name}</>
                        ) : null}
                      </p>
                    </div>
                    {tx.type !== "transfer" && category && (
                      <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
                        <span style={{ color: category.color }}>
                          <AppIcon name={category.icon} className="size-3" />
                        </span>
                        {category.name}
                      </Badge>
                    )}
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        tx.type === "income" && "text-green-600 dark:text-green-500",
                        tx.type === "expense" && "text-red-600 dark:text-red-500"
                      )}
                    >
                      {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                      {formatMoney(tx.amountMinor, tx.currency)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
