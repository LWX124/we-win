# QDII 数据补齐与校对系统设计

日期: 2026-04-28

## 背景

当前项目仅有 19 只基金，NAV 计算使用简化公式（indexPrice × exchangeRate），calibrationFactor 硬编码为 1.0。参考网站 palmmicro.com 覆盖 7 个 QDII 分类、100+ 只基金，提供三层 EST 估值（官方/参考/实时）。

需要：
1. 补齐基金列表和改进 NAV 计算逻辑
2. 建立定时校对机制，验证我方计算结果的准确性

校对是临时验证工具，确认计算无误后可关闭。

## 第一部分：数据补齐

### 1.1 基金列表扩展

从 PHP 源码 `/Users/weixi1/Documents/workspace/web` 的 `_stocklink.php` 中提取各分类的完整基金代码列表。

| 分类 | 对应页面 | 当前数量 | 预计补齐后 |
|------|---------|---------|-----------|
| 美股QDII | qdiicn.php | ~10 | ~30+ |
| 港股QDII | qdiihkcn.php | ~3 | ~20+ |
| 日本QDII | qdiijpcn.php | ~2 | ~10+ |
| 欧洲QDII | qdiieucn.php | ~1 | ~5+ |
| 混合QDII | qdiimixcn.php | ~1 | ~30 |
| A股指数 | chinaindexcn.php | 0 | ~20+ |
| A股商品 | chinafuturecn.php | 0 | ~15+ |

### 1.2 Schema 变更

扩展 `FundCategory` 枚举，新增分类以覆盖所有 QDII 类型：

```sql
-- 新增枚举值
ALTER TYPE "FundCategory" ADD VALUE 'HK_GENERAL';
ALTER TYPE "FundCategory" ADD VALUE 'JP_GENERAL';
ALTER TYPE "FundCategory" ADD VALUE 'EU_GENERAL';
ALTER TYPE "FundCategory" ADD VALUE 'MIXED_TECH';
ALTER TYPE "FundCategory" ADD VALUE 'MIXED_OIL';
ALTER TYPE "FundCategory" ADD VALUE 'MIXED_GOLD';
ALTER TYPE "FundCategory" ADD VALUE 'MIXED_COMMODITY';
ALTER TYPE "FundCategory" ADD VALUE 'CN_INDEX';
ALTER TYPE "FundCategory" ADD VALUE 'CN_COMMODITY';
```

### 1.3 NAV 计算改进

当前公式：`realtimeNAV = indexPrice × exchangeRate / calibration × positionAdjust`

改进为三层 EST：
- **officialNAV**: 从东方财富/天天基金 API 获取基金公司发布的官方净值
- **fairNAV**: 基于主要跟踪指数计算的参考估值（对应参考网站的"参考EST"）
- **realtimeNAV**: 基于期货或实时成分股数据计算（对应参考网站的"实时EST"）

`calibrationFactor` 从 PHP 源码中提取真实值，替代硬编码 1.0。

### 1.4 数据源补充

| 数据源 | 用途 | 当前状态 |
|--------|------|---------|
| Sina Finance | 基金市场价格 | ✅ 已有 |
| Yahoo Finance | 指数价格 | ✅ 已有 |
| ChinaMoney | 汇率 | ✅ 已有 |
| 东方财富/天天基金 | 官方净值 (officialNAV) | ❌ 需新增 |
| 期货数据源 | 实时 EST 计算 | ❌ 需新增（可选，后续迭代） |

## 第二部分：校对系统

### 2.1 校对流程

```
定时触发 (每交易日 16:00 北京时间)
  → Step 1: 抓取 7 个分类页面，提取所有基金代码列表
  → Step 2: 对每只基金，访问详情页 (如 sh501225cn.php)
  → Step 3: 解析详情页数据
  → Step 4: 从 Supabase 查询对应基金的最新计算数据
  → Step 5: 逐基金逐字段对比
  → Step 6: 生成校对报告
  → Step 7: 输出 (存库 + 飞书通知 + 本地文件 + 仪表盘)
```

### 2.2 详情页数据解析

每只基金详情页 (如 `sh501225cn.php`) 包含以下关键数据：

| 页面字段 | 映射字段 | 说明 |
|---------|---------|------|
| 官方EST | officialEST | 基金公司发布的估值 |
| 官方EST溢价 | officialPremium | 市场价相对官方EST的溢价率 |
| 参考EST | fairEST | 基于指数计算的参考估值 |
| 参考EST溢价 | fairPremium | 市场价相对参考EST的溢价率 |
| 净值记录 | latestNAV | 最新公布净值 |
| 净值涨幅 | navChange | 净值变动百分比 |
| 基金价格 | marketPrice | 当前市场交易价格 |
| 仓位估算 | positionEstimate | 基金仓位比例 |
| 汇率 | exchangeRates | USDCNH/USDCNY 等 |
| 溢价记录 | premiumHistory | 近期历史溢价数据 |

