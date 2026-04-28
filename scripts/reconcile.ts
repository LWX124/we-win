import { createClient } from "@supabase/supabase-js";
import { getAllFundSymbols } from "./lib/fund-registry";
import { parseFundDetailPage } from "./lib/html-parser";
import { compareFundData, type DiffRecord, type OurFundData } from "./lib/reconcile-core";
import { sendFeishuNotification } from "../lib/feishu";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const BASE_URL = "https://www.palmmicro.com/woody/res/";
const FETCH_DELAY_MS = 1500; // 1.5s between requests

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, serviceKey);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(pageUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 QDII-Reconciler/1.0" },
    });
    if (!resp.ok) {
      console.error(`  FAIL ${pageUrl}: ${resp.status}`);
      return null;
    }
    const buf = await resp.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf);
  } catch (e) {
    console.error(`  FAIL ${pageUrl}:`, e);
    return null;
  }
}

async function queryOurData(symbol: string): Promise<OurFundData | null> {
  const { data: fund } = await supabase
    .from("Fund")
    .select("id")
    .eq("symbol", symbol)
    .single();

  if (!fund) return null;

  const { data: price } = await supabase
    .from("FundPrice")
    .select("marketPrice")
    .eq("fundId", fund.id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  const { data: valuation } = await supabase
    .from("FundValuation")
    .select("realtimeNAV, premium")
    .eq("fundId", fund.id)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  return {
    marketPrice: price?.marketPrice ? Number(price.marketPrice) : null,
    premium: valuation?.premium ? Number(valuation.premium) : null,
    realtimeNAV: valuation?.realtimeNAV ? Number(valuation.realtimeNAV) : null,
  };
}

async function saveResults(
  allDiffs: DiffRecord[],
  totalFunds: number,
  durationMs: number,
): Promise<string> {
  const mismatchSymbols = new Set(
    allDiffs.filter((d) => d.severity !== "INFO" && d.field !== "missing" && d.field !== "fetch_failed").map((d) => d.fundSymbol),
  );
  const missingSymbols = new Set(
    allDiffs.filter((d) => d.field === "missing" || d.field === "fetch_failed").map((d) => d.fundSymbol),
  );

  const { data: run, error: runErr } = await supabase
    .from("ReconciliationRun")
    .insert({
      totalFunds,
      matchedCount: totalFunds - mismatchSymbols.size - missingSymbols.size,
      mismatchCount: mismatchSymbols.size,
      missingCount: missingSymbols.size,
      status: "COMPLETED",
      durationMs,
    })
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("Failed to save reconciliation run:", runErr);
    return "";
  }

  const details = allDiffs
    .filter((d) => d.severity !== "INFO")
    .map((d) => ({ runId: run.id, ...d }));

  if (details.length > 0) {
    const { error: detailErr } = await supabase
      .from("ReconciliationDetail")
      .insert(details);
    if (detailErr) console.error("Failed to save details:", detailErr);
  }

  return run.id;
}

function writeLocalReport(diffs: DiffRecord[], totalFunds: number, durationMs: number): void {
  const dir = join(process.cwd(), "reports", "reconciliation");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const filePath = join(dir, `${date}.json`);

  const report = {
    date,
    timestamp: new Date().toISOString(),
    totalFunds,
    durationMs,
    summary: {
      info: diffs.filter((d) => d.severity === "INFO").length,
      warning: diffs.filter((d) => d.severity === "WARNING").length,
      critical: diffs.filter((d) => d.severity === "CRITICAL").length,
      missing: diffs.filter((d) => d.field === "missing").length,
    },
    diffs: diffs.filter((d) => d.severity !== "INFO"),
  };

  writeFileSync(filePath, JSON.stringify(report, null, 2));
  console.log(`  Report saved to ${filePath}`);
}

async function sendNotification(diffs: DiffRecord[], totalFunds: number): Promise<void> {
  const warnings = diffs.filter((d) => d.severity === "WARNING");
  const criticals = diffs.filter((d) => d.severity === "CRITICAL");
  const missing = diffs.filter((d) => d.field === "missing" || d.field === "fetch_failed");

  const problemFunds = new Set([
    ...warnings.map((d) => d.fundSymbol),
    ...criticals.map((d) => d.fundSymbol),
    ...missing.map((d) => d.fundSymbol),
  ]);

  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("  No FEISHU_WEBHOOK_URL set, skipping notification");
    return;
  }

  let text = `校对完成：${totalFunds} 只基金\n`;
  text += `正常: ${totalFunds - problemFunds.size}\n`;

  if (criticals.length > 0) {
    text += `\n--- CRITICAL (${criticals.length}) ---\n`;
    for (const d of criticals) {
      text += `${d.fundSymbol} ${d.field}: 我方=${d.ourValue} 参考=${d.refValue} 差异=${d.diffPercent?.toFixed(2)}%\n`;
    }
  }

  if (warnings.length > 0) {
    text += `\n--- WARNING (${warnings.length}) ---\n`;
    for (const d of warnings.slice(0, 20)) {
      text += `${d.fundSymbol} ${d.field}: 差异=${d.diffPercent?.toFixed(2)}%\n`;
    }
    if (warnings.length > 20) text += `... 及 ${warnings.length - 20} 条更多\n`;
  }

  if (missing.length > 0) {
    text += `\n缺失数据: ${missing.map((d) => d.fundSymbol).join(", ")}\n`;
  }

  const title = criticals.length > 0
    ? `QDII 校对告警 - ${criticals.length} 项严重差异`
    : `QDII 校对完成 - ${totalFunds} 只基金`;

  await sendFeishuNotification(webhookUrl, { title, text });
}

async function main() {
  console.log("=== QDII Reconciliation ===");
  const startTime = Date.now();
  const allFunds = getAllFundSymbols();
  console.log(`Total funds to reconcile: ${allFunds.length}`);

  const allDiffs: DiffRecord[] = [];
  let processed = 0;

  for (const fund of allFunds) {
    const pageUrl = `${BASE_URL}${fund.detailPage}`;
    console.log(`  [${++processed}/${allFunds.length}] ${fund.symbol}...`);

    const html = await fetchPage(pageUrl);
    if (!html) {
      allDiffs.push({
        fundSymbol: fund.symbol,
        category: fund.category,
        field: "fetch_failed",
        ourValue: null,
        refValue: null,
        diffPercent: null,
        severity: "WARNING",
      });
      await sleep(FETCH_DELAY_MS);
      continue;
    }

    const refData = parseFundDetailPage(html, fund.symbol);
    const ourData = await queryOurData(fund.symbol);
    const diffs = compareFundData(refData, ourData, fund.category);
    allDiffs.push(...diffs);

    await sleep(FETCH_DELAY_MS);
  }

  const durationMs = Date.now() - startTime;

  console.log(`\n--- Summary (${(durationMs / 1000).toFixed(1)}s) ---`);
  const warnings = allDiffs.filter((d) => d.severity === "WARNING");
  const criticals = allDiffs.filter((d) => d.severity === "CRITICAL");
  console.log(`  Total: ${allFunds.length}, Critical: ${criticals.length}, Warning: ${warnings.length}`);

  await saveResults(allDiffs, allFunds.length, durationMs);
  writeLocalReport(allDiffs, allFunds.length, durationMs);
  await sendNotification(allDiffs, allFunds.length);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
