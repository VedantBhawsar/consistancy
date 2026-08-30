"use client";

import { useState } from "react";
import { TaskForm } from "./task-form";

export function NewTaskPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--rule)] px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--brass)]"
      >
        + Add task
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--rule)] bg-[var(--bg-elevated)] p-4">
      <TaskForm onDone={() => setOpen(false)} />
    </div>
  );
}
