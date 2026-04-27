import { SignalBadge } from "./SignalBadge";

type Signal = {
  id: string;
  type: string;
  premiumRate: number;
  zScore: number | null;
  netSpread: number | null;
  costEstimate: number | null;
  timestamp: Date;
  fund: { symbol: string; name: string; category: string };
};

function pct(v: unknown): string {
  if (v === null || v === undefined) return "--";
  return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
}

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-600">
              {signal.fund.symbol}
            </span>
            <SignalBadge type={signal.type} zScore={signal.zScore ?? undefined} />
          </div>
          <p className="text-sm font-medium text-slate-800 mt-1">
            {signal.fund.name}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {new Date(signal.timestamp).toLocaleTimeString("zh-CN")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center pt-3 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500">溢价率</p>
          <p
            className={`font-mono font-bold text-sm ${
              Number(signal.premiumRate) > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {pct(signal.premiumRate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">预估成本</p>
          <p className="font-mono font-bold text-sm">
            {pct(signal.costEstimate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">净套利空间</p>
          <p className="font-mono font-bold text-sm text-blue-600">
            {pct(signal.netSpread)}
          </p>
        </div>
      </div>
    </div>
  );
}
