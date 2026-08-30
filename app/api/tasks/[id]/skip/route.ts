import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { skipTaskOccurrence } from "@/lib/services/completion";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const occurrenceId =
    typeof body?.occurrenceId === "string" ? body.occurrenceId : undefined;

  try {
    const occurrence = await skipTaskOccurrence(
      session.user.id,
      id,
      occurrenceId
    );
    return NextResponse.json({ occurrence });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
