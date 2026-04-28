import * as cheerio from "cheerio";
import type { Element } from "domhandler";

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

function extractText($el: cheerio.Cheerio<Element>): string {
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
      result.marketPrice = price;
      result.priceChange = change;
    } else if (
      code.includes("USD") ||
      code.includes("HKD") ||
      code.includes("JPY") ||
      code.includes("EUR") ||
      code.includes("CNY") ||
      code.includes("CNH")
    ) {
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
