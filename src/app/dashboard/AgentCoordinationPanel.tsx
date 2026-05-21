'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type AgentCoordinationViewModel = {
  id: string;
  runKey: string;
  repository: string;
  triggerType: string;
  status: string;
  priority: string;
  activeAgent: string | null;
  combinedConclusion: string | null;
  operationalSummary: string | null;
  linkedWorkflow: string | null;
  linkedIncidentKey: string | null;
  startedAt: string;
  completedAt: string | null;
  tasks: Array<{
    id: string;
    agentType: string;
    title: string;
    status: string;
    priority: string;
    summary: string;
    context: string | null;
    startedAt: string;
    completedAt: string | null;
  }>;
  findings: Array<{
    id: string;
    agentType: string;
    findingType: string;
    severity: string;
    summary: string;
    evidence: string | null;
    confidence: number;
    createdAt: string;
  }>;
};

const agentProfiles = [
  ['Workflow Intelligence Agent', 'CI/CD monitoring, pipeline instability, execution patterns'],
  ['Regression Detection Agent', 'Suspicious commits, regression scoring, risky module detection'],
  ['Repository Intelligence Agent', 'Architecture context, hotspots, dependencies, repo memory'],
  ['Recovery Agent', 'Remediation planning, auto-fix orchestration, stabilization validation'],
  ['Documentation Agent', 'Engineering reports, incident summaries, operational explanations'],
] as const;

// made by bob
export function AgentCoordinationPanel({ initialRuns }: { initialRuns: AgentCoordinationViewModel[] }) {
  const [runs, setRuns] = useState(initialRuns);
  const [expandedId, setExpandedId] = useState<string | null>(initialRuns[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();
  const activeRun = runs.find((run) => run.id === expandedId) || runs[0] || null;

  async function loadRuns() {
    const response = await fetch('/api/agents', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as { runs?: AgentCoordinationViewModel[] };
    startTransition(() => setRuns(data.runs || []));
  }

  async function startCoordination() {
    const response = await fetch('/api/agents', { method: 'POST' });
    if (response.ok) {
      await loadRuns();
    }
  }

  useEffect(() => {
    const timer = window.setInterval(loadRuns, 12000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
      <section className="agent-soft rounded-3xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">agent coordination core</p>
            <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Operational agent network</h3>
            <p className="agent-muted mt-2 text-sm">
              Specialized engineering agents coordinate findings from incidents, investigations, recovery, PR reviews, and repository memory.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void startCoordination()}
            className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            Coordinate Agents
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {agentProfiles.map(([name, responsibility]) => (
            <div key={name} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="agent-muted mt-1 text-xs leading-5">{responsibility}</p>
                </div>
                <span className="pulse-orb mt-1 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Recent coordination runs</h4>
            <StatusBadge tone={isPending ? 'info' : 'healthy'}>{isPending ? 'syncing' : 'live'}</StatusBadge>
          </div>
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: 'var(--border)' }}>
              No coordination runs yet. Failed workflows, terminal assign-analysis, or manual coordination will populate this system.
            </div>
          ) : runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => setExpandedId(run.id)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                expandedId === run.id ? 'border-sky-300/60 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{run.repository}</p>
                  <p className="agent-muted mt-1 text-xs">{run.triggerType.replaceAll('_', ' ')} {run.linkedWorkflow ? `on ${run.linkedWorkflow}` : ''}</p>
                </div>
                <PriorityBadge priority={run.priority} />
              </div>
              <p className="agent-muted mt-3 line-clamp-2 text-sm">{run.operationalSummary || 'Coordination summary pending.'}</p>
            </button>
          ))}
        </div>
      </section>

      {activeRun ? <AgentCoordinationDetail run={activeRun} /> : (
        <section className="agent-soft rounded-3xl p-5">
          <h3 className="text-xl font-bold">Coordination flow</h3>
          <p className="agent-muted mt-2 text-sm">Run agent coordination to see task delegation, findings, and combined engineering conclusions.</p>
        </section>
      )}
    </div>
  );
}

function AgentCoordinationDetail({ run }: { run: AgentCoordinationViewModel }) {
  return (
    <section className="agent-soft rounded-3xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">multi-stage investigation execution</p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">{run.repository}</h3>
          <p className="agent-muted mt-2 text-sm">{run.combinedConclusion || 'Combined engineering conclusion is being assembled.'}</p>
        </div>
        <StatusBadge tone={run.status === 'COMPLETED' ? 'healthy' : 'info'}>{run.status.toLowerCase()}</StatusBadge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniMetric label="priority" value={run.priority} />
        <MiniMetric label="task ownership" value={`${run.tasks.length} agents`} />
        <MiniMetric label="findings" value={`${run.findings.length}`} />
      </div>

      {/* // made by bob */}
      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <h4 className="font-semibold">Coordination flow</h4>
        <div className="mt-4 grid gap-3">
          {run.tasks.map((task, index) => (
            <div key={task.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[2rem_1fr_auto] sm:items-center">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-400/10 font-mono text-xs text-sky-300">{index + 1}</span>
              <div>
                <p className="font-semibold">{task.agentType}</p>
                <p className="agent-muted mt-1 text-sm">{task.summary}</p>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-300">{task.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Shared engineering findings</h4>
          <div className="mt-4 grid gap-3">
            {run.findings.map((finding) => (
              <div key={finding.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs text-sky-300">{finding.findingType}</p>
                  <SeverityBadge severity={finding.severity} />
                </div>
                <p className="mt-2 text-sm leading-6">{finding.summary}</p>
                <p className="agent-muted mt-2 text-xs">owner: {finding.agentType} | confidence: {finding.confidence}%</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Operational telemetry</h4>
          <div className="mt-4 grid gap-3">
            <TelemetryLine label="[Workflow Agent]" value="CI/CD signal ownership established" />
            <TelemetryLine label="[Regression Agent]" value="Suspicious commit and memory correlation completed" />
            <TelemetryLine label="[Repository Agent]" value="Architecture context routed into shared conclusion" />
            <TelemetryLine label="[Recovery Agent]" value="Remediation posture evaluated" />
            <TelemetryLine label="[Documentation Agent]" value="Engineering report generated" />
          </div>
          <div className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-400/10 p-4">
            <p className="font-semibold text-sky-200">Combined conclusion</p>
            <p className="mt-2 text-sm leading-6 text-sky-100/85">{run.combinedConclusion || run.operationalSummary || 'No conclusion available yet.'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone = priority === 'CRITICAL' || priority === 'HIGH'
    ? 'border-red-300/30 bg-red-400/10 text-red-300'
    : priority === 'MEDIUM'
      ? 'border-amber-300/30 bg-amber-400/10 text-amber-300'
      : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-300';

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{priority}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  return <PriorityBadge priority={severity} />;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 truncate text-lg font-bold">{value}</p>
    </div>
  );
}

function TelemetryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 font-mono text-xs">
      <span className="text-sky-300">{label}</span>
      <span className="agent-muted ml-2">{value}</span>
    </div>
  );
}

// Made with Bob
// made by bob
