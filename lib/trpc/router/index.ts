import { router } from "../init";
import { fundRouter } from "./fund";
import { arbitrageRouter } from "./arbitrage";
import { historyRouter } from "./history";

export const appRouter = router({
  fund: fundRouter,
  arbitrage: arbitrageRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
