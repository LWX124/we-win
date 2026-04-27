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
