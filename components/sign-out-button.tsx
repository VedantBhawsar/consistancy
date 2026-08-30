"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-[var(--ink-muted)] underline decoration-[var(--rule)] underline-offset-4 transition-colors hover:text-[var(--ink)]"
    >
      Sign out
    </button>
  );
}
