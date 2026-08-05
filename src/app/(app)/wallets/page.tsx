"use client";

import { format as formatDate } from "date-fns";
import { MoreVertical, Pencil, Plus, Trash2, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { AppIcon } from "@/components/icons";
import { WalletFormDialog } from "@/components/wallets/wallet-form-dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/currencies";
import { deleteWallet } from "@/lib/firestore/wallets";
import type { Wallet } from "@/lib/types";

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Next occurrence of `dueDay`, clamped to shorter months (e.g. day 31 in Feb). */
function getNextDueDate(dueDay: number, from = new Date()): Date {
  const clampedThisMonth = Math.min(dueDay, daysInMonth(from.getFullYear(), from.getMonth()));
  const thisMonthDue = new Date(from.getFullYear(), from.getMonth(), clampedThisMonth);
  if (thisMonthDue >= from) return thisMonthDue;

  const nextMonth = from.getMonth() + 1;
  const clampedNextMonth = Math.min(dueDay, daysInMonth(from.getFullYear(), nextMonth));
  return new Date(from.getFullYear(), nextMonth, clampedNextMonth);
}

export default function WalletsPage() {
  const { user } = useAuth();
  const { wallets, walletsLoading } = useData();

  const [formOpen, setFormOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingWallet(null);
    setFormOpen(true);
  };

  const openEdit = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!user || !deletingWallet) return;
    setDeleting(true);
    try {
      await deleteWallet(user.uid, deletingWallet.id);
      toast.success(`Wallet "${deletingWallet.name}" deleted`);
      setDeletingWallet(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete the wallet");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Wallets</h1>
          <p className="text-sm text-muted-foreground">
            Manage your accounts and their balances
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add wallet
        </Button>
      </div>

      {walletsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <WalletIcon className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No wallets yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first wallet to start tracking expenses.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <Card
              key={wallet.id}
              className="relative overflow-hidden bg-white dark:bg-zinc-900 text-neutral-900 dark:text-zinc-100 border-transparent shadow-sm"
            >
              <div
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: wallet.color }}
              />
              <CardContent className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: wallet.color }}
                  >
                    <AppIcon name={wallet.icon} className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{wallet.name}</p>
                      {wallet.walletType === "credit" && (
                        <span className="inline-flex items-center rounded-full border border-neutral-300 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-zinc-400">
                          Credit
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{wallet.currency}</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {formatMoney(wallet.balanceMinor, wallet.currency)}
                    </p>
                    {wallet.walletType === "credit" && wallet.creditDueDay && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        You owe{" "}
                        {formatMoney(
                          Math.max(0, (wallet.creditLimitMinor ?? 0) - wallet.balanceMinor),
                          wallet.currency
                        )}{" "}
                        till {formatDate(getNextDueDate(wallet.creditDueDay), "d MMMM")}.
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(wallet)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeletingWallet(wallet)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WalletFormDialog open={formOpen} onOpenChange={setFormOpen} wallet={editingWallet} />

      <AlertDialog
        open={Boolean(deletingWallet)}
        onOpenChange={(open) => !open && setDeletingWallet(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deletingWallet?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the wallet and all of its transactions. This
              action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete wallet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}