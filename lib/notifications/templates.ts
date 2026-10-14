import type { NotificationMessage } from "./provider";

export function reminderText({
  taskTitle,
  durationMinutes,
  scheduledTime,
}: NotificationMessage["templateData"]): string {
  return [
    `⏰ ${taskTitle}`,
    "",
    `Your scheduled task starts at ${scheduledTime} (${durationMinutes} mins).`,
    "",
    "Choose an option below or reply with Done / Reject:",
  ].join("\n");
}
