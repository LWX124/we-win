# QDII 套利监控系统 — 设计文档

## 概述

一个面向 QDII 基金折溢价套利的全栈监控平台。提供实时基金数据看板、套利机会检测、飞书即时通知，后续可扩展银河 QMT 自动量化交易。

**技术栈**: Next.js (App Router) + TypeScript + TailwindCSS + React + PostgreSQL + Prisma + Python Collector

---

## 1. 系统架构

### 1.1 架构模式：前后端分离 + 独立数据采集

```
浏览器 (React + TailwindCSS)
  │ HTTP / WebSocket
  ▼
Next.js 前端服务 (端口 3000)
  ├── React Server Components + Client Components
  ├── NextAuth.js 认证 (多用户 + 角色)
  ├── tRPC API 数据接口
  ├── next-ws WebSocket 服务
  └── 飞书 Bot Webhook 发送
  │ Prisma
  ▼
PostgreSQL
  ▲ (写入)
  │
Python Data Collector Service (独立进程)
  ├── 外部 API 行情采集 (新浪/Yahoo/ChinaMoney)
  ├── 净值估算 + 校准因子计算
  ├── 套利信号检测
  └── Redis Pub/Sub 推送
  │
  ▼
Redis (Pub/Sub + 队列)
```

### 1.2 关键设计决策

- **Next.js 不直接调外部行情 API** — 所有行情数据由 Python Collector 写入 PostgreSQL，Next.js 只读数据库
- **Redis Pub/Sub 解耦实时推送** — Collector 检测到套利机会 → publish 到 Redis → Next.js 订阅 → WebSocket 推浏览器 + 飞书通知
- **飞书通知走 Next.js** — 通知逻辑在 Next.js 侧，订阅 Redis 套利信号后发送飞书消息
- **Python Collector 复用参考项目逻辑** — API 调用和计算逻辑可用 Python 重写，参考 `/Users/lwx/Workspace/study/web/` 中的 PHP 实现

---

## 2. 数据模型 (PostgreSQL + Prisma)

### 2.1 用户 & 认证

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String?
  passwordHash  String
  role          Role     @default(USER)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions       Session[]
  notifications  Notification[]
  feishuConfig   FeishuConfig?
}

enum Role {
  ADMIN
  USER
}
```

### 2.2 基金 & 分类

```prisma
model Fund {
  id        String     @id @default(uuid())
  symbol    String     @unique   // e.g. SH513100, SZ159941
  name      String               // e.g. 纳指ETF
  exchange  Exchange              // SH / SZ
  type      FundType              // ETF / LOF / FIELD
  category  FundCategory          // US_TECH / HK_HSI / JP_NKY ...
  currency  Currency              // USD / HKD / JPY / EUR
  isActive  Boolean    @default(true)

  prices        FundPrice[]
  valuations    FundValuation[]
  signals       ArbitrageSignal[]
  pairs         FundPair[]

  createdAt DateTime @default(now())
}

enum Exchange   { SH  SZ }
enum FundType   { ETF  LOF  FIELD }
enum FundCategory {
  US_TECH    // 纳斯达克 (QQQ/^NDX)
  US_SP      // 标普500 (SPY/^GSPC)
  US_OIL     // 油气 (XOP)
  US_BIO     // 生物科技 (XBI/IBB)
  US_CONS    // 消费 (XLY)
  US_GENERAL // 综合 (AGG/IXC等)
  HK_HSI     // 恒生 (^HSI)
  HK_HSCEI   // 国企 (^HSCE)
  HK_TECH    // 恒生科技 (^HSTECH)
  JP_NKY     // 日经225 (^NKY)
  EU_DAX     // 欧洲 (^DAX/^CAC)
  MIXED      // 混合持仓
}
enum Currency { USD HKD JPY EUR CNY }
```

### 2.3 行情数据

```prisma
model FundPrice {
  id          String   @id @default(uuid())
  fundId      String
  timestamp   DateTime
  marketPrice Decimal  // 场内交易价格
  volume      BigInt?
  turnover    Decimal? // 成交额
  source      DataSource

  fund Fund @relation(fields: [fundId], references: [id])
  @@index([fundId, timestamp])
}

