"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SettingsValues = {
  name: string;
  email: string;
  timezone: string;
  telegramChatId: string | null;
  remindBeforeMinutes: number[];
};

const REMINDER_OPTIONS = [
  { value: 0, label: "At scheduled time" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 30, label: "30 min before" },
];

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setSaved(false);
    setSaving(true);

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        timezone: values.timezone,
        telegramChatId: values.telegramChatId || null,
        notificationPreferences: {
          channel: "TELEGRAM",
          remindBeforeMinutes:
            values.remindBeforeMinutes.length > 0 ? values.remindBeforeMinutes : [0],
        },
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not save settings");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          disabled
          value={values.email}
          className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--ink-muted)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Timezone
        <input
          value={values.timezone}
          onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
          placeholder="Asia/Kolkata"
          className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
        />
        <span className="text-xs text-[var(--ink-muted)]">
          IANA timezone name, used to schedule reminders at the right local time.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Telegram chat ID
        <input
          value={values.telegramChatId ?? ""}
          onChange={(e) =>
            setValues((v) => ({ ...v, telegramChatId: e.target.value }))
          }
          placeholder="123456789"
          className="rounded-md border border-[var(--rule)] bg-[var(--bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--brass)]"
        />
        <span className="text-xs text-[var(--ink-muted)]">
          Message the bot, then message @userinfobot to get your numeric chat ID.
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm">Default reminder timing</span>
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

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-[var(--success)]">Settings saved.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
