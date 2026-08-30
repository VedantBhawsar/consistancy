export function formatTimeInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Winding down";
}

export function categoryLabel(category: string): string {
  return category
    .split("_")
    .map((word) => word[0] + word.slice(1).toLowerCase())
    .join(" ");
}

const PROGRESS_BAR_WIDTH = 20;

export function asciiProgressBar(percent: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * PROGRESS_BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(PROGRESS_BAR_WIDTH - filled);
}
