# QDII Arbitrage Monitoring System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack QDII fund arbitrage monitoring platform with real-time data, arbitrage signal detection, Feishu notifications, and multi-user role-based access.

**Architecture:** Next.js (App Router) frontend/API + Python Data Collector as independent service, PostgreSQL + Prisma ORM, Redis Pub/Sub for real-time data push, NextAuth.js for authentication with credentials provider.

**Tech Stack:** Next.js 15 + TypeScript + TailwindCSS v4 + React 19 + Prisma + PostgreSQL + Redis + tRPC + next-ws + Recharts + NextAuth.js + TanStack React Query + Vitest + Playwright

---

## Phase 0: Project Scaffolding

### Task 0.1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`

- [ ] **Step 1: Create Next.js app with TypeScript and TailwindCSS**

Run: `npx create-next-app@latest . --typescript --tailwind --src-dir=false --app --import-alias="@/*" --no-turbopack`

- [ ] **Step 2: Install core dependencies**

```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter @tRPC/server @tRPC/client @tRPC/react-query @tRPC/next @tanstack/react-query zod recharts next-ws ioredis bcryptjs
npm install -D @types/bcryptjs vitest @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 3: Verify dev server starts**

Run: `npm run dev`
Expected: Next.js dev server on http://localhost:3000

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + TailwindCSS project"
```

### Task 0.2: Configure Prisma and database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`
- Create: `.env`

- [ ] **Step 1: Write Prisma schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

enum Exchange {
  SH
  SZ
}

enum FundType {
  ETF
  LOF
  FIELD
}

enum FundCategory {
  US_TECH
  US_SP
  US_OIL
  US_BIO
  US_CONS
  US_GENERAL
  HK_HSI
  HK_HSCEI
  HK_TECH
  JP_NKY
  EU_DAX
  MIXED
}

enum Currency {
  USD
  HKD
  JPY
  EUR
  CNY
}

enum DataSource {
  SINA
  YAHOO
  CHINAMONEY
  EASTMONEY
}

enum SignalType {
  PREMIUM
  DISCOUNT
  PAIR
}

enum SignalStatus {
  ACTIVE
  EXPIRED
  EXECUTED
}

enum NotifyChannel {
  FEISHU
  WECHAT
  EMAIL
}

