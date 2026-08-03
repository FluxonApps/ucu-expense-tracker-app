import type { CurrencyCode } from "./types";

/** ISO-4217 numeric code -> letter code, for the Monobank API. */
export const ISO_NUMERIC_TO_CODE: Record<number, CurrencyCode> = {
  980: "UAH",
  840: "USD",
  978: "EUR",
  985: "PLN",
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["UAH", "USD", "EUR", "PLN"];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  UAH: "₴",
  USD: "$",
  EUR: "€",
  PLN: "zł",
};


/** Format an amount in minor units (kopiykas/cents) for display. */
export function formatMoney(amountMinor: number, currency: CurrencyCode): string {
  const major = amountMinor / 100;
  const formatted = new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${formatted} ${CURRENCY_SYMBOLS[currency]}`;
}

/** Parse user input like "1 234,56" or "1234.56" into minor units. */
export function parseAmountToMinor(input: string): number | null {
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}
