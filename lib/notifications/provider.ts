export type NotificationMessage = {
  /** Telegram chat ID (numeric string) — get it from @userinfobot after messaging your bot. */
  to: string;
  templateData: {
    taskTitle: string;
    durationMinutes: number;
    /** Scheduled time formatted in the recipient's local timezone, e.g. "08:30" */
    scheduledTime: string;
  };
};

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<{ providerMessageId: string }>;
}
