import { NextResponse } from "next/server";
import { ISO_NUMERIC_TO_CODE } from "@/lib/currencies";
import type { CurrencyCode, CurrencyRate } from "@/lib/types";

const MONOBANK_URL = "https://api.monobank.ua/bank/currency";
/**
 * Monobank allows roughly one request per 5 minutes (429 otherwise),
 * so we cache the parsed response in memory.
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

let cache: { rates: CurrencyRate[]; fetchedAt: number } | null = null;

function parseRates(data: MonobankRate[]): CurrencyRate[] {
  const rates: CurrencyRate[] = [];
  for (const entry of data) {
    const from = ISO_NUMERIC_TO_CODE[entry.currencyCodeA] as CurrencyCode | undefined;
    const to = ISO_NUMERIC_TO_CODE[entry.currencyCodeB] as CurrencyCode | undefined;
    if (!from || !to) continue;

    if (entry.rateBuy && entry.rateSell) {
      rates.push({ from, to, rateBuy: entry.rateBuy, rateSell: entry.rateSell });
    } else if (entry.rateCross) {
      // Cross-rate pairs only publish a single rate.
      rates.push({ from, to, rateBuy: entry.rateCross, rateSell: entry.rateCross });
    }
  }
  return rates;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ rates: cache.rates, cached: true });
  }

  try {
    const response = await fetch(MONOBANK_URL, { cache: "no-store" });
    if (!response.ok) {
      // Rate-limited or unavailable: fall back to the stale cache if we have one.
      if (cache) {
        return NextResponse.json({ rates: cache.rates, cached: true, stale: true });
      }
      return NextResponse.json(
        { error: `Monobank API responded with ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as MonobankRate[];
    const rates = parseRates(data);
    cache = { rates, fetchedAt: now };
    return NextResponse.json({ rates, cached: false });
  } catch (error) {
    console.error("Failed to fetch currency rates", error);
    if (cache) {
      return NextResponse.json({ rates: cache.rates, cached: true, stale: true });
    }
    return NextResponse.json({ error: "Failed to fetch currency rates" }, { status: 502 });
  }
}
