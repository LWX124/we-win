import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const arbitrageRouter = router({
  activeSignals: protectedProcedure.query(async () => {
    return prisma.arbitrageSignal.findMany({
      where: { status: "ACTIVE" },
      include: {
        fund: {
          select: { symbol: true, name: true, category: true },
        },
      },
      orderBy: { netSpread: "desc" },
    });
  }),

  signalHistory: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      return prisma.arbitrageSignal.findMany({
        where: { timestamp: { gte: since } },
        include: {
          fund: { select: { symbol: true, name: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 200,
      });
    }),

  stats: protectedProcedure.query(async () => {
    const [active, today] = await Promise.all([
      prisma.arbitrageSignal.count({ where: { status: "ACTIVE" } }),
      prisma.arbitrageSignal.count({
        where: {
          timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return { active, today };
  }),
});
