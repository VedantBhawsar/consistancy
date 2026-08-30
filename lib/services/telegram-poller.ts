import { handleInboundCommand } from "./telegram-inbound";

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat?: { id?: number };
    text?: string;
  };
};

/**
 * Long-polling alternative to the Telegram webhook — no public URL, TLS
 * certificate, or domain required, so it works from a bare-IP VPS. Blocks
 * for up to `timeoutSeconds` waiting for new updates, then returns
 * immediately once any arrive.
 */
export async function pollTelegramUpdates(
  botToken: string,
  offset: number,
  timeoutSeconds = 30
): Promise<{ nextOffset: number }> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=${timeoutSeconds}`,
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

    const chatId = update.message?.chat?.id;
    const text = update.message?.text;
    if (chatId === undefined || !text) continue;

    try {
      await handleInboundCommand(String(chatId), text);
    } catch (err) {
      console.error("Failed to handle inbound Telegram command", err);
    }
  }

  return { nextOffset };
}
