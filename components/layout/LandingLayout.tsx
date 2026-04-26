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
