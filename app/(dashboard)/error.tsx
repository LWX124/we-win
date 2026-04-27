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
