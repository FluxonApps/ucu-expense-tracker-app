"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useData } from "@/components/data-provider";
import { MCC_CATEGORY_MAP } from "@/lib/mcc-mapping";
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
import { createTransaction } from "@/lib/firestore/transactions";

interface ImportTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportTransactionsDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportTransactionsDialogProps) {
  const { user } = useAuth();
  const { wallets, categories } = useData();

  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!user) return;
    if (!selectedWalletId) {
      toast.error("Please select a wallet first");
      return;
    }
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
    if (!selectedWallet) {
      toast.error("Selected wallet not found");
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (lines.length <= 1) {
        toast.error("The selected file contains no transaction rows.");
        setIsImporting(false);
        return;
      }

      const transactionsToAdd = [];

      for (let i = 1; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.startsWith('"') && line.endsWith('"')) {
          line = line.substring(1, line.length - 1);
        }

        const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((col) =>
          col.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim()
        );

        if (columns.length < 4) continue;

        const dateStr = columns[0];
        const note = columns[1];
        const mccCode = columns[2] || "";
        let amountStr = columns[3];

        if (!dateStr || !amountStr) continue;

        const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
        const datePieces = datePart.split(".");
        if (datePieces.length < 3) continue;

        const [day, month, year] = datePieces;
        const [hour = "0", minute = "0", second = "0"] = timePart.split(":");

        const txDate = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second)
        );

        amountStr = amountStr
          .replace(/−/g, "-")
          .replace(/\s/g, "")
          .replace(",", ".");

        const numericMatch = amountStr.match(/-?\d+\.?\d*/);
        if (!numericMatch) continue;

        const amount = parseFloat(numericMatch[0]);
        if (isNaN(amount) || amount === 0) continue;

        const isIncome = amount > 0;

        // Match MCC code using our separate file mapping
        let matchedCategoryName = MCC_CATEGORY_MAP[mccCode];

        if (!matchedCategoryName && isIncome) {
          matchedCategoryName = "Other Income";
        }

        const foundCategory = categories.find(
          (c) => c.name.toLowerCase() === matchedCategoryName?.toLowerCase()
        );

        transactionsToAdd.push({
          walletId: selectedWalletId,
          categoryId: foundCategory ? foundCategory.id : "",
          type: (isIncome ? "income" : "expense") as "income" | "expense",
          amountMinor: Math.round(Math.abs(amount) * 100),
          currency: selectedWallet.currency,
          date: txDate,
          note: note,
        });
      }

      if (transactionsToAdd.length === 0) {
        toast.error("Could not parse any valid transactions from this file.");
        setIsImporting(false);
        return;
      }

      await Promise.all(
        transactionsToAdd.map((tx) => createTransaction(user.uid, tx))
      );

      toast.success(`Successfully imported ${transactionsToAdd.length} transactions!`);

      onSuccess();
      onOpenChange(false);
      setFile(null);
      setSelectedWalletId("");
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to parse or save the file.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>
            Upload a statement file from your bank to automatically add transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wallet">Select Wallet</Label>
            <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
              <SelectTrigger id="wallet">
                <SelectValue placeholder="Choose a wallet for these transactions" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name} ({wallet.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Bank Statement (CSV)</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || !selectedWalletId || isImporting}>
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}