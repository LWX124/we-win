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
