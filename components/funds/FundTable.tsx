"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SignalBadge } from "@/components/arbitrage/SignalBadge";

function formatPrice(v: unknown): string {
  if (v === null || v === undefined) return "--";
  return Number(v).toFixed(3);
}

function formatPremium(v: unknown): string {
  if (v === null || v === undefined) return "--";
  const pct = Number(v);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function FundTable() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;

  const { data: funds, isLoading } = trpc.fund.list.useQuery({
    category,
    sortBy: "premium",
    sortOrder: "desc",
    limit: 50,
  });

  if (isLoading) {
    return <LoadingSkeleton rows={10} />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            <th className="px-4 py-3 font-medium text-slate-600">代码</th>
            <th className="px-4 py-3 font-medium text-slate-600">名称</th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">
              场内价
            </th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">
              实时净值
            </th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">
              溢价率
            </th>
            <th className="px-4 py-3 font-medium text-slate-600">信号</th>
          </tr>
        </thead>
        <tbody>
          {funds?.map((fund) => (
            <tr
              key={fund.id}
              className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-slate-700">
                <Link
                  href={`/funds/${fund.symbol}`}
                  className="hover:text-blue-600"
                >
                  {fund.symbol}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-800">{fund.name}</td>
              <td className="px-4 py-3 text-right font-mono">
                {formatPrice(fund.marketPrice)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {formatPrice(fund.valuation?.realtimeNAV)}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono ${
                  Number(fund.valuation?.premium) > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {formatPremium(fund.valuation?.premium)}
              </td>
              <td className="px-4 py-3">
                {fund.activeSignal && (
                  <SignalBadge
                    type={fund.activeSignal.type}
                    zScore={Number(fund.activeSignal.zScore)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
