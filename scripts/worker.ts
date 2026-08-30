import { startNotificationWorker } from "@/lib/queue/notification-worker";

const worker = startNotificationWorker();

console.log("Notification worker started");

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("error", (err) => {
  console.error("[worker] error", err);
});

async function shutdown() {
  console.log("Shutting down notification worker...");
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
