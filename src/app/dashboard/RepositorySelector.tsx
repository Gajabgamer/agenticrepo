'use client';

import { useDeferredValue, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SectionHeading, StatusBadge } from '../ui/agent-components';

interface RepositoryOption {
  name: string;
  owner: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch: string;
  private: boolean;
}

export function RepositorySelector() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [selectedFullName, setSelectedFullName] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const filteredRepositories = repositories.filter((repo) =>
    repo.fullName.toLowerCase().includes(deferredSearch.toLowerCase()),
  );
  const selected = repositories.find((repo) => repo.fullName === selectedFullName) || null;

  async function loadRepositories() {
    setLoading(true);
    setStatus('Loading repositories...');

    try {
      const response = await fetch('/api/repositories');
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || 'Failed to load repositories');
        return;
      }

      setRepositories(data.repositories);
      setSelectedFullName(data.repositories[0]?.fullName || '');
      setStatus(`Loaded ${data.repositories.length} repositories`);
    } finally {
      setLoading(false);
    }
  }

  async function connectRepository() {
    if (!selected) {
      setStatus('Select a repository first');
      return;
    }

    setLoading(true);
    setStatus('Connecting repository...');
    try {
      const response = await fetch('/api/repositories/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: selected.name,
          owner: selected.owner,
          cloneUrl: selected.cloneUrl,
          defaultBranch: selected.defaultBranch,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || 'Failed to connect repository');
        return;
      }

      setStatus('Repository connected');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur">
      {/* // made by bob */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading
          eyebrow="Interactive repository selection"
          title="Connect one monitored repo"
          description="Search authenticated GitHub repositories, inspect metadata, and choose the repo this agent should operate on."
        />
        <StatusBadge tone={repositories.length > 0 ? 'info' : 'neutral'}>
          {repositories.length > 0 ? `${repositories.length} loaded` : 'not loaded'}
        </StatusBadge>
      </div>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={loadRepositories}
          disabled={loading}
          className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? 'Syncing GitHub repositories...' : 'Fetch repositories'}
        </button>
        {repositories.length > 0 ? (
          <div className="grid gap-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search owner/repository..."
              className="min-h-12 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-sky-300/70"
            />

            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {filteredRepositories.map((repo) => (
                <button
                  key={repo.fullName}
                  type="button"
                  onClick={() => setSelectedFullName(repo.fullName)}
                  className={`w-full rounded-2xl border p-4 text-left transition hover:border-sky-300/35 ${
                    selectedFullName === repo.fullName
                      ? 'border-sky-300/50 bg-sky-300/[0.08]'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-mono text-sm text-white">{repo.fullName}</p>
                      <p className="mt-1 text-xs text-slate-500">default branch: {repo.defaultBranch}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={repo.private ? 'warning' : 'healthy'}>
                        {repo.private ? 'private' : 'public'}
                      </StatusBadge>
                      <StatusBadge tone="info">workflow ready</StatusBadge>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selected ? (
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Selected repository</p>
                    <p className="mt-2 font-mono text-sm text-emerald-100">{selected.fullName}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{selected.cloneUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={connectRepository}
                    disabled={loading}
                    className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-wait disabled:opacity-70"
                  >
                    Connect selected
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {status ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-slate-400">
          {status}
        </p>
      ) : null}
    </div>
  );
}

// Made with Bob
// made by bob
