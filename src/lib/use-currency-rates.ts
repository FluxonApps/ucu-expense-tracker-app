"use client";

import { useEffect, useState } from "react";
import type { CurrencyCode, CurrencyRate } from "./types";

interface CurrencyRatesState {
  rates: CurrencyRate[];
  loading: boolean;
  error: string | null;
}

export function useCurrencyRates(): CurrencyRatesState {
  const [state, setState] = useState<CurrencyRatesState>({
    rates: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/currency")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Currency API returned ${res.status}`);
        const data = (await res.json()) as { rates: CurrencyRate[] };
        if (!cancelled) setState({ rates: data.rates, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ rates: [], loading: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Converts an amount between currencies using Monobank rates.
 * All pairs are quoted against UAH (except EUR/USD), so conversion
 * goes through UAH as the base currency.
 *
 * Returns null when the required rates are missing.
 */
export function convertMinor(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: CurrencyRate[]
): number | null {
  if (from === to) return amountMinor;

  const toUah = (amount: number, currency: CurrencyCode): number | null => {
    if (currency === "UAH") return amount;
    // Selling `currency` for UAH happens at the bank's buy rate.
    const rate = rates.find((r) => r.from === currency && r.to === "UAH");
    return rate ? amount * rate.rateBuy : null;
  };

  const fromUah = (amount: number, currency: CurrencyCode): number | null => {
    if (currency === "UAH") return amount;
    // Buying `currency` with UAH happens at the bank's sell rate.
    const rate = rates.find((r) => r.from === currency && r.to === "UAH");
    return rate ? amount / rate.rateSell : null;
  };

  const inUah = toUah(amountMinor, from);
  if (inUah === null) return null;
  const converted = fromUah(inUah, to);
  if (converted === null) return null;
  return Math.round(converted);
}
