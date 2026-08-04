"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrencyCode } from "@/lib/types";

const STORAGE_KEY = "spendly-display-currency";
const DEFAULT_CURRENCY: CurrencyCode = "UAH";

interface DisplayCurrencyContextValue {
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(null);

export function DisplayCurrencyProvider({ children }: { children: ReactNode }) {
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (stored) setDisplayCurrencyState(stored);
  }, []);

  const setDisplayCurrency = (currency: CurrencyCode) => {
    setDisplayCurrencyState(currency);
    localStorage.setItem(STORAGE_KEY, currency);
  };

  return (
    <DisplayCurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency }}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const ctx = useContext(DisplayCurrencyContext);
  if (!ctx) {
    throw new Error("useDisplayCurrency must be used within a DisplayCurrencyProvider");
  }
  return ctx;
}
