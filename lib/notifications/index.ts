import type { NotificationProvider } from "./provider";
import { TelegramProvider } from "./telegram-provider";
import { ConsoleNotificationProvider } from "./console-provider";

export type { NotificationMessage, NotificationProvider } from "./provider";

let cached: NotificationProvider | undefined;

export function getNotificationProvider(): NotificationProvider {
  if (cached) return cached;

  cached = process.env.TELEGRAM_BOT_TOKEN
    ? new TelegramProvider()
    : new ConsoleNotificationProvider();

  return cached;
}
