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
