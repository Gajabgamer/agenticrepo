'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeading, StatusBadge } from '../ui/agent-components';

interface SettingsFormProps {
  hasBobApiKey: boolean;
  hasGroqApiKey: boolean;
  preferredAiProvider: 'bob' | 'groq';
  hasGithubWebhookSecret: boolean;
  autoFixEnabled: boolean;
  confidenceThreshold: number;
  disabled?: boolean;
}

export function SettingsForm({
  hasBobApiKey,
  hasGroqApiKey,
  preferredAiProvider,
  hasGithubWebhookSecret,
  autoFixEnabled,
  confidenceThreshold,
  disabled = false,
}: SettingsFormProps) {
  const router = useRouter();
  const [bobApiKey, setBobApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [provider, setProvider] = useState<'bob' | 'groq'>(preferredAiProvider);
  const [githubWebhookSecret, setGithubWebhookSecret] = useState('');
  const [enabled, setEnabled] = useState(autoFixEnabled);
  const [threshold, setThreshold] = useState(confidenceThreshold);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const activeProviderConnected = provider === 'groq' ? hasGroqApiKey : hasBobApiKey;
  const providerLabel = provider === 'groq' ? 'Groq' : 'Bob';

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      setStatus('Login with GitHub before saving agent settings');
      return;
    }

    setSaving(true);
    setStatus('Saving settings...');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bobApiKey,
          groqApiKey,
          preferredAiProvider: provider,
          githubWebhookSecret,
          autoFixEnabled: enabled,
          confidenceThreshold: threshold,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || 'Failed to save settings');
        return;
      }

      setBobApiKey('');
      setGroqApiKey('');
      setGithubWebhookSecret('');
      setStatus(`${providerLabel} selected. Agent settings saved.`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={saveSettings}
      className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur"
    >
      {/* // made by bob */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          eyebrow="AI provider key experience"
          title="Agent configuration"
          description="Securely store Bob or Groq credentials with webhook settings, then tune deterministic auto-fix behavior."
        />
        <StatusBadge tone={activeProviderConnected && hasGithubWebhookSecret ? 'healthy' : 'warning'}>
          {activeProviderConnected ? `${providerLabel} Connected` : `${providerLabel} key needed`}
        </StatusBadge>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Bob status</p>
            <p className={`mt-2 text-sm font-semibold ${hasBobApiKey ? 'text-emerald-200' : 'text-amber-200'}`}>
              {hasBobApiKey ? 'Connected and encrypted' : 'Waiting for API key'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Groq status</p>
            <p className={`mt-2 text-sm font-semibold ${hasGroqApiKey ? 'text-emerald-200' : 'text-amber-200'}`}>
              {hasGroqApiKey ? 'Connected and encrypted' : 'Waiting for API key'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Webhook secret</p>
            <p className={`mt-2 text-sm font-semibold ${hasGithubWebhookSecret ? 'text-emerald-200' : 'text-amber-200'}`}>
              {hasGithubWebhookSecret ? 'Configured' : 'Missing'}
            </p>
          </div>
        </div>
        {/* // made by bob */}
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">AI provider</span>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value === 'groq' ? 'groq' : 'bob')}
            disabled={disabled || saving}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-slate-100 outline-none transition focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="bob">IBM Bob</option>
            <option value="groq">Groq</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">IBM Bob API key</span>
          <input
            type="password"
            value={bobApiKey}
            onChange={(event) => setBobApiKey(event.target.value)}
            disabled={disabled || saving}
            placeholder={hasBobApiKey ? 'Stored. Enter a new value to replace.' : 'Enter Bob API key'}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Groq API key</span>
          <input
            type="password"
            value={groqApiKey}
            onChange={(event) => setGroqApiKey(event.target.value)}
            disabled={disabled || saving}
            placeholder={hasGroqApiKey ? 'Stored. Enter a new value to replace.' : 'Enter Groq API key'}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">GitHub webhook secret</span>
          <input
            type="password"
            value={githubWebhookSecret}
            onChange={(event) => setGithubWebhookSecret(event.target.value)}
            disabled={disabled || saving}
            placeholder={hasGithubWebhookSecret ? 'Stored. Enter a new value to replace.' : 'Enter webhook secret'}
            className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          <span>Enable engineering agent auto-fix workflow</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={disabled || saving}
            className="h-5 w-5 accent-sky-300 disabled:cursor-not-allowed"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-slate-300">Confidence threshold</span>
          <input
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            disabled={disabled || saving}
            className="min-h-12 w-36 rounded-2xl border border-white/10 bg-slate-950 px-4 text-slate-100 outline-none transition focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-5 rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-70"
      >
        {saving ? 'Saving AI provider...' : 'Save secure settings'}
      </button>
      {status ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-slate-400">
          {status}
        </p>
      ) : null}
    </form>
  );
}

// Made with Bob
// made by bob
