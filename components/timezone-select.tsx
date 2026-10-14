"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const POPULAR_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function getTimezoneOffset(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value;
    return offset ? `(${offset})` : "";
  } catch {
    return "";
  }
}

function getAllTimezones(): string[] {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Fallback if not supported
  }
  return POPULAR_TIMEZONES;
}

export function TimezoneSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [allTimezones] = React.useState<string[]>(() => getAllTimezones());

  const offsetMap = React.useMemo(() => {
    const map = new Map<string, string>();
    allTimezones.forEach((tz) => map.set(tz, getTimezoneOffset(tz)));
    return map;
  }, [allTimezones]);

  const otherTimezones = React.useMemo(() => {
    const popularSet = new Set(POPULAR_TIMEZONES);
    return allTimezones.filter((tz) => !popularSet.has(tz));
  }, [allTimezones]);

  const selectedOffset = offsetMap.get(value) || getTimezoneOffset(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between px-3 text-left font-normal"
        >
          <span className="truncate">
            {value ? (
              <>
                <span className="font-medium text-foreground">{value}</span>{" "}
                <span className="text-xs text-muted-foreground">{selectedOffset}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select timezone...</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 sm:w-[420px]" align="start">
        <Command>
          <CommandInput placeholder="Search timezone (e.g. Kolkata, London, New York)..." />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No timezone found.</CommandEmpty>

            <CommandGroup heading="Common Timezones">
              {POPULAR_TIMEZONES.map((tz) => {
                const offset = offsetMap.get(tz) || "";
                return (
                  <CommandItem
                    key={tz}
                    value={`${tz} ${offset}`}
                    onSelect={() => {
                      onChange(tz);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "size-4 text-primary",
                          value === tz ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">{tz}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {offset}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="All Timezones">
              {otherTimezones.map((tz) => {
                const offset = offsetMap.get(tz) || "";
                return (
                  <CommandItem
                    key={tz}
                    value={`${tz} ${offset}`}
                    onSelect={() => {
                      onChange(tz);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Check
                        className={cn(
                          "size-4 text-primary",
                          value === tz ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>{tz}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {offset}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
