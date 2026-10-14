"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm } from "./task-form";

export function NewTaskPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your routine
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Define it once — the schedule generates itself every day.
          </p>
        </div>
        <Button
          type="button"
          variant={open ? "outline" : "default"}
          onClick={() => setOpen((o) => !o)}
          className="gap-1.5"
        >
          {open ? (
            <>
              <X className="size-4" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="size-4" />
              <span>Add task</span>
            </>
          )}
        </Button>
      </div>

      {open && (
        <Card className="mt-6 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div>
              <CardTitle className="text-base font-semibold">
                Add new task
              </CardTitle>
              <CardDescription>
                Create a recurring daily or weekly routine task.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setOpen(false)}
              aria-label="Close form"
            >
              <X className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <TaskForm onDone={() => setOpen(false)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
