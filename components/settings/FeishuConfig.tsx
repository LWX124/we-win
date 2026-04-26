"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { useState, useEffect } from "react";

export function FeishuConfig() {
  const { data: config } = trpc.settings.getFeishuConfig.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.settings.updateFeishuConfig.useMutation({
    onSuccess: () => utils.settings.getFeishuConfig.invalidate(),
  });

  const [webhookUrl, setWebhookUrl] = useState("");
  const [threshold, setThreshold] = useState(1.5);
  const [notifyPairs, setNotifyPairs] = useState(true);

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhookUrl);
      setThreshold(Number(config.threshold));
      setNotifyPairs(config.notifyPairs);
    }
  }, [config]);

  const handleSave = () => {
    updateMutation.mutate({
      webhookUrl: webhookUrl || "",
      threshold,
      notifyPairs,
      isActive: true,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">飞书通知配置</h2>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          最小溢价率阈值 (%)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="20"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="notifyPairs"
          checked={notifyPairs}
          onChange={(e) => setNotifyPairs(e.target.checked)}
        />
        <label htmlFor="notifyPairs" className="text-sm text-slate-700">
          通知配对套利机会
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
      >
        {updateMutation.isPending ? "保存中..." : "保存配置"}
      </button>
      {updateMutation.isSuccess && (
        <p className="text-sm text-green-600">保存成功</p>
      )}
    </div>
  );
}
