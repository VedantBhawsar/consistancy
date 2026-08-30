import type { NotificationMessage } from "./provider";

export function reminderText({
  taskTitle,
  durationMinutes,
  scheduledTime,
}: NotificationMessage["templateData"]): string {
  return [
    `⏰ ${taskTitle}`,
    "",
    `Your scheduled task is starting at ${scheduledTime}.`,
    "",
    "Task:",
    taskTitle,
    "",
    "Duration:",
    `${durationMinutes} minutes`,
    "",
    "Reply:",
    "DONE",
    "SKIP",
  ].join("\n");
}
