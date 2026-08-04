"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowDownRight, ArrowUpRight, RefreshCw, ArrowRightLeft } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";

const FlagUSD = () => (
  <svg viewBox="0 0 640 480" className="size-4 rounded-sm shrink-0 inline-block align-middle">
    <path fill="#bd3d44" d="M0 0h640v480H0z"/>
    <path stroke="#fff" strokeWidth="37" d="M0 55.4h640M0 130h640M0 203h640M0 277h640M0 350h640M0 424h640"/>
    <path fill="#192f5d" d="M0 0h280v258.5H0z"/>
  </svg>
);

const FlagEUR = () => (
  <svg viewBox="0 0 640 480" className="size-4 rounded-sm shrink-0 inline-block align-middle">
    <path fill="#003399" d="M0 0h640v480H0z"/>
    <g fill="#ffcc00">
      <circle cx="320" cy="120" r="10"/><circle cx="320" cy="360" r="10"/>
      <circle cx="200" cy="240" r="10"/><circle cx="440" cy="240" r="10"/>
      <circle cx="235" cy="155" r="10"/><circle cx="405" cy="325" r="10"/>
      <circle cx="235" cy="325" r="10"/><circle cx="405" cy="155" r="10"/>
    </g>
  </svg>
);

const FlagPLN = () => (
  <svg viewBox="0 0 640 480" className="size-4 rounded-sm shrink-0 inline-block align-middle">
    <path fill="#fff" d="M0 0h640v240H0z"/>
    <path fill="#dc143c" d="M0 240h640v240H0z"/>
  </svg>
);

const CURRENCY_FLAGS: Record<string, React.ReactNode> = {
  USD: <FlagUSD />,
  EUR: <FlagEUR />,
  PLN: <FlagPLN />,
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 p-2 shadow-xl backdrop-blur-md text-xs space-y-1">
        <p className="font-semibold text-neutral-300 border-b border-neutral-800 pb-1 mb-1">
          {data.day}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">
            NBU Rate: <b className="text-emerald-400 font-semibold">{data.rate.toFixed(2)} ₴</b>
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function CurrencyCard() {
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "EUR" | "PLN">("USD");
  const [historyData, setHistoryData] = useState<Record<string, { day: string; rate: number }[]>>({});
  const [realRates, setRealRates] = useState<Record<string, { buy: number; sell: number }>>({});
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState<string>("100");
  const [convertDirection, setConvertDirection] = useState<"TO_UAH" | "FROM_UAH">("TO_UAH");

  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetch("/api/currency");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();

        if (data.history) {
          setHistoryData(data.history);
        }

        if (data.rates) {
          const mapped: Record<string, { buy: number; sell: number }> = {};
          data.rates.forEach((r: any) => {
            if (r.to === "UAH") {
              mapped[r.from] = { buy: r.rateBuy, sell: r.rateSell };
            }
          });
          setRealRates(mapped);
        }
      } catch (err) {
        console.error("Failed to load currency data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRates();
  }, []);

  const chartData = historyData[selectedCurrency] || [];
  const activeRates = realRates[selectedCurrency];

  const currentBuy = activeRates?.buy ?? chartData[chartData.length - 1]?.rate ?? 0;
  const currentSell = activeRates?.sell ?? chartData[chartData.length - 1]?.rate ?? 0;

  const firstRate = chartData[0]?.rate ?? currentBuy;
  const buyDiff = currentBuy - firstRate;
  const buyPercent = firstRate ? ((buyDiff / firstRate) * 100).toFixed(2) : "0.00";
  const isBuyUp = buyDiff >= 0;

  const parsedAmount = parseFloat(amount) || 0;
  const rateToUse = convertDirection === "TO_UAH" ? currentBuy : currentSell;

  const convertedValue = rateToUse
    ? (convertDirection === "TO_UAH"
        ? parsedAmount * rateToUse
        : parsedAmount / rateToUse
      ).toLocaleString("en-US", { maximumFractionDigits: 2 })
    : "0";

  const toggleDirection = () => {
    setConvertDirection((prev) => (prev === "TO_UAH" ? "FROM_UAH" : "TO_UAH"));
  };

  const inputCurrency = convertDirection === "TO_UAH" ? selectedCurrency : "UAH";
  const outputCurrency = convertDirection === "TO_UAH" ? "UAH" : selectedCurrency;

  return (
    <Card className="border-neutral-800 bg-neutral-900 text-white shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {CURRENCY_FLAGS[selectedCurrency]} Exchange Rates
          </CardTitle>
          <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
            <RefreshCw className="size-3 text-neutral-500 animate-spin-slow" />
            Monobank / NBU API (UAH)
          </p>
        </div>

        <Tabs value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v as any)}>
          <TabsList className="bg-neutral-800 border border-neutral-700/80 p-0.5">
            <TabsTrigger value="USD" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-neutral-700">
              <FlagUSD /> USD
            </TabsTrigger>
            <TabsTrigger value="EUR" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-neutral-700">
              <FlagEUR /> EUR
            </TabsTrigger>
            <TabsTrigger value="PLN" className="text-xs flex items-center gap-1.5 data-[state=active]:bg-neutral-700">
              <FlagPLN /> PLN
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center rounded-xl bg-neutral-800/40 p-3.5 border border-neutral-800/80">
          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-400">Buy / Sell</span>
            {loading ? (
              <Skeleton className="h-8 w-32 bg-neutral-800" />
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tabular-nums text-emerald-400">
                    {currentBuy.toFixed(2)} ₴
                  </span>
                  <span
                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      isBuyUp
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {isBuyUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {Math.abs(Number(buyPercent))}%
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  Sell: <span className="font-semibold text-sky-400">{currentSell.toFixed(2)} ₴</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-14 w-full pt-2">
            {loading ? (
              <Skeleton className="h-full w-full bg-neutral-800" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="currencyTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isBuyUp ? "#34d399" : "#f87171"} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={isBuyUp ? "#34d399" : "#f87171"} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={["dataMin - 0.05", "dataMax + 0.05"]} hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#525252", strokeWidth: 1, strokeDasharray: "2 2" }} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke={isBuyUp ? "#34d399" : "#f87171"}
                    strokeWidth={2}
                    fill="url(#currencyTrend)"
                    activeDot={{ r: 4, fill: isBuyUp ? "#34d399" : "#f87171", stroke: "#171717", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-neutral-800/30 p-3 border border-neutral-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Quick Converter</span>
            <span>
              {convertDirection === "TO_UAH" ? "At buy rate" : "At sell rate"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-neutral-900 border-neutral-700 text-white h-9 text-sm pr-12 focus-visible:ring-1 focus-visible:ring-emerald-500"
                placeholder="Amount"
              />
              <span className="absolute right-2.5 top-2 text-xs font-semibold text-neutral-400">
                {inputCurrency}
              </span>
            </div>

            <button
              onClick={toggleDirection}
              type="button"
              title="Switch direction"
              className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition border border-neutral-700 shrink-0"
            >
              <ArrowRightLeft className="size-4" />
            </button>

            <div className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md h-9 px-3 flex items-center justify-between text-sm">
              <span className="font-bold text-emerald-400 tabular-nums truncate">{convertedValue}</span>
              <span className="text-xs font-semibold text-neutral-400 ml-1">{outputCurrency}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
