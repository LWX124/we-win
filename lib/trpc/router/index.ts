import { router } from "../init";
import { fundRouter } from "./fund";
import { arbitrageRouter } from "./arbitrage";
import { historyRouter } from "./history";
import { settingsRouter } from "./settings";
import { adminRouter } from "./admin";
import { reconciliationRouter } from "./reconciliation";

export const appRouter = router({
  fund: fundRouter,
  arbitrage: arbitrageRouter,
  history: historyRouter,
  settings: settingsRouter,
  admin: adminRouter,
  reconciliation: reconciliationRouter,
});

export type AppRouter = typeof appRouter;
