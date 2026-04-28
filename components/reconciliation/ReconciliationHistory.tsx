"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

interface Props {
  onSelectRun: (runId: string) => void;
  selectedRunId: string | null;
}

export function ReconciliationHistory({ onSelectRun, selectedRunId }: Props) {
  const { data: runs, isLoading } = trpc.reconciliation.runs.useQuery({ limit: 30 });

  if (isLoading) return <LoadingSkeleton rows={5} />;

  if (!runs || runs.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#ebedf1] p-8 text-center text-[#646e80]">
        暂无校对记录。运行 <code className="bg-[#f3f4f6] px-1.5 py-0.5 rounded text-[13px]">npx tsx scripts/reconcile.ts</code> 执行校对。
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[12px] border border-[#ebedf1] overflow-hidden">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="bg-[#f9fafc]">
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">时间</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">总数</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">一致</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">差异</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">缺失</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">耗时</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">状态</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, index) => (
            <tr
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className={`border-b border-[#f3f4f6] cursor-pointer transition-colors ${
                selectedRunId === run.id
                  ? "bg-[#eff2fe]"
                  : index % 2 === 1
                    ? "bg-[#fdfdfe] hover:bg-blue-50/30"
                    : "bg-white hover:bg-blue-50/30"
              }`}
            >
              <td className="px-5 py-3.5 text-[#333a4d]">
                {new Date(run.timestamp).toLocaleString("zh-CN")}
              </td>
              <td className="px-5 py-3.5 text-right text-[#333a4d]">{run.totalFunds}</td>
              <td className="px-5 py-3.5 text-right text-[#0d9858] font-semibold">{run.matchedCount}</td>
              <td className={`px-5 py-3.5 text-right font-semibold ${run.mismatchCount > 0 ? "text-[#dc2626]" : "text-[#333a4d]"}`}>
                {run.mismatchCount}
              </td>
              <td className={`px-5 py-3.5 text-right ${run.missingCount > 0 ? "text-[#f59e0b]" : "text-[#333a4d]"}`}>
                {run.missingCount}
              </td>
              <td className="px-5 py-3.5 text-right text-[#646e80]">
                {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "--"}
              </td>
              <td className="px-5 py-3.5">
                <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${
                  run.status === "COMPLETED" ? "bg-[#ecfdf5] text-[#0d9858]" : "bg-[#fef2f2] text-[#dc2626]"
                }`}>
                  {run.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
