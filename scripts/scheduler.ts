import { runSchedulerTick } from "@/lib/services/scheduler";

const TICK_INTERVAL_MS = 60_000;

async function tick() {
  try {
    const { enqueued } = await runSchedulerTick();
    if (enqueued > 0) {
      console.log(`[scheduler] enqueued ${enqueued} notification job(s)`);
    }
  } catch (err) {
    console.error("[scheduler] tick failed", err);
  }
}

console.log("Scheduler started (interval: 60s)");
tick();
const interval = setInterval(tick, TICK_INTERVAL_MS);

function shutdown() {
  console.log("Shutting down scheduler...");
  clearInterval(interval);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
