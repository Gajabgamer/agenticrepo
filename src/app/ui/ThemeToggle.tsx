'use client';

import { useEffect, useState } from 'react';

// made by bob
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('agentic-theme');
    const preferredTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

    setTheme(preferredTheme);
    document.documentElement.classList.toggle('dark', preferredTheme === 'dark');
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    window.localStorage.setItem('agentic-theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid h-10 w-10 place-items-center rounded-2xl border text-lg transition hover:-translate-y-0.5"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--panel)',
        color: 'var(--foreground)',
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}

// Made with Bob
