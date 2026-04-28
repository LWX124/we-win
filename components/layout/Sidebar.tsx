"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/funds", label: "基金列表", icon: "💰" },
  { href: "/arbitrage", label: "套利机会", icon: "🎯" },
  { href: "/history", label: "历史分析", icon: "📈" },
  { href: "/reconciliation", label: "数据校对", icon: "🔍" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] shrink-0 bg-white border-r border-[#ebedf1] flex flex-col px-4 py-6 gap-2">
      <Link href="/" className="text-[20px] font-bold text-[#2563eb] mb-4">
        QDII Arbitrage
      </Link>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 h-10 rounded-lg text-[14px] transition-colors ${
                isActive
                  ? "bg-[#eff2fe] text-[#1d58d6] font-semibold"
                  : "text-[#4c5568] font-medium hover:bg-[#f1f3f6]"
              }`}
            >
              <span className="text-[16px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
