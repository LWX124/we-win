import { LandingLayout } from "@/components/layout/LandingLayout";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function HomePage() {
  const [activeSignals, totalFunds] = await Promise.all([
    prisma.arbitrageSignal.count({ where: { status: "ACTIVE" } }),
    prisma.fund.count({ where: { isActive: true } }),
  ]);

  const topFunds = await prisma.fund.findMany({
    where: { isActive: true },
    include: {
      valuations: { orderBy: { timestamp: "desc" }, take: 1 },
      prices: { orderBy: { timestamp: "desc" }, take: 1 },
    },
    orderBy: { symbol: "asc" },
    take: 10,
  });

  const topByPremium = topFunds
    .map((f) => ({
      symbol: f.symbol,
      name: f.name,
      marketPrice: f.prices[0]?.marketPrice,
      premium: f.valuations[0]?.premium,
    }))
    .sort(
      (a, b) =>
        Math.abs(Number(b.premium ?? 0)) - Math.abs(Number(a.premium ?? 0)),
    )
    .slice(0, 10);

  return (
    <LandingLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            QDII 基金套利监控
          </h1>
          <p className="text-slate-500 text-lg">
            实时监控 {totalFunds} 只 QDII 基金的折溢价机会
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalFunds}</p>
            <p className="text-slate-500 mt-1">监控基金数量</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-3xl font-bold text-red-500">{activeSignals}</p>
            <p className="text-slate-500 mt-1">当前活跃套利信号</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">溢价率排行</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-6 py-2 font-medium text-slate-600">代码</th>
                <th className="px-6 py-2 font-medium text-slate-600">名称</th>
                <th className="px-6 py-2 font-medium text-slate-600 text-right">
                  溢价率
                </th>
              </tr>
            </thead>
            <tbody>
              {topByPremium.map((f) => (
                <tr key={f.symbol} className="border-b border-slate-50">
                  <td className="px-6 py-2 font-mono text-slate-700">
                    {f.symbol}
                  </td>
                  <td className="px-6 py-2 text-slate-800">{f.name}</td>
                  <td
                    className={`px-6 py-2 text-right font-mono ${
                      Number(f.premium ?? 0) > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {f.premium
                      ? `${Number(f.premium) >= 0 ? "+" : ""}${Number(f.premium).toFixed(2)}%`
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            登录查看完整数据
          </Link>
        </div>
      </div>
    </LandingLayout>
  );
}
