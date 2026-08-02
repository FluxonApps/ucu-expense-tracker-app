import type { Timestamp } from "firebase/firestore";

export type CurrencyCode = "UAH" | "USD" | "EUR" | "PLN";

export type TransactionType = "income" | "expense" | "transfer";

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
  /** Destination wallet for transfers. */
  toWalletId?: string;
  /** Amount credited to the destination wallet (after conversion), minor units. */
  toAmountMinor?: number;
  /** Not set for transfers. */
  categoryId?: string;
  date: Timestamp;
  note: string;
  createdAt: Timestamp;
}

export interface CurrencyRate {
  /** e.g. "USD" */
  from: CurrencyCode;
  /** e.g. "UAH" */
  to: CurrencyCode;
  rateBuy: number;
  rateSell: number;
}
