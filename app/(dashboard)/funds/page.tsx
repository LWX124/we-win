import { Suspense } from "react";
import { FundFilter } from "@/components/funds/FundFilter";
import { FundTable } from "@/components/funds/FundTable";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function FundsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">基金列表</h1>
      <Suspense>
        <FundFilter />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton rows={10} />}>
        <FundTable />
      </Suspense>
    </div>
  );
}