model ExchangeRate {
  id        String     @id @default(uuid())
  pair      String     // USDCNY / HKDCNY / JPYCNY / EURCNY
  rate      Decimal
  timestamp DateTime
  source    DataSource

  @@index([pair, timestamp])
}

model IndexPrice {
  id          String   @id @default(uuid())
  indexSymbol String   // ^NDX / ^GSPC / XOP / ^HSI ...
  price       Decimal
  timestamp   DateTime
  source      DataSource

  @@index([indexSymbol, timestamp])
}

enum DataSource { SINA YAHOO CHINAMONEY EASTMONEY }
```

### 2.4 估值 & 套利

```prisma
model FundValuation {
  id                String   @id @default(uuid())
  fundId            String
  timestamp         DateTime
  officialNAV       Decimal? // 官方净值 (T+1 披露)
  fairNAV           Decimal? // 公允净值 (基于底层收盘价)
  realtimeNAV       Decimal? // 实时估算净值
  calibrationFactor Decimal? // 校准因子
  premium           Decimal? // 溢价率 (%)

  fund Fund @relation(fields: [fundId], references: [id])
  @@index([fundId, timestamp])
}

model FundPair {
  id                String  @id @default(uuid())
  fundId            String
  pairFundId        String? // 配对基金 (同底层另一只 QDII)
  pairIndex         String? // 基准指数符号
  calibrationFactor Decimal?
  positionAdjust    Decimal? @default(1.0)

  fund Fund @relation(fields: [fundId], references: [id])
}

model ArbitrageSignal {
  id             String        @id @default(uuid())
  fundId         String
  timestamp      DateTime
  type           SignalType    // PREMIUM / DISCOUNT / PAIR
  premiumRate    Decimal       // 实时溢价率
  zScore         Decimal?      // 偏离历史均值的标准差数
  historicalMean Decimal?
  historicalStd  Decimal?
  costEstimate   Decimal?      // 预估交易成本 (%)
  netSpread      Decimal?      // 净套利空间 (%)
  status         SignalStatus  @default(ACTIVE)

  notifications Notification[]

  fund Fund @relation(fields: [fundId], references: [id])
  @@index([fundId, timestamp])
  @@index([status])
}

enum SignalType   { PREMIUM DISCOUNT PAIR }
enum SignalStatus { ACTIVE EXPIRED EXECUTED }
```

### 2.5 通知

```prisma
model Notification {
  id        String   @id @default(uuid())
  signalId  String
  userId    String
  channel   NotifyChannel
  content   String
  status    NotifyStatus @default(PENDING)
  sentAt    DateTime?
  readAt    DateTime?

  signal ArbitrageSignal @relation(fields: [signalId], references: [id])
  user   User            @relation(fields: [userId], references: [id])
}

model FeishuConfig {
  id          String  @id @default(uuid())
  userId      String  @unique
  webhookUrl  String
  isActive    Boolean @default(true)
  threshold   Decimal @default(1.5) // 最小溢价率阈值 (%)
  notifyPairs Boolean @default(true) // 是否通知配对套利机会

  user User @relation(fields: [userId], references: [id])
}

