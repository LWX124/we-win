"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { SignalCard } from "./SignalCard";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export function ArbitragePanel() {
  const { data: signals, isLoading } = trpc.arbitrage.activeSignals.useQuery();
  const { data: stats } = trpc.arbitrage.stats.useQuery();

  if (isLoading) return <LoadingSkeleton rows={5} />;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">活跃信号</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.active ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">今日信号</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.today ?? 0}</p>
        </div>
      </div>

      {!signals || signals.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          暂无活跃套利信号
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={{
                id: s.id,
                type: s.type,
                premiumRate: Number(s.premiumRate),
                zScore: s.zScore ? Number(s.zScore) : null,
                netSpread: s.netSpread ? Number(s.netSpread) : null,
                costEstimate: s.costEstimate ? Number(s.costEstimate) : null,
                timestamp: s.timestamp,
                fund: s.fund as { symbol: string; name: string; category: string },
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
