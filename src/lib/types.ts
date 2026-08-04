import type { Timestamp } from "firebase/firestore";

export type CurrencyCode = "UAH" | "USD" | "EUR" | "PLN";

export type TransactionType = "income" | "expense" | "transfer";

/** How often an automatic income or expense is created. */
export type PaymentFrequency =
  | "monthly"
  | "everyTwoMonths"
  | "semiannual"
  | "yearly";

export interface UserProfile {
  displayName: string;
  email: string;
  baseCurrency: CurrencyCode;
  createdAt: Timestamp;
}

export interface Wallet {
  id: string;
  name: string;
  currency: CurrencyCode;
  /** Denormalized balance in minor units (kopiykas/cents). */
  balanceMinor: number;
  icon: string;
  color: string;
  createdAt: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Amount in minor units (kopiykas/cents), always positive. */
  amountMinor: number;
  currency: CurrencyCode;
  walletId: string;
  /** Wallet name retained for history if the wallet is later deleted. */
  walletName?: string;
  /** Destination wallet for transfers. */
  toWalletId?: string;
  /** Destination wallet name retained for transfer history after deletion. */
  toWalletName?: string;
  /** Amount credited to the destination wallet (after conversion), minor units. */
  toAmountMinor?: number;
  /** Not set for transfers. */
  categoryId?: string;
  date: Timestamp;
  note: string;
  /** True only for a transaction created by a recurring-payment schedule. */
  isAutomatic?: boolean;
  /** The schedule that generated this transaction, when applicable. */
  recurringTransactionId?: string;
  createdAt: Timestamp;
}

/** A rule that will create future income or expense transactions. */
export interface RecurringTransaction {
  id: string;
  type: "income" | "expense";
  amountMinor: number;
  currency: CurrencyCode;
  walletId: string;
  /** Kept so the schedule remains understandable if the wallet is removed. */
  walletName?: string;
  categoryId: string;
  note: string;
  frequency: PaymentFrequency;
  /** Day in a month chosen by the user, from 1 through 31. */
  dayOfMonth: number;
  /** The first future occurrence that has not been generated yet. */
  nextRunAt: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CurrencyRate {
  /** e.g. "USD" */
  from: CurrencyCode;
  /** e.g. "UAH" */
  to: CurrencyCode;
  rateBuy: number;
  rateSell: number;
}
