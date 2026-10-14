"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, ExternalLink, Copy, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

export function SettingsForm({
  initial,
  botUsername,
}: {
  initial: SettingsValues;
  botUsername?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedBot, setCopiedBot] = useState(false);

  function copyBotHandle() {
    navigator.clipboard.writeText("@userinfobot");
    setCopiedBot(true);
    setTimeout(() => setCopiedBot(false), 2000);
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

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="telegramChatId" className="cursor-pointer font-medium text-[var(--ink)]">
            Telegram chat ID
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-[var(--brass)] hover:underline focus:outline-none"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>How to get this?</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={8}
              className="w-[340px] sm:w-[380px] p-4 text-xs"
            >
              <div className="space-y-3">
                <div className="border-b border-[var(--rule)] pb-2.5">
                  <h4 className="font-semibold text-sm text-[var(--ink)]">
                    Finding your Telegram Chat ID
                  </h4>
                  <p className="mt-0.5 text-[var(--ink-muted)]">
                    Follow these steps to receive reminders on Telegram:
                  </p>
                </div>

                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brass-soft)] font-bold text-[11px] text-[var(--ink)]">
                      1
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-[var(--ink)]">
                        Open @userinfobot
                      </span>
                      <p className="mt-0.5 text-[var(--ink-muted)]">
                        Search for{" "}
                        <span className="font-mono font-medium text-[var(--ink)]">@userinfobot</span>{" "}
                        in Telegram or click{" "}
                        <a
                          href="https://t.me/userinfobot"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[var(--brass)] underline hover:opacity-80"
                        >
                          t.me/userinfobot
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                      <button
                        type="button"
                        onClick={copyBotHandle}
                        className="mt-1 inline-flex items-center gap-1 rounded border border-[var(--rule)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                      >
                        {copiedBot ? (
                          <>
                            <Check className="h-3 w-3 text-[var(--success)]" />
                            <span className="text-[var(--success)]">Copied username</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy @userinfobot</span>
                          </>
                        )}
                      </button>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brass-soft)] font-bold text-[11px] text-[var(--ink)]">
                      2
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-[var(--ink)]">
                        Find your numeric ID
                      </span>
                      <p className="mt-0.5 text-[var(--ink-muted)]">
                        Tap <strong>Start</strong> (or send any message). The bot will reply with your profile info. Copy the numeric <strong>Id</strong> (e.g., <code>123456789</code>).
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brass-soft)] font-bold text-[11px] text-[var(--ink)]">
                      3
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-[var(--ink)]">
                        Paste your ID below
                      </span>
                      <p className="mt-0.5 text-[var(--ink-muted)]">
                        Enter that numeric ID into the <strong>Telegram chat ID</strong> field.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brass-soft)] font-bold text-[11px] text-[var(--ink)]">
                      4
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-[var(--ink)]">
                        Start your reminder bot
                      </span>
                      <p className="mt-0.5 text-[var(--ink-muted)]">
                        {botUsername ? (
                          <>
                            Open{" "}
                            <a
                              href={`https://t.me/${botUsername}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-[var(--brass)] underline hover:opacity-80"
                            >
                              @{botUsername}
                              <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            and tap <strong>Start</strong>.
                          </>
                        ) : (
                          "Open your reminder bot in Telegram and tap Start (or send /start)."
                        )}{" "}
                        Bots cannot send messages to users until you have started a conversation with them first.
                      </p>
                    </div>
                  </li>
                </ol>

                <div className="rounded-md border border-[var(--rule)] bg-[var(--bg)] p-2.5 text-[11px] text-[var(--ink-muted)]">
                  <span className="font-semibold text-[var(--ink)]">💡 Once connected:</span>{" "}
                  You will receive reminders automatically with Done, Skip, and Snooze buttons, plus daily morning &amp; evening digests.
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <input
          id="telegramChatId"
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
      </div>

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
