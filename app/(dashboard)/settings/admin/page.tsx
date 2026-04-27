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
