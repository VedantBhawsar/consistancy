import { randomUUID } from "crypto";
import type { NotificationMessage, NotificationProvider } from "./provider";
import { reminderText } from "./templates";

/**
 * Fallback used automatically when Telegram credentials aren't configured
 * yet, so the full scheduler -> queue -> worker -> log pipeline is testable
 * end-to-end before real credentials are added. Swap happens transparently
 * via getNotificationProvider() once TELEGRAM_BOT_TOKEN is set — no other
 * code needs to change.
 */
export class ConsoleNotificationProvider implements NotificationProvider {
  async send(
    message: NotificationMessage
  ): Promise<{ providerMessageId: string }> {
    console.log(
      `[telegram:mock] -> ${message.to}\n${reminderText(message.templateData)}\n`
    );
    return { providerMessageId: `mock-${randomUUID()}` };
  }
}
