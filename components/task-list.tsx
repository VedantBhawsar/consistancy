"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskForm, type TaskFormValues } from "./task-form";
import { categoryLabel } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  scheduledTime: string;
  durationMinutes: number;
  recurrenceRule: { type: string; daysOfWeek: number[] };
  notificationPreferences: { channel: "TELEGRAM"; remindBeforeMinutes: number[] };
  isActive: boolean;
};

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Every day",
  WEEKDAYS: "Weekdays",
  WEEKENDS: "Weekends",
  SPECIFIC_DAYS: "Specific days",
  WEEKLY: "Weekly",
  CUSTOM: "Custom",
};

function toFormValues(task: TaskRow): TaskFormValues {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    scheduledTime: task.scheduledTime.slice(0, 5),
    durationMinutes: task.durationMinutes,
    recurrenceType: task.recurrenceRule.type,
    daysOfWeek: task.recurrenceRule.daysOfWeek,
    remindBeforeMinutes: task.notificationPreferences.remindBeforeMinutes,
    isActive: task.isActive,
  };
}

export function TaskList({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this task from your routine?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
        No tasks yet — add your first one above.
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tasks
        .slice()
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
        .map((task) => (
          <li key={task.id}>
            <Card className={!task.isActive ? "opacity-75" : ""}>
              <CardContent className="p-4">
                {editingId === task.id ? (
                  <TaskForm
                    initialValues={toFormValues(task)}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {task.scheduledTime.slice(0, 5)}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            !task.isActive ? "text-muted-foreground line-through" : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </span>
                        {!task.isActive && (
                          <Badge variant="outline" className="text-[10px]">
                            Paused
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryLabel(task.category)}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {task.durationMinutes} min · {RECURRENCE_LABELS[task.recurrenceRule.type]}
                        {task.description ? ` · ${task.description}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditingId(task.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={deletingId === task.id}
                        onClick={() => handleDelete(task.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
    </ul>
  );
}
