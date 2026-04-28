"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

interface Props {
  runId: string;
}

function severityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "text-[#dc2626]";
    case "WARNING": return "text-[#f59e0b]";
    default: return "text-[#333a4d]";
  }
}

function severityBg(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "bg-[#fef2f2] text-[#dc2626]";
    case "WARNING": return "bg-[#fffbeb] text-[#f59e0b]";
    default: return "bg-[#f3f4f6] text-[#646e80]";
  }
}

export function ReconciliationDetailTable({ runId }: Props) {
  const { data: details, isLoading } = trpc.reconciliation.details.useQuery({ runId });

  if (isLoading) return <LoadingSkeleton rows={5} />;

  if (!details || details.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#ebedf1] p-8 text-center text-[#0d9858] font-medium">
        所有基金数据一致，无差异记录。
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[12px] border border-[#ebedf1] overflow-hidden">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="bg-[#f9fafc]">
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">基金</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">分类</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">字段</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">我方值</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">参考值</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">差异%</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">级别</th>
          </tr>
        </thead>
        <tbody>
          {details.map((d, index) => (
            <tr
              key={d.id}
              className={`border-b border-[#f3f4f6] ${index % 2 === 1 ? "bg-[#fdfdfe]" : "bg-white"}`}
            >
              <td className="px-5 py-3.5 font-semibold text-[#2563eb]">{d.fundSymbol}</td>
              <td className="px-5 py-3.5 text-[#646e80]">{d.category}</td>
              <td className="px-5 py-3.5 text-[#333a4d]">{d.field}</td>
              <td className="px-5 py-3.5 text-right text-[#333a4d]">
                {d.ourValue !== null ? Number(d.ourValue).toFixed(4) : "--"}
              </td>
              <td className="px-5 py-3.5 text-right text-[#333a4d]">
                {d.refValue !== null ? Number(d.refValue).toFixed(4) : "--"}
              </td>
              <td className={`px-5 py-3.5 text-right font-semibold ${severityColor(d.severity)}`}>
                {d.diffPercent !== null ? `${Number(d.diffPercent).toFixed(2)}%` : "--"}
              </td>
              <td className="px-5 py-3.5">
                <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${severityBg(d.severity)}`}>
                  {d.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
