import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppNav } from "@/components/app-nav";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await auth();

  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      timezone: users.timezone,
      telegramChatId: users.telegramChatId,
      notificationPreferences: users.notificationPreferences,
    })
    .from(users)
    .where(eq(users.id, session!.user.id))
    .limit(1);

  return (
    <div className="min-h-full">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Settings
            </CardTitle>
            <CardDescription>
              Your profile and how reminders reach you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user && (
              <SettingsForm
                initial={{
                  name: user.name,
                  email: user.email,
                  timezone: user.timezone,
                  telegramChatId: user.telegramChatId,
                  remindBeforeMinutes: user.notificationPreferences.remindBeforeMinutes,
                }}
                botUsername={process.env.TELEGRAM_BOT_USERNAME}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
