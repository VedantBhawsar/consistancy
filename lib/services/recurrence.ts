import type { RecurrenceRule } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";

export type RecurrenceInput = {
  type: RecurrenceRule["type"];
  daysOfWeek?: number[];
};

function dedupeSortDays(days: number[]): number[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/**
 * Resolves a user-supplied recurrence input into a canonical RecurrenceRule
 * where `daysOfWeek` is always the source of truth for occurrence generation.
 */
export function normalizeRecurrenceRule(input: RecurrenceInput): RecurrenceRule {
  switch (input.type) {
    case "DAILY":
      return { type: "DAILY", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
    case "WEEKDAYS":
      return { type: "WEEKDAYS", daysOfWeek: [1, 2, 3, 4, 5] };
    case "WEEKENDS":
      return { type: "WEEKENDS", daysOfWeek: [0, 6] };
    case "WEEKLY": {
      const days = dedupeSortDays(input.daysOfWeek ?? []);
      if (days.length !== 1) {
        throw new AppError("WEEKLY recurrence requires exactly one day of week");
      }
      return { type: "WEEKLY", daysOfWeek: days };
    }
    case "SPECIFIC_DAYS":
    case "CUSTOM": {
      const days = dedupeSortDays(input.daysOfWeek ?? []);
      if (days.length === 0) {
        throw new AppError(`${input.type} recurrence requires at least one day of week`);
      }
      return { type: input.type, daysOfWeek: days };
    }
    default:
      throw new AppError("Unknown recurrence type");
  }
}
