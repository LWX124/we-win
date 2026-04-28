import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";

export const reconciliationRouter = router({
  runs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
      }),
    )
    .query(async ({ input }) => {
      const runs = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          timestamp: Date;
          totalFunds: number;
          matchedCount: number;
          mismatchCount: number;
          missingCount: number;
          status: string;
          durationMs: number | null;
        }>
      >(
        `SELECT * FROM "ReconciliationRun" ORDER BY "timestamp" DESC LIMIT $1`,
        input.limit,
      );
      return runs;
    }),

  details: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      const details = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          runId: string;
          fundSymbol: string;
          category: string;
          field: string;
          ourValue: number | null;
          refValue: number | null;
          diffPercent: number | null;
          severity: string;
        }>
      >(
        `SELECT * FROM "ReconciliationDetail" WHERE "runId" = $1 ORDER BY "severity" DESC, "fundSymbol" ASC`,
        input.runId,
      );
      return details;
    }),
});
