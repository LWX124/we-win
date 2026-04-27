import { router } from "../init";
import { fundRouter } from "./fund";
import { arbitrageRouter } from "./arbitrage";
import { historyRouter } from "./history";
import { settingsRouter } from "./settings";
import { adminRouter } from "./admin";

export const appRouter = router({
  fund: fundRouter,
  arbitrage: arbitrageRouter,
  history: historyRouter,
  settings: settingsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
