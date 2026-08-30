import { pollTelegramUpdates } from "@/lib/services/telegram-poller";
import { setTelegramCommands } from "@/lib/notifications/telegram-bot";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is not configured");
}

let offset = 0;
let running = true;

async function loop() {
  console.log("Telegram poller started");
  await setTelegramCommands();
  while (running) {
    try {
      const { nextOffset } = await pollTelegramUpdates(botToken!, offset);
      offset = nextOffset;
    } catch (err) {
      console.error("[telegram-poller] error", err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

loop();

function shutdown() {
  console.log("Shutting down Telegram poller...");
  running = false;
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
