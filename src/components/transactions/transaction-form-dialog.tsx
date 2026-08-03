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
import type { Transaction } from "@/lib/types";

type FormType = "expense" | "income" | "transfer";

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this transaction (income/expense only). */
  transaction?: Transaction | null;
  /** Called after a successful create/update so lists can refresh. */
  onSaved?: () => void;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  onSaved,
}: TransactionFormDialogProps) {
  const { user } = useAuth();
  const { wallets, categories } = useData();
  const isEdit = Boolean(transaction);

  const [type, setType] = useState<FormType>("expense");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [toAmountTouched, setToAmountTouched] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState("");
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
    } else {
      setType("expense");
      setAmount("");
      setWalletId(wallets[0]?.id ?? "");
      setToWalletId("");
      setToAmount("");
      setCategoryId("");
      setDate(new Date());
      setNote("");
    }
    setToAmountTouched(false);
  }, [open, transaction, wallets]);

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

  // Keep same-currency transfers in sync so users don't type the amount twice.
  const amountMinor = parseAmountToMinor(amount);
  useEffect(() => {
    if (type !== "transfer" || toAmountTouched) return;
    if (!fromWallet || !toWallet) return;
    if (fromWallet.currency === toWallet.currency) {
      setToAmount(amount);
    }
    // TODO: prefill cross-currency transfers using rates from /api/currency
  }, [type, amount, fromWallet, toWallet, toAmountTouched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (amountMinor === null) {
      toast.error("Amount must be a number");
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

    if (type !== "income" && fromWallet && amountMinor > effectiveBalance) {
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
      if (toAmountMinor === null) {
        toast.error("Received amount must be a number");
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
            <Tabs value={type} onValueChange={(value) => setType(value as FormType)}>
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
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
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

          <div className="space-y-1.5">
            <Label>{type === "transfer" ? "From wallet" : "Wallet"}</Label>
            <Select value={walletId} onValueChange={setWalletId}>
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
                <Select value={toWalletId} onValueChange={setToWalletId}>
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
              {toWallet && fromWallet && toWallet.currency !== fromWallet.currency && (
                <div className="space-y-1.5">
                  <Label htmlFor="tx-to-amount">
                    Received amount ({toWallet.currency})
                  </Label>
                  <Input
                    id="tx-to-amount"
                    placeholder="0.00"
                    inputMode="decimal"
                    value={toAmount}
                    onChange={(e) => {
                      setToAmount(e.target.value);
                      setToAmountTouched(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the amount that actually arrived in the destination wallet.
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
              {isEdit ? "Save changes" : type === "transfer" ? "Transfer" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
