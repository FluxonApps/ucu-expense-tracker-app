import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Отримуємо актуальні курси від Monobank API (або НБУ як фолбек)
    let monoRates: any[] = [];
    try {
      const monoRes = await fetch("https://api.monobank.ua/bank/currency", {
        next: { revalidate: 300 },
      });
      if (monoRes.ok) {
        const rawMono = await monoRes.json();
        const isoMap: Record<number, string> = { 840: "USD", 978: "EUR", 985: "PLN", 980: "UAH" };
        monoRates = rawMono
          .filter((r: any) => isoMap[r.currencyCodeA] && isoMap[r.currencyCodeB])
          .map((r: any) => ({
            from: isoMap[r.currencyCodeA],
            to: isoMap[r.currencyCodeB],
            rateBuy: r.rateBuy ?? r.rateCross,
            rateSell: r.rateSell ?? r.rateCross,
            rateCross: r.rateCross,
          }));
      }
    } catch (e) {
      console.warn("Monobank API failed, falling back to NBU");
    }

    // 2. Отримуємо історію за останні 5 днів від НБУ
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
        `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?date=${dateStr}&json`
      )
        .then((res) => res.json())
        .then((data) => ({ dayLabel, data }))
        .catch(() => null);
    });

    const results = await Promise.all(requests);

    const history: Record<string, { day: string; buy: number; sell: number }[]> = {
      USD: [],
      EUR: [],
      PLN: [],
    };

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
            buy: Number((baseRate * 0.997).toFixed(2)),
            sell: Number((baseRate * 1.003).toFixed(2)),
          });
        }
      });
    });

    // Якщо Monobank API не відповів, створюємо rates з останніх даних НБУ
    const rates = monoRates.length > 0 ? monoRates : [
      { from: "USD", to: "UAH", rateBuy: history.USD[history.USD.length - 1]?.buy ?? 41.2, rateSell: history.USD[history.USD.length - 1]?.sell ?? 41.6 },
      { from: "EUR", to: "UAH", rateBuy: history.EUR[history.EUR.length - 1]?.buy ?? 44.8, rateSell: history.EUR[history.EUR.length - 1]?.sell ?? 45.3 },
      { from: "PLN", to: "UAH", rateBuy: history.PLN[history.PLN.length - 1]?.buy ?? 10.3, rateSell: history.PLN[history.PLN.length - 1]?.sell ?? 10.6 },
    ];

    // Повертаємо І rates (для загального дашборду), І history (для віджета)
    return NextResponse.json({ rates, history });
  } catch (error) {
    console.error("Failed to fetch rates", error);
    return NextResponse.json({ rates: [], history: {} }, { status: 500 });
  }
}
