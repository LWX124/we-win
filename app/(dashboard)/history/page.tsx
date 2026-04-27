import { FundComparison } from "@/components/history/FundComparison";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function HistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">历史分析</h1>
      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <FundComparison />
      </Suspense>
    </div>
  );
}