enum NotifyChannel { FEISHU WECHAT EMAIL }
enum NotifyStatus  { PENDING SENT FAILED READ }
```

---

## 3. 页面 & 路由

### 3.1 路由树 (Next.js App Router)

```
app/
├── layout.tsx                (根布局 + 主题 + 认证 Provider)
├── page.tsx                  (看板首页 — 公开)
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx            (需登录 + 侧边栏导航)
│   ├── funds/
│   │   ├── page.tsx          (基金列表 + 实时数据)
│   │   └── [symbol]/
│   │       └── page.tsx      (单基金深度分析)
│   ├── arbitrage/
│   │   └── page.tsx          (套利机会列表)
│   ├── history/
│   │   └── page.tsx          (历史溢价走势)
│   └── settings/
│       ├── page.tsx          (个人设置: 飞书配置 + 通知偏好)
│       └── admin/
│           └── page.tsx      (用户管理 — ADMIN only)
```

### 3.2 页面功能

| 路由 | 功能描述 | 权限 |
|---|---|---|
| `/` | 看板首页：关键指标概览、活跃信号数、最新溢价率排行 Top 10 | 公开 |
| `/login` | 邮箱 + 密码登录 | 公开 |
| `/funds` | 基金列表：实时价格/净值/溢价率，可排序/筛选，WebSocket 实时更新 | 登录 |
| `/funds/:symbol` | 单基金详情：三层净值走势图、历史溢价率分布、配对基金对比 | 登录 |
| `/arbitrage` | 套利机会：当前活跃信号列表、按套利空间/时间排序、信号操作 | 登录 |
| `/history` | 历史分析：多基金溢价率走势对比、均值±2σ 区间、回测工具 | 登录 |
| `/settings` | 飞书 Webhook 配置、通知阈值、通知频率偏好 | 登录 |
| `/settings/admin` | 用户管理：角色分配、用户启用/禁用 | ADMIN |

---

## 4. 组件设计

### 4.1 组件层次

```
components/
├── layout/
│   ├── RootLayout.tsx         (HTML head + Providers)
│   ├── Sidebar.tsx            (导航侧边栏)
│   ├── Header.tsx             (顶部状态栏: WS 连接 + 更新时间 + 活跃信号数)
│   └── DashboardLayout.tsx    (需登录布局包裹器)
│
├── funds/
│   ├── FundTable.tsx          (基金列表表格: 排序/筛选/虚拟滚动/WS 更新高亮)
│   ├── FundRow.tsx            (单行: 名称/价格/净值/溢价率/信号标记)
│   ├── FundDetail.tsx         (基金详情面板)
│   ├── FundChart.tsx          (Recharts: 溢价率走势图)
│   └── FundFilter.tsx         (分类筛选: 类型/地区/交易所)
│
├── arbitrage/
│   ├── ArbitragePanel.tsx     (套利机会面板: 按套利空间排序)
│   ├── SignalCard.tsx         (单条信号: 类型/溢价率/Z-score/操作)
│   ├── SignalBadge.tsx        (信号徽标: 溢价红/折价绿/配对蓝)
│   └── StrategyGuide.tsx      (策略说明: 成本计算/操作步骤)
│
├── history/
│   ├── HistoryChart.tsx       (历史溢价率区间图: 均值±2σ)
│   ├── DateRangePicker.tsx    (日期范围选择)
│   └── FundComparison.tsx     (多基金溢价率对比)
│
├── settings/
│   ├── FeishuConfig.tsx       (飞书 Webhook 配置表单)
│   ├── NotificationPref.tsx   (通知偏好设置)
│   └── AdminPanel.tsx         (用户管理)
│
├── ui/
│   ├── DataTable.tsx          (通用可排序表格)
│   ├── PriceBadge.tsx         (价格变动徽标)
│   ├── LiveDot.tsx            (实时数据指示灯)
│   ├── EmptyState.tsx         (空状态)
│   └── LoadingSkeleton.tsx    (骨架屏)
│
└── providers/
    ├── AuthProvider.tsx        (NextAuth SessionProvider)
    ├── WebSocketProvider.tsx   (WS 连接管理 + 实时行情 Context)
    └── ThemeProvider.tsx       (主题)
```

### 4.2 状态管理

| 状态 | 方案 | 说明 |
|---|---|---|
| 实时行情 | WebSocketProvider Context | 全局广播，按 fundId 索引更新 |
| 服务端数据 | TanStack React Query | 缓存、自动刷新 (stale-while-revalidate) |
| 筛选/排序 | URL SearchParams | 可分享、浏览器前进后退 |
| 认证 | NextAuth SessionProvider | 内置方案 |

---

## 5. 数据流

### 5.1 完整链路

```
新浪/Yahoo/ChinaMoney API
  │ ① HTTP 拉取价格/汇率/指数 (Python Collector)
  ▼
Python Collector
  │ ② 写入 PostgreSQL (FundPrice / ExchangeRate / IndexPrice)
  ▼
Python Collector
  │ ③ 净值估算 + 校准因子 + 溢价率计算
  ▼
双写:
  ├─ ④a → PostgreSQL (FundValuation / ArbitrageSignal)
  └─ ④b → Redis Pub/Sub (有新套利信号时)
  │
  ▼
Next.js 订阅 Redis
  │ ⑤ 收到信号 → WebSocket 推浏览器 + 飞书 Webhook
  ▼
