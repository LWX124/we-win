import { describe, it, expect } from "vitest";

// Test the premium calculation logic (mirrors collector/calculators/nav.py)
function calculatePremium(marketPrice: number, nav: number): number {
  if (nav === 0) return 0;
  return (marketPrice / nav - 1) * 100;
}

function zScore(current: number, history: number[]): number | null {
  if (history.length < 5) return null;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance =
    history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return (current - mean) / std;
}

describe("calculatePremium", () => {
  it("returns positive premium when price > NAV", () => {
    expect(calculatePremium(1.05, 1.0)).toBeCloseTo(5.0);
  });

  it("returns negative premium when price < NAV", () => {
    expect(calculatePremium(0.95, 1.0)).toBeCloseTo(-5.0);
  });

  it("returns 0 when price equals NAV", () => {
    expect(calculatePremium(1.0, 1.0)).toBe(0);
  });

  it("returns 0 when NAV is 0", () => {
    expect(calculatePremium(1.0, 0)).toBe(0);
  });
});

describe("zScore", () => {
  const history = [2.0, 2.5, 1.8, 2.2, 2.1, 1.9, 2.3, 2.0, 2.4, 2.1,
                   1.7, 2.6, 1.9, 2.2, 2.0, 2.3, 1.8, 2.5, 2.1, 2.4];

  it("returns null for insufficient history", () => {
    expect(zScore(3.0, [1.0, 2.0])).toBeNull();
  });

  it("returns Z > 2 for significant premium outlier", () => {
    const result = zScore(5.0, history);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(2);
  });

  it("returns Z < -2 for significant discount outlier", () => {
    const result = zScore(-1.0, history);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(-2);
  });
});
