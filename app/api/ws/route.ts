import { subRedis } from "@/lib/redis";

subRedis.subscribe("arbitrage:signals", "arbitrage:prices").catch(console.error);

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let controller: ReadableStreamDefaultController;

  const onMessage = (channel: string, message: string) => {
    if (!closed && controller) {
      const event = `event: ${channel.replace(":", "_")}\ndata: ${message}\n\n`;
      controller.enqueue(encoder.encode(event));
    }
  };

  const keepalive = setInterval(() => {
    if (!closed && controller) {
      controller.enqueue(encoder.encode(": keepalive\n\n"));
    }
  }, 15000);

  subRedis.on("message", onMessage);

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      closed = true;
      clearInterval(keepalive);
      subRedis.off("message", onMessage);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
