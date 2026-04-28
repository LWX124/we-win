"use client";

import { useState } from "react";
import { ReconciliationHistory } from "@/components/reconciliation/ReconciliationHistory";
import { ReconciliationDetailTable } from "@/components/reconciliation/ReconciliationDetail";

export default function ReconciliationPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[#1a2035]">数据校对</h1>
        <p className="text-[14px] text-[#646e80] mt-1">
          与 palmmicro.com 参考数据的每日校对记录
        </p>
      </div>

      <div>
        <h2 className="text-[16px] font-semibold text-[#333a4d] mb-3">校对历史</h2>
        <ReconciliationHistory
          onSelectRun={setSelectedRunId}
          selectedRunId={selectedRunId}
        />
      </div>

      {selectedRunId && (
        <div>
          <h2 className="text-[16px] font-semibold text-[#333a4d] mb-3">差异明细</h2>
          <ReconciliationDetailTable runId={selectedRunId} />
        </div>
      )}
    </div>
  );
}
