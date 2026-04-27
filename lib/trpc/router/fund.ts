import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";

export const fundRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        exchange: z.string().optional(),
        sortBy: z.enum(["premium", "symbol", "marketPrice"]).default("premium"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const { category, exchange, limit } = input;

      const where: Record<string, unknown> = { isActive: true };
      if (category) where.category = category;
      if (exchange) where.exchange = exchange;

      const funds = await prisma.fund.findMany({
        where,
        include: {
          valuations: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          prices: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          signals: {
            where: { status: "ACTIVE" },
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
        take: limit,
      });

      return funds.map((f) => ({
        id: f.id,
        symbol: f.symbol,
        name: f.name,
        exchange: f.exchange,
        type: f.type,
        category: f.category,
        currency: f.currency,
        marketPrice: f.prices[0]?.marketPrice ?? null,
        valuation: f.valuations[0] ?? null,
        activeSignal: f.signals[0] ?? null,
      }));
    }),

  bySymbol: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const fund = await prisma.fund.findUnique({
        where: { symbol: input.symbol },
        include: {
          valuations: {
            orderBy: { timestamp: "desc" },
            take: 100,
          },
          prices: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          signals: {
            orderBy: { timestamp: "desc" },
            take: 20,
          },
          pairs: true,
        },
      });

      if (!fund) throw new Error("Fund not found");
      return fund;
    }),

  categories: publicProcedure.query(async () => {
    const funds = await prisma.fund.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
    });
    return [...new Set(funds.map((f) => f.category))].sort();
  }),
});
