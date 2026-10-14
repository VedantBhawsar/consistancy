import type { NotificationMessage, NotificationProvider } from "./provider";
import { reminderText } from "./templates";

/**
 * Telegram Bot API. Free, no per-message cost, no business verification —
 * create a bot via @BotFather to get a token. The recipient must have
 * started a chat with the bot at least once before it can message them.
 * https://core.telegram.org/bots/api#sendmessage
 */
export class TelegramProvider implements NotificationProvider {
  private botToken = process.env.TELEGRAM_BOT_TOKEN;

  async send(
    message: NotificationMessage
  ): Promise<{ providerMessageId: string }> {
    if (!this.botToken) {
      throw new Error("Telegram credentials are not configured (TELEGRAM_BOT_TOKEN)");
    }

    const res = await fetch(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.to,
          text: reminderText(message.templateData),
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Done", callback_data: `done:${message.templateData.occurrenceId}` },
                { text: "❌ Reject", callback_data: `reject:${message.templateData.occurrenceId}` },
                { text: "⏰ Snooze 10m", callback_data: `snooze:${message.templateData.occurrenceId}` },
              ],
            ],
          },
        }),
      }
    );

    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };

    if (!res.ok || !data.ok || data.result?.message_id === undefined) {
      throw new Error(`Telegram API error (${res.status}): ${data.description ?? "unknown error"}`);
    }

    return { providerMessageId: String(data.result.message_id) };
  }
}
