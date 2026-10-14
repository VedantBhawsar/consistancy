"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, ExternalLink, Copy, Check, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimezoneSelect } from "./timezone-select";

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
  const [registeringCommands, setRegisteringCommands] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  function copyBotHandle() {
    navigator.clipboard.writeText("@userinfobot");
    setCopiedBot(true);
    setTimeout(() => setCopiedBot(false), 2000);
  }

  async function handleRegisterCommands() {
    setRegisteringCommands(true);
    setCommandFeedback(null);
    try {
      const res = await fetch("/api/telegram/register-commands", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommandFeedback({
          success: false,
          message: data.error || "Failed to register bot commands.",
        });
      } else {
        setCommandFeedback({
          success: true,
          message:
            "Commands registered! Open your bot in Telegram to see the menu.",
        });
      }
    } catch {
      setCommandFeedback({
        success: false,
        message: "Network error trying to register commands.",
      });
    } finally {
      setRegisteringCommands(false);
    }
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
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Name</span>
        <Input
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          className="h-10"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <Input
          disabled
          value={values.email}
          className="h-10 text-muted-foreground"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <label className="font-medium text-foreground">Timezone</label>
        <TimezoneSelect
          value={values.timezone}
          onChange={(tz) => setValues((v) => ({ ...v, timezone: tz }))}
        />
        <span className="text-xs text-muted-foreground">
          IANA timezone, used to schedule reminders at the right local time.
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="telegramChatId" className="cursor-pointer font-medium text-foreground">
            Telegram chat ID
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="size-3.5" />
                <span>How to get this?</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={8}
              className="w-[340px] p-4 text-xs sm:w-[380px]"
            >
              <div className="space-y-3">
                <div className="border-b border-border pb-2.5">
                  <h4 className="text-sm font-semibold text-foreground">
                    Finding your Telegram Chat ID
                  </h4>
                  <p className="mt-0.5 text-muted-foreground">
                    Follow these steps to receive reminders on Telegram:
                  </p>
                </div>

                <ol className="space-y-3">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      1
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-foreground">
                        Open @userinfobot
                      </span>
                      <p className="mt-0.5 text-muted-foreground">
                        Search for{" "}
                        <span className="font-mono font-medium text-foreground">@userinfobot</span>{" "}
                        in Telegram or click{" "}
                        <a
                          href="https://t.me/userinfobot"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary underline hover:opacity-80"
                        >
                          t.me/userinfobot
                          <ExternalLink className="size-3" />
                        </a>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={copyBotHandle}
                        className="mt-1"
                      >
                        {copiedBot ? (
                          <>
                            <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Copied username</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy @userinfobot</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      2
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-foreground">
                        Find your numeric ID
                      </span>
                      <p className="mt-0.5 text-muted-foreground">
                        Tap <strong>Start</strong> (or send any message). The bot will reply with your profile info. Copy the numeric <strong>Id</strong> (e.g., <code>123456789</code>).
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      3
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-foreground">
                        Paste your ID below
                      </span>
                      <p className="mt-0.5 text-muted-foreground">
                        Enter that numeric ID into the <strong>Telegram chat ID</strong> field.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                      4
                    </span>
                    <div className="flex-1 leading-relaxed">
                      <span className="font-medium text-foreground">
                        Start your reminder bot
                      </span>
                      <p className="mt-0.5 text-muted-foreground">
                        {botUsername ? (
                          <>
                            Open{" "}
                            <a
                              href={`https://t.me/${botUsername}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-primary underline hover:opacity-80"
                            >
                              @{botUsername}
                              <ExternalLink className="size-3" />
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

                <div className="rounded-md border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">💡 Once connected:</span>{" "}
                  You will receive reminders automatically with Done, Skip, and Snooze buttons, plus daily morning &amp; evening digests.
                </div>

                <div className="border-t border-border pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Bot commands autocomplete:
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={registeringCommands}
                      onClick={handleRegisterCommands}
                    >
                      <Terminal className="size-3" />
                      <span>{registeringCommands ? "Registering..." : "Sync commands"}</span>
                    </Button>
                  </div>
                  {commandFeedback && (
                    <p
                      className={`mt-1.5 text-[11px] ${
                        commandFeedback.success
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {commandFeedback.message}
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Input
          id="telegramChatId"
          value={values.telegramChatId ?? ""}
          onChange={(e) =>
            setValues((v) => ({ ...v, telegramChatId: e.target.value }))
          }
          placeholder="123456789"
          className="h-10"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Message the bot, then message @userinfobot to get your numeric chat ID.</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={registeringCommands}
            onClick={handleRegisterCommands}
            className="ml-2 gap-1 text-primary hover:underline"
          >
            <Terminal className="size-3" />
            <span>Sync commands</span>
          </Button>
        </div>
        {commandFeedback && (
          <p
            className={`text-xs ${
              commandFeedback.success
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive"
            }`}
          >
            {commandFeedback.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Default reminder timing</span>
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggleReminder(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                values.remindBeforeMinutes.includes(opt.value)
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Settings saved.</p>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="self-start"
      >
        {saving ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
