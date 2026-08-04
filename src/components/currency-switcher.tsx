"use client";

import { useDisplayCurrency } from "@/components/display-currency-provider";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";

const OPTIONS = SUPPORTED_CURRENCIES;

export function CurrencySwitcher() {
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();

  return (
    <div className="flex items-center rounded-md border p-0.5 text-xs font-medium">
      {OPTIONS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setDisplayCurrency(code)}
          className={cn(
            "rounded px-2 py-1 transition-colors",
            code === displayCurrency
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={code === displayCurrency}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
