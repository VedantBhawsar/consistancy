"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";
import { categoryLabel } from "@/lib/utils/format";

const RECURRENCE_TYPES = [
  { value: "DAILY", label: "Every day" },
  { value: "WEEKDAYS", label: "Weekdays (Mon–Fri)" },
  { value: "WEEKENDS", label: "Weekends (Sat–Sun)" },
  { value: "SPECIFIC_DAYS", label: "Specific days" },
  { value: "WEEKLY", label: "Weekly (one day)" },
  { value: "CUSTOM", label: "Custom days" },
] as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const REMINDER_OPTIONS = [
  { value: 0, label: "At scheduled time" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 30, label: "30 min before" },
];

export type TaskFormValues = {
  id?: string;
  title: string;
  description?: string | null;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  scheduledTime: string;
  durationMinutes: number;
  recurrenceType: string;
  daysOfWeek: number[];
  remindBeforeMinutes: number[];
  isActive: boolean;
};

const DEFAULT_VALUES: TaskFormValues = {
  title: "",
  description: "",
  category: CATEGORIES[0],
  priority: "MEDIUM",
  scheduledTime: "08:00",
  durationMinutes: 30,
  recurrenceType: "DAILY",
  daysOfWeek: [],
  remindBeforeMinutes: [0],
  isActive: true,
};

export function TaskForm({
  initialValues,
  onDone,
}: {
  initialValues?: TaskFormValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>(
    initialValues ?? DEFAULT_VALUES
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsDayPicker = ["SPECIFIC_DAYS", "WEEKLY", "CUSTOM"].includes(
    values.recurrenceType
  );

  function toggleDay(day: number) {
    setValues((v) => ({
      ...v,
      daysOfWeek: v.daysOfWeek.includes(day)
        ? v.daysOfWeek.filter((d) => d !== day)
        : [...v.daysOfWeek, day],
    }));
  }

  function toggleReminder(minutes: number) {
    setValues((v) => ({
      ...v,
      remindBeforeMinutes: v.remindBeforeMinutes.includes(minutes)
        ? v.remindBeforeMinutes.filter((m) => m !== minutes)
        : [...v.remindBeforeMinutes, minutes].sort((a, b) => a - b),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: values.title,
      description: values.description || null,
      category: values.category,
      priority: values.priority,
      scheduledTime: values.scheduledTime,
      durationMinutes: values.durationMinutes,
      recurrence: {
        type: values.recurrenceType,
        daysOfWeek: needsDayPicker ? values.daysOfWeek : undefined,
      },
      notificationPreferences: {
        channel: "TELEGRAM",
        remindBeforeMinutes:
          values.remindBeforeMinutes.length > 0 ? values.remindBeforeMinutes : [0],
      },
      isActive: values.isActive,
    };

    const res = await fetch(values.id ? `/api/tasks/${values.id}` : "/api/tasks", {
      method: values.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not save task");
      return;
    }

    if (!values.id) setValues(DEFAULT_VALUES);
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Title
          <input
            required
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="DSA Practice"
            className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Description
          <textarea
            value={values.description ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
            rows={2}
            placeholder="Solve 2 NeetCode problems."
            className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Time
          <input
            type="time"
            required
            value={values.scheduledTime}
            onChange={(e) =>
              setValues((v) => ({ ...v, scheduledTime: e.target.value }))
            }
            className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Duration (minutes)
          <input
            type="number"
            min={5}
            max={1440}
            required
            value={values.durationMinutes}
            onChange={(e) =>
              setValues((v) => ({ ...v, durationMinutes: Number(e.target.value) }))
            }
            className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Priority
          <select
            value={values.priority}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                priority: e.target.value as TaskFormValues["priority"],
              }))
            }
            className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm">Repeats</span>
        <div className="flex flex-wrap gap-2">
          {RECURRENCE_TYPES.map((rt) => (
            <button
              type="button"
              key={rt.value}
              onClick={() => setValues((v) => ({ ...v, recurrenceType: rt.value }))}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                values.recurrenceType === rt.value
                  ? "border-[var(--brass)] bg-[var(--brass-soft)] text-[var(--ink)]"
                  : "border-[var(--rule)] text-[var(--ink-muted)]"
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>

        {needsDayPicker && (
          <div className="mt-1 flex gap-1.5">
            {DAY_LABELS.map((label, day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(day)}
                className={`h-8 w-8 rounded-full border text-xs transition-colors ${
                  values.daysOfWeek.includes(day)
                    ? "border-[var(--brass)] bg-[var(--brass-soft)]"
                    : "border-[var(--rule)] text-[var(--ink-muted)]"
                }`}
              >
                {label[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm">Telegram reminder</span>
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggleReminder(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                values.remindBeforeMinutes.includes(opt.value)
                  ? "border-[var(--brass)] bg-[var(--brass-soft)] text-[var(--ink)]"
                  : "border-[var(--rule)] text-[var(--ink-muted)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
        />
        Active
      </label>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-50"
      >
        {saving ? "Saving..." : values.id ? "Save changes" : "Add to routine"}
      </button>
    </form>
  );
}