### 2.3 校对对比逻辑

**主要校对字段（按优先级）：**

1. **溢价率 (premium)** — 核心指标，直接反映计算准确性
2. **官方EST / 参考EST** — 验证 NAV 计算逻辑
3. **市场价格** — 验证数据源一致性（应完全一致）
4. **汇率** — 验证汇率数据源

**差异分级：**
- `INFO`: 差异 < 0.5%（正常范围，不报警）
- `WARNING`: 差异 0.5% - 2%（需要关注，飞书通知）
- `CRITICAL`: 差异 > 2%（计算可能有误，飞书通知 + 高亮）

### 2.4 新增数据库表

```sql
-- 校对运行记录
CREATE TABLE "ReconciliationRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" TIMESTAMPTZ NOT NULL,
  "totalFunds" INT NOT NULL,
  "matchedCount" INT NOT NULL,
  "mismatchCount" INT NOT NULL,
  "missingCount" INT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "durationMs" INT
);

-- 校对差异明细
CREATE TABLE "ReconciliationDetail" (
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
CREATE INDEX "ReconciliationDetail_runId_idx" ON "ReconciliationDetail"("runId");
CREATE INDEX "ReconciliationDetail_severity_idx" ON "ReconciliationDetail"("severity");
```

### 2.5 校对脚本

文件：`scripts/reconcile.ts`

```
主要模块：
├── fetchCategoryPages()     — 抓取 7 个分类页，提取基金代码列表
├── fetchFundDetailPage()    — 抓取单只基金详情页，解析数据
├── queryOurData()           — 从 Supabase 查询我方对应数据
├── compareFundData()        — 逐字段对比，生成差异记录
├── saveResults()            — 存入 ReconciliationRun/Detail 表
├── sendFeishuNotification() — 发送飞书通知（仅 WARNING/CRITICAL）
└── writeLocalReport()       — 生成本地 JSON 报告文件
```

**抓取策略：**
- 每次请求间隔 1-2 秒，避免对 palmmicro 服务器产生压力
- 约 100-150 只基金 + 7 个分类页 ≈ 160 次请求
- 总耗时约 3-5 分钟

**执行方式：**
- 定时：Node.js cron 进程，每交易日 16:00 执行
- 手动：`npx tsx scripts/reconcile.ts`

### 2.6 定时调度

使用 `node-cron` 包，在 `scripts/cron-runner.ts` 中配置：

```typescript
// 每交易日 16:00 北京时间执行
cron.schedule('0 16 * * 1-5', runReconciliation, {
  timezone: 'Asia/Shanghai'
});
```

启动方式：`node scripts/cron-runner.js` 或通过 `start-dev.sh` 集成。

### 2.7 输出渠道

**1. 数据库存储**
- `ReconciliationRun` 记录每次运行概况
- `ReconciliationDetail` 记录每只基金的差异明细

**2. 飞书通知**
- 正常：每日摘要（"校对完成：120 只基金，3 只差异"）
- 异常：列出每只差异基金的详细对比

**3. 本地报告文件**
- 路径：`reports/reconciliation/YYYY-MM-DD.json`
- 包含完整对比数据，方便离线分析

**4. 仪表盘页面**
- 路由：`/dashboard/reconciliation`
- 展示最近 30 天校对历史
- 差异趋势图
- 最新一次校对的详细对比表格
- 按严重程度筛选

## 第三部分：文件结构

```
scripts/
├── seed-and-fetch.ts        — 重构：扩展基金列表 + 改进 NAV 计算
├── reconcile.ts             — 新增：校对脚本
├── cron-runner.ts           — 新增：定时调度器
└── lib/
    ├── html-parser.ts       — 新增：palmmicro HTML 解析器
    └── fund-registry.ts     — 新增：从 PHP 源码提取的完整基金注册表

supabase/
└── migration-reconciliation.sql  — 新增：校对相关表

app/(dashboard)/
└── reconciliation/
    └── page.tsx             — 新增：校对仪表盘页面

components/reconciliation/
├── ReconciliationHistory.tsx — 校对历史列表
├── ReconciliationDetail.tsx  — 差异明细表
└── DiffTrendChart.tsx        — 差异趋势图

reports/reconciliation/       — 本地报告输出目录 (gitignore)
```

## 设计决策记录

1. **校对是临时工具** — 设计保持简洁实用，不过度工程化。一旦验证计算正确，可通过配置关闭。
2. **源码 + 网页结合** — 从 PHP 源码提取基金列表和计算参数（静态数据），从网页抓取实时数据做校对（动态数据）。
3. **每日 1 次校对** — 考虑到 100+ 只基金详情页需要逐个抓取，每日收盘后执行一次即可。
4. **差异阈值 0.5%** — 溢价率差异超过 0.5% 触发 WARNING，超过 2% 触发 CRITICAL。
5. **Node.js cron** — 部署在本地或服务器，直接访问 Supabase 和 palmmicro。
