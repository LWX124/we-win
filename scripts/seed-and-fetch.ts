import { createClient } from "@supabase/supabase-js";
import { getAllFundSymbols } from "./lib/fund-registry";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, serviceKey);

// ── Category → DB mapping ──
const CATEGORY_MAP: Record<string, { dbCategory: string; currency: string }> = {
  chinaindex: { dbCategory: "CN_INDEX", currency: "CNY" },
  chinafuture: { dbCategory: "CN_COMMODITY", currency: "CNY" },
  qdii: { dbCategory: "US_TECH", currency: "USD" },
  qdiihk: { dbCategory: "HK_HSI", currency: "HKD" },
  qdiijp: { dbCategory: "JP_NKY", currency: "JPY" },
  qdiieu: { dbCategory: "EU_DAX", currency: "EUR" },
  qdiimix: { dbCategory: "MIXED", currency: "USD" },
};

// ── Fund seed data (from fund registry) ──
const funds = getAllFundSymbols().map((entry) => {
  const mapping = CATEGORY_MAP[entry.category] ?? { dbCategory: "MIXED", currency: "USD" };
  const exchange = entry.symbol.startsWith("SH") ? "SH" : "SZ";
  const type = entry.symbol.includes("ETF") ? "ETF" : "LOF";
  return {
    symbol: entry.symbol,
    name: entry.symbol, // Will be updated with real names later
    exchange,
    type,
    category: mapping.dbCategory,
    currency: mapping.currency,
    pairIndex: "", // Will be populated from EST mapping
  };
});

const CATEGORY_INDEX_MAP: Record<string, string> = {
  US_TECH: "^NDX", US_SP: "^GSPC", US_OIL: "XOP", US_BIO: "XBI",
  US_CONS: "XLY", HK_HSI: "^HSI", HK_HSCEI: "^HSCE", HK_TECH: "^HSTECH",
  JP_NKY: "^N225", EU_DAX: "^GDAXI", MIXED: "KWEB",
};
const CURRENCY_MAP: Record<string, string> = {
  USD: "USDCNY", HKD: "HKDCNY", JPY: "JPYCNY", EUR: "EURCNY",
};

// ── Step 1: Seed Funds + FundPairs ──

async function seedFunds() {
  console.log("\n[Step 1] Seeding funds...");
  const fundIds: Record<string, string> = {};

  for (const { pairIndex, ...fundData } of funds) {
    const { data, error } = await supabase
      .from("Fund")
      .upsert(fundData, { onConflict: "symbol" })
      .select("id, symbol")
      .single();

    if (error) {
      console.error(`  FAIL Fund ${fundData.symbol}: ${error.message}`);
      continue;
    }
    fundIds[data.symbol] = data.id;

    // Upsert FundPair — let DB auto-generate UUID id
    const { error: pairErr } = await supabase.from("FundPair").upsert(
      { fundId: data.id, pairIndex, calibrationFactor: 1.0, positionAdjust: 1.0 },
      { onConflict: "fundId,pairIndex" },
    );
    if (pairErr) console.error(`  FAIL FundPair ${fundData.symbol}: ${pairErr.message}`);
  }
  console.log(`  Seeded ${Object.keys(fundIds).length} funds`);
  return fundIds;
}

// ── Step 2: Fetch exchange rates (ChinaMoney) ──

async function fetchExchangeRates(): Promise<Record<string, number>> {
  console.log("\n[Step 2] Fetching exchange rates...");
  const today = new Date().toISOString().slice(0, 10);
  const rates: Record<string, number> = {};

  try {
    const resp = await fetch("https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: today, endDate: today, currency: "", pageNum: 1, pageSize: 50 }),
    });
    const json = await resp.json();

    // API returns head array (currency pair names) and records[0].values array (rates)
    const heads: string[] = json.data?.head || [];
    const values: string[] = json.records?.[0]?.values || [];
    const pairMap: Record<string, string> = {
      "USD/CNY": "USDCNY", "HKD/CNY": "HKDCNY", "100JPY/CNY": "JPYCNY", "EUR/CNY": "EURCNY",
    };

    for (let i = 0; i < heads.length; i++) {
      const pair = pairMap[heads[i]];
      if (pair && values[i]) {
        let rate = parseFloat(values[i]);
        if (heads[i] === "100JPY/CNY") rate = rate / 100; // Convert 100JPY to 1JPY
        rates[pair] = rate;
      }
    }

    // Insert into Supabase
    const now = new Date().toISOString();
    const rows = Object.entries(rates).map(([pair, rate]) => ({
      pair, rate, timestamp: now, source: "CHINAMONEY",
    }));
    if (rows.length) {
      const { error } = await supabase.from("ExchangeRate").insert(rows);
      if (error) console.error(`  FAIL ExchangeRate: ${error.message}`);
    }
    console.log(`  Got ${Object.keys(rates).length} rates:`, rates);
  } catch (e) {
    console.error("  ChinaMoney API failed:", e);
  }
  return rates;
}

