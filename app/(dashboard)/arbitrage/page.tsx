import { ArbitragePanel } from "@/components/arbitrage/ArbitragePanel";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ArbitragePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">套利机会</h1>
      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <ArbitragePanel />
      </Suspense>
    </div>
  );
}
