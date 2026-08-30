import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "./sign-out-button";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/tasks", label: "Routine" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export async function AppNav() {
  const session = await auth();

  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight"
          >
            Consistancy
          </Link>
          <nav className="hidden gap-5 text-sm text-[var(--ink-muted)] sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-[var(--ink)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        {session?.user && (
          <div className="flex items-center gap-4 text-sm text-[var(--ink-muted)]">
            <span className="hidden sm:inline">{session.user.name}</span>
            <SignOutButton />
          </div>
        )}
      </div>
      <nav className="flex gap-5 overflow-x-auto border-t border-[var(--rule)] px-4 py-2 text-sm text-[var(--ink-muted)] sm:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 transition-colors hover:text-[var(--ink)]"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
