import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const NOTIFICATION_QUEUE_NAME = "notifications";

export type NotificationJobData = {
  notificationJobId: string;
};

/**
 * Retry policy per spec section 18: attempt 1 -> wait 30s -> attempt 2 ->
 * wait 2min -> attempt 3 -> dead letter. The 30s/2min delays are implemented
 * by the worker's `backoffStrategy` (see notification-worker.ts).
 */
export const notificationQueue = new Queue<NotificationJobData>(
  NOTIFICATION_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "custom" },
      removeOnComplete: 1000,
      removeOnFail: false,
    },
  }
);
