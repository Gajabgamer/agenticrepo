'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type PullRequestReviewViewModel = {
  id: string;
  prNumber: number;
  repository: string;
  title: string | null;
  author: string | null;
  branch: string | null;
  status: string;
  riskClassification: string;
  riskScore: number;
  confidenceScore: number;
  changedFiles: string | null;
  changedModules: string | null;
  architectureImpact: string;
  workflowImpact: string;
  affectedDependencies: string | null;
  suspiciousPatterns: string | null;
  reasoning: string;
  recommendations: string | null;
  deploymentConcerns: string | null;
  inlineInsights: string | null;
  relatedUrl: string | null;
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
export function PullRequestReviewPanel({
  initialReviews,
  autoFixEnabled,
}: {
  initialReviews: PullRequestReviewViewModel[];
  autoFixEnabled: boolean;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [expandedId, setExpandedId] = useState<string | null>(initialReviews[0]?.id ?? null);
  const [prNumber, setPrNumber] = useState(initialReviews[0]?.prNumber ? String(initialReviews[0].prNumber) : '');
  const [isPending, startTransition] = useTransition();
  const activeReview = reviews.find((review) => review.id === expandedId) || reviews[0] || null;

  async function loadReviews() {
    const response = await fetch('/api/pull-request-reviews', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as { reviews?: PullRequestReviewViewModel[] };
    startTransition(() => setReviews(data.reviews || []));
  }

  async function runReview() {
    const numericPr = Number(prNumber);
    if (!numericPr || Number.isNaN(numericPr)) return;

    const response = await fetch('/api/pull-request-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prNumber: numericPr }),
    });

    if (response.ok) {
      await loadReviews();
    }
  }

  useEffect(() => {
    const timer = window.setInterval(loadReviews, 12000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="agent-soft rounded-3xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Autonomous reviewer</p>
            <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Pull request intelligence</h3>
            <p className="agent-muted mt-2 text-sm">Changed files, architecture impact, regression risk, workflow impact, and operational recommendations.</p>
          </div>
          <StatusBadge tone={autoFixEnabled ? 'healthy' : 'info'}>{autoFixEnabled ? 'auto-fix armed' : 'review only'}</StatusBadge>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={prNumber}
            onChange={(event) => setPrNumber(event.target.value)}
            inputMode="numeric"
            placeholder="PR number"
            className="min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
          />
          <button
            type="button"
            onClick={() => void runReview()}
            disabled={isPending}
            className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            Review PR
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: 'var(--border)' }}>
              No PR reviews have been recorded yet. Open or update a pull request, or run a review by PR number.
            </div>
          ) : reviews.map((review) => (
            <button
              key={review.id}
              type="button"
              onClick={() => setExpandedId(review.id)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                expandedId === review.id ? 'border-sky-300/60 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">PR #{review.prNumber} {review.title || 'Untitled pull request'}</p>
                  <p className="agent-muted mt-1 text-xs">{review.repository} {review.branch ? `via ${review.branch}` : ''}</p>
                </div>
                <RiskBadge classification={review.riskClassification} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MiniMetric label="risk" value={`${review.riskScore}/100`} />
                <MiniMetric label="confidence" value={`${review.confidenceScore}/100`} />
                <MiniMetric label="modules" value={`${parseJsonArray(review.changedModules).length}`} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {activeReview ? <ReviewDetail review={activeReview} /> : (
        <section className="agent-soft rounded-3xl p-5">
          <h3 className="text-xl font-bold">Reviewer timeline</h3>
          <p className="agent-muted mt-2 text-sm">Review execution details will appear after the first autonomous PR review.</p>
        </section>
      )}
    </div>
  );
}

function ReviewDetail({ review }: { review: PullRequestReviewViewModel }) {
  const changedFiles = parseChangedFiles(review.changedFiles);
  const recommendations = parseJsonArray(review.recommendations);
  const deploymentConcerns = parseJsonArray(review.deploymentConcerns);
  const inlineInsights = parseJsonArray(review.inlineInsights);
  const suspiciousPatterns = parseJsonArray(review.suspiciousPatterns);

  return (
    <section className="agent-soft rounded-3xl p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Engineering reasoning</p>
          <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">PR #{review.prNumber}</h3>
          <p className="agent-muted mt-2 text-sm">{review.reasoning}</p>
        </div>
        <RiskBadge classification={review.riskClassification} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniMetric label="Architecture" value={review.architectureImpact} tall />
        <MiniMetric label="Workflow impact" value={review.workflowImpact} tall />
        <MiniMetric label="Dependencies" value={parseJsonArray(review.affectedDependencies).join(', ') || 'No dependency file changes detected'} tall />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Review execution timeline</h4>
          <div className="mt-4 grid gap-3">
            {review.steps.map((step) => (
              <div key={step.id} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-sky-300">{step.stage}</p>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[0.65rem] font-semibold text-emerald-300">{step.status}</span>
                </div>
                <p className="mt-2 text-sm">{step.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <ReasoningList title="Suspicious patterns" items={suspiciousPatterns} tone="warning" />
          <ReasoningList title="Recommended validations" items={recommendations} tone="healthy" />
          <ReasoningList title="Deployment concerns" items={deploymentConcerns} tone="danger" />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <h4 className="font-semibold">Inline engineering insights</h4>
        <div className="mt-3 grid gap-2">
          {(inlineInsights.length ? inlineInsights : changedFiles.map((file) => `${file.filename}: no high-risk inline insight generated.`)).slice(0, 8).map((item) => (
            <p key={item} className="rounded-xl bg-slate-950/50 px-3 py-2 font-mono text-xs text-sky-100">{item}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskBadge({ classification }: { classification: string }) {
  const tone = classification === 'CRITICAL' || classification === 'HIGH RISK'
    ? 'text-red-300 border-red-300/30 bg-red-400/10'
    : classification === 'MODERATE'
      ? 'text-amber-300 border-amber-300/30 bg-amber-400/10'
      : 'text-emerald-300 border-emerald-300/30 bg-emerald-400/10';

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{classification}</span>;
}

function MiniMetric({ label, value, tall = false }: { label: string; value: string; tall?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${tall ? 'min-h-32' : ''}`} style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.18em]">{label}</p>
      <p className={`mt-2 ${tall ? 'text-sm leading-6' : 'truncate text-lg font-bold'}`}>{value}</p>
    </div>
  );
}

function ReasoningList({ title, items, tone }: { title: string; items: string[]; tone: 'healthy' | 'warning' | 'danger' }) {
  const color = tone === 'healthy' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : 'text-red-300';

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <h4 className={`font-semibold ${color}`}>{title}</h4>
      <div className="mt-3 grid gap-2">
        {(items.length ? items : ['No signal generated for this category.']).map((item) => (
          <p key={item} className="agent-muted rounded-xl bg-white/[0.03] px-3 py-2 text-sm">{item}</p>
        ))}
      </div>
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

function parseChangedFiles(value: string | null): Array<{ filename: string }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          if (item && typeof item === 'object' && 'filename' in item && typeof item.filename === 'string') {
            return [{ filename: item.filename }];
          }
          return [];
        })
      : [];
  } catch {
    return [];
  }
}

// Made with Bob
// made by bob
