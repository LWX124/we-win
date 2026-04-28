-- Supabase Migration: QDII Arbitrage Database
-- Generated from prisma/schema.prisma
-- Run this in Supabase SQL Editor

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "Exchange" AS ENUM ('SH', 'SZ');
CREATE TYPE "FundType" AS ENUM ('ETF', 'LOF', 'FIELD');
CREATE TYPE "FundCategory" AS ENUM (
  'US_TECH', 'US_SP', 'US_OIL', 'US_BIO', 'US_CONS', 'US_GENERAL',
  'HK_HSI', 'HK_HSCEI', 'HK_TECH',
  'JP_NKY', 'EU_DAX', 'MIXED'
);
CREATE TYPE "Currency" AS ENUM ('USD', 'HKD', 'JPY', 'EUR', 'CNY');
CREATE TYPE "DataSource" AS ENUM ('SINA', 'YAHOO', 'CHINAMONEY', 'EASTMONEY');
CREATE TYPE "SignalType" AS ENUM ('PREMIUM', 'DISCOUNT', 'PAIR');
CREATE TYPE "SignalStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'EXECUTED');
CREATE TYPE "NotifyChannel" AS ENUM ('FEISHU', 'WECHAT', 'EMAIL');
CREATE TYPE "NotifyStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- ============================================
-- TABLES
-- ============================================

-- User
CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session
CREATE TABLE "Session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires" TIMESTAMPTZ NOT NULL
);

-- Fund
CREATE TABLE "Fund" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "symbol" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "exchange" "Exchange" NOT NULL,
  "type" "FundType" NOT NULL,
  "category" "FundCategory" NOT NULL,
  "currency" "Currency" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FundPrice
CREATE TABLE "FundPrice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fundId" UUID NOT NULL REFERENCES "Fund"("id") ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "marketPrice" DECIMAL(10, 4) NOT NULL,
  "volume" BIGINT,
  "turnover" DECIMAL(16, 2),
  "source" "DataSource" NOT NULL
);
CREATE INDEX "FundPrice_fundId_timestamp_idx" ON "FundPrice"("fundId", "timestamp");

-- ExchangeRate
CREATE TABLE "ExchangeRate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "pair" TEXT NOT NULL,
  "rate" DECIMAL(10, 6) NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "source" "DataSource" NOT NULL
);
CREATE INDEX "ExchangeRate_pair_timestamp_idx" ON "ExchangeRate"("pair", "timestamp");

-- IndexPrice
CREATE TABLE "IndexPrice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "indexSymbol" TEXT NOT NULL,
  "price" DECIMAL(12, 4) NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "source" "DataSource" NOT NULL
);
CREATE INDEX "IndexPrice_indexSymbol_timestamp_idx" ON "IndexPrice"("indexSymbol", "timestamp");

-- FundValuation
CREATE TABLE "FundValuation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fundId" UUID NOT NULL REFERENCES "Fund"("id") ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "officialNAV" DECIMAL(10, 4),
  "fairNAV" DECIMAL(10, 4),
  "realtimeNAV" DECIMAL(10, 4),
  "calibrationFactor" DECIMAL(12, 6),
  "premium" DECIMAL(8, 4)
);
CREATE INDEX "FundValuation_fundId_timestamp_idx" ON "FundValuation"("fundId", "timestamp");

-- FundPair
CREATE TABLE "FundPair" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fundId" UUID NOT NULL REFERENCES "Fund"("id") ON DELETE CASCADE,
  "pairFundId" TEXT,
  "pairIndex" TEXT,
  "calibrationFactor" DECIMAL(12, 6),
  "positionAdjust" DECIMAL(10, 6) DEFAULT 1.0,
  UNIQUE("fundId", "pairIndex")
);
CREATE INDEX "FundPair_fundId_idx" ON "FundPair"("fundId");

-- ArbitrageSignal
CREATE TABLE "ArbitrageSignal" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "fundId" UUID NOT NULL REFERENCES "Fund"("id") ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "type" "SignalType" NOT NULL,
  "premiumRate" DECIMAL(8, 4) NOT NULL,
  "zScore" DECIMAL(8, 4),
  "historicalMean" DECIMAL(8, 4),
  "historicalStd" DECIMAL(8, 4),
  "costEstimate" DECIMAL(8, 4),
  "netSpread" DECIMAL(8, 4),
  "status" "SignalStatus" NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX "ArbitrageSignal_fundId_timestamp_idx" ON "ArbitrageSignal"("fundId", "timestamp");
CREATE INDEX "ArbitrageSignal_status_idx" ON "ArbitrageSignal"("status");
CREATE INDEX "ArbitrageSignal_type_status_idx" ON "ArbitrageSignal"("type", "status");

-- Notification
CREATE TABLE "Notification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "signalId" UUID NOT NULL REFERENCES "ArbitrageSignal"("id") ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "channel" "NotifyChannel" NOT NULL,
  "content" TEXT NOT NULL,
  "status" "NotifyStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMPTZ,
  "readAt" TIMESTAMPTZ
);
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- FeishuConfig
CREATE TABLE "FeishuConfig" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "webhookUrl" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "threshold" DECIMAL(6, 4) NOT NULL DEFAULT 1.5,
  "notifyPairs" BOOLEAN NOT NULL DEFAULT true
);

-- ============================================
-- Auto-update updatedAt trigger for User table
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_updatedAt"
  BEFORE UPDATE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Enable Row Level Security (optional, recommended)
-- ============================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FundPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExchangeRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IndexPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FundValuation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FundPair" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArbitrageSignal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeishuConfig" ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated to read public fund data
CREATE POLICY "Fund read access" ON "Fund" FOR SELECT USING (true);
CREATE POLICY "FundPrice read access" ON "FundPrice" FOR SELECT USING (true);
CREATE POLICY "ExchangeRate read access" ON "ExchangeRate" FOR SELECT USING (true);
CREATE POLICY "IndexPrice read access" ON "IndexPrice" FOR SELECT USING (true);
CREATE POLICY "FundValuation read access" ON "FundValuation" FOR SELECT USING (true);
CREATE POLICY "FundPair read access" ON "FundPair" FOR SELECT USING (true);
CREATE POLICY "ArbitrageSignal read access" ON "ArbitrageSignal" FOR SELECT USING (true);