浏览器 React 组件渲染
```

### 5.2 两条查询路径

**REST/tRPC — 历史数据 & 页面加载**:
React Query → tRPC Router → Prisma → PostgreSQL
(基金列表、历史图表、用户设置)

**WebSocket — 实时更新**:
Python Collector → Redis Pub/Sub → Next.js WS → Browser
(实时价格/溢价率变动、新套利信号、信号状态变化)

### 5.3 Python Collector 调度

| 任务 | 频率 | 说明 |
|---|---|---|
| 行情采集 | 交易日 9:30-15:00 每 30s | 场内价格 + 底层指数 + 汇率 |
| 净值估算 | 行情采集后立即 | 三层净值 + 溢价率 + 套利检测 |
| 校准因子更新 | 每日 16:00 | 基于当日收盘数据 |
| 净值历史同步 | 每日 20:00 | 官方披露净值入库 |
| 历史数据全量同步 | 周六 03:00 | 股票历史 OHLCV |

---

## 6. 套利信号检测

### 6.1 核心公式

```
实时溢价率 = (场内价格 / 实时估算净值 - 1) × 100%

Z-score = (当前溢价率 - 历史均值) / 历史标准差

入场信号: |Z-score| > 2

净套利空间 = |溢价率| - 交易成本率 - 滑点预留 (通常需 > 1.5%)
```

### 6.2 信号类型

| 类型 | 条件 | 说明 |
|---|---|---|
| PREMIUM (溢价套利) | 溢价率 > 0 且 Z-score > 2 | 卖出基金 + 买入底层资产 |
| DISCOUNT (折价套利) | 溢价率 < 0 且 Z-score < -2 | 买入基金 + 做空底层资产 |
| PAIR (配对套利) | 同底层两基金溢价率差 > 阈值 | 做空高溢价 + 做多低溢价 |

---

## 7. 错误处理

### 7.1 外部 API 降级

- 新浪 API 不可用 → 降级到 Yahoo Finance
- 汇率 API 超时 → 用最近一次有效汇率，标记 stale
- 所有数据源挂了 → 前端显示"数据延迟"警告，保留最后已知数据

### 7.2 基础设施故障

- PostgreSQL 慢查询 → Prisma 连接池 + 查询超时 10s
- Redis 不可用 → 降级为纯轮询，WebSocket 推送暂停
- Collector 写库失败 → 重试 3 次，失败后跳过本周期

### 7.3 前端错误边界

- 每个路由有 `error.tsx` 边界
- WebSocket 断线 → 自动重连 (指数退避)
- 数据加载失败 → Skeleton 骨架屏 + 重试按钮

### 7.4 飞书通知失败

- Webhook 超时/失败 → 重试 2 次，记录日志
- 连续失败超过阈值 → 暂停该用户通知，提示检查配置

---

## 8. 测试策略

| 层级 | 工具 | 覆盖范围 |
|---|---|---|
| 单元测试 | Vitest | 估值计算函数、信号检测逻辑、工具函数 |
| 组件测试 | Testing Library | FundTable、ArbitragePanel、SignalBadge、WS Context |
| API 测试 | Vitest + tRPC test utils | tRPC 路由验证、权限检查、认证流程 |
| E2E | Playwright | 登录→看板→基金列表→套利机会 核心流程 |
| Collector | Python unittest/pytest | API 调用 mock、计算对账 |

---

## 9. 项目结构

```
we-win/
├── app/                    # Next.js App Router (见 §3.1)
├── components/             # React 组件 (见 §4.1)
├── lib/
│   ├── prisma.ts          # Prisma 客户端
│   ├── auth.ts            # NextAuth 配置
│   ├── trpc/
│   │   └── router/        # tRPC 路由
│   └── ws.ts              # WebSocket 服务端
├── collector/             # Python Data Collector
│   ├── main.py            # 主调度器
│   ├── fetchers/          # API 数据获取 (新浪/Yahoo/ChinaMoney)
│   ├── calculators/       # 净值估算/溢价率/信号检测
│   ├── models/            # 数据模型
│   └── requirements.txt
├── prisma/
│   └── schema.prisma
├── docs/
│   └── superpowers/
│       └── specs/         # 设计文档
└── ... (config files)
```
