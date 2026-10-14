"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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

export function TodayList({
  occurrences,
  timezone,
}: {
  occurrences: TodayOccurrence[];
  timezone: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    taskTitle: string;
    commendation: string;
    completed: number;
    total: number;
    streak: number;
  } | null>(null);
  const now = useNow();

  const nextPendingId = occurrences.find((o) => o.status === "PENDING")?.id;

  async function act(taskId: string, occurrenceId: string, action: "complete" | "skip") {
    setPending(occurrenceId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId }),
      });
      if (res.ok && action === "complete") {
        const data = await res.json().catch(() => null);
        if (data?.commendation) {
          setFeedback({
            taskTitle: data.taskTitle || "Task",
            commendation: data.commendation,
            completed: data.progress?.completed,
            total: data.progress?.total,
            streak: data.streaks?.currentStreak,
          });
        }
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  if (occurrences.length === 0) {
    return (
      <Card className="border-dashed p-10 text-center text-sm text-muted-foreground">
        Nothing scheduled today.{" "}
        <a href="/tasks" className="font-medium text-foreground underline underline-offset-4 hover:opacity-80">
          Build your routine
        </a>{" "}
        to see it here.
      </Card>
    );
  }

  return (
    <div className="flex flex-col">
      {feedback && (
        <Alert className="mb-6 border-primary/40 bg-primary/5 text-foreground">
          <Sparkles className="size-4 text-primary" />
          <div className="flex flex-1 items-start justify-between">
            <div>
              <AlertTitle className="text-sm font-semibold">
                Marked &ldquo;{feedback.taskTitle}&rdquo; done!
              </AlertTitle>
              <AlertDescription className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{feedback.commendation}</span> · Today:{" "}
                {feedback.completed}/{feedback.total} tasks completed · 🔥 Current streak:{" "}
                {feedback.streak} {feedback.streak === 1 ? "day" : "days"}
              </AlertDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setFeedback(null)}
              aria-label="Close feedback"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </Alert>
      )}

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
                  className="absolute left-[27px] top-7 bottom-0 w-px bg-border"
                  aria-hidden
                />
              )}

              <div className="flex w-14 shrink-0 flex-col items-end pt-1">
                <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                  {formatTimeInTz(occurrence.scheduledAt, timezone)}
                </span>
              </div>

              <span
                className={`relative top-2 size-3 shrink-0 rounded-full border-2 bg-background transition-colors ${
                  occurrence.status === "COMPLETED"
                    ? "border-emerald-600 bg-emerald-600"
                    : occurrence.status === "MISSED"
                      ? "border-destructive bg-destructive"
                      : isActiveNow
                        ? "border-primary bg-primary animate-pulse"
                        : "border-border"
                }`}
                aria-hidden
              />

              <div
                className={`flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 transition-colors ${
                  isActiveNow
                    ? "border-primary bg-primary/5"
                    : isNext
                      ? "border-border bg-card shadow-xs"
                      : "border-transparent bg-muted/20"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate text-sm font-medium ${
                        occurrence.status === "MISSED" || occurrence.status === "SKIPPED"
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {occurrence.title}
                    </p>
                    {isActiveNow && (
                      <Badge variant="default" className="text-[10px]">
                        Active Now
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {categoryLabel(occurrence.category)} · {occurrence.durationMinutes} min
                  </p>
                </div>

                {occurrence.status === "PENDING" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending === occurrence.id}
                      onClick={() => act(occurrence.taskId, occurrence.id, "skip")}
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      disabled={pending === occurrence.id}
                      onClick={() => act(occurrence.taskId, occurrence.id, "complete")}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <div className="shrink-0">
                    {occurrence.status === "COMPLETED" && (
                      <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        <span>Done</span>
                      </Badge>
                    )}
                    {occurrence.status === "MISSED" && (
                      <Badge variant="destructive">Missed</Badge>
                    )}
                    {occurrence.status === "SKIPPED" && (
                      <Badge variant="outline">Skipped</Badge>
                    )}
                    {occurrence.status === "CANCELLED" && (
                      <Badge variant="secondary">Cancelled</Badge>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
