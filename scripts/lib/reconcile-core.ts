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
