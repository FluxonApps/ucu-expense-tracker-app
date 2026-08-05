"use client";

import { useState, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransaction } from "@/lib/firestore/transactions";
import { AlertCircle, Building2, Upload, X } from "lucide-react";

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

  const [selectedBank, setSelectedBank] = useState<string>("monobank");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!user) return;
    if (!selectedBank) {
      toast.error("Please select a bank first.");
      return;
    }
    if (!selectedWalletId) {
      toast.error("Please select a wallet first.");
      return;
    }
    if (!file) {
      toast.error("Please select a file.");
      return;
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      toast.error("Excel files (.xlsx) are not supported. Please open the file in Excel/Numbers and choose 'Save As > CSV'.");
      return;
    }
    if (!fileName.endsWith('.csv')) {
      toast.error("Invalid file format. Please upload a .csv file.");
      return;
    }

    const selectedWallet = wallets.find((w) => w.id === selectedWalletId);
    if (!selectedWallet) {
      toast.error("Selected wallet not found.");
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (lines.length <= 1) {
        throw new Error("The selected file is empty or contains no transaction rows.");
      }

      let headerIndex = -1;
      let delimiter = ",";

      const sample = lines.slice(0, 5).join("\n");
      if (sample.includes(";")) delimiter = ";";
      else if (sample.includes("\t")) delimiter = "\t";

      const splitRegex = new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`);

      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        let cleanLine = lines[i].trim();
        if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
          cleanLine = cleanLine.slice(1, -1);
        }

        const cols = cleanLine.split(splitRegex).map(c =>
          c.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim().toLowerCase()
        );

        if (cols[0] && (cols[0].includes("дата") && cols[0].includes("операці"))) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        throw new Error("Invalid CSV format: Could not find the standard Monobank header.");
      }

      const transactionsToAdd = [];
      const seenSignatures = new Set<string>(); // Tracks internal file duplicates

      for (let i = headerIndex + 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('"') && line.endsWith('"')) {
          line = line.slice(1, -1);
        }

        const columns = line.split(splitRegex).map((col) =>
          col.replace(/^"+|"+$/g, "").replace(/""/g, '"').trim()
        );

        if (columns.length < 4) continue;

        const dateStr = columns[0];
        const note = columns[1] || "";
        const mccCode = columns[2] || "";
        let amountStr = columns[3];

        if (!dateStr || !amountStr) continue;

        const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
        if (!datePart) continue;

        const datePieces = datePart.split(".");
        if (datePieces.length < 3) continue;

        let day, month, year;
        if (datePieces[0].length === 4) {
          year = datePieces[0];
          month = datePieces[1];
          day = datePieces[2];
        } else {
          day = datePieces[0];
          month = datePieces[1];
          year = datePieces[2];
        }

        const [hour = "0", minute = "0", second = "0"] = timePart.split(":");
        const txDate = new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second)
        );

        amountStr = amountStr.replace(/−/g, "-").replace(/\s/g, "").replace(",", ".");
        const numericMatch = amountStr.match(/-?\d+\.?\d*/);
        if (!numericMatch) continue;

        const amount = parseFloat(numericMatch[0]);
        if (isNaN(amount) || amount === 0) continue;

        const isIncome = amount > 0;
        const amountMinor = Math.round(Math.abs(amount) * 100);

        // --- INTERNAL FILE DEDUPLICATION SIGNATURE ---
        // We create a strict signature based on Date, Amount, and Note
        const signature = `${txDate.getTime()}-${amountMinor}-${note.trim().toLowerCase()}`;
        if (seenSignatures.has(signature)) {
          continue; // Skip duplicate row inside the same file
        }
        seenSignatures.add(signature);

        let matchedCategoryName = MCC_CATEGORY_MAP[mccCode];

        if (!matchedCategoryName && isIncome) {
          matchedCategoryName = "Other Income";
        }

        const foundCategory = categories.find(
          (c) => c.name.toLowerCase() === matchedCategoryName?.toLowerCase()
        );

        // Generate Base64 ID safe for Firestore
        const rawString = `mono-${signature}`;
        const customId = btoa(unescape(encodeURIComponent(rawString)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        transactionsToAdd.push({
          id: customId,
          walletId: selectedWalletId,
          categoryId: foundCategory ? foundCategory.id : "",
          type: (isIncome ? "income" : "expense") as "income" | "expense",
          amountMinor: amountMinor,
          currency: selectedWallet.currency,
          date: txDate,
          note: note,
        });
      }

      if (transactionsToAdd.length === 0) {
        throw new Error("No valid transactions found.");
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const tx of transactionsToAdd) {
        const wasCreated = await createTransaction(user.uid, tx);
        if (wasCreated) {
          importedCount++;
        } else {
          skippedCount++;
        }
      }

      if (importedCount === 0) {
        toast.info(`No new transactions found. Skipped ${skippedCount} duplicates.`);
      } else if (skippedCount > 0) {
        toast.success(`Imported ${importedCount} transactions (${skippedCount} duplicates skipped).`);
      } else {
        toast.success(`Successfully imported ${importedCount} transactions!`);
      }

      onSuccess();
      onOpenChange(false);
      setFile(null);
      setSelectedWalletId("");
    } catch (error) {
      console.error("Import error:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to parse or save the file due to an invalid structure.");
      }
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

        <div className="space-y-4 py-2">
          <div className="flex gap-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/20 p-3 text-xs text-muted-foreground border-blue-200 dark:border-blue-800">
            <AlertCircle className="size-4 shrink-0 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Import Requirements:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Currently, <strong>only Monobank</strong> imports are supported.</li>
                <li>File must be strictly in <strong>.csv</strong> format.</li>
                <li>The file structure must match the standard Monobank export.</li>
              </ul>
              <p className="font-semibold pt-1 text-emerald-700 dark:text-emerald-400">Note: Existing transactions are automatically skipped using Base64 Hashed IDs.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank" className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              Select Bank
            </Label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger id="bank">
                <SelectValue placeholder="Choose a bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monobank">Monobank</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0"
              >
                <Upload className="mr-2 size-4" />
                {file ? "Change File" : "Select File"}
              </Button>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm text-muted-foreground truncate">
                  {file ? file.name : "No file selected"}
                </span>

                {file && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <input
              id="file"
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || !selectedWalletId || !selectedBank || isImporting}>
            {isImporting ? "Importing..." : "Import CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}