// ── Step 3: Fetch index prices (Yahoo Finance) ──

async function fetchIndexPrices(): Promise<Record<string, number>> {
  console.log("\n[Step 3] Fetching index prices (Yahoo v8 chart API)...");
  const symbols = [...new Set([...Object.values(CATEGORY_INDEX_MAP), ...funds.map((f) => f.pairIndex)])];
  const prices: Record<string, number> = {};
  const now = new Date().toISOString();
  const rows: Array<{ indexSymbol: string; price: number; timestamp: string; source: string }> = [];

  // Fetch each symbol individually via v8 chart API
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const resp = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } },
        );
        const json = await resp.json();
        const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) {
          prices[sym] = price;
          rows.push({ indexSymbol: sym, price, timestamp: now, source: "YAHOO" });
        }
      } catch (e) {
        console.error(`  FAIL ${sym}:`, e);
      }
    }),
  );

  if (rows.length) {
    const { error } = await supabase.from("IndexPrice").insert(rows);
    if (error) console.error(`  FAIL IndexPrice: ${error.message}`);
  }
  console.log(`  Got ${Object.keys(prices).length}/${symbols.length} index prices`);
  return prices;
}

// ── Step 4: Fetch fund prices (Sina Finance) ──

async function fetchFundPrices(fundIds: Record<string, string>): Promise<Record<string, { price: number; volume: number | null }>> {
  console.log("\n[Step 4] Fetching fund prices from Sina...");
  const sinaSymbols = funds.map((f) => `f_${f.symbol.slice(2)}`);
  const results: Record<string, { price: number; volume: number | null }> = {};

  try {
    const resp = await fetch(`http://hq.sinajs.cn/list=${sinaSymbols.join(",")}`, {
      headers: { Referer: "https://finance.sina.com.cn" },
    });
    const buf = await resp.arrayBuffer();
    const text = new TextDecoder("gb2312").decode(buf);

    for (const line of text.trim().split("\n")) {
      const match = line.match(/var hq_str_f_(\d+)="(.+)"/);
      if (!match) continue;
      const code = match[1];
      const data = match[2].split(",");
      if (!data[1]) continue;

      // Find which fund this code belongs to
      const fund = funds.find((f) => f.symbol.slice(2) === code);
      if (!fund) continue;

      const price = parseFloat(data[1]);
      const volume = data[8] ? Math.floor(parseFloat(data[8])) : null;
      if (price > 0) results[fund.symbol] = { price, volume };
    }

    // Insert into Supabase
    const now = new Date().toISOString();
    const rows = Object.entries(results)
      .filter(([sym]) => fundIds[sym])
      .map(([sym, d]) => ({
        fundId: fundIds[sym], timestamp: now, marketPrice: d.price,
        volume: d.volume, source: "SINA",
      }));
    if (rows.length) {
      const { error } = await supabase.from("FundPrice").insert(rows);
      if (error) console.error(`  FAIL FundPrice: ${error.message}`);
    }
    console.log(`  Got ${Object.keys(results).length} fund prices`);
  } catch (e) {
    console.error("  Sina API failed:", e);
  }
  return results;
}

// ── Step 5: Calculate and insert valuations ──

async function calculateValuations(
  fundIds: Record<string, string>,
  rates: Record<string, number>,
  indexPrices: Record<string, number>,
  fundPrices: Record<string, { price: number; volume: number | null }>,
) {
  console.log("\n[Step 5] Calculating valuations...");
  const now = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];

  for (const fund of funds) {
    const fid = fundIds[fund.symbol];
    const fp = fundPrices[fund.symbol];
    if (!fid || !fp) continue;

    const indexSym = fund.pairIndex;
    const idxPrice = indexPrices[indexSym];
    const ratePair = CURRENCY_MAP[fund.currency];
    const rate = ratePair ? rates[ratePair] : undefined;

    if (!idxPrice || !rate) continue;

    const calibration = 1.0;
    const posAdj = 1.0;
    const realtimeNAV = (idxPrice * rate) / calibration * posAdj;
    const premium = realtimeNAV === 0 ? 0 : (fp.price / realtimeNAV - 1) * 100;

    rows.push({
      fundId: fid, timestamp: now, realtimeNAV: +realtimeNAV.toFixed(4),
      calibrationFactor: calibration, premium: +premium.toFixed(4),
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("FundValuation").insert(rows);
    if (error) console.error(`  FAIL FundValuation: ${error.message}`);
  }
  console.log(`  Calculated ${rows.length} valuations`);
}

// ── Main ──

async function main() {
  console.log("=== Supabase Seed & Fetch ===");
  const fundIds = await seedFunds();
  const [rates, indexPrices] = await Promise.all([fetchExchangeRates(), fetchIndexPrices()]);
  const fundPrices = await fetchFundPrices(fundIds);
  await calculateValuations(fundIds, rates, indexPrices, fundPrices);
  console.log("\n=== Done ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
