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
