import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set. Skipping seed.");
  process.exit(0);
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});
const prisma = new PrismaClient({ adapter });

const funds = [
  // US Tech (NASDAQ 100)
  { symbol: "SH513100", name: "纳指ETF", exchange: "SH" as const, type: "ETF" as const, category: "US_TECH" as const, currency: "USD" as const, pairIndex: "^NDX" },
  { symbol: "SZ159941", name: "纳指ETF", exchange: "SZ" as const, type: "ETF" as const, category: "US_TECH" as const, currency: "USD" as const, pairIndex: "^NDX" },
  { symbol: "SZ159501", name: "纳指ETF", exchange: "SZ" as const, type: "ETF" as const, category: "US_TECH" as const, currency: "USD" as const, pairIndex: "^NDX" },
  // US S&P 500
  { symbol: "SH513500", name: "标普ETF", exchange: "SH" as const, type: "ETF" as const, category: "US_SP" as const, currency: "USD" as const, pairIndex: "^GSPC" },
  { symbol: "SZ161125", name: "标普LOF", exchange: "SZ" as const, type: "LOF" as const, category: "US_SP" as const, currency: "USD" as const, pairIndex: "^GSPC" },
  // US Oil & Gas
  { symbol: "SH513350", name: "标普油气ETF", exchange: "SH" as const, type: "ETF" as const, category: "US_OIL" as const, currency: "USD" as const, pairIndex: "XOP" },
  { symbol: "SZ162411", name: "华宝油气", exchange: "SZ" as const, type: "LOF" as const, category: "US_OIL" as const, currency: "USD" as const, pairIndex: "XOP" },
  // US Biotech
  { symbol: "SZ159502", name: "标普生物科技", exchange: "SZ" as const, type: "ETF" as const, category: "US_BIO" as const, currency: "USD" as const, pairIndex: "XBI" },
  { symbol: "SZ161127", name: "生物科技LOF", exchange: "SZ" as const, type: "LOF" as const, category: "US_BIO" as const, currency: "USD" as const, pairIndex: "IBB" },
  // US Consumer
  { symbol: "SZ162415", name: "美国消费", exchange: "SZ" as const, type: "LOF" as const, category: "US_CONS" as const, currency: "USD" as const, pairIndex: "XLY" },
  // HK
  { symbol: "SH513600", name: "恒生ETF", exchange: "SH" as const, type: "ETF" as const, category: "HK_HSI" as const, currency: "HKD" as const, pairIndex: "^HSI" },
  { symbol: "SZ159954", name: "恒生ETF", exchange: "SZ" as const, type: "ETF" as const, category: "HK_HSI" as const, currency: "HKD" as const, pairIndex: "^HSI" },
  { symbol: "SH510900", name: "H股ETF", exchange: "SH" as const, type: "ETF" as const, category: "HK_HSCEI" as const, currency: "HKD" as const, pairIndex: "^HSCE" },
  { symbol: "SH513890", name: "恒生科技ETF", exchange: "SH" as const, type: "ETF" as const, category: "HK_TECH" as const, currency: "HKD" as const, pairIndex: "^HSTECH" },
  // Japan
  { symbol: "SH513520", name: "日经ETF", exchange: "SH" as const, type: "ETF" as const, category: "JP_NKY" as const, currency: "JPY" as const, pairIndex: "^N225" },
  { symbol: "SZ159866", name: "日经ETF", exchange: "SZ" as const, type: "ETF" as const, category: "JP_NKY" as const, currency: "JPY" as const, pairIndex: "^N225" },
  // Europe
  { symbol: "SH513430", name: "德国ETF", exchange: "SH" as const, type: "ETF" as const, category: "EU_DAX" as const, currency: "EUR" as const, pairIndex: "^GDAXI" },
  // Mixed / Others
  { symbol: "SZ164906", name: "中国互联", exchange: "SZ" as const, type: "LOF" as const, category: "MIXED" as const, currency: "USD" as const, pairIndex: "KWEB" },
  { symbol: "SZ163208", name: "全球油气", exchange: "SZ" as const, type: "LOF" as const, category: "US_OIL" as const, currency: "USD" as const, pairIndex: "XLE" },
];

async function main() {
  console.log("Seeding QDII funds...");

  for (const fund of funds) {
    const { pairIndex, ...fundData } = fund;
    const created = await prisma.fund.upsert({
      where: { symbol: fundData.symbol },
      update: fundData,
      create: fundData,
    });

    // Create FundPair for each fund
    if (pairIndex) {
      await prisma.fundPair.upsert({
        where: { id: `${created.id}-pair` },
        update: {
          fundId: created.id,
          pairIndex,
          calibrationFactor: 1.0,
          positionAdjust: 1.0,
        },
        create: {
          id: `${created.id}-pair`,
          fundId: created.id,
          pairIndex,
          calibrationFactor: 1.0,
          positionAdjust: 1.0,
        },
      });
    }
  }

  console.log(`Seeded ${funds.length} funds.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
