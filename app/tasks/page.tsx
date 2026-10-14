import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { NewTaskPanel } from "@/components/new-task-panel";
import { TaskList } from "@/components/task-list";
import { listTasks } from "@/lib/services/tasks";

export default async function TasksPage() {
  const session = await auth();
  const tasks = await listTasks(session!.user.id);

  return (
    <div className="min-h-full">
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <NewTaskPanel />

        <div className="mt-8">
          <TaskList tasks={tasks} />
        </div>
      </main>
    </div>
  );
}
