"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatTimeInTz, categoryLabel } from "@/lib/utils/format";
import { useNow } from "@/lib/hooks/use-now";

export type TodayOccurrence = {
  id: string;
  taskId: string;
  scheduledAt: Date;
  status: string;
  completedAt: Date | null;
  title: string;
  category: string;
  priority: string;
  durationMinutes: number;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "border-[var(--rule)]",
  COMPLETED: "border-[var(--success)]",
  MISSED: "border-[var(--danger)]",
  SKIPPED: "border-[var(--rule)]",
  CANCELLED: "border-[var(--rule)]",
};

export function TodayList({
  occurrences,
  timezone,
}: {
  occurrences: TodayOccurrence[];
  timezone: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const now = useNow();

  const nextPendingId = occurrences.find((o) => o.status === "PENDING")?.id;

  async function act(taskId: string, occurrenceId: string, action: "complete" | "skip") {
    setPending(occurrenceId);
    try {
      await fetch(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (occurrences.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--rule)] px-6 py-10 text-center text-sm text-[var(--ink-muted)]">
        Nothing scheduled today.{" "}
        <a href="/tasks" className="underline decoration-[var(--rule)] underline-offset-4">
          Build your routine
        </a>{" "}
        to see it here.
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col">
      {occurrences.map((occurrence, i) => {
        const scheduledMs = occurrence.scheduledAt.getTime();
        const isActiveNow =
          occurrence.status === "PENDING" &&
          now >= scheduledMs &&
          now <= scheduledMs + occurrence.durationMinutes * 60_000;
        const isNext = !isActiveNow && occurrence.id === nextPendingId;
        const isLast = i === occurrences.length - 1;

        return (
          <li key={occurrence.id} className="relative flex gap-4 pb-6">
            {!isLast && (
              <span
                className="absolute left-[27px] top-7 bottom-0 w-px bg-[var(--rule)]"
                aria-hidden
              />
            )}

            <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
              <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--brass)]">
                {formatTimeInTz(occurrence.scheduledAt, timezone)}
              </span>
            </div>

            <span
              className={`relative top-1.5 h-3 w-3 shrink-0 rounded-full border-2 bg-[var(--bg)] ${
                STATUS_STYLES[occurrence.status]
              } ${isActiveNow ? "bg-[var(--brass)]" : ""}`}
              aria-hidden
            />

            <div
              className={`flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border px-4 py-3 ${
                isActiveNow
                  ? "border-[var(--brass)] bg-[var(--brass-soft)]"
                  : isNext
                    ? "border-[var(--rule)] bg-[var(--bg-elevated)]"
                    : "border-transparent"
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-medium ${
                    occurrence.status === "MISSED" || occurrence.status === "SKIPPED"
                      ? "text-[var(--ink-muted)] line-through decoration-[var(--rule)]"
                      : ""
                  }`}
                >
                  {occurrence.title}
                </p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {categoryLabel(occurrence.category)} · {occurrence.durationMinutes} min
                </p>
              </div>

              {occurrence.status === "PENDING" ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={pending === occurrence.id}
                    onClick={() => act(occurrence.taskId, occurrence.id, "skip")}
                    className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    disabled={pending === occurrence.id}
                    onClick={() => act(occurrence.taskId, occurrence.id, "complete")}
                    className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] transition-opacity disabled:opacity-50"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <span
                  className={`shrink-0 text-xs font-medium ${
                    occurrence.status === "COMPLETED"
                      ? "text-[var(--success)]"
                      : occurrence.status === "MISSED"
                        ? "text-[var(--danger)]"
                        : "text-[var(--ink-muted)]"
                  }`}
                >
                  {occurrence.status === "COMPLETED" && "✓ Done"}
                  {occurrence.status === "MISSED" && "Missed"}
                  {occurrence.status === "SKIPPED" && "Skipped"}
                  {occurrence.status === "CANCELLED" && "Cancelled"}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
