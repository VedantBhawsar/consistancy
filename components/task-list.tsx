"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskForm, type TaskFormValues } from "./task-form";
import { categoryLabel } from "@/lib/utils/format";

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
      <p className="text-sm text-[var(--ink-muted)]">
        No tasks yet — add your first one above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tasks
        .slice()
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
        .map((task) => (
          <li
            key={task.id}
            className="rounded-lg border border-[var(--rule)] bg-[var(--bg-elevated)] p-4"
          >
            {editingId === task.id ? (
              <TaskForm
                initialValues={toFormValues(task)}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--brass)]">
                      {task.scheduledTime.slice(0, 5)}
                    </span>
                    <span className={`text-sm font-medium ${!task.isActive ? "text-[var(--ink-muted)]" : ""}`}>
                      {task.title}
                    </span>
                    {!task.isActive && (
                      <span className="rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    {categoryLabel(task.category)} · {task.durationMinutes} min ·{" "}
                    {RECURRENCE_LABELS[task.recurrenceRule.type]}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <button
                    onClick={() => setEditingId(task.id)}
                    className="text-[var(--ink-muted)] underline decoration-[var(--rule)] underline-offset-4 hover:text-[var(--ink)]"
                  >
                    Edit
                  </button>
                  <button
                    disabled={deletingId === task.id}
                    onClick={() => handleDelete(task.id)}
                    className="text-[var(--danger)] underline decoration-[var(--danger-soft)] underline-offset-4 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
    </ul>
  );
}
