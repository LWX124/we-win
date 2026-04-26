import { adminProcedure, router } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const adminRouter = router({
  listUsers: adminProcedure.query(async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  updateUserRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["ADMIN", "USER"]) }))
    .mutation(async ({ input }) => {
      return prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });
    }),
});
