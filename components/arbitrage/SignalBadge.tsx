const config: Record<string, { label: string; bg: string; text: string }> = {
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
  const { label, bg, text } = config[type] || config.PREMIUM;
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
