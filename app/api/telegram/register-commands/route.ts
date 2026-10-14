import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setTelegramCommands } from "@/lib/notifications/telegram-bot";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await setTelegramCommands();
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to register bot commands" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Telegram bot commands registered successfully!",
  });
}
