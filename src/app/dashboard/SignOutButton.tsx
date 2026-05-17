'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectTo: '/' })}
      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-red-300/50 hover:bg-red-400/10 hover:text-red-100"
    >
      Logout
    </button>
  );
}

// Made with Bob
// made by bob
