export async function sendFeishuNotification(
  webhookUrl: string,
  content: {
    title: string;
    text: string;
  },
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: { content: content.title, tag: "plain_text" },
            template: "red",
          },
          elements: [
            {
              tag: "div",
              text: { content: content.text, tag: "plain_text" },
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      console.error(`Feishu webhook failed: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as { StatusCode?: number };
    return data.StatusCode === 0;
  } catch (error) {
    console.error("Feishu notification error:", error);
    return false;
  }
}
