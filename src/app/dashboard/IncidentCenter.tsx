'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type IncidentViewModel = {
  id: string;
  incidentKey: string;
  severity: string;
  repository: string;
  affectedBranch: string | null;
  affectedFiles: string | null;
  engineeringSummary: string;
  status: string;
  relatedWorkflow: string | null;
  relatedPr: number | null;
  relatedIssue: number | null;
  relatedUrl: string | null;
  openedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  history: Array<{
    id: string;
    status: string;
    summary: string;
    details: string | null;
    createdAt: string;
  }>;
};

const severityStyle: Record<string, string> = {
  LOW: 'text-signal-sky border-sky-300/30 bg-sky-400/10',
  MEDIUM: 'text-signal-amber border-amber-300/30 bg-amber-400/10',
  HIGH: 'text-signal-red border-red-300/30 bg-red-400/10',
  CRITICAL: 'text-signal-red border-red-300/40 bg-red-500/15',
};

// made by bob
export function IncidentCenter({ initialIncidents }: { initialIncidents: IncidentViewModel[] }) {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [expandedId, setExpandedId] = useState<string | null>(initialIncidents[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const response = await fetch('/api/incidents', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { incidents?: IncidentViewModel[] };
        startTransition(() => setIncidents(data.incidents || []));
      } catch {
        // Keep last known incidents.
      }
    };

    const timer = window.setInterval(loadIncidents, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="agent-soft overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">incident management</p>
          <h3 className="mt-2 text-xl font-bold">Repository incident center</h3>
          <p className="agent-muted mt-1 text-sm">Regression, workflow, suspicious commit, and auto-fix incidents with history.</p>
        </div>
        <StatusBadge tone={isPending ? 'info' : incidents.some((incident) => incident.status !== 'RESOLVED') ? 'warning' : 'healthy'}>
          {isPending ? 'syncing' : `${incidents.length} incidents`}
        </StatusBadge>
      </div>

      <div className="grid gap-0">
        {incidents.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">No incidents recorded yet.</div>
        ) : incidents.map((incident) => (
          <button
            key={incident.id}
            type="button"
            onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
            className="grid gap-4 border-b border-white/10 p-5 text-left transition hover:bg-white/[0.04]"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${severityStyle[incident.severity] || severityStyle.LOW}`}>
                    {incident.severity}
                  </span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-300">
                    {incident.status}
                  </span>
                  <span className="agent-muted font-mono text-xs">{formatTime(incident.openedAt)}</span>
                </div>
                <p className="mt-3 font-semibold">{incident.engineeringSummary}</p>
                <p className="agent-muted mt-1 text-sm">{incident.repository}{incident.affectedBranch ? ` @ ${incident.affectedBranch}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {incident.relatedWorkflow ? <span className="rounded-full border border-white/10 px-2 py-1">workflow: {incident.relatedWorkflow}</span> : null}
                {incident.relatedPr ? <span className="rounded-full border border-white/10 px-2 py-1">PR #{incident.relatedPr}</span> : null}
                {incident.relatedIssue ? <span className="rounded-full border border-white/10 px-2 py-1">issue #{incident.relatedIssue}</span> : null}
              </div>
            </div>

            {expandedId === incident.id ? (
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="agent-terminal rounded-2xl p-4 font-mono text-xs leading-6 text-slate-300">
                  <p>incident_id={incident.id}</p>
                  <p>key={incident.incidentKey}</p>
                  <p>status={incident.status}</p>
                  {incident.affectedFiles ? <pre className="mt-3 whitespace-pre-wrap">files={formatJsonList(incident.affectedFiles)}</pre> : null}
                  {incident.relatedUrl ? <p className="mt-3 break-all">url={incident.relatedUrl}</p> : null}
                </div>
                <div className="grid gap-3">
                  {incident.history.map((entry) => (
                    <div key={entry.id} className="agent-soft rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{entry.status}</p>
                        <p className="agent-muted font-mono text-xs">{formatTime(entry.createdAt)}</p>
                      </div>
                      <p className="agent-muted mt-2 text-sm">{entry.summary}</p>
                      {entry.details ? <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-slate-400">{formatDetails(entry.details)}</pre> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('en-US', { hour12: false });
}

function formatDetails(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatJsonList(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

// Made with Bob
// made by bob
