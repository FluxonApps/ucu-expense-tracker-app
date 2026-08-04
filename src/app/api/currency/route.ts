import { NextResponse } from "next/server";
import { ISO_NUMERIC_TO_CODE } from "@/lib/currencies";
import type { CurrencyCode, CurrencyRate } from "@/lib/types";

const MONOBANK_URL = "https://api.monobank.ua/bank/currency";
/**
 * Monobank & NBU TTL cache duration (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface MonobankRate {
  currencyCodeA: number;
  currencyCodeB: number;
  date: number;
  rateBuy?: number;
  rateSell?: number;
  rateCross?: number;
}

interface HistoryItem {
  day: string;
  rate: number;
}

let monoCache: { rates: CurrencyRate[]; fetchedAt: number } | null = null;
let historyCache: { history: Record<string, HistoryItem[]>; fetchedAt: number } | null = null;

function parseRates(data: MonobankRate[]): CurrencyRate[] {
  const rates: CurrencyRate[] = [];
  for (const entry of data) {
    const from = ISO_NUMERIC_TO_CODE[entry.currencyCodeA] as CurrencyCode | undefined;
    const to = ISO_NUMERIC_TO_CODE[entry.currencyCodeB] as CurrencyCode | undefined;
    if (!from || !to) continue;

    if (entry.rateBuy && entry.rateSell) {
      rates.push({ from, to, rateBuy: entry.rateBuy, rateSell: entry.rateSell });
    } else if (entry.rateCross) {
      rates.push({ from, to, rateBuy: entry.rateCross, rateSell: entry.rateCross });
    }
  }
  return rates;
}

async function fetchNbuHistory(): Promise<Record<string, HistoryItem[]>> {
  const now = Date.now();
  if (historyCache && now - historyCache.fetchedAt < CACHE_TTL_MS) {
    return historyCache.history;
  }

  const today = new Date();
  const days = [4, 3, 2, 1, 0];

  const requests = days.map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}${mm}${dd}`;

    const dayLabel = d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });

    return fetch(
      `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${dateStr}&json`,
      { cache: "no-store" }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => ({ dayLabel, data }))
      .catch(() => null);
  });

  const results = await Promise.all(requests);
  const history: Record<string, HistoryItem[]> = { USD: [], EUR: [], PLN: [] };

  results.forEach((res) => {
    if (!res || !Array.isArray(res.data)) return;

    const ratesMap: Record<string, number> = {};
    res.data.forEach((item: { cc: string; rate: number }) => {
      ratesMap[item.cc] = item.rate;
    });

    ["USD", "EUR", "PLN"].forEach((code) => {
      const baseRate = ratesMap[code];
      if (baseRate) {
        history[code].push({
          day: res.dayLabel,
          rate: Number(baseRate.toFixed(2)),
        });
      }
    });
  });

  if (history.USD.length > 0) {
    historyCache = { history, fetchedAt: now };
  }

  return historyCache?.history || history;
}

export async function GET() {
  const now = Date.now();
  let rates: CurrencyRate[] | null = null;

  // 1. Try to fetch live Monobank rates using in-memory cache
  if (monoCache && now - monoCache.fetchedAt < CACHE_TTL_MS) {
    rates = monoCache.rates;
  } else {
    try {
      const response = await fetch(MONOBANK_URL, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as MonobankRate[];
        rates = parseRates(data);
        monoCache = { rates, fetchedAt: now };
      } else if (monoCache) {
        rates = monoCache.rates;
      }
    } catch (error) {
      console.error("Monobank fetch failed", error);
      if (monoCache) rates = monoCache.rates;
    }
  }

  // 2. Fetch 5-day history from NBU
  const history = await fetchNbuHistory();

  // If Monobank API failed, fallback to NBU rates without invented/fake numbers
  if (!rates && history.USD.length > 0) {
    rates = [
      { from: "USD", to: "UAH", rateBuy: history.USD[history.USD.length - 1]?.rate, rateSell: history.USD[history.USD.length - 1]?.rate },
      { from: "EUR", to: "UAH", rateBuy: history.EUR[history.EUR.length - 1]?.rate, rateSell: history.EUR[history.EUR.length - 1]?.rate },
      { from: "PLN", to: "UAH", rateBuy: history.PLN[history.PLN.length - 1]?.rate, rateSell: history.PLN[history.PLN.length - 1]?.rate },
    ];
  }

  // Return 502 error if both sources are unavailable and no cache exists
  if (!rates || rates.length === 0) {
    return NextResponse.json(
      { error: "Failed to fetch currency rates" },
      { status: 502 }
    );
  }

  return NextResponse.json({ rates, history });
}
