import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/tasks", label: "Routine" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export async function AppNav() {
  const session = await auth();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Consistancy
          </Link>
          <nav className="hidden gap-5 text-sm font-medium text-muted-foreground sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {session?.user && (
            <span className="hidden sm:inline text-sm font-medium text-foreground mr-1">
              {session.user.name}
            </span>
          )}
          <ThemeToggle />
          {session?.user && <SignOutButton />}
        </div>
      </div>
      <nav className="flex gap-5 overflow-x-auto border-t border-border px-4 py-2.5 text-sm font-medium text-muted-foreground sm:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
