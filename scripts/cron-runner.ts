import cron from "node-cron";
import { execSync } from "child_process";

// Run reconciliation at 16:00 Beijing time, weekdays only
// node-cron uses system timezone; set TZ=Asia/Shanghai when running
const CRON_EXPRESSION = "0 16 * * 1-5";

console.log("=== QDII Cron Runner ===");
console.log(`Scheduled: ${CRON_EXPRESSION} (weekdays 16:00 Asia/Shanghai)`);
console.log("Waiting for next trigger...\n");

cron.schedule(
  CRON_EXPRESSION,
  () => {
    console.log(`[${new Date().toISOString()}] Running reconciliation...`);
    try {
      execSync("npx tsx scripts/reconcile.ts", {
        stdio: "inherit",
        env: { ...process.env, TZ: "Asia/Shanghai" },
      });
    } catch (e) {
      console.error("Reconciliation failed:", e);
    }
  },
  { timezone: "Asia/Shanghai" },
);

// Keep the process alive
process.on("SIGINT", () => {
  console.log("\nCron runner stopped.");
  process.exit(0);
});
