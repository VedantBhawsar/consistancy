export const CATEGORIES = [
  "WORK",
  "DSA",
  "SYSTEM_DESIGN",
  "JOB_SEARCH",
  "GYM",
  "COMMUNICATION",
  "PROJECT",
  "PERSONAL",
] as const;

export const TIMEZONES_HINT = "IANA timezone, e.g. Asia/Kolkata";

/** Grace period (minutes) after scheduled time before a pending occurrence is marked MISSED. */
export const MISSED_GRACE_PERIOD_MINUTES = 30;

/** How many days ahead the occurrence generator materializes recurring tasks. */
export const OCCURRENCE_GENERATION_WINDOW_DAYS = 14;
