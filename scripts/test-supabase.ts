import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const tables = [
  "User", "Session", "Fund", "FundPrice", "ExchangeRate",
  "IndexPrice", "FundValuation", "FundPair", "ArbitrageSignal",
  "Notification", "FeishuConfig",
] as const;

async function test() {
  console.log(`Supabase: ${url}\n`);

  let pass = 0;
  let fail = 0;

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`  [FAIL] ${table} — ${error.message}`);
      fail++;
    } else {
      console.log(`  [OK]   ${table} — ${count ?? 0} rows`);
      pass++;
    }
  }

  console.log(`\nResult: ${pass}/${tables.length} tables OK, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

test();