enum NotifyStatus {
  PENDING
  SENT
  FAILED
  READ
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String?
  passwordHash String
  role         Role     @default(USER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions      Session[]
  notifications Notification[]
  feishuConfig  FeishuConfig?
}

model Session {
  id        String   @id @default(uuid())
  sessionToken String @unique
  userId    String
  expires   DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Fund {
  id        String        @id @default(uuid())
  symbol    String        @unique
  name      String
  exchange  Exchange
  type      FundType
  category  FundCategory
  currency  Currency
  isActive  Boolean       @default(true)
  createdAt DateTime      @default(now())

  prices      FundPrice[]
  valuations  FundValuation[]
  signals     ArbitrageSignal[]
  pairs       FundPair[]
}

model FundPrice {
  id          String     @id @default(uuid())
  fundId      String
  timestamp   DateTime
  marketPrice Decimal    @db.Decimal(10, 4)
  volume      BigInt?
  turnover    Decimal?   @db.Decimal(16, 2)
  source      DataSource

  fund Fund @relation(fields: [fundId], references: [id], onDelete: Cascade)
  @@index([fundId, timestamp])
}

model ExchangeRate {
  id        String     @id @default(uuid())
  pair      String
  rate      Decimal    @db.Decimal(10, 6)
  timestamp DateTime
  source    DataSource

  @@index([pair, timestamp])
}

model IndexPrice {
  id          String   @id @default(uuid())
  indexSymbol String
  price       Decimal  @db.Decimal(12, 4)
  timestamp   DateTime
  source      DataSource

  @@index([indexSymbol, timestamp])
}

model FundValuation {
  id                String   @id @default(uuid())
  fundId            String
  timestamp         DateTime
  officialNAV       Decimal? @db.Decimal(10, 4)
  fairNAV           Decimal? @db.Decimal(10, 4)
  realtimeNAV       Decimal? @db.Decimal(10, 4)
  calibrationFactor Decimal? @db.Decimal(12, 6)
  premium           Decimal? @db.Decimal(8, 4)

  fund Fund @relation(fields: [fundId], references: [id], onDelete: Cascade)
  @@index([fundId, timestamp])
}

model FundPair {
  id                String   @id @default(uuid())
  fundId            String
  pairFundId        String?
  pairIndex         String?
  calibrationFactor Decimal? @db.Decimal(12, 6)
  positionAdjust    Decimal? @default(1.0) @db.Decimal(10, 6)

  fund Fund @relation(fields: [fundId], references: [id], onDelete: Cascade)
}

model ArbitrageSignal {
  id             String        @id @default(uuid())
  fundId         String
  timestamp      DateTime
  type           SignalType
  premiumRate    Decimal       @db.Decimal(8, 4)
  zScore         Decimal?      @db.Decimal(8, 4)
  historicalMean Decimal?      @db.Decimal(8, 4)
  historicalStd  Decimal?      @db.Decimal(8, 4)
  costEstimate   Decimal?      @db.Decimal(8, 4)
  netSpread      Decimal?      @db.Decimal(8, 4)
  status         SignalStatus  @default(ACTIVE)

  notifications Notification[]

  fund Fund @relation(fields: [fundId], references: [id], onDelete: Cascade)
  @@index([fundId, timestamp])
  @@index([status])
}

model Notification {
  id        String        @id @default(uuid())
  signalId  String
  userId    String
  channel   NotifyChannel
  content   String
  status    NotifyStatus   @default(PENDING)
  sentAt    DateTime?
  readAt    DateTime?

  signal ArbitrageSignal @relation(fields: [signalId], references: [id], onDelete: Cascade)
  user   User            @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model FeishuConfig {
  id          String  @id @default(uuid())
  userId      String  @unique
  webhookUrl  String
  isActive    Boolean @default(true)
  threshold   Decimal @default(1.5) @db.Decimal(6, 4)
  notifyPairs Boolean @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Create Prisma client singleton**

Write `lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Set up .env**

Write `.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qdii_arbitrage"
AUTH_SECRET="change-me-in-production"
REDIS_URL="redis://localhost:6379"
```

- [ ] **Step 4: Run database migration**

Run: `npx prisma migrate dev --name init`
Expected: Tables created in PostgreSQL

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/prisma.ts .env
git commit -m "feat: add Prisma schema and client"
```

---

## Phase 1: Authentication

### Task 1.1: Set up NextAuth.js

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `components/providers/AuthProvider.tsx`

- [ ] **Step 1: Write NextAuth configuration**

Write `lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Write Auth API route**

Write `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Write AuthProvider**

Write `components/providers/AuthProvider.tsx`:

```typescript
"use client";

import { SessionProvider } from "next-auth/react";
import { type ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth/[...nextauth]/route.ts components/providers/AuthProvider.tsx
git commit -m "feat: add NextAuth.js credentials authentication"
```

### Task 1.2: Login and register pages

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/layout.tsx`

- [ ] **Step 1: Write auth layout**

Write `app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write login page**

Write `app/(auth)/login/page.tsx`:

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("邮箱或密码错误");
    } else {
      router.push("/funds");
      router.refresh();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-2xl font-bold text-slate-900 text-center mb-6">
        QDII 套利监控
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          登录
        </button>
      </form>
      <p className="text-sm text-slate-500 text-center mt-4">
        还没有账号？{" "}
        <a href="/register" className="text-blue-600 hover:underline">
          注册
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Write register page**

Write `app/(auth)/register/page.tsx` (same structure as login, with name field, calls API to create user):

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "注册失败");
      return;
    }

    router.push("/login");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-2xl font-bold text-slate-900 text-center mb-6">
        注册账号
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            昵称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            密码
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          注册
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Create registration API route**

Write `app/api/auth/register/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { name, email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ message: "邮箱和密码不能为空" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "邮箱已被注册" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  return NextResponse.json({ message: "注册成功" }, { status: 201 });
}
```

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/ app/api/auth/register/
git commit -m "feat: add login and register pages with API"
```

---

## Phase 2: Layout & Navigation

### Task 2.1: Root layout with providers

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/globals.css`

- [ ] **Step 1: Write globals.css**

Write `app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 2: Write root layout**

Write `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "QDII 套利监控",
  description: "QDII 基金折溢价套利监控平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add root layout with AuthProvider"
```

### Task 2.2: Dashboard layout with sidebar

**Files:**
- Create: `components/layout/Sidebar.tsx`
- Create: `components/layout/Header.tsx`
- Create: `components/layout/DashboardLayout.tsx`
- Create: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Write Sidebar component**

Write `components/layout/Sidebar.tsx`:

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/funds", label: "基金列表", icon: "💰" },
  { href: "/arbitrage", label: "套利机会", icon: "🎯" },
  { href: "/history", label: "历史分析", icon: "📈" },
  { href: "/settings", label: "设置", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-slate-200">
        <Link href="/" className="font-bold text-lg text-blue-600">
          QDII Arbitrage
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Write Header component**

Write `components/layout/Header.tsx`:

```typescript
"use client";

import { signOut, useSession } from "next-auth/react";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span>实时连接</span>
        </div>
        <span>|</span>
        <span>数据更新: --</span>
        <span>|</span>
        <span>活跃信号: --</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">
          {session?.user?.name || session?.user?.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          退出
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Write DashboardLayout**

Write `components/layout/DashboardLayout.tsx`:

```typescript
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write dashboard route layout**

Write `app/(dashboard)/layout.tsx`:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
```

- [ ] **Step 5: Commit**

```bash
git add components/layout/ app/(dashboard)/layout.tsx
git commit -m "feat: add sidebar navigation and dashboard layout"
```

---

## Phase 3: Fund Data Pages

### Task 3.1: tRPC setup

**Files:**
- Create: `lib/trpc/context.ts`
- Create: `lib/trpc/init.ts`
- Create: `lib/trpc/router/index.ts`
- Create: `lib/trpc/router/fund.ts`
- Create: `app/api/trpc/[trpc]/route.ts`
- Create: `components/providers/TRPCProvider.tsx`

- [ ] **Step 1: Write tRPC context**

Write `lib/trpc/init.ts`:

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { type Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedProcedure = t.procedure.use(isAuthed);

const isAdmin = isAuthed.unstable_pipe(({ ctx, next }) => {
  if ((ctx.session.user as { role?: string }).role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const adminProcedure = t.procedure.use(isAdmin);
```

- [ ] **Step 2: Write tRPC context factory**

Write `lib/trpc/context.ts`:

```typescript
import { auth } from "@/lib/auth";

export async function createContext() {
  const session = await auth();
  return { session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

- [ ] **Step 3: Install superjson**

Run: `npm install superjson`

- [ ] **Step 4: Write fund tRPC router**

Write `lib/trpc/router/fund.ts`:

```typescript
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";

export const fundRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        exchange: z.string().optional(),
        sortBy: z.enum(["premium", "symbol", "marketPrice"]).default("premium"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const { category, exchange, sortBy, sortOrder, limit } = input;

      const where: Record<string, unknown> = { isActive: true };
      if (category) where.category = category;
      if (exchange) where.exchange = exchange;

      const funds = await prisma.fund.findMany({
        where,
        include: {
          valuations: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          prices: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          signals: {
            where: { status: "ACTIVE" },
            orderBy: { timestamp: "desc" },
            take: 1,
          },
        },
        take: limit,
      });

      return funds.map((f) => ({
        id: f.id,
        symbol: f.symbol,
        name: f.name,
        exchange: f.exchange,
        type: f.type,
        category: f.category,
        currency: f.currency,
        marketPrice: f.prices[0]?.marketPrice ?? null,
        valuation: f.valuations[0] ?? null,
        activeSignal: f.signals[0] ?? null,
      }));
    }),

  bySymbol: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const fund = await prisma.fund.findUnique({
        where: { symbol: input.symbol },
        include: {
          valuations: {
            orderBy: { timestamp: "desc" },
            take: 100,
          },
          prices: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          signals: {
            orderBy: { timestamp: "desc" },
            take: 20,
          },
          pairs: true,
        },
      });

      if (!fund) throw new Error("Fund not found");
      return fund;
    }),

  categories: publicProcedure.query(async () => {
    const funds = await prisma.fund.findMany({
      where: { isActive: true },
      select: { category: true, exchange: true },
      distinct: ["category", "exchange"],
    });
    return [...new Set(funds.map((f) => f.category))].sort();
  }),
});
```

- [ ] **Step 5: Write root router**

Write `lib/trpc/router/index.ts`:

```typescript
import { router } from "../init";
import { fundRouter } from "./fund";

export const appRouter = router({
  fund: fundRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 6: Write tRPC API route**

Write `app/api/trpc/[trpc]/route.ts`:

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc/router";
import { createContext } from "@/lib/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 7: Write TRPCProvider**

Write `components/providers/TRPCProvider.tsx`:

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { type AppRouter } from "@/lib/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 8: Update root layout to include TRPCProvider**

Modify `app/layout.tsx` to add `<TRPCProvider>` inside `<AuthProvider>`.

- [ ] **Step 9: Commit**

```bash
git add lib/trpc/ app/api/trpc/ components/providers/TRPCProvider.tsx app/layout.tsx
git commit -m "feat: set up tRPC with fund list and detail routers"
```

### Task 3.2: Fund list page

**Files:**
- Create: `components/funds/FundFilter.tsx`
- Create: `components/funds/FundTable.tsx`
- Create: `components/ui/LoadingSkeleton.tsx`
- Create: `app/(dashboard)/funds/page.tsx`

- [ ] **Step 1: Write FundFilter component**

Write `components/funds/FundFilter.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const categories = [
  { value: "US_TECH", label: "美国科技" },
  { value: "US_SP", label: "标普500" },
  { value: "US_OIL", label: "油气" },
  { value: "US_BIO", label: "生物科技" },
  { value: "HK_HSI", label: "恒生" },
  { value: "HK_HSCEI", label: "国企" },
  { value: "HK_TECH", label: "恒生科技" },
  { value: "JP_NKY", label: "日经" },
  { value: "EU_DAX", label: "欧洲" },
  { value: "MIXED", label: "混合" },
];

export function FundFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || "";

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => setFilter("category", "")}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          !currentCategory
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        全部
      </button>
      {categories.map((cat) => (
        <button
          key={cat.value}
          onClick={() => setFilter("category", cat.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            currentCategory === cat.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write FundTable component**

Write `components/funds/FundTable.tsx`:

```typescript
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { SignalBadge } from "@/components/arbitrage/SignalBadge";

function formatPrice(v: unknown): string {
  if (v === null || v === undefined) return "--";
  return Number(v).toFixed(3);
}

function formatPremium(v: unknown): string {
  if (v === null || v === undefined) return "--";
  const pct = Number(v);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function FundTable() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;

  const { data: funds, isLoading } = trpc.fund.list.useQuery({
    category,
    sortBy: "premium",
    sortOrder: "desc",
    limit: 50,
  });

  if (isLoading) {
    return <LoadingSkeleton rows={10} />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            <th className="px-4 py-3 font-medium text-slate-600">代码</th>
            <th className="px-4 py-3 font-medium text-slate-600">名称</th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">
              场内价
            </th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">
              实时净值
            </th>
            <th className="px-4 py-3 font-medium text-slate-600 text-right">
              溢价率
            </th>
            <th className="px-4 py-3 font-medium text-slate-600">信号</th>
          </tr>
        </thead>
        <tbody>
          {funds?.map((fund) => (
            <tr
              key={fund.id}
              className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-slate-700">
                <Link
                  href={`/funds/${fund.symbol}`}
                  className="hover:text-blue-600"
                >
                  {fund.symbol}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-800">{fund.name}</td>
              <td className="px-4 py-3 text-right font-mono">
                {formatPrice(fund.marketPrice)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {formatPrice(fund.valuation?.realtimeNAV)}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono ${
                  Number(fund.valuation?.premium) > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {formatPremium(fund.valuation?.premium)}
              </td>
              <td className="px-4 py-3">
                {fund.activeSignal && (
                  <SignalBadge
                    type={fund.activeSignal.type}
                    zScore={Number(fund.activeSignal.zScore)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Write LoadingSkeleton**

Write `components/ui/LoadingSkeleton.tsx`:

```typescript
export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-20" />
          <div className="h-4 bg-slate-200 rounded w-32" />
          <div className="h-4 bg-slate-200 rounded w-16 ml-auto" />
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-16" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write SignalBadge**

Write `components/arbitrage/SignalBadge.tsx`:

```typescript
import { type SignalType } from "@prisma/client";

const config: Record<SignalType, { label: string; bg: string; text: string }> =
  {
    PREMIUM: { label: "溢价", bg: "bg-red-100", text: "text-red-700" },
    DISCOUNT: { label: "折价", bg: "bg-green-100", text: "text-green-700" },
    PAIR: { label: "配对", bg: "bg-blue-100", text: "text-blue-700" },
  };

export function SignalBadge({
  type,
  zScore,
}: {
  type: string;
  zScore?: number;
}) {
  const { label, bg, text } =
    config[type as SignalType] || config.PREMIUM;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      {label}
      {zScore !== undefined && (
        <span className="opacity-70">Z:{zScore.toFixed(1)}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 5: Write fund list page**

Write `app/(dashboard)/funds/page.tsx`:

```typescript
import { Suspense } from "react";
import { FundFilter } from "@/components/funds/FundFilter";
import { FundTable } from "@/components/funds/FundTable";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function FundsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">基金列表</h1>
      <Suspense>
        <FundFilter />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton rows={10} />}>
        <FundTable />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/funds/ components/ui/ components/arbitrage/SignalBadge.tsx app/\(dashboard\)/funds/
git commit -m "feat: add fund list page with filter and table"
```

### Task 3.3: Fund detail page

**Files:**
- Create: `components/funds/FundDetail.tsx`
- Create: `components/funds/FundChart.tsx`
- Create: `app/(dashboard)/funds/[symbol]/page.tsx`

- [ ] **Step 1: Write FundChart component**

Write `components/funds/FundChart.tsx`:

```typescript
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartData = {
  timestamp: string;
  premium: number;
  officialNAV?: number;
  fairNAV?: number;
  realtimeNAV?: number;
};

export function FundChart({ data }: { data: ChartData[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-800 mb-3">溢价率走势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString("zh-CN", {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString("zh-CN")}
            formatter={(v: number) => [`${v.toFixed(2)}%`]}
          />
          <Line
            type="monotone"
            dataKey="premium"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write FundDetail component**

Write `components/funds/FundDetail.tsx`:

```typescript
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { FundChart } from "./FundChart";
import { SignalBadge } from "@/components/arbitrage/SignalBadge";

function format(val: unknown, decimals = 3): string {
  if (val === null || val === undefined) return "--";
  return Number(val).toFixed(decimals);
}

function pct(val: unknown): string {
  if (val === null || val === undefined) return "--";
  const v = Number(val);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function FundDetail({ symbol }: { symbol: string }) {
  const { data: fund, isLoading } = trpc.fund.bySymbol.useQuery({ symbol });

  if (isLoading) return <p className="text-slate-500">加载中...</p>;
  if (!fund) return <p className="text-red-500">基金不存在</p>;

  const chartData = fund.valuations
    .slice()
    .reverse()
    .map((v) => ({
      timestamp: v.timestamp.toISOString(),
      premium: Number(v.premium ?? 0),
      officialNAV: Number(v.officialNAV ?? 0),
      fairNAV: Number(v.fairNAV ?? 0),
      realtimeNAV: Number(v.realtimeNAV ?? 0),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {fund.name}
          <span className="text-slate-400 font-mono text-lg ml-3">
            {fund.symbol}
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {fund.exchange} · {fund.type} · {fund.category} · {fund.currency}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">场内价格</p>
          <p className="text-xl font-mono font-bold">
            {format(fund.prices[0]?.marketPrice)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">实时净值</p>
          <p className="text-xl font-mono font-bold">
            {format(fund.valuations[0]?.realtimeNAV)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">公允净值</p>
          <p className="text-xl font-mono font-bold">
            {format(fund.valuations[0]?.fairNAV)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">溢价率</p>
          <p
            className={`text-xl font-mono font-bold ${
              Number(fund.valuations[0]?.premium) > 0
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {pct(fund.valuations[0]?.premium)}
          </p>
        </div>
      </div>

      <FundChart data={chartData} />

      {fund.signals.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">近期信号</h3>
          <div className="space-y-2">
            {fund.signals.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <SignalBadge type={s.type} zScore={Number(s.zScore)} />
                  <span className="text-slate-500">
                    {s.timestamp.toLocaleString("zh-CN")}
                  </span>
                </div>
                <span className="font-mono">
                  溢价率: {pct(s.premiumRate)} | 净空间: {pct(s.netSpread)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write fund detail page**

Write `app/(dashboard)/funds/[symbol]/page.tsx`:

```typescript
import { FundDetail } from "@/components/funds/FundDetail";

export default async function FundPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return <FundDetail symbol={symbol} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/funds/ app/\(dashboard\)/funds/\[symbol\]/
git commit -m "feat: add fund detail page with chart and signal history"
```

---

## Phase 4: Arbitrage Pages

### Task 4.1: Arbitrage opportunity panel

**Files:**
- Create: `components/arbitrage/SignalCard.tsx`
- Create: `components/arbitrage/ArbitragePanel.tsx`
- Create: `lib/trpc/router/arbitrage.ts`
- Modify: `lib/trpc/router/index.ts`
- Create: `app/(dashboard)/arbitrage/page.tsx`

- [ ] **Step 1: Write arbitrage tRPC router**

Write `lib/trpc/router/arbitrage.ts`:

```typescript
import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const arbitrageRouter = router({
  activeSignals: protectedProcedure.query(async () => {
    return prisma.arbitrageSignal.findMany({
      where: { status: "ACTIVE" },
      include: {
        fund: {
          select: { symbol: true, name: true, category: true },
        },
      },
      orderBy: { netSpread: "desc" },
    });
  }),

  signalHistory: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      return prisma.arbitrageSignal.findMany({
        where: { timestamp: { gte: since } },
        include: {
          fund: { select: { symbol: true, name: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 200,
      });
    }),

  stats: protectedProcedure.query(async () => {
    const [active, today] = await Promise.all([
      prisma.arbitrageSignal.count({ where: { status: "ACTIVE" } }),
      prisma.arbitrageSignal.count({
        where: {
          timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return { active, today };
  }),
});
```

- [ ] **Step 2: Update root router**

Modify `lib/trpc/router/index.ts` to add:

```typescript
import { arbitrageRouter } from "./arbitrage";

export const appRouter = router({
  fund: fundRouter,
  arbitrage: arbitrageRouter,
});
```

- [ ] **Step 3: Write SignalCard component**

Write `components/arbitrage/SignalCard.tsx`:

```typescript
import { SignalBadge } from "./SignalBadge";

type Signal = {
  id: string;
  type: string;
  premiumRate: number;
  zScore: number | null;
  netSpread: number | null;
  costEstimate: number | null;
  timestamp: Date;
  fund: { symbol: string; name: string; category: string };
};

function pct(v: unknown): string {
  if (v === null || v === undefined) return "--";
  return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
}

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-600">
              {signal.fund.symbol}
            </span>
            <SignalBadge type={signal.type} zScore={signal.zScore ?? undefined} />
          </div>
          <p className="text-sm font-medium text-slate-800 mt-1">
            {signal.fund.name}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {new Date(signal.timestamp).toLocaleTimeString("zh-CN")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center pt-3 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-500">溢价率</p>
          <p
            className={`font-mono font-bold text-sm ${
              Number(signal.premiumRate) > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {pct(signal.premiumRate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">预估成本</p>
          <p className="font-mono font-bold text-sm">
            {pct(signal.costEstimate)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">净套利空间</p>
          <p className="font-mono font-bold text-sm text-blue-600">
            {pct(signal.netSpread)}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write ArbitragePanel**

Write `components/arbitrage/ArbitragePanel.tsx`:

```typescript
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { SignalCard } from "./SignalCard";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export function ArbitragePanel() {
  const { data: signals, isLoading } = trpc.arbitrage.activeSignals.useQuery();
  const { data: stats } = trpc.arbitrage.stats.useQuery();

  if (isLoading) return <LoadingSkeleton rows={5} />;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">活跃信号</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.active ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">今日信号</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.today ?? 0}</p>
        </div>
      </div>

      {!signals || signals.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          暂无活跃套利信号
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={{
                id: s.id,
                type: s.type,
                premiumRate: Number(s.premiumRate),
                zScore: s.zScore ? Number(s.zScore) : null,
                netSpread: s.netSpread ? Number(s.netSpread) : null,
                costEstimate: s.costEstimate ? Number(s.costEstimate) : null,
                timestamp: s.timestamp,
                fund: s.fund as { symbol: string; name: string; category: string },
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write arbitrage page**

Write `app/(dashboard)/arbitrage/page.tsx`:

```typescript
import { ArbitragePanel } from "@/components/arbitrage/ArbitragePanel";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ArbitragePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">套利机会</h1>
      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <ArbitragePanel />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/trpc/router/arbitrage.ts lib/trpc/router/index.ts components/arbitrage/ app/\(dashboard\)/arbitrage/
git commit -m "feat: add arbitrage opportunity panel and API"
```

---

## Phase 5: History & Settings Pages

### Task 5.1: History page

**Files:**
- Create: `components/history/HistoryChart.tsx`
- Create: `components/history/FundComparison.tsx`
- Create: `lib/trpc/router/history.ts`
- Modify: `lib/trpc/router/index.ts`
- Create: `app/(dashboard)/history/page.tsx`

- [ ] **Step 1: Write history tRPC router**

Write `lib/trpc/router/history.ts`:

```typescript
import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const historyRouter = router({
  premiumHistory: protectedProcedure
    .input(
      z.object({
        fundIds: z.array(z.string()),
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const valuations = await prisma.fundValuation.findMany({
        where: {
          fundId: { in: input.fundIds },
          timestamp: { gte: since },
        },
        include: {
          fund: { select: { symbol: true, name: true } },
        },
        orderBy: { timestamp: "asc" },
      });

      // Group by fund
      const byFund = new Map<string, typeof valuations>();
      for (const v of valuations) {
        const key = v.fund.symbol;
        if (!byFund.has(key)) byFund.set(key, []);
        byFund.get(key)!.push(v);
      }

      return Array.from(byFund.entries()).map(([symbol, vals]) => ({
        symbol,
        name: vals[0].fund.name,
        data: vals.map((v) => ({
          timestamp: v.timestamp.toISOString(),
          premium: Number(v.premium ?? 0),
        })),
      }));
    }),

  fundOptions: protectedProcedure.query(async () => {
    return prisma.fund.findMany({
      where: { isActive: true },
      select: { id: true, symbol: true, name: true, category: true },
      orderBy: { symbol: "asc" },
    });
  }),
});
```

- [ ] **Step 2: Update root router to add historyRouter**

- [ ] **Step 3: Write FundComparison component**

Write `components/history/FundComparison.tsx`:

```typescript
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316",
];

export function FundComparison() {
  const { data: funds } = trpc.history.fundOptions.useQuery();
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState(30);

  const { data: history } = trpc.history.premiumHistory.useQuery(
    { fundIds: selected, days },
    { enabled: selected.length > 0 },
  );

  const toggleFund = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Merge all fund data by timestamp
  const mergedData = new Map<string, Record<string, number>>();
  history?.forEach((fund) => {
    fund.data.forEach((d) => {
      if (!mergedData.has(d.timestamp)) mergedData.set(d.timestamp, {});
      mergedData.get(d.timestamp)![fund.symbol] = d.premium;
    });
  });
  const chartData = Array.from(mergedData.entries())
    .map(([timestamp, vals]) => ({ timestamp, ...vals }))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {funds?.map((f) => (
          <button
            key={f.id}
            onClick={() => toggleFund(f.id)}
            className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
              selected.includes(f.id)
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.symbol}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {[7, 30, 90, 180].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded text-xs font-medium ${
              days === d
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {d}天
          </button>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("zh-CN")
                }
              />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                labelFormatter={(v) => new Date(v).toLocaleString("zh-CN")}
                formatter={(v: number) => [`${v.toFixed(2)}%`]}
              />
              <Legend />
              {history?.map((fund, i) => (
                <Line
                  key={fund.symbol}
                  type="monotone"
                  dataKey={fund.symbol}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false}
                  strokeWidth={1.5}
                  name={fund.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write history page**

Write `app/(dashboard)/history/page.tsx`:

```typescript
import { FundComparison } from "@/components/history/FundComparison";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function HistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">历史分析</h1>
      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <FundComparison />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/trpc/router/history.ts lib/trpc/router/index.ts components/history/ app/\(dashboard\)/history/
git commit -m "feat: add history page with multi-fund comparison chart"
```

### Task 5.2: Settings and admin pages

**Files:**
- Create: `components/settings/FeishuConfig.tsx`
- Create: `components/settings/AdminPanel.tsx`
- Create: `lib/trpc/router/settings.ts`
- Create: `lib/trpc/router/admin.ts`
- Modify: `lib/trpc/router/index.ts`
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `app/(dashboard)/settings/admin/page.tsx`

- [ ] **Step 1: Write settings tRPC router**

Write `lib/trpc/router/settings.ts`:

```typescript
import { router, protectedProcedure } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const settingsRouter = router({
  getFeishuConfig: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    if (!userId) return null;

    return prisma.feishuConfig.findUnique({ where: { userId } });
  }),

  updateFeishuConfig: protectedProcedure
    .input(
      z.object({
        webhookUrl: z.string().url().or(z.literal("")),
        isActive: z.boolean(),
        threshold: z.number().min(0).max(20),
        notifyPairs: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (!userId) throw new Error("Not authenticated");

      return prisma.feishuConfig.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
    }),
});
```

- [ ] **Step 2: Write admin tRPC router**

Write `lib/trpc/router/admin.ts`:

```typescript
import { adminProcedure, router } from "../init";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const adminRouter = router({
  listUsers: adminProcedure.query(async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  updateUserRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["ADMIN", "USER"]) }))
    .mutation(async ({ input }) => {
      return prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });
    }),
});
```

- [ ] **Step 3: Update root router to add settingsRouter and adminRouter**

- [ ] **Step 4: Write FeishuConfig component**

Write `components/settings/FeishuConfig.tsx`:

```typescript
"use client";

import { trpc } from "@/components/providers/TRPCProvider";
import { useState, useEffect } from "react";

export function FeishuConfig() {
  const { data: config } = trpc.settings.getFeishuConfig.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.settings.updateFeishuConfig.useMutation({
    onSuccess: () => utils.settings.getFeishuConfig.invalidate(),
  });

  const [webhookUrl, setWebhookUrl] = useState("");
  const [threshold, setThreshold] = useState(1.5);
  const [notifyPairs, setNotifyPairs] = useState(true);

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhookUrl);
      setThreshold(Number(config.threshold));
      setNotifyPairs(config.notifyPairs);
    }
  }, [config]);

  const handleSave = () => {
    updateMutation.mutate({
      webhookUrl,
      threshold,
      notifyPairs,
      isActive: true,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">飞书通知配置</h2>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          最小溢价率阈值 (%)
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          max="20"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="notifyPairs"
          checked={notifyPairs}
          onChange={(e) => setNotifyPairs(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="notifyPairs" className="text-sm text-slate-700">
          通知配对套利机会
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
      >
        {updateMutation.isPending ? "保存中..." : "保存配置"}
      </button>
      {updateMutation.isSuccess && (
        <p className="text-sm text-green-600">保存成功</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write AdminPanel**

Write `components/settings/AdminPanel.tsx`:

```typescript
"use client";

import { trpc } from "@/components/providers/TRPCProvider";

export function AdminPanel() {
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery();
  const utils = trpc.useUtils();
  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => utils.admin.listUsers.invalidate(),
  });

  if (isLoading) return <p className="text-slate-500">加载中...</p>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            <th className="px-4 py-3 font-medium">邮箱</th>
            <th className="px-4 py-3 font-medium">昵称</th>
            <th className="px-4 py-3 font-medium">角色</th>
            <th className="px-4 py-3 font-medium">注册时间</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((user) => (
            <tr key={user.id} className="border-b border-slate-100">
              <td className="px-4 py-3">{user.email}</td>
              <td className="px-4 py-3">{user.name || "--"}</td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    user.role === "ADMIN"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(user.createdAt).toLocaleDateString("zh-CN")}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() =>
                    updateRole.mutate({
                      userId: user.id,
                      role: user.role === "ADMIN" ? "USER" : "ADMIN",
                    })
                  }
                  className="text-xs text-blue-600 hover:underline"
                  disabled={updateRole.isPending}
                >
                  {user.role === "ADMIN" ? "降级为用户" : "提升为管理员"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Write settings page**

Write `app/(dashboard)/settings/page.tsx`:

```typescript
import { FeishuConfig } from "@/components/settings/FeishuConfig";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">设置</h1>
      <FeishuConfig />
      {isAdmin && (
        <div>
          <Link
            href="/settings/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            用户管理 →
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write admin page**

Write `app/(dashboard)/settings/admin/page.tsx`:

```typescript
import { AdminPanel } from "@/components/settings/AdminPanel";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "ADMIN") {
    redirect("/settings");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">用户管理</h1>
      <AdminPanel />
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/trpc/router/settings.ts lib/trpc/router/admin.ts lib/trpc/router/index.ts components/settings/ app/\(dashboard\)/settings/
git commit -m "feat: add settings page with Feishu config and admin panel"
```

---

## Phase 6: Real-time WebSocket

### Task 6.1: WebSocket server with next-ws

**Files:**
- Create: `lib/ws/server.ts`
- Create: `app/api/ws/route.ts`
- Create: `lib/redis.ts`
- Create: `components/providers/WebSocketProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Install redis dependencies**

Run: `npm install ioredis`
Run: `npm install -D @types/ioredis`

- [ ] **Step 2: Write Redis client**

Write `lib/redis.ts`:

```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  subRedis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis(REDIS_URL);
export const subRedis = globalForRedis.subRedis ?? new Redis(REDIS_URL);

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.subRedis = subRedis;
}
```

- [ ] **Step 3: Write WebSocket server**

Write `app/api/ws/route.ts`:

```typescript
import { subRedis } from "@/lib/redis";

const clients = new Set<(data: string) => void>();

subRedis.subscribe("arbitrage:signals", "arbitrage:prices");

subRedis.on("message", (channel, message) => {
  for (const send of clients) {
    try {
      send(JSON.stringify({ channel, data: JSON.parse(message) }));
    } catch {
      clients.delete(send);
    }
  }
});

export async function GET(request: Request) {
  const { socket, response } = (request as Request & {
    socket?: { on: (event: string, cb: () => void) => void };
  }).socket?.on
    ? DenoUpgrade(request)
    : NodeUpgrade(request);

  return response;
}

function NodeUpgrade(request: Request) {
  const upgradeHeader = request.headers.get("upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return {
      response: new Response("Expected Upgrade: websocket", { status: 426 }),
    };
  }

  let interval: NodeJS.Timeout;
  let closed = false;
  let socket: { close: () => void };

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        if (!closed) {
          controller.enqueue(new TextEncoder().encode(data));
        }
      };

      clients.add(send);
      interval = setInterval(() => {
        if (!closed) {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        }
      }, 30000);

      socket = {
        close: () => {
          closed = true;
          clients.delete(send);
          clearInterval(interval);
          controller.close();
        },
      };
    },
    cancel() {
      closed = true;
      clearInterval(interval);
    },
  });

  return {
    response: new Response(stream, {
      status: 101,
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    }),
    socket,
  };
}
```

Wait — SSE (Server-Sent Events) is simpler and more reliable for this use case. Let me redo this as SSE.

- [ ] **Step 3 (revised): Write SSE route for real-time data**

Write `app/api/ws/route.ts`:

```typescript
import { subRedis } from "@/lib/redis";

subRedis.subscribe("arbitrage:signals", "arbitrage:prices").catch(console.error);

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let controller: ReadableStreamDefaultController;

  const onMessage = (channel: string, message: string) => {
    if (!closed && controller) {
      const event = `event: ${channel.replace(":", "_")}\ndata: ${message}\n\n`;
      controller.enqueue(encoder.encode(event));
    }
  };

  const keepalive = setInterval(() => {
    if (!closed && controller) {
      controller.enqueue(encoder.encode(": keepalive\n\n"));
    }
  }, 15000);

  subRedis.on("message", onMessage);

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      closed = true;
      clearInterval(keepalive);
      subRedis.off("message", onMessage);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 4: Write WebSocketProvider**

Write `components/providers/WebSocketProvider.tsx`:

```typescript
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type PriceUpdate = {
  fundId: string;
  marketPrice: number;
  realtimeNAV: number | null;
  premium: number | null;
  timestamp: string;
};

type SignalUpdate = {
  id: string;
  fundId: string;
  type: string;
  premiumRate: number;
  zScore: number;
  netSpread: number;
  fundSymbol: string;
  fundName: string;
  timestamp: string;
};

type WSContextValue = {
  prices: Map<string, PriceUpdate>;
  latestSignal: SignalUpdate | null;
  connected: boolean;
};

const WSContext = createContext<WSContextValue>({
  prices: new Map(),
  latestSignal: null,
  connected: false,
});

export function useWS() {
  return useContext(WSContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [prices] = useState(() => new Map<string, PriceUpdate>());
  const [latestSignal, setLatestSignal] = useState<SignalUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource("/api/ws");

    eventSource.onopen = () => setConnected(true);

    eventSource.addEventListener("arbitrage_signals", (e) => {
      try {
        const signal = JSON.parse(e.data) as SignalUpdate;
        setLatestSignal(signal);
      } catch {}
    });

    eventSource.addEventListener("arbitrage_prices", (e) => {
      try {
        const update = JSON.parse(e.data) as PriceUpdate;
        prices.set(update.fundId, update);
        forceRender((n) => n + 1);
      } catch {}
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [prices]);

  return (
    <WSContext.Provider value={{ prices, latestSignal, connected }}>
      {children}
    </WSContext.Provider>
  );
}
```

- [ ] **Step 5: Update root layout to include WebSocketProvider**

Modify `app/layout.tsx` to wrap with `<WebSocketProvider>` inside `<AuthProvider>`.

- [ ] **Step 6: Commit**

```bash
git add lib/redis.ts app/api/ws/route.ts components/providers/WebSocketProvider.tsx app/layout.tsx
git commit -m "feat: add SSE real-time data with Redis Pub/Sub"
```

---

## Phase 7: Home Page Dashboard

### Task 7.1: Public dashboard page

**Files:**
- Create: `app/page.tsx`
- Create: `components/layout/LandingLayout.tsx`

- [ ] **Step 1: Write landing layout**

Write `components/layout/LandingLayout.tsx`:

```typescript
import Link from "next/link";
import { auth } from "@/lib/auth";

export async function LandingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <span className="font-bold text-lg text-blue-600">QDII Arbitrage</span>
        <div className="flex gap-3">
          {session ? (
            <Link
              href="/funds"
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              进入看板
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-1.5 text-slate-600 text-sm hover:text-slate-900"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write home page**

Write `app/page.tsx`:

```typescript
import { LandingLayout } from "@/components/layout/LandingLayout";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function HomePage() {
  const [activeSignals, totalFunds] = await Promise.all([
    prisma.arbitrageSignal.count({ where: { status: "ACTIVE" } }),
    prisma.fund.count({ where: { isActive: true } }),
  ]);

  const topFunds = await prisma.fund.findMany({
    where: { isActive: true },
    include: {
      valuations: { orderBy: { timestamp: "desc" }, take: 1 },
      prices: { orderBy: { timestamp: "desc" }, take: 1 },
    },
    orderBy: { symbol: "asc" },
    take: 10,
  });

  const topByPremium = topFunds
    .map((f) => ({
      symbol: f.symbol,
      name: f.name,
      marketPrice: f.prices[0]?.marketPrice,
      premium: f.valuations[0]?.premium,
    }))
    .sort(
      (a, b) =>
        Math.abs(Number(b.premium ?? 0)) - Math.abs(Number(a.premium ?? 0)),
    )
    .slice(0, 10);

  return (
    <LandingLayout>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            QDII 基金套利监控
          </h1>
          <p className="text-slate-500 text-lg">
            实时监控 {totalFunds} 只 QDII 基金的折溢价机会
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{totalFunds}</p>
            <p className="text-slate-500 mt-1">监控基金数量</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-3xl font-bold text-red-500">{activeSignals}</p>
            <p className="text-slate-500 mt-1">当前活跃套利信号</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">溢价率排行</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-6 py-2 font-medium text-slate-600">代码</th>
                <th className="px-6 py-2 font-medium text-slate-600">名称</th>
                <th className="px-6 py-2 font-medium text-slate-600 text-right">
                  溢价率
                </th>
              </tr>
            </thead>
            <tbody>
              {topByPremium.map((f) => (
                <tr key={f.symbol} className="border-b border-slate-50">
                  <td className="px-6 py-2 font-mono text-slate-700">
                    {f.symbol}
                  </td>
                  <td className="px-6 py-2 text-slate-800">{f.name}</td>
                  <td
                    className={`px-6 py-2 text-right font-mono ${
                      Number(f.premium ?? 0) > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {f.premium
                      ? `${Number(f.premium) >= 0 ? "+" : ""}${Number(f.premium).toFixed(2)}%`
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            登录查看完整数据
          </Link>
        </div>
      </div>
    </LandingLayout>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx components/layout/LandingLayout.tsx
git commit -m "feat: add public dashboard homepage"
```

---

## Phase 8: Python Data Collector

### Task 8.1: Collector scaffolding

**Files:**
- Create: `collector/requirements.txt`
- Create: `collector/main.py`
- Create: `collector/config.py`

- [ ] **Step 1: Write requirements.txt**

Write `collector/requirements.txt`:

```
requests>=2.31.0
psycopg2-binary>=2.9.9
redis>=5.0.0
schedule>=1.2.0
python-dotenv>=1.0.0
numpy>=1.26.0
```

- [ ] **Step 2: Write config.py**

Write `collector/config.py`:

```python
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/qdii_arbitrage")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Trading hours (Beijing time)
TRADING_START = (9, 30)
TRADING_END = (15, 0)

# Polling interval in seconds during trading hours
POLL_INTERVAL = 30

# Transaction cost estimates (in percentage)
COST_STOCK_COMMISSION = 0.015  # 万1.5
COST_FX_SPREAD = 0.001  # 0.1% FX spread
COST_SLIPPAGE = 0.001  # 0.1% slippage reserve
TOTAL_COST_ESTIMATE = 0.017  # ~1.7%
```

- [ ] **Step 3: Write main.py skeleton**

Write `collector/main.py`:

```python
"""
QDII Arbitrage Data Collector

Fetches real-time market data from Sina/Yahoo/ChinaMoney APIs,
calculates fund NAVs and arbitrage signals, writes to PostgreSQL,
and publishes signals to Redis Pub/Sub.
"""
import schedule
import time
import logging
from config import POLL_INTERVAL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def should_run():
    """Check if we're in trading hours on a weekday."""
    import datetime
    now = datetime.datetime.now()
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    t = (now.hour, now.minute)
    return (9, 30) <= t <= (15, 5)


def fetch_and_process():
    """Main data collection loop."""
    if not should_run():
        return

    logger.info("Starting data collection cycle...")
    try:
        # To be implemented in following tasks
        logger.info("Data collection cycle complete.")
    except Exception as e:
        logger.error(f"Data collection failed: {e}")


def main():
    logger.info("QDII Arbitrage Collector starting...")

    # Run fetch every POLL_INTERVAL seconds during trading hours
    schedule.every(POLL_INTERVAL).seconds.do(fetch_and_process)

    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Commit**

```bash
git add collector/
git commit -m "feat: scaffold Python data collector"
```

### Task 8.2: API fetchers

**Files:**
- Create: `collector/fetchers/__init__.py`
- Create: `collector/fetchers/sina.py`
- Create: `collector/fetchers/yahoo.py`
- Create: `collector/fetchers/chinamoney.py`

- [ ] **Step 1: Write Sina fetcher**

Write `collector/fetchers/sina.py`:

```python
"""
Sina Finance API fetcher for A-share market data.

Sina API format:
- Stock realtime: http://hq.sinajs.cn/list=sh600036
- Fund realtime: http://hq.sinajs.cn/list=f_513100
- Index realtime: http://hq.sinajs.cn/list=s_sh000001
"""
import requests
import re
import logging

logger = logging.getLogger(__name__)

SINA_API = "http://hq.sinajs.cn/list="


def _fetch(symbols: list[str]) -> dict[str, dict]:
    """Fetch realtime data for a list of Sina symbols."""
    query = ",".join(symbols)
    headers = {"Referer": "https://finance.sina.com.cn"}

    try:
        resp = requests.get(f"{SINA_API}{query}", headers=headers, timeout=10)
        resp.encoding = "gb2312"
    except requests.RequestException as e:
        logger.error(f"Sina API request failed: {e}")
        return {}

    results = {}
    lines = resp.text.strip().split("\n")
    for line in lines:
        match = re.match(r'var hq_str_(.+?)="(.+)"', line)
        if not match:
            continue

        symbol = match.group(1)
        data = match.group(2).split(",")
        if len(data) < 4 or not data[0]:
            continue

        results[symbol] = _parse_line(symbol, data)

    return results


def _parse_line(symbol: str, data: list[str]) -> dict:
    """Parse a single Sina data line. Different symbol prefixes have different formats."""
    if symbol.startswith("f_"):
        # Fund
        return {
            "symbol": symbol[2:],
            "name": data[0],
            "price": float(data[1]) if data[1] else None,
            "prev_close": float(data[2]) if data[2] else None,
            "volume": int(float(data[8])) if len(data) > 8 and data[8] else None,
        }
    elif symbol.startswith("s_"):
        # Index
        return {
            "symbol": symbol[2:],
            "name": data[0],
            "price": float(data[1]) if data[1] else None,
            "change_pct": float(data[3]) if len(data) > 3 and data[3] else None,
        }
    else:
        # Stock
        return {
            "symbol": symbol,
            "name": data[0],
            "price": float(data[3]) if len(data) > 3 and data[3] else None,
            "prev_close": float(data[2]) if len(data) > 1 and data[2] else None,
        }


def fetch_fund_prices(symbols: list[str]) -> dict[str, dict]:
    """Fetch realtime fund prices. Input: list of raw symbols like SH513100."""
    sina_symbols = []
    for s in symbols:
        if s.startswith("SH"):
            sina_symbols.append(f"f_{s[2:]}")
        elif s.startswith("SZ"):
            sina_symbols.append(f"f_{s[2:]}")

    results = {}
    # Batch in groups of 50 to avoid URL too long
    for i in range(0, len(sina_symbols), 50):
        batch = sina_symbols[i : i + 50]
        results.update(_fetch(batch))

    return results
```

- [ ] **Step 2: Write Yahoo fetcher**

Write `collector/fetchers/yahoo.py`:

```python
"""Yahoo Finance API v7 fetcher for global indices and ETFs."""
import requests
import logging

logger = logging.getLogger(__name__)

YAHOO_API = "https://query2.finance.yahoo.com/v7/finance/quote"


def fetch_quotes(symbols: list[str]) -> dict[str, dict]:
    """Fetch realtime quotes for a list of Yahoo symbols (e.g., ^NDX, XOP, QQQ)."""
    try:
        resp = requests.get(
            YAHOO_API,
            params={"symbols": ",".join(symbols)},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Yahoo API request failed: {e}")
        return {}

    data = resp.json()
    results = {}

    for item in data.get("quoteResponse", {}).get("result", []):
        symbol = item.get("symbol", "")
        results[symbol] = {
            "symbol": symbol,
            "price": item.get("regularMarketPrice"),
            "prev_close": item.get("regularMarketPreviousClose"),
            "change_pct": item.get("regularMarketChangePercent"),
            "currency": item.get("currency"),
        }

    return results
```

- [ ] **Step 3: Write ChinaMoney fetcher**

Write `collector/fetchers/chinamoney.py`:

```python
"""China Money (中国外汇交易中心) fetcher for official CNY central parity rates."""
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

CHINAMONEY_API = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew"


def fetch_cny_rates() -> dict[str, dict]:
    """Fetch latest USD/CNY, HKD/CNY, JPY/CNY, EUR/CNY central parity rates."""
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        resp = requests.post(
            CHINAMONEY_API,
            json={
                "startDate": today,
                "endDate": today,
                "currency": "",
                "pageNum": 1,
                "pageSize": 50,
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"ChinaMoney API request failed: {e}")
        return {}

    data = resp.json()
    records = data.get("records", [])

    pair_map = {
        "USD": "USDCNY",
        "HKD": "HKDCNY",
        "JPY": "JPYCNY",
        "EUR": "EURCNY",
    }

    results = {}
    for record in records:
        currency = record.get("ccy")
        rate = record.get("values", [None])[0]
        if currency in pair_map and rate is not None:
            results[pair_map[currency]] = {
                "pair": pair_map[currency],
                "rate": float(rate) / 100 if currency in ("JPY",) else float(rate),
                "timestamp": today,
            }

    return results
```

- [ ] **Step 4: Commit**

```bash
git add collector/fetchers/
git commit -m "feat: add Sina, Yahoo, and ChinaMoney API fetchers"
```

### Task 8.3: Calculators and signal detection

**Files:**
- Create: `collector/calculators/__init__.py`
- Create: `collector/calculators/nav.py`
- Create: `collector/calculators/signals.py`
- Create: `collector/db.py`

- [ ] **Step 1: Write database helper**

Write `collector/db.py`:

```python
"""Database operations for the collector."""
import psycopg2
import psycopg2.extras
from config import DATABASE_URL

_conn = None


def get_conn():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL)
        _conn.autocommit = True
    return _conn


def fetch_active_funds() -> list[dict]:
    """Fetch all active QDII funds with their pair info."""
    conn = get_conn()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT f.id, f.symbol, f.name, f.exchange, f.currency, f.category,
                   fp.pair_index, fp.calibration_factor as pair_calibration,
                   fp.position_adjust
            FROM "Fund" f
            LEFT JOIN "FundPair" fp ON fp."fundId" = f.id
            WHERE f."isActive" = true
        """)
        return cur.fetchall()


def insert_fund_price(fund_id: str, price: float, volume: int | None,
                       turnover: float | None, source: str, timestamp):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "FundPrice" (id, "fundId", timestamp, "marketPrice", volume, turnover, source)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s)
        """, (fund_id, timestamp, price, volume, turnover, source))


def insert_exchange_rate(pair: str, rate: float, timestamp, source: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "ExchangeRate" (id, pair, rate, timestamp, source)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
        """, (pair, rate, timestamp, source))


def insert_index_price(symbol: str, price: float, timestamp, source: str):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "IndexPrice" (id, "indexSymbol", price, timestamp, source)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
        """, (symbol, price, timestamp, source))


def insert_valuation(fund_id: str, timestamp, official_nav: float | None,
                     fair_nav: float | None, realtime_nav: float | None,
                     calibration_factor: float | None, premium: float | None):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "FundValuation" (id, "fundId", timestamp, "officialNAV", "fairNAV",
                                          "realtimeNAV", "calibrationFactor", premium)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s)
        """, (fund_id, timestamp, official_nav, fair_nav, realtime_nav, calibration_factor, premium))


def insert_signal(fund_id: str, timestamp, signal_type: str, premium_rate: float,
                  z_score: float | None, historical_mean: float | None,
                  historical_std: float | None, cost_estimate: float,
                  net_spread: float):
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "ArbitrageSignal" (id, "fundId", timestamp, type, "premiumRate",
                                            "zScore", "historicalMean", "historicalStd",
                                            "costEstimate", "netSpread", status)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
        """, (fund_id, timestamp, signal_type, premium_rate, z_score, historical_mean,
              historical_std, cost_estimate, net_spread))


def expire_old_signals(fund_id: str, current_signal_id: str = None):
    """Mark previous ACTIVE signals as EXPIRED, optionally excluding current."""
    conn = get_conn()
    with conn.cursor() as cur:
        if current_signal_id:
            cur.execute("""
                UPDATE "ArbitrageSignal" SET status = 'EXPIRED'
                WHERE "fundId" = %s AND status = 'ACTIVE' AND id != %s
            """, (fund_id, current_signal_id))
        else:
            cur.execute("""
                UPDATE "ArbitrageSignal" SET status = 'EXPIRED'
                WHERE "fundId" = %s AND status = 'ACTIVE'
            """, (fund_id,))


def get_historical_premiums(fund_id: str, days: int = 30) -> list[float]:
    """Get premium history for Z-score calculation."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT premium FROM "FundValuation"
            WHERE "fundId" = %s AND premium IS NOT NULL
            ORDER BY timestamp DESC
            LIMIT %s
        """, (fund_id, days * 50))  # ~50 readings per day
        return [float(r[0]) for r in cur.fetchall()]
```

- [ ] **Step 2: Write NAV calculator**

Write `collector/calculators/nav.py`:

```python
"""
Net Asset Value (NAV) calculation for QDII funds.

Implements the core valuation logic:
  realtimeNAV = index_price × CNY_rate / calibration_factor × position_adjust
  premium = (market_price / realtimeNAV - 1) × 100
"""
import logging

logger = logging.getLogger(__name__)


def calculate_realtime_nav(
    index_price: float,
    cny_rate: float,
    calibration_factor: float,
    position_adjust: float = 1.0,
    is_domestic_index: bool = False,
) -> float:
    """
    Calculate realtime estimated NAV for a QDII fund.

    For foreign indices: NAV = index_price × CNY_rate / calibration_factor × position_adjust
    For domestic indices: NAV = index_price × CNY_rate / calibration_factor (no FX conversion needed)

    Args:
        index_price: Current price of the underlying index/ETF
        cny_rate: CNY exchange rate (how many CNY per 1 unit of foreign currency)
        calibration_factor: Historical price/NAV calibration factor
        position_adjust: Position adjustment factor (default 1.0)
        is_domestic_index: True if underlying is A-share (not foreign)
    """
    if is_domestic_index:
        # A-share: no exchange rate conversion
        nav = (index_price * cny_rate) / calibration_factor
    else:
        # Foreign: index_price already in foreign currency
        nav = (index_price * cny_rate) / calibration_factor

    return nav * position_adjust


def calculate_premium(
    market_price: float,
    nav: float,
) -> float:
    """Calculate premium/discount rate in percentage."""
    if nav == 0:
        return 0.0
    return (market_price / nav - 1.0) * 100.0
```

- [ ] **Step 3: Write signal detector**

Write `collector/calculators/signals.py`:

```python
"""
Arbitrage signal detection using Z-score method.

Signal types:
  PREMIUM: premium > 0 and Z-score > 2 → sell fund, buy underlying
  DISCOUNT: premium < 0 and Z-score < -2 → buy fund, short underlying
  PAIR: premium difference between two similar funds > threshold
"""
import numpy as np
import logging
from config import TOTAL_COST_ESTIMATE

logger = logging.getLogger(__name__)


def detect_signal(
    current_premium: float,
    historical_premiums: list[float],
    cost_estimate: float = TOTAL_COST_ESTIMATE,
) -> dict:
    """
    Detect arbitrage signals based on Z-score.

    Returns:
        dict with signal type, Z-score, net spread, etc. or None if no signal.
    """
    if len(historical_premiums) < 30:
        # Not enough history for reliable Z-score
        return None

    premiums = np.array(historical_premiums)
    mean = float(np.mean(premiums))
    std = float(np.std(premiums))

    if std == 0:
        return None

    z_score = (current_premium - mean) / std

    if abs(z_score) <= 2.0:
        return None

    net_spread = abs(current_premium) - cost_estimate

    if net_spread <= 0:
        return None

    if current_premium > 0 and z_score > 2.0:
        signal_type = "PREMIUM"
    elif current_premium < 0 and z_score < -2.0:
        signal_type = "DISCOUNT"
    else:
        return None

    return {
        "type": signal_type,
        "premium_rate": current_premium,
        "z_score": z_score,
        "historical_mean": mean,
        "historical_std": std,
        "cost_estimate": cost_estimate,
        "net_spread": net_spread,
    }


def detect_pair_signal(
    premium_a: float,
    premium_b: float,
    threshold: float = 1.5,
    cost_estimate: float = TOTAL_COST_ESTIMATE,
) -> dict | None:
    """
    Detect pair arbitrage signals between two QDII funds tracking the same index.

    Returns signal if |premium_A - premium_B| > threshold.
    """
    diff = abs(premium_a - premium_b - cost_estimate)

    if diff <= threshold:
        return None

    net_spread = diff - cost_estimate

    return {
        "type": "PAIR",
        "premium_rate": diff,
        "net_spread": net_spread,
        "cost_estimate": cost_estimate,
        "z_score": None,
        "historical_mean": None,
        "historical_std": None,
    }
```

- [ ] **Step 4: Integrate fetchers and calculators into main.py**

Update `collector/main.py` `fetch_and_process()` function:

```python
import datetime
import redis
import json
from fetchers.sina import fetch_fund_prices
from fetchers.yahoo import fetch_quotes
from fetchers.chinamoney import fetch_cny_rates
from calculators.nav import calculate_realtime_nav, calculate_premium
from calculators.signals import detect_signal
from db import (
    fetch_active_funds, insert_fund_price, insert_exchange_rate,
    insert_index_price, insert_valuation, insert_signal,
    expire_old_signals, get_historical_premiums,
)
from config import REDIS_URL, TOTAL_COST_ESTIMATE

r = redis.from_url(REDIS_URL)

# Category to index symbol mapping
CATEGORY_INDEX_MAP = {
    "US_TECH": "^NDX",
    "US_SP": "^GSPC",
    "US_OIL": "XOP",
    "US_BIO": "XBI",
    "US_CONS": "XLY",
    "US_GENERAL": "AGG",
    "HK_HSI": "^HSI",
    "HK_HSCEI": "^HSCE",
    "HK_TECH": "^HSTECH",
    "JP_NKY": "^N225",
    "EU_DAX": "^GDAXI",
}

CURRENCY_MAP = {
    "USD": "USDCNY",
    "HKD": "HKDCNY",
    "JPY": "JPYCNY",
    "EUR": "EURCNY",
}


def fetch_and_process():
    if not should_run():
        return

    now = datetime.datetime.now()
    logger.info("Starting data collection cycle...")

    try:
        # Step 1: Fetch exchange rates
        rates = fetch_cny_rates()
        for pair, data in rates.items():
            insert_exchange_rate(pair, data["rate"], now, "CHINAMONEY")

        # Step 2: Fetch underlying index prices (Yahoo)
        yahoo_symbols = list(set(CATEGORY_INDEX_MAP.values()))
        index_prices = fetch_quotes(yahoo_symbols)
        for symbol, data in index_prices.items():
            if data.get("price"):
                insert_index_price(symbol, data["price"], now, "YAHOO")

        # Step 3: Get active funds
        funds = fetch_active_funds()

        # Group symbols for Sina batch fetch
        sina_symbols = [f["symbol"] for f in funds]
        fund_prices = fetch_fund_prices(sina_symbols)

        # Step 4: Calculate NAVs and detect signals
        for fund in funds:
            symbol = fund["symbol"]
            if symbol not in fund_prices:
                continue

            price_data = fund_prices[symbol]
            market_price = price_data.get("price")
            if not market_price:
                continue

            # Save market price
            insert_fund_price(
                fund["id"], market_price,
                price_data.get("volume"),
                None,
                "SINA", now,
            )

            # Get underlying index price
            category = fund["category"]
            index_symbol = CATEGORY_INDEX_MAP.get(category)
            index_price = index_prices.get(index_symbol, {}).get("price") if index_symbol else None

            # Get exchange rate
            currency = fund["currency"]
            rate_pair = CURRENCY_MAP.get(currency)
            rate = None
            if rate_pair and rate_pair in rates:
                rate = rates[rate_pair]["rate"]

            if not index_price or not rate:
                continue

            # Calculate realtime NAV
            calibration = fund.get("pair_calibration") or 1.0
            position_adj = fund.get("position_adjust") or 1.0

            realtime_nav = calculate_realtime_nav(
                index_price, rate, calibration, position_adj,
                is_domestic_index=category in ("MIXED",),
            )

            premium = calculate_premium(market_price, realtime_nav)

            # Save valuation
            insert_valuation(
                fund["id"], now,
                official_nav=None,
                fair_nav=None,
                realtime_nav=realtime_nav,
                calibration_factor=calibration,
                premium=premium,
            )

            # Detect signals
            history = get_historical_premiums(fund["id"], days=30)
            history.append(premium)

            signal = detect_signal(premium, history, TOTAL_COST_ESTIMATE)

            if signal:
                # Expire old signals for this fund
                expire_old_signals(fund["id"])

                # Save new signal
                insert_signal(
                    fund["id"], now,
                    signal["type"],
                    signal["premium_rate"],
                    signal["z_score"],
                    signal["historical_mean"],
                    signal["historical_std"],
                    signal["cost_estimate"],
                    signal["net_spread"],
                )

                # Publish to Redis
                r.publish("arbitrage:signals", json.dumps({
                    "fundId": fund["id"],
                    "type": signal["type"],
                    "premiumRate": signal["premium_rate"],
                    "zScore": signal["z_score"],
                    "netSpread": signal["net_spread"],
                    "fundSymbol": fund["symbol"],
                    "fundName": fund["name"],
                    "timestamp": now.isoformat(),
                }, default=str))

                logger.info(
                    f"Signal detected: {fund['symbol']} {signal['type']} "
                    f"premium={signal['premium_rate']:.2f}% z={signal['z_score']:.1f}"
                )

            # Publish price update
            r.publish("arbitrage:prices", json.dumps({
                "fundId": fund["id"],
                "marketPrice": market_price,
                "realtimeNAV": realtime_nav,
                "premium": premium,
                "timestamp": now.isoformat(),
            }, default=str))

        logger.info(f"Cycle complete. Processed {len(funds)} funds.")

    except Exception as e:
        logger.error(f"Data collection failed: {e}", exc_info=True)
```

- [ ] **Step 5: Commit**

```bash
git add collector/
git commit -m "feat: add NAV calculator and signal detection logic"
```

---

## Phase 9: Feishu Notification

### Task 9.1: Feishu bot webhook sender

**Files:**
- Create: `lib/feishu.ts`
- Create: `app/api/notify/route.ts`

- [ ] **Step 1: Write Feishu sender**

Write `lib/feishu.ts`:

```typescript
export async function sendFeishuNotification(
  webhookUrl: string,
  content: {
    title: string;
    text: string;
  },
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: { content: content.title, tag: "plain_text" },
            template: "red",
          },
          elements: [
            {
              tag: "div",
              text: { content: content.text, tag: "plain_text" },
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      console.error(`Feishu webhook failed: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as { StatusCode?: number };
    return data.StatusCode === 0;
  } catch (error) {
    console.error("Feishu notification error:", error);
    return false;
  }
}
```

- [ ] **Step 2: Write notification processing endpoint**

Write `app/api/notify/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendFeishuNotification } from "@/lib/feishu";

export async function POST(request: Request) {
  const { signalId } = await request.json();

  if (!signalId) {
    return NextResponse.json({ error: "Missing signalId" }, { status: 400 });
  }

  const signal = await prisma.arbitrageSignal.findUnique({
    where: { id: signalId },
    include: { fund: { select: { symbol: true, name: true } } },
  });

  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    include: { feishuConfig: true },
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const config = user.feishuConfig;
    if (!config || !config.isActive || !config.webhookUrl) continue;

    const premiumAbs = Math.abs(Number(signal.premiumRate));
    if (premiumAbs < Number(config.threshold)) continue;

    if (signal.type === "PAIR" && !config.notifyPairs) continue;

    const typeLabel =
      signal.type === "PREMIUM"
        ? "溢价套利"
        : signal.type === "DISCOUNT"
          ? "折价套利"
          : "配对套利";

    const title = `${typeLabel}机会: ${signal.fund.symbol}`;
    const text = [
      `基金: ${signal.fund.name} (${signal.fund.symbol})`,
      `溢价率: ${Number(signal.premiumRate) >= 0 ? "+" : ""}${Number(signal.premiumRate).toFixed(2)}%`,
      `Z-score: ${signal.zScore ? Number(signal.zScore).toFixed(1) : "--"}`,
      `净套利空间: ${signal.netSpread ? Number(signal.netSpread).toFixed(2) + "%" : "--"}`,
      `时间: ${new Date(signal.timestamp).toLocaleString("zh-CN")}`,
    ].join("\n");

    const success = await sendFeishuNotification(config.webhookUrl, {
      title,
      text,
    });

    await prisma.notification.create({
      data: {
        signalId: signal.id,
        userId: user.id,
        channel: "FEISHU",
        content: text,
        status: success ? "SENT" : "FAILED",
        sentAt: success ? new Date() : null,
      },
    });

    if (success) sent++;
    else failed++;
  }

  return NextResponse.json({ sent, failed });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/feishu.ts app/api/notify/
git commit -m "feat: add Feishu bot webhook notification"
```

---

## Phase 10: Seed Data & Documentation

### Task 10.1: Seed QDII funds

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write seed script**

Write `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    const created = await prisma.fund.upsert({
      where: { symbol: fund.symbol },
      update: fund,
      create: fund,
    });

    // Create FundPair for each fund
    if (fund.pairIndex) {
      await prisma.fundPair.upsert({
        where: { id: `${created.id}-pair` },
        update: {
          fundId: created.id,
          pairIndex: fund.pairIndex,
          calibrationFactor: 1.0,
          positionAdjust: 1.0,
        },
        create: {
          id: `${created.id}-pair`,
          fundId: created.id,
          pairIndex: fund.pairIndex,
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
```

- [ ] **Step 2: Add seed config to package.json**

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Run seed**

```bash
npm install -D tsx
npx prisma db seed
```

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add QDII fund seed data with pair configurations"
```

---

## Phase 11: Final Integration & Polish

### Task 11.1: Error boundaries and final wiring

**Files:**
- Create: `app/(dashboard)/error.tsx`
- Create: `app/(auth)/error.tsx`

- [ ] **Step 1: Write dashboard error boundary**

Write `app/(dashboard)/error.tsx`:

```typescript
"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">
        页面加载出错
      </h2>
      <p className="text-slate-500 mb-4 text-sm">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
      >
        重试
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write auth error boundary (same structure)**

- [ ] **Step 3: Update middleware for route protection**

Create `middleware.ts`:

```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/funds/:path*", "/arbitrage", "/history", "/settings/:path*"],
};
```

- [ ] **Step 4: Final commit**

```bash
git add app/\(dashboard\)/error.tsx app/\(auth\)/error.tsx middleware.ts
git commit -m "feat: add error boundaries and route protection middleware"
```

---

### Task 11.2: Testing setup and critical tests

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/funds/calculators.test.ts`
- Create: `tests/arbitrage/SignalBadge.test.tsx`
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Write Vitest config**

Write `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 2: Write test setup**

Write `tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Write NAV calculation unit test**

Write `tests/funds/calculators.test.ts`:

```typescript
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
```

- [ ] **Step 4: Write SignalBadge component test**

Write `tests/arbitrage/SignalBadge.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalBadge } from "@/components/arbitrage/SignalBadge";

describe("SignalBadge", () => {
  it("renders premium signal with red styling", () => {
    render(<SignalBadge type="PREMIUM" zScore={2.5} />);
    const badge = screen.getByText("溢价");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText("Z:2.5")).toBeInTheDocument();
  });

  it("renders discount signal with green styling", () => {
    render(<SignalBadge type="DISCOUNT" zScore={-2.5} />);
    expect(screen.getByText("折价")).toBeInTheDocument();
  });

  it("renders pair signal", () => {
    render(<SignalBadge type="PAIR" />);
    expect(screen.getByText("配对")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Write Playwright E2E test**

Write `tests/e2e/auth.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("login page renders correctly", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await expect(page.getByRole("heading", { name: "QDII 套利监控" })).toBeVisible();
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});

test("homepage shows fund overview", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await expect(page.locator("text=QDII 基金套利监控")).toBeVisible();
  await expect(page.locator("text=登录查看完整数据")).toBeVisible();
});

test("unauthenticated redirect to login", async ({ page }) => {
  await page.goto("http://localhost:3000/funds");
  await page.waitForURL("**/login");
});
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run
npx playwright test
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/
git commit -m "test: add unit, component, and E2E tests"
```

**Total: ~35 tasks across 11 phases**

| Phase | Tasks | Description |
|---|---|---|
| 0 | 0.1-0.2 | Project scaffolding, Prisma setup |
| 1 | 1.1-1.2 | Authentication (NextAuth + login/register) |
| 2 | 2.1-2.2 | Layout, sidebar, navigation |
| 3 | 3.1-3.3 | tRPC setup, fund list, fund detail |
| 4 | 4.1 | Arbitrage opportunity panel |
| 5 | 5.1-5.2 | History charts, settings, admin |
| 6 | 6.1 | Real-time SSE + Redis Pub/Sub |
| 7 | 7.1 | Public dashboard homepage |
| 8 | 8.1-8.3 | Python collector (fetchers + calculators + signals) |
| 9 | 9.1 | Feishu bot notification |
| 10 | 10.1 | Seed data |
| 11 | 11.1 | Error boundaries, middleware |

**Execution order**: Phases must run sequentially (each builds on prior). Within a phase, tasks run sequentially.
