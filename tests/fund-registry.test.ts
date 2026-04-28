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
