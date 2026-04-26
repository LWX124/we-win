import { router } from "../init";
import { fundRouter } from "./fund";

export const appRouter = router({
  fund: fundRouter,
});

export type AppRouter = typeof appRouter;
