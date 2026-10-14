/**
 * Raw Telegram Bot API helpers for interactive, non-reminder traffic: command
 * replies, digests, and callback-query acknowledgements. Deliberately
 * separate from TelegramProvider (lib/notifications/telegram-provider.ts),
 * which sends the queued/retried reminder messages — these calls are
 * best-effort and never thrown from a queue job, so a delivery failure here
 * just logs instead of triggering BullMQ retries.
 */

type InlineKeyboard = { text: string; callback_data: string }[][];

function botToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramText(
  chatId: string,
  text: string,
  inlineKeyboard?: InlineKeyboard
): Promise<void> {
  const token = botToken();
  if (!token) {
    console.log(`[telegram:mock] -> ${chatId}\n${text}\n`);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error(`[telegram] sendMessage failed (${res.status})`, data);
    }
  } catch (err) {
    console.error("[telegram] sendMessage error", err);
  }
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const token = botToken();
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("[telegram] answerCallbackQuery error", err);
  }
}

/** Registers the bot's slash-command menu (BotFather-style autocomplete). Safe to call on every startup or settings save. */
export async function setTelegramCommands(): Promise<{ success: boolean; error?: string }> {
  const token = botToken();
  if (!token) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const commands = [
    { command: "today", description: "Show today's full schedule" },
    { command: "status", description: "Today's progress and streak" },
    { command: "next", description: "Show your next pending task" },
    { command: "done", description: "Mark your next pending task done" },
    { command: "skip", description: "Skip your next pending task" },
    { command: "snooze", description: "Delay the next reminder, e.g. /snooze 10" },
    { command: "tasks", description: "List your active recurring tasks" },
    { command: "newtask", description: "Create a task, see /help for format" },
    { command: "help", description: "List all commands" },
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error(`[telegram] setMyCommands failed (${res.status})`, data);
      return {
        success: false,
        error: data?.description || `Telegram API error (${res.status})`,
      };
    }
    return { success: true };
  } catch (err) {
    console.error("[telegram] setMyCommands error", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
