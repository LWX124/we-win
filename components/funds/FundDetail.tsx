"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { FundChart } from "./FundChart";
import { SignalBadge } from "@/components/arbitrage/SignalBadge";

function format(val: unknown, decimals = 3): string {
  if (val === null || val === undefined) return "--";
  return Number(val).toFixed(decimals);
}

function pct(val: unknown): string {
  if (val === null || val === undefined) return "--";
  const v = Number(val);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function FundDetail({ symbol }: { symbol: string }) {
  const { data: fund, isLoading } = trpc.fund.bySymbol.useQuery({ symbol });

  if (isLoading) return <p className="text-slate-500">加载中...</p>;
  if (!fund) return <p className="text-red-500">基金不存在</p>;

  const chartData = fund.valuations
    .slice()
    .reverse()
    .map((v) => ({
      timestamp: v.timestamp.toISOString(),
      premium: Number(v.premium ?? 0),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {fund.name}
          <span className="text-slate-400 font-mono text-lg ml-3">
            {fund.symbol}
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {fund.exchange} · {fund.type} · {fund.category} · {fund.currency}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">场内价格</p>
          <p className="text-xl font-mono font-bold">
            {format(fund.prices[0]?.marketPrice)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">实时净值</p>
          <p className="text-xl font-mono font-bold">
            {format(fund.valuations[0]?.realtimeNAV)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">公允净值</p>
          <p className="text-xl font-mono font-bold">
            {format(fund.valuations[0]?.fairNAV)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">溢价率</p>
          <p
            className={`text-xl font-mono font-bold ${
              Number(fund.valuations[0]?.premium) > 0
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {pct(fund.valuations[0]?.premium)}
          </p>
        </div>
      </div>

      <FundChart data={chartData} />

      {fund.signals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">近期信号</h3>
          <div className="space-y-2">
            {fund.signals.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <SignalBadge type={s.type} zScore={Number(s.zScore)} />
                  <span className="text-slate-500">
                    {s.timestamp.toLocaleString("zh-CN")}
                  </span>
                </div>
                <span className="font-mono">
                  溢价率: {pct(s.premiumRate)} | 净空间: {pct(s.netSpread)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
