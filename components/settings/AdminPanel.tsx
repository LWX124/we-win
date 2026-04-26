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
