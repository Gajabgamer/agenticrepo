'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type ActivityTimelineEvent = {
  id: string;
  eventType: string;
  repository: string;
  severity: string;
  status: string;
  summary: string;
  details: string | null;
  relatedWorkflow: string | null;
  relatedPr: number | null;
  relatedIssue: number | null;
  relatedUrl: string | null;
  createdAt: string;
};

const eventLabels: Record<string, string> = {
  workflow_failure: 'Workflow Failure',
  ai_analysis: 'AI Analysis',
  regression_alert: 'Regression Alert',
  successful_fix: 'Successful Fix',
  pr_generation: 'PR Generation',
  documentation_generation: 'Documentation',
  suspicious_commit: 'Suspicious Commit',
  issue_creation: 'Issue Creation',
  repository_investigation: 'Investigation',
  pr_review: 'PR Review',
  terminal_command: 'Terminal Command',
  autofix_execution: 'AutoFix',
  workflow_recovery: 'Workflow Recovery',
  engineering_memory: 'Engineering Memory',
  context_optimization: 'Context Optimization',
  agent_coordination: 'Agent Coordination',
};

const severityClass: Record<string, string> = {
  danger: 'border-red-300/30 bg-red-400/10 text-signal-red',
  warning: 'border-amber-300/30 bg-amber-400/10 text-signal-amber',
  success: 'border-emerald-300/30 bg-emerald-400/10 text-signal-green',
  info: 'border-sky-300/30 bg-sky-400/10 text-signal-sky',
};

// made by bob
export function ActivityTimeline({ initialEvents }: { initialEvents: ActivityTimelineEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [expandedId, setExpandedId] = useState<string | null>(initialEvents[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await fetch('/api/activity', { cache: 'no-store' });

        if (!response.ok) {
          return;
        }

        const data = await response.json() as { events?: ActivityTimelineEvent[] };
        startTransition(() => setEvents(data.events || []));
      } catch {
        // Keep the existing timeline if a poll fails.
      }
    };

    const timer = window.setInterval(loadEvents, 8000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="agent-soft overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">live activity timeline</p>
          <h3 className="mt-2 text-xl font-bold">Autonomous engineering telemetry</h3>
          <p className="agent-muted mt-1 text-sm">Persisted workflow, analysis, terminal, and auto-fix activity from AgenticRepo.</p>
        </div>
        <StatusBadge tone={isPending ? 'info' : 'healthy'}>{isPending ? 'syncing' : 'live polling'}</StatusBadge>
      </div>

      <div className="grid gap-0">
        {events.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">
            No persisted activity yet. Run terminal commands or process GitHub webhooks to populate the timeline.
          </div>
        ) : events.map((event, index) => (
          <button
            key={event.id}
            type="button"
            onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
            className="group grid gap-3 border-b border-white/10 p-5 text-left transition hover:bg-white/[0.04]"
            style={{ animation: `agentFloat ${Math.min(index, 5) * 120 + 4200}ms ease-in-out infinite` }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border shadow-[0_0_20px_currentColor] ${severityClass[event.severity] || severityClass.info}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${severityClass[event.severity] || severityClass.info}`}>
                      {eventLabels[event.eventType] || event.eventType}
                    </span>
                    <span className="agent-muted font-mono text-xs">{formatTime(event.createdAt)}</span>
                    <span className="agent-muted font-mono text-xs">{event.status}</span>
                  </div>
                  <p className="mt-2 font-semibold">{event.summary}</p>
                  <p className="agent-muted mt-1 text-sm">{event.repository}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {event.relatedWorkflow ? <span className="rounded-full border border-white/10 px-2 py-1">workflow: {event.relatedWorkflow}</span> : null}
                {event.relatedPr ? <span className="rounded-full border border-white/10 px-2 py-1">PR #{event.relatedPr}</span> : null}
                {event.relatedIssue ? <span className="rounded-full border border-white/10 px-2 py-1">issue #{event.relatedIssue}</span> : null}
              </div>
            </div>

            {expandedId === event.id ? (
              <div className="agent-terminal rounded-2xl p-4 font-mono text-xs leading-6 text-slate-300">
                <p>event_id={event.id}</p>
                <p>type={event.eventType}</p>
                <p>severity={event.severity}</p>
                {event.relatedUrl ? <p>url={event.relatedUrl}</p> : null}
                {event.details ? <pre className="mt-3 whitespace-pre-wrap break-words">{formatDetails(event.details)}</pre> : <p className="mt-3 text-slate-500">No expanded details recorded.</p>}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDetails(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

// Made with Bob
// made by bob
