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
    const warnings = diffs.filter((d) => d.severity !== "INFO");
    expect(warnings.length).toBe(0);
  });

  it("detects premium mismatch", () => {
    const ourData = { marketPrice: 2.474, premium: 6.8, realtimeNAV: 2.345 };
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
