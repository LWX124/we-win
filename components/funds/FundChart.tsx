"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartData = {
  timestamp: string;
  premium: number;
};

export function FundChart({ data }: { data: ChartData[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-800 mb-3">溢价率走势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("zh-CN", {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString("zh-CN")}
            formatter={(v) => [`${typeof v === "number" ? v.toFixed(2) : "--"}%`]}
          />
          <Line
            type="monotone"
            dataKey="premium"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
