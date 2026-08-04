"use client";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
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
import { AppIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/currencies";
import { subscribeToTransactionsInRange } from "@/lib/firestore/transactions";
import type { CurrencyCode, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import {convertMinor, useCurrencyRates } from "@/lib/use-currency-rates";

const BASE_CURRENCY: CurrencyCode = "UAH";

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#8b5cf6",
  "#ef4444",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#6366f1",
  "#737373",
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { wallets, categories, walletsLoading } = useData();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const now = useMemo(() => new Date(), []);
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

  // Get the currency rates
  const { rates, loading: ratesLoading, error: ratesError } = useCurrencyRates();
  /** Converts an amount into the base currency. */
  const toBase = useMemo(() => {
    return (amountMinor: number, _currency: CurrencyCode): number => {
      return convertMinor(amountMinor, _currency, BASE_CURRENCY, rates) ?? 0;
    };
  }, [rates]);

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
      const amount = Math.round(toBase(tx.amountMinor, tx.currency) / 100);
      if (tx.type === "income") bucket.income += amount;
      else bucket.expense += amount;
    }
    return months;
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
      if (bucket) bucket.expense += Math.round(toBase(tx.amountMinor, tx.currency) / 100);
    }
    return buckets;
  }, [monthTxs, monthStart, now, toBase]);

  const recentTxs = useMemo(() => transactions.slice(0, 8), [transactions]);

  const topCategories = pieData.slice(0, 5);

  const loading = walletsLoading || txLoading || ratesLoading;

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
  const walletName = (id: string) => wallets.find((w) => w.id === id)?.name;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your finances for {format(now, "MMMM yyyy")}
        </p>
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
              {formatMoney(totalBalanceMinor, BASE_CURRENCY)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {wallets.length} wallet{wallets.length === 1 ? "" : "s"}, converted
              to UAH
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
              {formatMoney(monthIncomeMinor, BASE_CURRENCY)}
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
              {formatMoney(monthExpense, BASE_CURRENCY)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Goals</CardTitle>
        </CardHeader>

        <CardContent>
          Budget goals will be here
        </CardContent>
      </Card> */}
            {/* Budget goals — блок на всю ширину сторінки */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget goals</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track spending limits for selected categories
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Тимчасові дані для перевірки дизайну */}
          {[
            {
              name: "Food",
              spentMinor: 600000,
              limitMinor: 1000000,
              color: "#3b82f6",
            },
            {
              name: "Transport",
              spentMinor: 400000,
              limitMinor: 1000000,
              color: "#22c55e",
            },
          ].map((goal) => {
            // Відсоток використаного бюджету
            const percentage = Math.min(
              (goal.spentMinor / goal.limitMinor) * 100,
              100
            );

            // Скільки грошей залишилося
            const remainingMinor = Math.max(
              goal.limitMinor - goal.spentMinor,
              0
            );

            return (
              <div key={goal.name} className="space-y-2">
                {/* Назва категорії та відсоток */}
                <div className="flex items-center justify-between">
                  <p className="font-medium">{goal.name}</p>

                  <p className="text-sm text-muted-foreground">
                    {Math.round(percentage)}%
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {/* Фон progress bar */}
                  <div className="relative h-10 flex-1 overflow-hidden rounded-full bg-muted">
                    {/* Заповнена частина progress bar */}
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: goal.color,
                      }}
                    />

                    {/* Витрачено */}
                    <span className="absolute inset-y-0 left-4 flex items-center text-sm font-medium">
                      {formatMoney(goal.spentMinor, BASE_CURRENCY)}
                    </span>

                    {/* Залишилося */}
                    <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium">
                      {formatMoney(remainingMinor, BASE_CURRENCY)}
                    </span>
                  </div>

                  {/* Текст праворуч від progress bar */}
                  <p className="text-sm text-muted-foreground sm:w-44">
                    час
                  </p>
                </div>
              </div>
            );
          })}

          {/* Кнопка для майбутнього додавання нової категорії */}
          <button
            type="button"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            + Add category
          </button>
        </CardContent>
      </Card>

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
                      formatter={(value) => [`${Number(value).toLocaleString("uk-UA")} ₴`]}
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
                        {entry.value.toLocaleString("uk-UA")} ₴
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
                    `${Number(value).toLocaleString("uk-UA")} ₴`,
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
                  formatter={(value) => [`${Number(value).toLocaleString("uk-UA")} ₴`, "Spent"]}
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
                          ? `${walletName(tx.walletId)} → ${walletName(tx.toWalletId ?? "")}`
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
