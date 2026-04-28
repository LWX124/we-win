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

-- RLS: read access for all, insert requires service_role key (bypasses RLS)
ALTER TABLE "ReconciliationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReconciliationDetail" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ReconciliationRun read access"
  ON "ReconciliationRun" FOR SELECT USING (true);
CREATE POLICY "ReconciliationDetail read access"
  ON "ReconciliationDetail" FOR SELECT USING (true);

-- INSERT is done via service_role key which bypasses RLS.
-- If a non-service-role path ever needs to insert, add INSERT policies here.
