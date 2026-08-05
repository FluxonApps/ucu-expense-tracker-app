"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { AppIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, parseAmountToMinor } from "@/lib/currencies";
import {
  createTransaction,
  createTransfer,
  updateTransaction,
} from "@/lib/firestore/transactions";
import {
  createRecurringTransaction,
  updateRecurringTransaction,
} from "@/lib/firestore/recurring-transactions";
import type {
  CurrencyCode,
  PaymentFrequency,
  RecurringTransaction,
  Transaction,
} from "@/lib/types";
import { convertMinor, useCurrencyRates } from "@/lib/use-currency-rates";

type FormType = "expense" | "income" | "transfer";
type PaymentFrequencyValue = "one-time" | PaymentFrequency;

const PAYMENT_FREQUENCY_OPTIONS: Array<{ value: PaymentFrequencyValue; label: string }> = [
  { value: "one-time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "everyTwoMonths", label: "Every 2 months" },
  { value: "semiannual", label: "Every 6 months" },
  { value: "yearly", label: "Yearly" },
];

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this transaction (income/expense only). */
  transaction?: Transaction | null;
  /** When set, the dialog edits this automatic-payment schedule. */
  recurringTransaction?: RecurringTransaction | null;
  /** Called after a successful create/update so lists can refresh. */
  onSaved?: () => void;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  recurringTransaction,
  onSaved,
}: TransactionFormDialogProps) {
  const { user } = useAuth();
  const { wallets, categories } = useData();
  const { rates, loading: ratesLoading, error: ratesError } = useCurrencyRates();
  const isEditingTransaction = Boolean(transaction);
  const isEditingRecurring = Boolean(recurringTransaction);
  const isEdit = isEditingTransaction || isEditingRecurring;

  const [type, setType] = useState<FormType>("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState("");
  const [paymentFrequency, setPaymentFrequency] =
    useState<PaymentFrequencyValue>("one-time");
  const [paymentDay, setPaymentDay] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setType(transaction.type as FormType);
      setAmount((transaction.amountMinor / 100).toFixed(2));
      setWalletId(transaction.walletId);
      setToWalletId(transaction.toWalletId ?? "");
      setToAmount(
        transaction.toAmountMinor ? (transaction.toAmountMinor / 100).toFixed(2) : ""
      );
      setCategoryId(transaction.categoryId ?? "");
      setDate(transaction.date.toDate());
      setNote(transaction.note);
      setPaymentFrequency("one-time");
      setPaymentDay(String(transaction.date.toDate().getDate()));
    } else if (recurringTransaction) {
      setType(recurringTransaction.type);
      setAmount((recurringTransaction.amountMinor / 100).toFixed(2));
      setWalletId(recurringTransaction.walletId);
      setToWalletId("");
      setToAmount("");
      setCategoryId(recurringTransaction.categoryId);
      setDate(recurringTransaction.nextRunAt.toDate());
      setNote(recurringTransaction.note);
      setPaymentFrequency(recurringTransaction.frequency);
      setPaymentDay(String(recurringTransaction.dayOfMonth));
    } else {
      setType("expense");
      setAmount("");
      setWalletId(wallets[0]?.id ?? "");
      setToWalletId("");
      setToAmount("");
      setCategoryId("");
      setDate(new Date());
      setNote("");
      setPaymentFrequency("one-time");
      setPaymentDay(String(new Date().getDate()));
    }
  }, [open, transaction, recurringTransaction, wallets]);

  const fromWallet = wallets.find((w) => w.id === walletId);
  const toWallet = wallets.find((w) => w.id === toWalletId);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === (type === "transfer" ? "expense" : type)),
    [categories, type]
  );

  // Keep the selected category valid when switching between income/expense.
  useEffect(() => {
    if (type === "transfer") return;
    if (categoryId && !filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId("");
    }
  }, [type, categoryId, filteredCategories]);

  const amountMinor = parseAmountToMinor(amount);

  function formatInputAmount(valueMinor: number): string {
    return (valueMinor / 100).toFixed(2);
  }

  function convertInputAmount(
    value: string,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): string {
    if (!value.trim()) return "";

    const valueMinor = parseAmountToMinor(value);
    if (valueMinor === null) return "";

    const converted = convertMinor(valueMinor, fromCurrency, toCurrency, rates);
    return converted === null ? "" : formatInputAmount(converted);
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    setToAmount(
      fromWallet && toWallet
        ? convertInputAmount(value, fromWallet.currency, toWallet.currency)
        : ""
    );
  }

  function handleToAmountChange(value: string) {
    setToAmount(value);
    setAmount(
      fromWallet && toWallet
        ? convertInputAmount(value, toWallet.currency, fromWallet.currency)
        : ""
    );
  }

  function handleFromWalletChange(nextWalletId: string) {
    const nextFromWallet = wallets.find((wallet) => wallet.id === nextWalletId);
    setWalletId(nextWalletId);
    setToAmount(
      nextFromWallet && toWallet
        ? convertInputAmount(amount, nextFromWallet.currency, toWallet.currency)
        : ""
    );
  }

  function handleToWalletChange(nextWalletId: string) {
    const nextToWallet = wallets.find((wallet) => wallet.id === nextWalletId);
    setToWalletId(nextWalletId);
    setToAmount(
      fromWallet && nextToWallet
        ? convertInputAmount(amount, fromWallet.currency, nextToWallet.currency)
        : ""
    );
  }

  function handleTypeChange(nextType: FormType) {
    setType(nextType);
    if (nextType === "transfer") setPaymentFrequency("one-time");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // A recurring payment is edited as a schedule. It must not silently turn
    // into a separate one-time transaction while leaving the old schedule on.
    if (isEditingRecurring && paymentFrequency === "one-time") {
      toast.error("An automatic payment cannot be changed to one-time here.");
      return;
    }

    if (amountMinor === null || amountMinor <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (!walletId) {
      toast.error("Please choose a wallet");
      return;
    }
    const isEditingSameWallet =
      isEdit && transaction && transaction.walletId === walletId && transaction.type !== "transfer";
    const effectiveBalance =
      isEditingSameWallet && transaction.type !== "income"
        ? fromWallet!.balanceMinor + transaction.amountMinor
        : fromWallet?.balanceMinor ?? 0;

    if (
      paymentFrequency === "one-time" &&
      type !== "income" &&
      fromWallet &&
      amountMinor > effectiveBalance
    ) {
      toast.error("Insufficient funds in this wallet");
      return;
    }

    if (type === "transfer") {
      if (!toWalletId) {
        toast.error("Please choose a destination wallet");
        return;
      }
      if (toWalletId === walletId) {
        toast.error("Source and destination wallets must be different");
        return;
      }
      const toAmountMinor = parseAmountToMinor(toAmount);
      if (toAmountMinor === null || toAmountMinor <= 0) {
        toast.error("Exchange rate is unavailable. Please try again shortly.");
        return;
      }
      setSubmitting(true);
      try {
        await createTransfer(user.uid, {
          amountMinor,
          currency: fromWallet!.currency,
          walletId,
          toWalletId,
          toAmountMinor,
          date,
          note: note.trim(),
        });
        toast.success("Transfer created");
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        console.error(error);
        toast.error("Failed to create the transfer");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!categoryId) {
      toast.error("Please choose a category");
      return;
    }

    if (paymentFrequency !== "one-time") {
      const dayOfMonth = Number(paymentDay);
      if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        toast.error("Please choose a payment day from 1 to 31");
        return;
      }

      setSubmitting(true);
      try {
        const input = {
          type,
          amountMinor,
          currency: fromWallet!.currency,
          walletId,
          walletName: fromWallet!.name,
          categoryId,
          note: note.trim(),
          frequency: paymentFrequency,
          dayOfMonth,
          startDate: date,
        };
        if (recurringTransaction) {
          await updateRecurringTransaction(user.uid, recurringTransaction.id, input);
          toast.success("Automatic payment updated");
        } else {
          await createRecurringTransaction(user.uid, input);
          toast.success("Automatic payment scheduled");
        }
        onOpenChange(false);
        onSaved?.();
      } catch (error) {
        console.error(error);
        toast.error("Failed to save the automatic payment");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        type,
        amountMinor,
        currency: fromWallet!.currency,
        walletId,
        categoryId,
        date,
        note: note.trim(),
      };
      if (isEdit && transaction) {
        await updateTransaction(user.uid, transaction.id, input);
        toast.success("Transaction updated");
      } else {
        await createTransaction(user.uid, input);
        toast.success("Transaction added");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save the transaction");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transaction" : "New transaction"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the transaction details."
              : "Record an expense, income, or a transfer between wallets."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <Tabs value={type} onValueChange={(value) => handleTypeChange(value as FormType)}>
              <TabsList className="w-full">
                <TabsTrigger value="expense" className="flex-1">
                  Expense
                </TabsTrigger>
                <TabsTrigger value="income" className="flex-1">
                  Income
                </TabsTrigger>
                <TabsTrigger value="transfer" className="flex-1">
                  Transfer
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">
                Amount {fromWallet ? `(${fromWallet.currency})` : ""}
              </Label>
              <Input
                id="tx-amount"
                placeholder="0.00"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{paymentFrequency === "one-time" ? "Date" : "First payment date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="size-4" />
                    {format(date, "d MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(selected) => selected && setDate(selected)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {!isEditingTransaction && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment frequency</Label>
                <Select
                  value={paymentFrequency}
                  onValueChange={(value) => setPaymentFrequency(value as PaymentFrequencyValue)}
                  disabled={type === "transfer"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_FREQUENCY_OPTIONS.filter(
                      (option) => !isEditingRecurring || option.value !== "one-time"
                    ).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {type === "transfer" && (
                  <p className="text-xs text-muted-foreground">Transfers can only be one-time.</p>
                )}
              </div>

              {paymentFrequency !== "one-time" && (
                <div className="space-y-1.5">
                  <Label>Payment day</Label>
                  <Select value={paymentDay} onValueChange={setPaymentDay}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Uses the last day when a month is shorter.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{type === "transfer" ? "From wallet" : "Wallet"}</Label>
            <Select value={walletId} onValueChange={handleFromWalletChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    <span className="flex items-center gap-2">
                      <AppIcon name={wallet.icon} className="size-4" />
                      {wallet.name} · {formatMoney(wallet.balanceMinor, wallet.currency)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "transfer" ? (
            <>
              <div className="space-y-1.5">
                <Label>To wallet</Label>
                <Select value={toWalletId} onValueChange={handleToWalletChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a destination wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets
                      .filter((wallet) => wallet.id !== walletId)
                      .map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          <span className="flex items-center gap-2">
                            <AppIcon name={wallet.icon} className="size-4" />
                            {wallet.name} ·{" "}
                            {formatMoney(wallet.balanceMinor, wallet.currency)}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {toWallet && fromWallet && (
                <div className="space-y-1.5">
                  <Label htmlFor="tx-to-amount">
                    Received amount ({toWallet.currency})
                  </Label>
                  <Input
                    id="tx-to-amount"
                    placeholder="0.00"
                    inputMode="decimal"
                    value={toAmount}
                    onChange={(e) => handleToAmountChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {ratesLoading
                      ? "Loading exchange rate..."
                      : ratesError
                        ? "Exchange rate is unavailable."
                        : "Both amounts stay in sync using the current exchange rate."}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="flex size-5 items-center justify-center rounded"
                          style={{ backgroundColor: `${category.color}22`, color: category.color }}
                        >
                          <AppIcon name={category.icon} className="size-3.5" />
                        </span>
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">Note</Label>
            <Textarea
              id="tx-note"
              placeholder="Optional note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEdit
                ? "Save changes"
                : paymentFrequency !== "one-time"
                  ? "Schedule payment"
                  : type === "transfer"
                    ? "Transfer"
                    : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
