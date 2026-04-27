"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316",
];

export function FundComparison() {
  const { data: funds } = trpc.history.fundOptions.useQuery();
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState(30);

  const { data: history } = trpc.history.premiumHistory.useQuery(
    { fundIds: selected, days },
    { enabled: selected.length > 0 },
  );

  const toggleFund = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const mergedData = new Map<string, Record<string, number>>();
  history?.forEach((fund) => {
    fund.data.forEach((d) => {
      if (!mergedData.has(d.timestamp)) mergedData.set(d.timestamp, {});
      mergedData.get(d.timestamp)![fund.symbol] = d.premium;
    });
  });
  const chartData = Array.from(mergedData.entries())
    .map(([timestamp, vals]) => ({ timestamp, ...vals }))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {funds?.map((f) => (
          <button
            key={f.id}
            onClick={() => toggleFund(f.id)}
            className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
              selected.includes(f.id)
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.symbol}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {[7, 30, 90, 180].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded text-xs font-medium ${
              days === d
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {d}天
          </button>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("zh-CN")
                }
              />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                labelFormatter={(v) => new Date(v).toLocaleString("zh-CN")}
                formatter={(v) => [`${Number(v).toFixed(2)}%`]}
              />
              <Legend />
              {history?.map((fund, i) => (
                <Line
                  key={fund.symbol}
                  type="monotone"
                  dataKey={fund.symbol}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  name={fund.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
