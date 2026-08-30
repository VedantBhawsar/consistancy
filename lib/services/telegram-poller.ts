import { handleInboundCommand, handleCallbackQuery } from "./telegram-inbound";
import { answerTelegramCallback, sendTelegramText } from "@/lib/notifications/telegram-bot";

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat?: { id?: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat?: { id?: number } };
  };
};

/**
 * Long-polling alternative to the Telegram webhook — no public URL, TLS
 * certificate, or domain required, so it works from a bare-IP VPS. Blocks
 * for up to `timeoutSeconds` waiting for new updates, then returns
 * immediately once any arrive. Every message and button press gets a reply —
 * nothing is handled silently.
 */
export async function pollTelegramUpdates(
  botToken: string,
  offset: number,
  timeoutSeconds = 30
): Promise<{ nextOffset: number }> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=${timeoutSeconds}&allowed_updates=${encodeURIComponent(
      JSON.stringify(["message", "callback_query"])
    )}`,
    { signal: AbortSignal.timeout((timeoutSeconds + 10) * 1000) }
  );

  const data = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: TelegramUpdate[];
  };

  if (!res.ok || !data.ok) {
    throw new Error(`Telegram getUpdates error (${res.status}): ${data.description ?? "unknown error"}`);
  }

  let nextOffset = offset;

  for (const update of data.result ?? []) {
    nextOffset = update.update_id + 1;

    if (update.callback_query) {
      const chatId = update.callback_query.message?.chat?.id;
      const cbData = update.callback_query.data;
      if (chatId === undefined || !cbData) continue;

      try {
        const reply = await handleCallbackQuery(String(chatId), cbData);
        await answerTelegramCallback(update.callback_query.id);
        await sendTelegramText(String(chatId), reply);
      } catch (err) {
        console.error("Failed to handle Telegram callback query", err);
        await answerTelegramCallback(update.callback_query.id, "Something went wrong.");
      }
      continue;
    }

    const chatId = update.message?.chat?.id;
    const text = update.message?.text;
    if (chatId === undefined || !text) continue;

    try {
      const reply = await handleInboundCommand(String(chatId), text);
      await sendTelegramText(String(chatId), reply);
    } catch (err) {
      console.error("Failed to handle inbound Telegram command", err);
      await sendTelegramText(String(chatId), "Something went wrong handling that — please try again.");
    }
  }

  return { nextOffset };
}
