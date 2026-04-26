import { router } from "../init";
import { fundRouter } from "./fund";
import { arbitrageRouter } from "./arbitrage";

export const appRouter = router({
  fund: fundRouter,
  arbitrage: arbitrageRouter,
});

export type AppRouter = typeof appRouter;
