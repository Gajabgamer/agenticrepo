'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type HealthViewModel = {
  repository: string;
  healthScore: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  workflowFailures: number;
  regressionIncidents: number;
  failedPullRequests: number;
  suspiciousCommits: number;
  unresolvedIssues: number;
  autoFixSuccesses: number;
  autoFixFailures: number;
  workflowReliability: number;
  autoFixSuccessRate: number;
  stabilityTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
};

const statusTone = {
  HEALTHY: 'text-signal-green',
  WARNING: 'text-signal-amber',
  CRITICAL: 'text-signal-red',
};

// made by bob
export function RepositoryHealthPanel({ initialHealth }: { initialHealth: HealthViewModel | null }) {
  const [health, setHealth] = useState(initialHealth);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const response = await fetch('/api/health/repository', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { health?: HealthViewModel };
        startTransition(() => setHealth(data.health || null));
      } catch {
        // Preserve last known health snapshot.
      }
    };

    const timer = window.setInterval(loadHealth, 12000);
    return () => window.clearInterval(timer);
  }, []);

  if (!health) {
    return (
      <section className="agent-soft rounded-3xl p-5">
        <p className="text-xl font-bold">Repository health unavailable</p>
        <p className="agent-muted mt-2 text-sm">Connect a repository and process workflow activity to calculate health.</p>
      </section>
    );
  }

  return (
    <section className="agent-soft overflow-hidden rounded-3xl">
      <div className="grid gap-5 p-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="agent-panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">repository health engine</p>
              <h3 className="mt-2 text-2xl font-bold">{health.repository}</h3>
            </div>
            <StatusBadge tone={isPending ? 'info' : health.status === 'HEALTHY' ? 'healthy' : health.status === 'WARNING' ? 'warning' : 'danger'}>
              {isPending ? 'syncing' : health.status}
            </StatusBadge>
          </div>
          <div className="mt-8 grid place-items-center">
            <div className="relative grid h-44 w-44 place-items-center rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(14,165,233,0.18),transparent_62%)] shadow-[0_0_60px_rgba(37,99,235,0.22)]">
              <div className="text-center">
                <p className={`text-5xl font-black ${statusTone[health.status]}`}>{health.healthScore}%</p>
                <p className="agent-muted mt-1 text-xs uppercase tracking-[0.18em]">stability</p>
              </div>
            </div>
          </div>
          <p className="agent-muted mt-6 text-sm">Trend: <span className="font-semibold text-sky-300">{health.stabilityTrend}</span></p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <HealthMetric label="Workflow reliability" value={`${health.workflowReliability}%`} />
          <HealthMetric label="Auto-fix success" value={`${health.autoFixSuccessRate}%`} />
          <HealthMetric label="Active incidents" value={`${health.unresolvedIssues}`} tone={health.unresolvedIssues > 0 ? 'warning' : 'healthy'} />
          <HealthMetric label="Workflow failures" value={`${health.workflowFailures}`} tone={health.workflowFailures > 0 ? 'danger' : 'healthy'} />
          <HealthMetric label="Regression incidents" value={`${health.regressionIncidents}`} tone={health.regressionIncidents > 0 ? 'danger' : 'healthy'} />
          <HealthMetric label="Suspicious commits" value={`${health.suspiciousCommits}`} tone={health.suspiciousCommits > 0 ? 'warning' : 'healthy'} />
        </div>
      </div>
    </section>
  );
}

function HealthMetric({ label, value, tone = 'info' }: { label: string; value: string; tone?: 'info' | 'healthy' | 'warning' | 'danger' }) {
  const color = tone === 'healthy' ? 'text-signal-green' : tone === 'warning' ? 'text-signal-amber' : tone === 'danger' ? 'text-signal-red' : 'text-signal-sky';

  return (
    <div className="agent-soft rounded-2xl p-4">
      <p className="agent-muted text-xs uppercase tracking-[0.18em]">{label}</p>
      <p className={`mt-3 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// Made with Bob
// made by bob
