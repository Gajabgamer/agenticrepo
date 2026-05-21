'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type InvestigationViewModel = {
  id: string;
  investigationKey: string;
  repository: string;
  triggerType: string;
  status: string;
  currentStage: string | null;
  severity: string;
  confidenceLevel: string | null;
  rootCause: string | null;
  affectedFiles: string | null;
  suspiciousCommits: string | null;
  conclusion: string | null;
  recommendedActions: string | null;
  relatedWorkflow: string | null;
  relatedPr: number | null;
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

const stageOrder = [
  'workflow_inspection',
  'log_analysis',
  'suspicious_commit_correlation',
  'affected_file_analysis',
  'regression_scoring',
  'engineering_summary',
  'autofix_eligibility',
];

// made by bob
export function InvestigationPanel({ initialInvestigations }: { initialInvestigations: InvestigationViewModel[] }) {
  const [investigations, setInvestigations] = useState(initialInvestigations);
  const [expandedId, setExpandedId] = useState<string | null>(initialInvestigations[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  async function startInvestigation() {
    const response = await fetch('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerType: 'repository' }),
    });

    if (response.ok) {
      await loadInvestigations();
    }
  }

  async function loadInvestigations() {
    const response = await fetch('/api/investigations', { cache: 'no-store' });

    if (!response.ok) {
      return;
    }

    const data = await response.json() as { investigations?: InvestigationViewModel[] };
    startTransition(() => setInvestigations(data.investigations || []));
  }

  useEffect(() => {
    const timer = window.setInterval(loadInvestigations, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="agent-soft overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">autonomous investigation workflow</p>
          <h3 className="mt-2 text-2xl font-bold">Engineering reasoning chain</h3>
          <p className="agent-muted mt-1 text-sm">Sequential workflow inspection, log analysis, commit correlation, regression scoring, Bob reasoning, and auto-fix evaluation.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={isPending ? 'info' : 'healthy'}>{isPending ? 'syncing' : 'ready'}</StatusBadge>
          <button
            type="button"
            onClick={() => void startInvestigation()}
            className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            Run investigation
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        {investigations.length === 0 ? (
          <div className="agent-terminal rounded-2xl p-5 text-sm text-slate-400">
            No investigations recorded yet. Run `investigate-failure` in the terminal or click Run investigation.
          </div>
        ) : investigations.map((investigation) => (
          <button
            key={investigation.id}
            type="button"
            onClick={() => setExpandedId(expandedId === investigation.id ? null : investigation.id)}
            className="agent-panel grid gap-4 rounded-3xl p-5 text-left transition hover:-translate-y-0.5"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={investigation.status === 'COMPLETED' ? 'healthy' : 'info'}>{investigation.status}</StatusBadge>
                  <StatusBadge tone={investigation.severity === 'HIGH' || investigation.severity === 'CRITICAL' ? 'danger' : 'warning'}>{investigation.severity}</StatusBadge>
                  <span className="agent-muted font-mono text-xs">{formatTime(investigation.startedAt)}</span>
                </div>
                <p className="mt-3 text-lg font-bold">{investigation.repository}</p>
                <p className="agent-muted mt-1 text-sm">{investigation.rootCause || investigation.currentStage || investigation.triggerType}</p>
              </div>
              <div className="grid gap-2 text-xs">
                {investigation.relatedWorkflow ? <span className="rounded-full border border-white/10 px-2 py-1">workflow: {investigation.relatedWorkflow}</span> : null}
                {investigation.confidenceLevel ? <span className="rounded-full border border-white/10 px-2 py-1">confidence: {investigation.confidenceLevel}</span> : null}
              </div>
            </div>

            <InvestigationGraph completedStages={investigation.steps.map((step) => step.stage)} />

            {expandedId === investigation.id ? (
              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <ReasoningPanel investigation={investigation} />
                <div className="grid gap-3">
                  {investigation.steps.map((step) => (
                    <div key={step.id} className="agent-soft rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{step.summary}</p>
                        <span className="text-xs text-signal-green">{step.status}</span>
                      </div>
                      <p className="agent-muted mt-1 font-mono text-xs">{step.stage}</p>
                      {step.evidence ? <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-400">{formatDetails(step.evidence)}</pre> : null}
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

function InvestigationGraph({ completedStages }: { completedStages: string[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {stageOrder.map((stage, index) => {
        const complete = completedStages.includes(stage);
        return (
          <div key={stage} className="relative">
            <div className={`rounded-2xl border p-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] ${complete ? 'border-emerald-300/30 bg-emerald-400/10 text-signal-green' : 'border-white/10 bg-white/[0.03] text-slate-500'}`}>
              {stage.replaceAll('_', ' ')}
            </div>
            {index < stageOrder.length - 1 ? <div className="workflow-line mx-auto hidden h-1 w-full md:block" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function ReasoningPanel({ investigation }: { investigation: InvestigationViewModel }) {
  return (
    <div className="agent-terminal rounded-2xl p-5 font-mono text-xs leading-6 text-slate-300">
      <p className="text-sky-300">root_cause={investigation.rootCause || 'pending'}</p>
      <p>confidence={investigation.confidenceLevel || 'pending'}</p>
      <p>workflow={investigation.relatedWorkflow || 'none'}</p>
      {investigation.affectedFiles ? <pre className="mt-3 whitespace-pre-wrap">affected_files={formatDetails(investigation.affectedFiles)}</pre> : null}
      {investigation.suspiciousCommits ? <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap">suspicious_commits={formatDetails(investigation.suspiciousCommits)}</pre> : null}
      {investigation.recommendedActions ? <pre className="mt-3 whitespace-pre-wrap text-emerald-200">recommended_actions={formatDetails(investigation.recommendedActions)}</pre> : null}
    </div>
  );
}

function formatDetails(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('en-US', { hour12: false });
}

// Made with Bob
// made by bob
