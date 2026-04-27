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
