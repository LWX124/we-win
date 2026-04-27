import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const historyRouter = router({
  premiumHistory: protectedProcedure
    .input(
      z.object({
        fundIds: z.array(z.string()),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const valuations = await prisma.fundValuation.findMany({
        where: {
          fundId: { in: input.fundIds },
          timestamp: { gte: since },
        },
        include: {
          fund: { select: { symbol: true, name: true } },
        },
        orderBy: { timestamp: "asc" },
      });

      const byFund = new Map<string, typeof valuations>();
      for (const v of valuations) {
        const key = v.fund.symbol;
        if (!byFund.has(key)) byFund.set(key, []);
        byFund.get(key)!.push(v);
      }

      return Array.from(byFund.entries()).map(([symbol, vals]) => ({
        symbol,
        name: vals[0].fund.name,
        data: vals.map((v) => ({
          timestamp: v.timestamp.toISOString(),
          premium: Number(v.premium ?? 0),
        })),
      }));
    }),

  fundOptions: protectedProcedure.query(async () => {
    return prisma.fund.findMany({
      where: { isActive: true },
      select: { id: true, symbol: true, name: true, category: true },
      orderBy: { symbol: "asc" },
    });
  }),
});
