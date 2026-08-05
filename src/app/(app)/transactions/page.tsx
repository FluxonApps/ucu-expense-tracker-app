"use client";

import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarIcon,
  Download,
  MoreVertical,
  Pencil,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { AppIcon } from "@/components/icons";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/currencies";
import {
  deleteTransaction,
  fetchTransactionsPage,
  type TransactionFilters,
  type TransactionsPage,
} from "@/lib/firestore/transactions";
import {
  deleteRecurringTransaction,
  setRecurringTransactionActive,
  subscribeToRecurringTransactions,
} from "@/lib/firestore/recurring-transactions";
import type { RecurringTransaction, Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ALL = "all";
const AUTOMATIC = "automatic";
const ONE_TIME = "one-time";

const frequencyLabel: Record<RecurringTransaction["frequency"], string> = {
  monthly: "Monthly",
  everyTwoMonths: "Every 2 months",
  semiannual: "Every 6 months",
  yearly: "Yearly",
};

function DateFilterButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="size-3.5" />
          {value ? format(value, "d MMM yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} />
      </PopoverContent>
    </Popover>
  );
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const { wallets, categories } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const readStored = (key: string) =>
    typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
  const [filterWallet, setFilterWallet] = useState(
    searchParams.get("wallet") ?? readStored("tx:wallet") ?? ALL);
  const [filterCategory, setFilterCategory] = useState(
    searchParams.get("category") ?? readStored("tx:category") ?? ALL);
  const [filterType, setFilterType] = useState(
    searchParams.get("type") ?? readStored("tx:type") ?? ALL);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const v = searchParams.get("from") ?? readStored("tx:from");
    return v ? new Date(v) : undefined;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const v = searchParams.get("to") ?? readStored("tx:to");
    return v ? new Date(v) : undefined;
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [cursor, setCursor] = useState<TransactionsPage["cursor"]>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingRecurringTx, setEditingRecurringTx] = useState<RecurringTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<RecurringTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingSchedulePending, setDeletingSchedulePending] = useState(false);

  const buildFilters = useCallback((): TransactionFilters => {
    return {
      walletId: filterWallet === ALL ? undefined : filterWallet,
      categoryId: filterCategory === ALL ? undefined : filterCategory,
      type: filterType === ALL ? undefined : (filterType as TransactionType),
      dateFrom,
      dateTo,
    };
  }, [filterWallet, filterCategory, filterType, dateFrom, dateTo]);

  const loadFirstPage = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const page = await fetchTransactionsPage(user.uid, buildFilters());
      setTransactions(page.transactions);
      setCursor(page.cursor);
      setHasMore(page.cursor !== null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [user, buildFilters]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterWallet !== ALL) params.set("wallet", filterWallet);
    if (filterCategory !== ALL) params.set("category", filterCategory);
    if (filterType !== ALL) params.set("type", filterType);
    if (dateFrom) params.set("from", dateFrom.toISOString().slice(0, 10));
    if (dateTo) params.set("to", dateTo.toISOString().slice(0, 10));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });

    sessionStorage.setItem("tx:wallet", filterWallet);
    sessionStorage.setItem("tx:category", filterCategory);
    sessionStorage.setItem("tx:type", filterType);
    if (dateFrom) sessionStorage.setItem("tx:from", dateFrom.toISOString().slice(0, 10));
    else sessionStorage.removeItem("tx:from");
    if (dateTo) sessionStorage.setItem("tx:to", dateTo.toISOString().slice(0, 10));
    else sessionStorage.removeItem("tx:to");
  }, [filterWallet, filterCategory, filterType, dateFrom, dateTo, pathname, router]);
  const loadMore = async () => {
    if (!user || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchTransactionsPage(user.uid, buildFilters(), cursor);
      setTransactions((prev) => [...prev, ...page.transactions]);
      setCursor(page.cursor);
      setHasMore(page.cursor !== null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load more transactions");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deletingTx) return;
    setDeleting(true);
    try {
      await deleteTransaction(user.uid, deletingTx.id);
      toast.success("Transaction deleted");
      setDeletingTx(null);
      loadFirstPage();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete the transaction");
    } finally {
      setDeleting(false);
    }
  };

  const handleScheduleActive = async (schedule: RecurringTransaction) => {
    if (!user) return;
    try {
      await setRecurringTransactionActive(user.uid, schedule.id, !schedule.isActive);
      toast.success(schedule.isActive ? "Automatic payment paused" : "Automatic payment resumed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update the automatic payment");
    }
  };

  const handleScheduleDelete = async () => {
    if (!user || !deletingSchedule) return;
    setDeletingSchedulePending(true);
    try {
      await deleteRecurringTransaction(user.uid, deletingSchedule.id);
      toast.success("Automatic payment deleted");
      setDeletingSchedule(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete the automatic payment");
    } finally {
      setDeletingSchedulePending(false);
    }
  };

  const hasActiveFilters =
    filterWallet !== ALL ||
    filterCategory !== ALL ||
    filterType !== ALL ||
    filterPayment !== ALL ||
    dateFrom !== undefined ||
    dateTo !== undefined;

  const clearFilters = () => {
    setFilterWallet(ALL);
    setFilterCategory(ALL);
    setFilterType(ALL);
    setFilterPayment(ALL);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const walletName = (id: string, storedName?: string) =>
    wallets.find((w) => w.id === id)?.name ?? storedName ?? "Deleted wallet";
  const categoryOf = (id?: string) => categories.find((c) => c.id === id);
  const recurringDateTo = dateTo ? new Date(dateTo) : undefined;
  recurringDateTo?.setHours(23, 59, 59, 999);
  const visibleRecurringTransactions = recurringTransactions.filter((schedule) => {
    const nextPaymentDate = schedule.nextRunAt.toDate();
    return (
      (filterWallet === ALL || schedule.walletId === filterWallet) &&
      (filterCategory === ALL || schedule.categoryId === filterCategory) &&
      (filterType === ALL || schedule.type === filterType) &&
      (!dateFrom || nextPaymentDate >= dateFrom) &&
      (!recurringDateTo || nextPaymentDate <= recurringDateTo)
    );
  });
  const visibleTransactions = transactions.filter(
    (tx) => filterPayment !== ONE_TIME || !tx.isAutomatic
  );
  const hasVisiblePayments =
    visibleTransactions.length > 0 ||
    (filterPayment === ALL && visibleRecurringTransactions.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            All income, expenses, and transfers
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTx(null);
            setEditingRecurringTx(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add transaction
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterWallet} onValueChange={setFilterWallet}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All wallets</SelectItem>
            {wallets.map((wallet) => (
              <SelectItem key={wallet.id} value={wallet.id}>
                {wallet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All payments</SelectItem>
            <SelectItem value={ONE_TIME}>One-time</SelectItem>
            <SelectItem value={AUTOMATIC}>Automatic</SelectItem>
          </SelectContent>
        </Select>

        <DateFilterButton label="From" value={dateFrom} onChange={setDateFrom} />
        <DateFilterButton label="To" value={dateTo} onChange={setDateTo} />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {filterPayment === AUTOMATIC ? (
        <Card className="py-0">
          <CardContent className="p-0">
            {visibleRecurringTransactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <p className="font-medium">No automatic payments found</p>
                <p className="text-sm text-muted-foreground">
                  Create a transaction with a recurring payment frequency to schedule one.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next payment</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecurringTransactions.map((schedule) => (
                    <TableRow key={schedule.id} className={!schedule.isActive ? "opacity-60" : ""}>
                      <TableCell>
                        <Badge variant={schedule.isActive ? "secondary" : "outline"}>
                          {schedule.isActive ? frequencyLabel[schedule.frequency] : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {format(schedule.nextRunAt.toDate(), "d MMM yyyy")} · day {schedule.dayOfMonth}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {schedule.note || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{walletName(schedule.walletId, schedule.walletName)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            schedule.type === "income"
                              ? "text-green-600 dark:text-green-500"
                              : "text-red-600 dark:text-red-500"
                          )}
                        >
                          {schedule.type === "income" ? "+" : "-"}
                          {formatMoney(schedule.amountMinor, schedule.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingTx(null);
                                setEditingRecurringTx(schedule);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScheduleActive(schedule)}>
                              {schedule.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                              {schedule.isActive ? "Pause" : "Resume"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletingSchedule(schedule)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card className="py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !hasVisiblePayments ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting the filters."
                  : "Add your first transaction to get started."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterPayment === ALL &&
                  visibleRecurringTransactions.map((schedule) => {
                    const category = categoryOf(schedule.categoryId);
                    return (
                      <TableRow
                        key={`schedule-${schedule.id}`}
                        className={cn("bg-muted/20", !schedule.isActive && "opacity-60")}
                      >
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          <div>{format(schedule.nextRunAt.toDate(), "yyyy-MM-dd")}</div>
                          <span className="text-xs">Next automatic payment</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">Automatic</Badge>
                            {category ? (
                              <Badge
                                variant="outline"
                                className="gap-1.5"
                                style={{ borderColor: `${category.color}66` }}
                              >
                                <span style={{ color: category.color }}>
                                  <AppIcon name={category.icon} className="size-3" />
                                </span>
                                {category.name}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">
                          {schedule.note || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {walletName(schedule.walletId, schedule.walletName)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              schedule.type === "income"
                                ? "text-green-600 dark:text-green-500"
                                : "text-red-600 dark:text-red-500"
                            )}
                          >
                            {schedule.type === "income" ? "+" : "-"}
                            {formatMoney(schedule.amountMinor, schedule.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingTx(null);
                                  setEditingRecurringTx(schedule);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleScheduleActive(schedule)}>
                                {schedule.isActive ? (
                                  <Pause className="size-4" />
                                ) : (
                                  <Play className="size-4" />
                                )}
                                {schedule.isActive ? "Pause" : "Resume"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeletingSchedule(schedule)}
                              >
                                <Trash2 className="size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {visibleTransactions.map((tx) => {
                  const category = categoryOf(tx.categoryId);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {tx.date.toDate().toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        {tx.type === "transfer" ? (
                          <Badge variant="secondary" className="gap-1">
                            <ArrowLeftRight className="size-3" />
                            Transfer
                          </Badge>
                        ) : category ? (
                          <Badge
                            variant="outline"
                            className="gap-1.5"
                            style={{ borderColor: `${category.color}66` }}
                          >
                            <span style={{ color: category.color }}>
                              <AppIcon name={category.icon} className="size-3" />
                            </span>
                            {category.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {tx.note || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tx.type === "transfer"
                          ? `${walletName(tx.walletId, tx.walletName)} → ${walletName(
                              tx.toWalletId ?? "",
                              tx.toWalletName
                            )}`
                          : walletName(tx.walletId, tx.walletName)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium tabular-nums",
                            tx.type === "income" && "text-green-600 dark:text-green-500",
                            tx.type === "expense" && "text-red-600 dark:text-red-500"
                          )}
                        >
                          {tx.type === "income" ? (
                            <ArrowDownLeft className="size-3.5" />
                          ) : tx.type === "expense" ? (
                            <ArrowUpRight className="size-3.5" />
                          ) : null}
                          {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                          {formatMoney(tx.amountMinor, tx.currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={tx.type === "transfer"}
                              onClick={() => {
                                setEditingTx(tx);
                                setEditingRecurringTx(null);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletingTx(tx)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      )}

      {filterPayment !== AUTOMATIC && hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editingTx}
        recurringTransaction={editingRecurringTx}
        onSaved={loadFirstPage}
      />

      {/* Import Transactions Modal Placeholder */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Transactions</DialogTitle>
            <DialogDescription>
              Import transactions directly from your banking application or file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            Import functionality will be implemented here.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingTx)}
        onOpenChange={(open) => !open && setDeletingTx(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              The wallet balance will be adjusted accordingly. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingSchedule)}
        onOpenChange={(open) => !open && setDeletingSchedule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automatic payment?</AlertDialogTitle>
            <AlertDialogDescription>
              Future payments will stop. Past transactions will remain in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSchedulePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleScheduleDelete();
              }}
              disabled={deletingSchedulePending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingSchedulePending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
