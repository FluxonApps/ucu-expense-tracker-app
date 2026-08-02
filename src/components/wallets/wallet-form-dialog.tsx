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
import type { CurrencyCode, Wallet } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [icon, setIcon] = useState(WALLET_ICONS[0]);
  const [color, setColor] = useState(WALLET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(wallet?.name ?? "");
      setCurrency(wallet?.currency ?? "UAH");
      setInitialBalance("");
      setIcon(wallet?.icon ?? WALLET_ICONS[0]);
      setColor(wallet?.color ?? WALLET_COLORS[0]);
    }
  }, [open, wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    let initialBalanceMinor = 0;
    if (!isEdit && initialBalance.trim()) {
      const parsed = parseAmountToMinor(initialBalance);
      if (parsed === null || parsed < 0) {
        toast.error("Starting balance must be a valid non-negative number");
        return;
      }
      initialBalanceMinor = parsed;
    }

    setSubmitting(true);
    try {
      if (isEdit && wallet) {
        await updateWallet(user.uid, wallet.id, { name: name.trim(), icon, color });
        toast.success("Wallet updated");
      } else {
        await createWallet(user.uid, {
          name: name.trim(),
          currency,
          icon,
          color,
          initialBalanceMinor,
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
              ? "Update the wallet name and appearance."
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

          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
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
            </div>
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
              {WALLET_COLORS.map((colorValue) => (
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
