import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { createTaskSchema } from "@/lib/validation/task";
import { createTask, listTasks } from "@/lib/services/tasks";
import { generateOccurrencesForTask } from "@/lib/services/occurrences";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await listTasks(session.user.id);
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const task = await createTask(session.user.id, parsed.data);
    await generateOccurrencesForTask(session.user.id, task.id);
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
