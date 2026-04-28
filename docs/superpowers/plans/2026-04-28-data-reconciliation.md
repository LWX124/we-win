# QDII Data Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand fund coverage from 19 to 100+ funds and build a daily reconciliation system that compares our calculated data with palmmicro.com reference data.

**Architecture:** Two independent modules sharing the Supabase database. (1) Fund registry extracted from PHP source provides the complete fund list. (2) Reconciliation script fetches each fund's detail page from palmmicro.com, parses HTML tables, compares values with our Supabase data, and reports differences via database, Feishu, local files, and a dashboard page.

**Tech Stack:** TypeScript, Next.js 16 (app router), tRPC, Supabase/Prisma, node-cron, vitest, cheerio (HTML parsing)

---

### Task 1: Install cheerio and node-cron dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install cheerio node-cron
npm install -D @types/node-cron
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require('cheerio'); require('node-cron'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cheerio and node-cron dependencies"
```

---

### Task 2: Create the fund registry with complete fund lists

**Files:**
- Create: `scripts/lib/fund-registry.ts`
- Test: `tests/fund-registry.test.ts`

This file contains ALL fund symbols extracted from the PHP source at `/Users/weixi1/Documents/workspace/web/php/stock/stocksymbol.php`. Each fund includes its symbol, category page, and paired index/EST symbol.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/fund-registry.test.ts
import { describe, it, expect } from "vitest";
import {
  getAllFundSymbols,
  getFundsByCategory,
  CATEGORY_PAGES,
} from "../scripts/lib/fund-registry";

describe("fund-registry", () => {
  it("returns all fund symbols across all categories", () => {
    const all = getAllFundSymbols();
    expect(all.length).toBeGreaterThan(100);
    // Every symbol starts with SH or SZ
    for (const f of all) {
      expect(f.symbol).toMatch(/^(SH|SZ)\d{6}$/);
    }
  });

  it("returns funds for the qdii (US) category", () => {
    const funds = getFundsByCategory("qdii");
    expect(funds.length).toBeGreaterThan(20);
    expect(funds.some((f) => f.symbol === "SH513100")).toBe(true);
  });

  it("returns funds for the qdiimix category", () => {
    const funds = getFundsByCategory("qdiimix");
    expect(funds.length).toBeGreaterThan(25);
    expect(funds.some((f) => f.symbol === "SH501225")).toBe(true);
  });

  it("returns funds for the qdiihk category", () => {
    const funds = getFundsByCategory("qdiihk");
    expect(funds.length).toBeGreaterThan(15);
    expect(funds.some((f) => f.symbol === "SH513600")).toBe(true);
  });

  it("has all 7 category pages defined", () => {
    expect(Object.keys(CATEGORY_PAGES)).toEqual([
      "chinaindex",
      "chinafuture",
      "qdii",
      "qdiihk",
      "qdiijp",
      "qdiieu",
      "qdiimix",
    ]);
  });

  it("no duplicate symbols within a category", () => {
    for (const cat of Object.keys(CATEGORY_PAGES)) {
      const funds = getFundsByCategory(cat);
      const symbols = funds.map((f) => f.symbol);
      expect(new Set(symbols).size).toBe(symbols.length);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fund-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the fund registry implementation**

```typescript
// scripts/lib/fund-registry.ts

export interface FundEntry {
  symbol: string;
  category: string;
  detailPage: string; // e.g. "sh501225cn.php"
}

// Category page mapping: category key -> PHP page filename
export const CATEGORY_PAGES: Record<string, string> = {
  chinaindex: "chinaindexcn.php",
  chinafuture: "chinafuturecn.php",
  qdii: "qdiicn.php",
  qdiihk: "qdiihkcn.php",
  qdiijp: "qdiijpcn.php",
  qdiieu: "qdiieucn.php",
  qdiimix: "qdiimixcn.php",
};

// Fund symbol arrays extracted from PHP source:
// /Users/weixi1/Documents/workspace/web/php/stock/stocksymbol.php

const CHINA_INDEX = ["SH501043", "SH510300", "SH510310", "SH510330", "SZ159919"];

const CHINA_FUTURE = ["SH518800", "SH518880", "SZ159934", "SZ159937", "SZ159985", "SZ161226"];

const QDII_OIL_ETF = ["SZ160416", "SZ162719", "SZ163208"];
const QDII_QQQ_MATCH = ["SH513100", "SH513110", "SH513390", "SH513870", "SZ159501", "SZ159513", "SZ159632", "SZ159659", "SZ159660", "SZ159696", "SZ159941", "SZ161130"];
const QDII_QQQ = [...QDII_QQQ_MATCH, "SH513300"];
const QDII_SPY_MATCH = ["SH513500", "SH513650", "SZ159612", "SZ161125"];
const QDII_SPY = [...QDII_SPY_MATCH, "SZ159655"];
const QDII_XOP = ["SH513350", "SZ159518", "SZ162411"];
const QDII_XBI = ["SZ159502", "SZ161127"];
const QDII_US = [
  "SH501300", "SH513290", "SH513400", "SZ160140", "SZ161126", "SZ161128", "SZ162415", "SZ164824", "SZ164906",
  ...QDII_XBI, ...QDII_XOP, ...QDII_OIL_ETF, ...QDII_QQQ, ...QDII_SPY,
];

const QDII_HK_TECH = ["SH513010", "SH513130", "SH513180", "SH513260", "SH513380", "SH513580", "SH513890", "SH520570", "SH520590", "SH520920", "SZ159740", "SZ159741", "SZ159742"];
const QDII_HK_HSHARES = ["SH510900", "SZ159850", "SZ159954", "SZ159960", "SZ160717", "SZ161831"];
const QDII_HK_HANGSENG = ["SH501302", "SH513210", "SH513600", "SH513660", "SZ159312", "SZ159920", "SZ160924", "SZ164705"];
const QDII_HK = ["SH501025", "SZ161124", ...QDII_HK_TECH, ...QDII_HK_HSHARES, ...QDII_HK_HANGSENG];

const QDII_JP_NKY = ["SH513000", "SH513520", "SH513880", "SZ159866"];
const QDII_JP = ["SH513800", ...QDII_JP_NKY];

const QDII_EU_DAX = ["SH513030", "SZ159561"];
const QDII_EU = ["SH513080", ...QDII_EU_DAX];

const CHINA_INTERNET = ["SH513050", "SH513220", "SZ159605", "SZ159607"];
const MSCI_US50 = ["SH513850", "SZ159577"];
const HK_MIX = ["SH513090", "SH513230", "SH513750", "SH513990", "SZ159567", "SZ159570", "SZ159615", "SZ159751", "SZ159792"];
const QDII_GOLD = ["SZ160216", "SZ161815", "SZ160719", "SZ161116", "SZ164701", "SZ165513"];
const QDII_OIL = ["SH501018", "SZ160723", "SZ161129"];
const QDII_GOLD_OIL = [...QDII_OIL, ...QDII_GOLD];
const QDII_MIX = [
  "SH501225", "SH501312", "SH513360", "SZ159509", "SZ159529", "SZ160644",
  ...QDII_GOLD_OIL, ...CHINA_INTERNET, ...HK_MIX, ...MSCI_US50,
];

const CATEGORY_SYMBOLS: Record<string, string[]> = {
  chinaindex: CHINA_INDEX,
  chinafuture: CHINA_FUTURE,
  qdii: QDII_US,
  qdiihk: QDII_HK,
  qdiijp: QDII_JP,
  qdiieu: QDII_EU,
  qdiimix: QDII_MIX,
};

function symbolToDetailPage(symbol: string): string {
  return `${symbol.toLowerCase()}cn.php`;
}

export function getFundsByCategory(category: string): FundEntry[] {
  const symbols = CATEGORY_SYMBOLS[category];
  if (!symbols) return [];
  return symbols.map((symbol) => ({
    symbol,
    category,
    detailPage: symbolToDetailPage(symbol),
  }));
}

export function getAllFundSymbols(): FundEntry[] {
  const seen = new Set<string>();
  const result: FundEntry[] = [];
  for (const [category, symbols] of Object.entries(CATEGORY_SYMBOLS)) {
    for (const symbol of symbols) {
      if (!seen.has(symbol)) {
        seen.add(symbol);
        result.push({ symbol, category, detailPage: symbolToDetailPage(symbol) });
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fund-registry.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/fund-registry.ts tests/fund-registry.test.ts
git commit -m "feat: add complete fund registry extracted from PHP source"
```

---

### Task 3: Create the HTML parser for palmmicro fund detail pages

**Files:**
- Create: `scripts/lib/html-parser.ts`
- Test: `tests/html-parser.test.ts`
- Create: `tests/fixtures/sh501225cn.html` (saved from curl output)

The parser extracts data from 4 HTML tables identified by their `id` attributes:
- `estimationtable` — official EST, fair EST, premiums
- `netvaluehistorytable` — latest NAV and change
- `referencetable` — market price, exchange rates
- `*fundhistorytable` — premium history

- [ ] **Step 1: Save the HTML fixture**

Run:
```bash
mkdir -p tests/fixtures
curl -s "https://www.palmmicro.com/woody/res/sh501225cn.php" > tests/fixtures/sh501225cn.html
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/html-parser.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parseFundDetailPage } from "../scripts/lib/html-parser";

const html = readFileSync("tests/fixtures/sh501225cn.html", "utf-8");

describe("parseFundDetailPage", () => {
  const result = parseFundDetailPage(html, "SH501225");

  it("parses fund symbol", () => {
    expect(result.symbol).toBe("SH501225");
  });

  it("parses estimation table data", () => {
    expect(result.officialEST).toBeGreaterThan(0);
    expect(result.estDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof result.officialPremium).toBe("number");
    // fairEST may or may not exist
    if (result.fairEST !== null) {
      expect(result.fairEST).toBeGreaterThan(0);
      expect(typeof result.fairPremium).toBe("number");
    }
  });

  it("parses net value history", () => {
    expect(result.latestNAV).toBeGreaterThan(0);
    expect(result.navDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof result.navChange).toBe("number");
  });

  it("parses reference table for market price", () => {
    expect(result.marketPrice).toBeGreaterThan(0);
    expect(typeof result.priceChange).toBe("number");
  });

  it("parses exchange rate data", () => {
    expect(Object.keys(result.exchangeRates).length).toBeGreaterThan(0);
    // Should have USDCNH or USDCNY etc.
    const keys = Object.keys(result.exchangeRates);
    expect(keys.some((k) => k.includes("USD") || k.includes("HKD"))).toBe(true);
  });

  it("parses premium history records", () => {
    expect(result.premiumHistory.length).toBeGreaterThan(0);
    const first = result.premiumHistory[0];
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof first.price).toBe("number");
    expect(typeof first.nav).toBe("number");
    expect(typeof first.premium).toBe("number");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/html-parser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the HTML parser implementation**

```typescript
// scripts/lib/html-parser.ts
import * as cheerio from "cheerio";

export interface PremiumHistoryEntry {
  date: string;
  price: number;
  nav: number;
  premium: number;
  officialEST: number | null;
  error: number | null;
}

export interface FundDetailData {
  symbol: string;
  officialEST: number | null;
  estDate: string | null;
  officialPremium: number | null;
  fairEST: number | null;
  fairPremium: number | null;
  realtimeEST: number | null;
  realtimePremium: number | null;
  latestNAV: number | null;
  navDate: string | null;
  navChange: number | null;
  marketPrice: number | null;
  priceChange: number | null;
  exchangeRates: Record<string, number>;
  premiumHistory: PremiumHistoryEntry[];
}

function parseNumber(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[%,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractText($el: cheerio.Cheerio<cheerio.Element>): string {
  return $el.text().trim();
}

export function parseFundDetailPage(html: string, symbol: string): FundDetailData {
  const $ = cheerio.load(html);
  const result: FundDetailData = {
    symbol,
    officialEST: null,
    estDate: null,
    officialPremium: null,
    fairEST: null,
    fairPremium: null,
    realtimeEST: null,
    realtimePremium: null,
    latestNAV: null,
    navDate: null,
    navChange: null,
    marketPrice: null,
    priceChange: null,
    exchangeRates: {},
    premiumHistory: [],
  };

  // Parse estimation table (#estimationtable)
  const estRows = $("#estimationtable tbody tr");
  estRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 4) {
      result.officialEST = parseNumber(extractText(cells.eq(1)));
      result.estDate = extractText(cells.eq(2)) || null;
      result.officialPremium = parseNumber(extractText(cells.eq(3)));
    }
    if (cells.length >= 6) {
      result.fairEST = parseNumber(extractText(cells.eq(4)));
      result.fairPremium = parseNumber(extractText(cells.eq(5)));
    }
    if (cells.length >= 8) {
      result.realtimeEST = parseNumber(extractText(cells.eq(6)));
      result.realtimePremium = parseNumber(extractText(cells.eq(7)));
    }
  });

  // Parse net value history table (#netvaluehistorytable)
  const navRows = $("#netvaluehistorytable tbody tr");
  if (navRows.length > 0) {
    const cells = $(navRows[0]).find("td");
    if (cells.length >= 3) {
      result.navDate = extractText(cells.eq(0)) || null;
      result.latestNAV = parseNumber(extractText(cells.eq(1)));
      result.navChange = parseNumber(extractText(cells.eq(2)));
    }
  }

  // Parse reference table (#referencetable)
  const refRows = $("#referencetable tbody tr");
  refRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const code = extractText(cells.eq(0));
    const price = parseNumber(extractText(cells.eq(1)));
    const change = parseNumber(extractText(cells.eq(2)));

    if (code.startsWith("SH") || code.startsWith("SZ")) {
      // This is the fund's own market data
      result.marketPrice = price;
      result.priceChange = change;
    } else if (code.includes("USD") || code.includes("HKD") || code.includes("JPY") || code.includes("EUR")) {
      // Exchange rate entry
      if (price !== null) {
        result.exchangeRates[code] = price;
      }
    }
  });

  // Parse premium history table (id ends with "fundhistorytable")
  const historyTable = $(`table[id$="fundhistorytable"]`);
  const historyRows = historyTable.find("tbody tr");
  historyRows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length >= 4) {
      const entry: PremiumHistoryEntry = {
        date: extractText(cells.eq(0)),
        price: parseNumber(extractText(cells.eq(1))) ?? 0,
        nav: parseNumber(extractText(cells.eq(2))) ?? 0,
        premium: parseNumber(extractText(cells.eq(3))) ?? 0,
        officialEST: cells.length >= 5 ? parseNumber(extractText(cells.eq(4))) : null,
        error: cells.length >= 7 ? parseNumber(extractText(cells.eq(6))) : null,
      };
      if (entry.date) result.premiumHistory.push(entry);
    }
  });

  return result;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/html-parser.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/html-parser.ts tests/html-parser.test.ts tests/fixtures/sh501225cn.html
git commit -m "feat: add HTML parser for palmmicro fund detail pages"
```

---

### Task 4: Create the reconciliation database migration

**Files:**
- Create: `supabase/migration-reconciliation.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migration-reconciliation.sql
-- Reconciliation tables for comparing our data with palmmicro reference

-- Run record for each reconciliation execution
CREATE TABLE IF NOT EXISTS "ReconciliationRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "totalFunds" INT NOT NULL,
  "matchedCount" INT NOT NULL,
  "mismatchCount" INT NOT NULL,
  "missingCount" INT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "durationMs" INT
);

-- Detail records for each fund comparison
CREATE TABLE IF NOT EXISTS "ReconciliationDetail" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" UUID NOT NULL REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE,
  "fundSymbol" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "ourValue" DECIMAL(12,4),
  "refValue" DECIMAL(12,4),
  "diffPercent" DECIMAL(8,4),
  "severity" TEXT NOT NULL DEFAULT 'INFO'
);

CREATE INDEX IF NOT EXISTS "ReconciliationDetail_runId_idx"
  ON "ReconciliationDetail"("runId");
CREATE INDEX IF NOT EXISTS "ReconciliationDetail_severity_idx"
  ON "ReconciliationDetail"("severity");

-- Allow read access
ALTER TABLE "ReconciliationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReconciliationDetail" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ReconciliationRun read access"
  ON "ReconciliationRun" FOR SELECT USING (true);
CREATE POLICY "ReconciliationDetail read access"
  ON "ReconciliationDetail" FOR SELECT USING (true);
```

- [ ] **Step 2: Apply the migration**

Run: Copy the SQL and execute it in the Supabase SQL Editor, or run:
```bash
npx supabase db push
```
Or apply manually via the Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration-reconciliation.sql
git commit -m "feat: add reconciliation database tables"
```

---

### Task 5: Create the reconciliation script

**Files:**
- Create: `scripts/reconcile.ts`
- Test: `tests/reconcile.test.ts`

This is the main script. It fetches fund detail pages from palmmicro.com, compares with our Supabase data, and outputs results to all 4 channels (DB, Feishu, local file, console).

- [ ] **Step 1: Write the failing test for the comparison logic**

```typescript
// tests/reconcile.test.ts
import { describe, it, expect } from "vitest";
import { compareFundData, classifySeverity } from "../scripts/lib/reconcile-core";
import type { FundDetailData } from "../scripts/lib/html-parser";

describe("classifySeverity", () => {
  it("returns INFO for diff < 0.5%", () => {
    expect(classifySeverity(0.3)).toBe("INFO");
    expect(classifySeverity(-0.3)).toBe("INFO");
  });

  it("returns WARNING for diff 0.5%-2%", () => {
    expect(classifySeverity(0.8)).toBe("WARNING");
    expect(classifySeverity(1.5)).toBe("WARNING");
  });

  it("returns CRITICAL for diff > 2%", () => {
    expect(classifySeverity(2.5)).toBe("CRITICAL");
    expect(classifySeverity(-3.0)).toBe("CRITICAL");
  });
});

describe("compareFundData", () => {
  const refData: FundDetailData = {
    symbol: "SH513100",
    officialEST: 2.345,
    estDate: "2026-04-28",
    officialPremium: 5.5,
    fairEST: 2.340,
    fairPremium: 5.7,
    realtimeEST: null,
    realtimePremium: null,
    latestNAV: 2.300,
    navDate: "2026-04-27",
    navChange: 1.2,
    marketPrice: 2.474,
    priceChange: -0.5,
    exchangeRates: { USDCNY: 7.25 },
    premiumHistory: [],
  };

  it("returns no mismatches when data matches closely", () => {
    const ourData = { marketPrice: 2.474, premium: 5.4, realtimeNAV: 2.345 };
    const diffs = compareFundData(refData, ourData, "qdii");
    // premium diff is 0.1, which is < 0.5%, so INFO
    const warnings = diffs.filter((d) => d.severity !== "INFO");
    expect(warnings.length).toBe(0);
  });

  it("detects premium mismatch", () => {
    const ourData = { marketPrice: 2.474, premium: 8.0, realtimeNAV: 2.345 };
    const diffs = compareFundData(refData, ourData, "qdii");
    const premiumDiff = diffs.find((d) => d.field === "officialPremium");
    expect(premiumDiff).toBeDefined();
    expect(premiumDiff!.severity).toBe("WARNING");
  });

  it("detects market price mismatch", () => {
    const ourData = { marketPrice: 2.600, premium: 5.5, realtimeNAV: 2.345 };
    const diffs = compareFundData(refData, ourData, "qdii");
    const priceDiff = diffs.find((d) => d.field === "marketPrice");
    expect(priceDiff).toBeDefined();
    expect(priceDiff!.severity).not.toBe("INFO");
  });

  it("handles missing our data gracefully", () => {
    const ourData = null;
    const diffs = compareFundData(refData, ourData, "qdii");
    expect(diffs.length).toBe(1);
    expect(diffs[0].field).toBe("missing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/reconcile.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the reconcile-core module**

```typescript
// scripts/lib/reconcile-core.ts
import type { FundDetailData } from "./html-parser";

export interface DiffRecord {
  fundSymbol: string;
  category: string;
  field: string;
  ourValue: number | null;
  refValue: number | null;
  diffPercent: number | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

export function classifySeverity(diffPercent: number): "INFO" | "WARNING" | "CRITICAL" {
  const abs = Math.abs(diffPercent);
  if (abs >= 2) return "CRITICAL";
  if (abs >= 0.5) return "WARNING";
  return "INFO";
}

function calcDiffPercent(our: number | null, ref: number | null): number | null {
  if (our === null || ref === null || ref === 0) return null;
  return ((our - ref) / Math.abs(ref)) * 100;
}

export interface OurFundData {
  marketPrice: number | null;
  premium: number | null;
  realtimeNAV: number | null;
}

export function compareFundData(
  refData: FundDetailData,
  ourData: OurFundData | null,
  category: string,
): DiffRecord[] {
  const diffs: DiffRecord[] = [];

  if (!ourData) {
    diffs.push({
      fundSymbol: refData.symbol,
      category,
      field: "missing",
      ourValue: null,
      refValue: null,
      diffPercent: null,
      severity: "WARNING",
    });
    return diffs;
  }

  // Compare premium (officialPremium from ref vs our premium)
  if (refData.officialPremium !== null && ourData.premium !== null) {
    const diff = ourData.premium - refData.officialPremium;
    diffs.push({
      fundSymbol: refData.symbol,
      category,
      field: "officialPremium",
      ourValue: ourData.premium,
      refValue: refData.officialPremium,
      diffPercent: diff,
      severity: classifySeverity(diff),
    });
  }

  // Compare market price
  if (refData.marketPrice !== null && ourData.marketPrice !== null) {
    const diff = calcDiffPercent(ourData.marketPrice, refData.marketPrice);
    if (diff !== null) {
      diffs.push({
        fundSymbol: refData.symbol,
        category,
        field: "marketPrice",
        ourValue: ourData.marketPrice,
        refValue: refData.marketPrice,
        diffPercent: diff,
        severity: classifySeverity(diff),
      });
    }
  }

  // Compare EST (realtimeNAV from us vs officialEST from ref)
  if (refData.officialEST !== null && ourData.realtimeNAV !== null) {
    const diff = calcDiffPercent(ourData.realtimeNAV, refData.officialEST);
    if (diff !== null) {
      diffs.push({
        fundSymbol: refData.symbol,
        category,
        field: "estValue",
        ourValue: ourData.realtimeNAV,
        refValue: refData.officialEST,
        diffPercent: diff,
        severity: classifySeverity(diff),
      });
    }
  }

  return diffs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/reconcile.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/reconcile-core.ts tests/reconcile.test.ts
git commit -m "feat: add reconciliation comparison logic"
```

---

### Task 6: Create the main reconcile script

**Files:**
- Create: `scripts/reconcile.ts`

This script orchestrates the full reconciliation flow: fetch pages, parse, compare, save results.

- [ ] **Step 1: Write the reconcile script**

```typescript
// scripts/reconcile.ts
import { createClient } from "@supabase/supabase-js";
import { getAllFundSymbols, CATEGORY_PAGES, type FundEntry } from "./lib/fund-registry";
import { parseFundDetailPage, type FundDetailData } from "./lib/html-parser";
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
  // Get the latest fund data from Supabase
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
  const matched = allDiffs.filter((d) => d.severity === "INFO" && d.field !== "missing").length;
  const mismatched = allDiffs.filter((d) => d.severity !== "INFO" && d.field !== "missing").length;
  const missing = allDiffs.filter((d) => d.field === "missing").length;

  // Count unique funds with issues (not fields)
  const mismatchSymbols = new Set(
    allDiffs.filter((d) => d.severity !== "INFO").map((d) => d.fundSymbol),
  );

  const { data: run, error: runErr } = await supabase
    .from("ReconciliationRun")
    .insert({
      totalFunds,
      matchedCount: totalFunds - mismatchSymbols.size,
      mismatchCount: mismatchSymbols.size,
      missingCount: missing,
      status: "COMPLETED",
      durationMs,
    })
    .select("id")
    .single();

  if (runErr || !run) {
    console.error("Failed to save reconciliation run:", runErr);
    return "";
  }

  // Save detail records (only WARNING and CRITICAL)
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
  const missing = diffs.filter((d) => d.field === "missing");

  // Get Feishu webhook from env or DB
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("  No FEISHU_WEBHOOK_URL set, skipping notification");
    return;
  }

  let text = `校对完成：${totalFunds} 只基金\n`;
  text += `正常: ${totalFunds - warnings.length - criticals.length - missing.length}\n`;

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

  // Output to all channels
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
```

- [ ] **Step 2: Verify script compiles**

Run: `npx tsx --eval "import './scripts/reconcile'" 2>&1 | head -5`
Expected: Should show import errors for env vars but not TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add scripts/reconcile.ts
git commit -m "feat: add main reconciliation script"
```

---

### Task 7: Create the cron runner

**Files:**
- Create: `scripts/cron-runner.ts`

- [ ] **Step 1: Write the cron runner**

```typescript
// scripts/cron-runner.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/cron-runner.ts
git commit -m "feat: add cron runner for scheduled reconciliation"
```

---

### Task 8: Add tRPC router for reconciliation data

**Files:**
- Create: `lib/trpc/router/reconciliation.ts`
- Modify: `lib/trpc/router/index.ts`

- [ ] **Step 1: Write the reconciliation router**

```typescript
// lib/trpc/router/reconciliation.ts
import { z } from "zod";
import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";

export const reconciliationRouter = router({
  runs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
      }),
    )
    .query(async ({ input }) => {
      const runs = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          timestamp: Date;
          totalFunds: number;
          matchedCount: number;
          mismatchCount: number;
          missingCount: number;
          status: string;
          durationMs: number | null;
        }>
      >(
        `SELECT * FROM "ReconciliationRun" ORDER BY "timestamp" DESC LIMIT $1`,
        input.limit,
      );
      return runs;
    }),

  details: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ input }) => {
      const details = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          runId: string;
          fundSymbol: string;
          category: string;
          field: string;
          ourValue: number | null;
          refValue: number | null;
          diffPercent: number | null;
          severity: string;
        }>
      >(
        `SELECT * FROM "ReconciliationDetail" WHERE "runId" = $1 ORDER BY "severity" DESC, "fundSymbol" ASC`,
        input.runId,
      );
      return details;
    }),
});
```

- [ ] **Step 2: Register the router in the app router**

Modify `lib/trpc/router/index.ts` to add:

```typescript
import { reconciliationRouter } from "./reconciliation";
```

And add to the router object:

```typescript
reconciliation: reconciliationRouter,
```

The full file should be:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add lib/trpc/router/reconciliation.ts lib/trpc/router/index.ts
git commit -m "feat: add tRPC router for reconciliation data"
```

---

### Task 9: Create the reconciliation dashboard page

**Files:**
- Create: `app/(dashboard)/reconciliation/page.tsx`
- Create: `components/reconciliation/ReconciliationHistory.tsx`
- Create: `components/reconciliation/ReconciliationDetail.tsx`

- [ ] **Step 1: Create the ReconciliationHistory component**

```tsx
// components/reconciliation/ReconciliationHistory.tsx
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

interface Props {
  onSelectRun: (runId: string) => void;
  selectedRunId: string | null;
}

export function ReconciliationHistory({ onSelectRun, selectedRunId }: Props) {
  const { data: runs, isLoading } = trpc.reconciliation.runs.useQuery({ limit: 30 });

  if (isLoading) return <LoadingSkeleton rows={5} />;

  if (!runs || runs.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#ebedf1] p-8 text-center text-[#646e80]">
        暂无校对记录。运行 <code className="bg-[#f3f4f6] px-1.5 py-0.5 rounded text-[13px]">npx tsx scripts/reconcile.ts</code> 执行校对。
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[12px] border border-[#ebedf1] overflow-hidden">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="bg-[#f9fafc]">
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">时间</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">总数</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">一致</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">差异</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">缺失</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">耗时</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">状态</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, index) => (
            <tr
              key={run.id}
              onClick={() => onSelectRun(run.id)}
              className={`border-b border-[#f3f4f6] cursor-pointer transition-colors ${
                selectedRunId === run.id
                  ? "bg-[#eff2fe]"
                  : index % 2 === 1
                    ? "bg-[#fdfdfe] hover:bg-blue-50/30"
                    : "bg-white hover:bg-blue-50/30"
              }`}
            >
              <td className="px-5 py-3.5 text-[#333a4d]">
                {new Date(run.timestamp).toLocaleString("zh-CN")}
              </td>
              <td className="px-5 py-3.5 text-right text-[#333a4d]">{run.totalFunds}</td>
              <td className="px-5 py-3.5 text-right text-[#0d9858] font-semibold">{run.matchedCount}</td>
              <td className={`px-5 py-3.5 text-right font-semibold ${run.mismatchCount > 0 ? "text-[#dc2626]" : "text-[#333a4d]"}`}>
                {run.mismatchCount}
              </td>
              <td className={`px-5 py-3.5 text-right ${run.missingCount > 0 ? "text-[#f59e0b]" : "text-[#333a4d]"}`}>
                {run.missingCount}
              </td>
              <td className="px-5 py-3.5 text-right text-[#646e80]">
                {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "--"}
              </td>
              <td className="px-5 py-3.5">
                <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${
                  run.status === "COMPLETED" ? "bg-[#ecfdf5] text-[#0d9858]" : "bg-[#fef2f2] text-[#dc2626]"
                }`}>
                  {run.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create the ReconciliationDetail component**

```tsx
// components/reconciliation/ReconciliationDetail.tsx
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

interface Props {
  runId: string;
}

function severityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "text-[#dc2626]";
    case "WARNING": return "text-[#f59e0b]";
    default: return "text-[#333a4d]";
  }
}

function severityBg(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "bg-[#fef2f2] text-[#dc2626]";
    case "WARNING": return "bg-[#fffbeb] text-[#f59e0b]";
    default: return "bg-[#f3f4f6] text-[#646e80]";
  }
}

export function ReconciliationDetailTable({ runId }: Props) {
  const { data: details, isLoading } = trpc.reconciliation.details.useQuery({ runId });

  if (isLoading) return <LoadingSkeleton rows={5} />;

  if (!details || details.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-[#ebedf1] p-8 text-center text-[#0d9858] font-medium">
        所有基金数据一致，无差异记录。
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[12px] border border-[#ebedf1] overflow-hidden">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="bg-[#f9fafc]">
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">基金</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">分类</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">字段</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">我方值</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">参考值</th>
            <th className="px-5 py-3.5 text-right text-[12px] font-semibold text-[#646e80] uppercase">差异%</th>
            <th className="px-5 py-3.5 text-left text-[12px] font-semibold text-[#646e80] uppercase">级别</th>
          </tr>
        </thead>
        <tbody>
          {details.map((d, index) => (
            <tr
              key={d.id}
              className={`border-b border-[#f3f4f6] ${index % 2 === 1 ? "bg-[#fdfdfe]" : "bg-white"}`}
            >
              <td className="px-5 py-3.5 font-semibold text-[#2563eb]">{d.fundSymbol}</td>
              <td className="px-5 py-3.5 text-[#646e80]">{d.category}</td>
              <td className="px-5 py-3.5 text-[#333a4d]">{d.field}</td>
              <td className="px-5 py-3.5 text-right text-[#333a4d]">
                {d.ourValue !== null ? Number(d.ourValue).toFixed(4) : "--"}
              </td>
              <td className="px-5 py-3.5 text-right text-[#333a4d]">
                {d.refValue !== null ? Number(d.refValue).toFixed(4) : "--"}
              </td>
              <td className={`px-5 py-3.5 text-right font-semibold ${severityColor(d.severity)}`}>
                {d.diffPercent !== null ? `${Number(d.diffPercent).toFixed(2)}%` : "--"}
              </td>
              <td className="px-5 py-3.5">
                <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${severityBg(d.severity)}`}>
                  {d.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create the dashboard page**

```tsx
// app/(dashboard)/reconciliation/page.tsx
"use client";

import { useState } from "react";
import { ReconciliationHistory } from "@/components/reconciliation/ReconciliationHistory";
import { ReconciliationDetailTable } from "@/components/reconciliation/ReconciliationDetail";

export default function ReconciliationPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[#1a2035]">数据校对</h1>
        <p className="text-[14px] text-[#646e80] mt-1">
          与 palmmicro.com 参考数据的每日校对记录
        </p>
      </div>

      <div>
        <h2 className="text-[16px] font-semibold text-[#333a4d] mb-3">校对历史</h2>
        <ReconciliationHistory
          onSelectRun={setSelectedRunId}
          selectedRunId={selectedRunId}
        />
      </div>

      {selectedRunId && (
        <div>
          <h2 className="text-[16px] font-semibold text-[#333a4d] mb-3">差异明细</h2>
          <ReconciliationDetailTable runId={selectedRunId} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/reconciliation/page.tsx components/reconciliation/ReconciliationHistory.tsx components/reconciliation/ReconciliationDetail.tsx
git commit -m "feat: add reconciliation dashboard page"
```

---

### Task 10: Add reconciliation to the sidebar navigation

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Add nav item**

In `components/layout/Sidebar.tsx`, add to the `navItems` array after the history entry:

```typescript
{ href: "/reconciliation", label: "数据校对", icon: "🔍" },
```

The full array should be:

```typescript
const navItems = [
  { href: "/funds", label: "基金列表", icon: "💰" },
  { href: "/arbitrage", label: "套利机会", icon: "🎯" },
  { href: "/history", label: "历史分析", icon: "📈" },
  { href: "/reconciliation", label: "数据校对", icon: "🔍" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat: add reconciliation link to sidebar"
```

---

### Task 11: Add reports directory to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add gitignore entry**

Append to `.gitignore`:

```
# Reconciliation reports
reports/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore reconciliation reports directory"
```

---

### Task 12: Expand the seed-and-fetch script with new funds

**Files:**
- Modify: `scripts/seed-and-fetch.ts`

This expands the fund list from 19 to include all funds from the registry, ensuring they can be compared during reconciliation.

- [ ] **Step 1: Update seed-and-fetch.ts to use the fund registry**

Replace the `funds` array at the top of `scripts/seed-and-fetch.ts` with an import from the fund registry, and update the schema to include new category enum values.

First, update the `FundCategory` enum in Supabase by running this SQL:

```sql
-- Add new category values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HK_GENERAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FundCategory')) THEN
    ALTER TYPE "FundCategory" ADD VALUE 'HK_GENERAL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'JP_GENERAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FundCategory')) THEN
    ALTER TYPE "FundCategory" ADD VALUE 'JP_GENERAL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EU_GENERAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FundCategory')) THEN
    ALTER TYPE "FundCategory" ADD VALUE 'EU_GENERAL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CN_INDEX' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FundCategory')) THEN
    ALTER TYPE "FundCategory" ADD VALUE 'CN_INDEX';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CN_COMMODITY' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FundCategory')) THEN
    ALTER TYPE "FundCategory" ADD VALUE 'CN_COMMODITY';
  END IF;
END$$;
```

Then update `seed-and-fetch.ts`. At the top, import the registry and build the full fund array:

```typescript
import { getAllFundSymbols } from "./lib/fund-registry";

// Map category page names to FundCategory enum and exchange rate currency
const CATEGORY_MAP: Record<string, { dbCategory: string; currency: string }> = {
  chinaindex: { dbCategory: "CN_INDEX", currency: "CNY" },
  chinafuture: { dbCategory: "CN_COMMODITY", currency: "CNY" },
  qdii: { dbCategory: "US_TECH", currency: "USD" },
  qdiihk: { dbCategory: "HK_HSI", currency: "HKD" },
  qdiijp: { dbCategory: "JP_NKY", currency: "JPY" },
  qdiieu: { dbCategory: "EU_DAX", currency: "EUR" },
  qdiimix: { dbCategory: "MIXED", currency: "USD" },
};

// Build fund list from registry
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
```

Keep the rest of the existing `seed-and-fetch.ts` logic unchanged (exchange rate fetching, index price fetching, fund price fetching, valuation calculation). The expanded fund list will automatically be seeded.

- [ ] **Step 2: Verify seed script compiles**

Run: `npx tsx --eval "import './scripts/seed-and-fetch'" 2>&1 | head -5`
Expected: Should not have TypeScript compilation errors

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-and-fetch.ts
git commit -m "feat: expand seed script to use full fund registry"
```

---

### Task 13: Add npm scripts for reconciliation

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts**

Add these to the `scripts` section in `package.json`:

```json
"reconcile": "tsx scripts/reconcile.ts",
"reconcile:cron": "TZ=Asia/Shanghai tsx scripts/cron-runner.ts"
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add npm scripts for reconciliation"
```

---

### Task 14: End-to-end verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (fund-registry, html-parser, reconcile)

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds without errors

- [ ] **Step 3: Run a manual reconciliation (partial)**

Run: `npx tsx -e "
import { parseFundDetailPage } from './scripts/lib/html-parser';
const html = require('fs').readFileSync('tests/fixtures/sh501225cn.html', 'utf-8');
const data = parseFundDetailPage(html, 'SH501225');
console.log(JSON.stringify(data, null, 2));
"`
Expected: Correctly parsed fund data printed to console

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found in e2e verification"
```
