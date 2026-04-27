import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const settingsRouter = router({
  getFeishuConfig: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user?.id;
    if (!userId) return null;
    return prisma.feishuConfig.findUnique({ where: { userId } });
  }),

  updateFeishuConfig: protectedProcedure
    .input(
      z.object({
        webhookUrl: z.string(),
        isActive: z.boolean(),
        threshold: z.number().min(0).max(20),
        notifyPairs: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user?.id;
      if (!userId) throw new Error("Not authenticated");

      return prisma.feishuConfig.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    }),
});
