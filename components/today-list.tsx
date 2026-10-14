"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { formatTimeInTz, categoryLabel } from "@/lib/utils/format";
import { useNow } from "@/lib/hooks/use-now";
import { cn } from "@/lib/utils";

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

      <ul className="flex flex-col gap-3">
        {occurrences.map((occurrence) => {
          const scheduledMs = occurrence.scheduledAt.getTime();
          const isActiveNow =
            occurrence.status === "PENDING" &&
            now >= scheduledMs &&
            now <= scheduledMs + occurrence.durationMinutes * 60_000;
          const isNext = !isActiveNow && occurrence.id === nextPendingId;

          return (
            <li key={occurrence.id}>
              <Card
                className={cn(
                  "transition-all",
                  isActiveNow && "border-primary ring-1 ring-primary/20 bg-primary/5 shadow-xs",
                  isNext && "border-border bg-card shadow-xs",
                  occurrence.status === "COMPLETED" && "bg-card/70 border-border/70",
                  occurrence.status === "MISSED" && "bg-card border-border shadow-xs",
                  occurrence.status === "SKIPPED" && "bg-muted/20 border-border/60 opacity-80"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Status indicator dot */}
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          occurrence.status === "COMPLETED" && "bg-emerald-600 dark:bg-emerald-400",
                          occurrence.status === "MISSED" && "bg-destructive",
                          isActiveNow && "bg-primary animate-pulse ring-4 ring-primary/20",
                          occurrence.status === "PENDING" && !isActiveNow && "bg-muted-foreground/40",
                          occurrence.status === "SKIPPED" && "bg-muted-foreground/30",
                          occurrence.status === "CANCELLED" && "bg-muted-foreground/30"
                        )}
                        aria-hidden
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatTimeInTz(occurrence.scheduledAt, timezone)}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {occurrence.title}
                          </span>
                          {isActiveNow && (
                            <Badge variant="default" className="text-[10px]">
                              Active Now
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {categoryLabel(occurrence.category)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {occurrence.durationMinutes} min
                        </p>
                      </div>
                    </div>

                    {/* Actions / Status badge */}
                    <div className="flex shrink-0 items-center gap-2">
                      {occurrence.status === "PENDING" ? (
                        <>
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
                        </>
                      ) : (
                        <div className="flex items-center">
                          {occurrence.status === "COMPLETED" && (
                            <Badge variant="secondary" className="gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="size-3" />
                              <span>Done</span>
                            </Badge>
                          )}
                          {occurrence.status === "MISSED" && (
                            <Badge variant="destructive" className="font-medium">
                              Missed
                            </Badge>
                          )}
                          {occurrence.status === "SKIPPED" && (
                            <Badge variant="outline" className="font-medium text-muted-foreground">
                              Skipped
                            </Badge>
                          )}
                          {occurrence.status === "CANCELLED" && (
                            <Badge variant="secondary" className="font-medium">
                              Cancelled
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
