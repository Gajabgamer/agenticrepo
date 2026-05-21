'use client';

import { useEffect, useState } from 'react';

function getInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const storedTheme = window.localStorage.getItem('agentic-theme');

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// made by bob
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
