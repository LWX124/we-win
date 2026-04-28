// scripts/lib/fund-registry.ts

export interface FundEntry {
  symbol: string;
  category: string;
  detailPage: string;
}

export const CATEGORY_PAGES: Record<string, string> = {
  chinaindex: "chinaindexcn.php",
  chinafuture: "chinafuturecn.php",
  qdii: "qdiicn.php",
  qdiihk: "qdiihkcn.php",
  qdiijp: "qdiijpcn.php",
  qdiieu: "qdiieucn.php",
  qdiimix: "qdiimixcn.php",
};

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
