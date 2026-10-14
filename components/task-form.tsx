"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";
import { categoryLabel } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            required
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="e.g. DSA Practice"
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={values.description ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
            rows={2}
            placeholder="Solve 2 NeetCode problems."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-time">Time</Label>
          <Input
            id="task-time"
            type="time"
            required
            value={values.scheduledTime}
            onChange={(e) =>
              setValues((v) => ({ ...v, scheduledTime: e.target.value }))
            }
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-duration">Duration (minutes)</Label>
          <Input
            id="task-duration"
            type="number"
            min={5}
            max={1440}
            required
            value={values.durationMinutes}
            onChange={(e) =>
              setValues((v) => ({ ...v, durationMinutes: Number(e.target.value) }))
            }
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-category">Category</Label>
          <Select
            value={values.category}
            onValueChange={(val) => setValues((v) => ({ ...v, category: val }))}
          >
            <SelectTrigger id="task-category" className="h-10 w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            value={values.priority}
            onValueChange={(val) =>
              setValues((v) => ({
                ...v,
                priority: val as TaskFormValues["priority"],
              }))
            }
          >
            <SelectTrigger id="task-priority" className="h-10 w-full">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Repeats</Label>
        <div className="flex flex-wrap gap-2">
          {RECURRENCE_TYPES.map((rt) => (
            <Button
              key={rt.value}
              type="button"
              variant={values.recurrenceType === rt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setValues((v) => ({ ...v, recurrenceType: rt.value }))}
              className="rounded-full text-xs"
            >
              {rt.label}
            </Button>
          ))}
        </div>

        {needsDayPicker && (
          <div className="mt-2 flex gap-1.5">
            {DAY_LABELS.map((label, day) => (
              <Button
                key={day}
                type="button"
                variant={values.daysOfWeek.includes(day) ? "default" : "outline"}
                size="icon-sm"
                onClick={() => toggleDay(day)}
                className="size-8 rounded-full text-xs font-medium"
              >
                {label[0]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Telegram reminder</Label>
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={
                values.remindBeforeMinutes.includes(opt.value)
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => toggleReminder(opt.value)}
              className="rounded-full text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="task-active"
          checked={values.isActive}
          onCheckedChange={(checked) =>
            setValues((v) => ({ ...v, isActive: Boolean(checked) }))
          }
        />
        <Label htmlFor="task-active" className="cursor-pointer font-normal">
          Active in routine
        </Label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : values.id ? "Save changes" : "Add to routine"}
        </Button>
        {onDone && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
