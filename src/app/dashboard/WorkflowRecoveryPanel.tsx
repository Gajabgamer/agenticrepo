'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type WorkflowRecoveryViewModel = {
  id: string;
  repository: string;
  workflowName: string | null;
  branch: string | null;
  runId: string | null;
  status: string;
  strategy: string;
  confidenceScore: number;
  stabilizationProbability: number;
  probableRootCause: string;
  affectedSystems: string | null;
  proposedRemediation: string;
  operationalImpact: string;
  validationSummary: string;
  autoFixEligible: boolean;
  autoFixExecuted: boolean;
  recoveryPullRequestUrl: string | null;
  startedAt: string;
  completedAt: string | null;
  steps: Array<{
    id: string;
    stage: string;
    status: string;
    summary: string;
    evidence: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
};

// made by bob
export function WorkflowRecoveryPanel({ initialRecoveries }: { initialRecoveries: WorkflowRecoveryViewModel[] }) {
  const [recoveries, setRecoveries] = useState(initialRecoveries);
  const [expandedId, setExpandedId] = useState<string | null>(initialRecoveries[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();
  const activeRecovery = recoveries.find((recovery) => recovery.id === expandedId) || recoveries[0] || null;

  async function loadRecoveries() {
    const response = await fetch('/api/recoveries', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as { recoveries?: WorkflowRecoveryViewModel[] };
    startTransition(() => setRecoveries(data.recoveries || []));
  }

  async function startRecovery() {
    const response = await fetch('/api/recoveries', { method: 'POST' });
    if (response.ok) {
      await loadRecoveries();
    }
  }

  useEffect(() => {
    const timer = window.setInterval(loadRecoveries, 12000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="agent-soft rounded-3xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">self-healing operations</p>
            <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Workflow recovery engine</h3>
            <p className="agent-muted mt-2 text-sm">Investigates instability, chooses a recovery strategy, evaluates safe remediation, and tracks stabilization confidence.</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void startRecovery()}
            className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            Run Recovery
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {recoveries.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: 'var(--border)' }}>
              No recovery plans have been recorded yet. Failed workflow webhooks and terminal recovery commands will populate this timeline.
            </div>
          ) : recoveries.map((recovery) => (
            <button
              key={recovery.id}
              type="button"
              onClick={() => setExpandedId(recovery.id)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                expandedId === recovery.id ? 'border-sky-300/60 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{recovery.workflowName || 'Workflow'} recovery</p>
                  <p className="agent-muted mt-1 text-xs">{recovery.repository} {recovery.branch ? `on ${recovery.branch}` : ''}</p>
                </div>
                <RecoveryStatus status={recovery.status} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MiniMetric label="strategy" value={recovery.strategy.replaceAll('_', ' ')} />
                <MiniMetric label="confidence" value={`${recovery.confidenceScore}%`} />
                <MiniMetric label="stabilization" value={`${recovery.stabilizationProbability}%`} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {activeRecovery ? <RecoveryDetail recovery={activeRecovery} /> : (
        <section className="agent-soft rounded-3xl p-5">
          <h3 className="text-xl font-bold">Recovery reasoning</h3>
          <p className="agent-muted mt-2 text-sm">Recovery reasoning appears once a workflow failure or manual recovery command is processed.</p>
        </section>
      )}
    </div>
  );
}

function RecoveryDetail({ recovery }: { recovery: WorkflowRecoveryViewModel }) {
  const affectedSystems = parseJsonArray(recovery.affectedSystems);

  return (
    <section className="agent-soft rounded-3xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">recovery reasoning panel</p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">{recovery.strategy.replaceAll('_', ' ')}</h3>
          <p className="agent-muted mt-2 text-sm">{recovery.probableRootCause}</p>
        </div>
        <StatusBadge tone={recovery.autoFixExecuted ? 'healthy' : recovery.autoFixEligible ? 'info' : 'warning'}>
          {recovery.autoFixExecuted ? 'self-healed' : recovery.autoFixEligible ? 'safe fix available' : 'manual gate'}
        </StatusBadge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniMetric label="Stabilization probability" value={`${recovery.stabilizationProbability}%`} tall />
        <MiniMetric label="Operational impact" value={recovery.operationalImpact} tall />
        <MiniMetric label="Validation" value={recovery.validationSummary} tall />
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <h4 className="font-semibold">Proposed remediation</h4>
        <p className="agent-muted mt-3 text-sm leading-6">{recovery.proposedRemediation}</p>
        {recovery.recoveryPullRequestUrl ? (
          <a href={recovery.recoveryPullRequestUrl} className="mt-3 inline-flex text-sm font-semibold text-sky-300">
            Open recovery pull request
          </a>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Affected systems</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {(affectedSystems.length ? affectedSystems : ['workflow surface']).map((system) => (
              <span key={system} className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">{system}</span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Recovery execution timeline</h4>
          <div className="mt-4 grid gap-3">
            {recovery.steps.map((step) => (
              <div key={step.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-sky-300">{step.stage}</p>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[0.65rem] font-semibold text-emerald-300">{step.status}</span>
                </div>
                <p className="mt-2 text-sm">{step.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecoveryStatus({ status }: { status: string }) {
  const tone = status === 'STABILIZED'
    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-300'
    : status === 'MANUAL_REVIEW'
      ? 'border-amber-300/30 bg-amber-400/10 text-amber-300'
      : 'border-sky-300/30 bg-sky-400/10 text-sky-300';

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status.replaceAll('_', ' ')}</span>;
}

function MiniMetric({ label, value, tall = false }: { label: string; value: string; tall?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${tall ? 'min-h-32' : ''}`} style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.18em]">{label}</p>
      <p className={`mt-2 ${tall ? 'text-sm leading-6' : 'truncate text-lg font-bold'}`}>{value}</p>
    </div>
  );
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// Made with Bob
// made by bob
