"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { AppIcon, WALLET_COLORS, WALLET_ICONS } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseAmountToMinor, SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { createWallet, updateWallet } from "@/lib/firestore/wallets";
import type { CurrencyCode, Wallet, WalletType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Minor units (cents/kopiykas) -> plain decimal string for an input default value. */
function minorToInputString(minor: number): string {
  return (minor / 100).toFixed(2);
}

// Aggressively filter out all common Tailwind blacks/dark grays
const BLACK_VARIANTS = [
  "#000000", "#000", "black",
  "#171717", // neutral-900
  "#0a0a0a", // neutral-950
  "#18181b", // zinc-900
  "#09090b", // zinc-950
  "#111827", // gray-900
  "#030712", // gray-950
  "#0f172a", // slate-900
  "#020617", // slate-950
];

const AVAILABLE_COLORS = [
  ...WALLET_COLORS.filter(
    (c) => !BLACK_VARIANTS.includes(c.toLowerCase())
  ),
  "#ec4899", // Pink
];

interface WalletFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this wallet instead of creating a new one. */
  wallet?: Wallet | null;
}

export function WalletFormDialog({ open, onOpenChange, wallet }: WalletFormDialogProps) {
  const { user } = useAuth();
  const isEdit = Boolean(wallet);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("UAH");
  const [initialBalance, setInitialBalance] = useState("");
  const [walletType, setWalletType] = useState<WalletType>("standard");
  const [creditLimit, setCreditLimit] = useState("");
  const [creditDueDay, setCreditDueDay] = useState("");
  const [icon, setIcon] = useState(WALLET_ICONS[0]);
  const [color, setColor] = useState(AVAILABLE_COLORS[0] ?? "#22c55e");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(wallet?.name ?? "");
      setCurrency(wallet?.currency ?? "UAH");
      setInitialBalance("");
      setWalletType(wallet?.walletType ?? "standard");
      setCreditLimit(
        wallet?.creditLimitMinor !== undefined ? minorToInputString(wallet.creditLimitMinor) : ""
      );
      setCreditDueDay(wallet?.creditDueDay !== undefined ? String(wallet.creditDueDay) : "");
      setIcon(wallet?.icon ?? WALLET_ICONS[0]);

      const initialColor = wallet?.color;
      if (initialColor && AVAILABLE_COLORS.includes(initialColor)) {
        setColor(initialColor);
      } else {
        setColor(AVAILABLE_COLORS[0] ?? "#22c55e");
      }
    }
  }, [open, wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let initialBalanceMinor = 0;
    let creditLimitMinor: number | undefined;
    let creditDueDayNum: number | undefined;
    let newBalanceMinor: number | undefined;

    if (!isEdit) {
      if (initialBalance.trim()) {
        const parsed = parseAmountToMinor(initialBalance);
        if (parsed === null || parsed < 0) {
          toast.error("Starting balance must be a valid non-negative number");
          return;
        }
        initialBalanceMinor = parsed;
      }

      if (walletType === "credit") {
        const parsedLimit = parseAmountToMinor(creditLimit);
        if (parsedLimit === null || parsedLimit <= 0) {
          toast.error("Credit limit must be a valid positive number");
          return;
        }
        creditLimitMinor = parsedLimit;

        const dueDay = Number(creditDueDay);
        if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
          toast.error("Top-up deadline must be a day between 1 and 31");
          return;
        }
        creditDueDayNum = dueDay;
      }
    }

    if (isEdit && wallet?.walletType === "credit") {
      const parsedLimit = parseAmountToMinor(creditLimit);
      if (parsedLimit === null || parsedLimit <= 0) {
        toast.error("Credit limit must be a valid positive number");
        return;
      }
      creditLimitMinor = parsedLimit;

      const dueDay = Number(creditDueDay);
      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        toast.error("Top-up deadline must be a day between 1 and 31");
        return;
      }
      creditDueDayNum = dueDay;

      const limitDelta = creditLimitMinor - (wallet.creditLimitMinor ?? 0);
      newBalanceMinor = wallet.balanceMinor + limitDelta;
    }

    setSubmitting(true);
    try {
      if (isEdit && wallet) {
        await updateWallet(user.uid, wallet.id, {
          name: name.trim(),
          icon,
          color,
          ...(wallet.walletType === "credit"
            ? {
                creditLimitMinor,
                creditDueDay: creditDueDayNum,
                balanceMinor: newBalanceMinor,
              }
            : {}),
        });
        toast.success("Wallet updated");
      } else {
        await createWallet(user.uid, {
          name: name.trim(),
          currency,
          icon,
          color,
          initialBalanceMinor,
          walletType,
          creditLimitMinor,
          creditDueDay: creditDueDayNum,
        });
        toast.success("Wallet created");
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save the wallet");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit wallet" : "New wallet"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? wallet?.walletType === "credit"
                ? "Update the wallet name, appearance, and credit settings."
                : "Update the wallet name and appearance."
              : "Add a wallet to track its balance and transactions."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wallet-name">Name</Label>
            <Input
              id="wallet-name"
              placeholder="e.g. Mono Black"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {isEdit && wallet?.walletType === "credit" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wallet-edit-credit-limit">Credit limit</Label>
                <Input
                  id="wallet-edit-credit-limit"
                  placeholder="0.00"
                  inputMode="decimal"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Changing this keeps what you currently owe the same.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wallet-edit-credit-due-day">Top-up deadline</Label>
                <Input
                  id="wallet-edit-credit-due-day"
                  type="number"
                  min={1}
                  max={31}
                  placeholder="e.g. 15"
                  value={creditDueDay}
                  onChange={(e) => setCreditDueDay(e.target.value)}
                />
              </div>
            </div>
          )}

          {!isEdit && (
            <>
              <div
                className={cn(
                  "grid gap-3",
                  walletType === "credit" ? "grid-cols-1" : "grid-cols-2"
                )}
              >
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as CurrencyCode)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {walletType !== "credit" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="wallet-balance">Starting balance</Label>
                    <Input
                      id="wallet-balance"
                      placeholder="0.00"
                      inputMode="decimal"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Wallet type</Label>
                <Select
                  value={walletType}
                  onValueChange={(value) => setWalletType(value as WalletType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {walletType === "credit" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="wallet-credit-limit">Credit limit</Label>
                    <Input
                      id="wallet-credit-limit"
                      placeholder="0.00"
                      inputMode="decimal"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Also sets your starting available credit.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wallet-credit-due-day">Top-up deadline</Label>
                    <Input
                      id="wallet-credit-due-day"
                      type="number"
                      min={1}
                      max={31}
                      placeholder="e.g. 15"
                      value={creditDueDay}
                      onChange={(e) => setCreditDueDay(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {WALLET_ICONS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md border transition-colors",
                    icon === iconName
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                  aria-label={iconName}
                >
                  <AppIcon name={iconName} className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map((colorValue) => (
                <button
                  key={colorValue}
                  type="button"
                  onClick={() => setColor(colorValue)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform",
                    color === colorValue
                      ? "scale-110 border-foreground"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: colorValue }}
                  aria-label={colorValue}
                />
              ))}
            </div>
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
            <Button type="submit" disabled={submitting}>
              {isEdit ? "Save changes" : "Create wallet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}