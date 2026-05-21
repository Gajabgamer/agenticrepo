'use client';

import { useEffect, useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

export type EngineeringMemoryViewModel = {
  repository: string;
  memories: Array<{
    id: string;
    memoryType: string;
    subject: string;
    summary: string;
    severity: string;
    confidenceScore: number;
    occurrenceCount: number;
    evidence: string | null;
    lastSeenAt: string;
  }>;
  nodes: Array<{
    id: string;
    nodeKey: string;
    nodeType: string;
    label: string;
    summary: string | null;
    severity: string | null;
    weight: number;
    metadata: string | null;
  }>;
  edges: Array<{
    id: string;
    sourceKey: string;
    targetKey: string;
    relationType: string;
    weight: number;
    evidence: string | null;
  }>;
  insights: string[];
  stats: {
    memoryCount: number;
    nodeCount: number;
    edgeCount: number;
    highRiskMemoryCount: number;
    unstableWorkflowCount: number;
    riskyModuleCount: number;
  };
} | null;

type ContextBundleViewModel = {
  repository: string;
  provider: 'bob' | 'groq';
  tokenBudget: number;
  estimatedTokens: number;
  savedTokens: number;
  compressionRatio: number;
  includedBlocks: Array<{
    id: string;
    layer: 'session' | 'repository' | 'incident' | 'cache';
    sourceType: string;
    title: string;
    summary: string;
    compressedText: string;
    priorityScore: number;
    tokenEstimate: number;
    providerProfile: string;
  }>;
  skippedBlocks: number;
  contextSources: string[];
  stats: {
    sessionBlocks: number;
    repositoryBlocks: number;
    incidentBlocks: number;
    cacheBlocks: number;
    candidateBlocks: number;
  };
} | null;

// made by bob
export function EngineeringMemoryPanel({ initialMemory }: { initialMemory: EngineeringMemoryViewModel }) {
  const [memory, setMemory] = useState<EngineeringMemoryViewModel>(initialMemory);
  const [contextBundle, setContextBundle] = useState<ContextBundleViewModel>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialMemory?.memories[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();
  const activeMemory = memory?.memories.find((item) => item.id === expandedId) || memory?.memories[0] || null;
  const importantNodes = memory?.nodes.slice(0, 12) || [];
  const importantEdges = memory?.edges.slice(0, 16) || [];

  async function loadMemory(refresh = false) {
    const response = await fetch('/api/memory', { method: refresh ? 'POST' : 'GET', cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as { memory?: EngineeringMemoryViewModel };
    startTransition(() => {
      setMemory(data.memory || null);
      setExpandedId(data.memory?.memories[0]?.id ?? null);
    });
  }

  async function loadContext(refresh = false) {
    const response = await fetch('/api/context', {
      method: refresh ? 'POST' : 'GET',
      cache: 'no-store',
      headers: refresh ? { 'Content-Type': 'application/json' } : undefined,
      body: refresh ? JSON.stringify({ purpose: 'analysis', refresh: true }) : undefined,
    });
    if (!response.ok) return;
    const data = await response.json() as { context?: ContextBundleViewModel };
    startTransition(() => setContextBundle(data.context || null));
  }

  useEffect(() => {
    void loadContext(false);
    const timer = window.setInterval(() => void loadMemory(false), 15000);
    const contextTimer = window.setInterval(() => void loadContext(false), 18000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(contextTimer);
    };
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
      <section className="agent-soft rounded-3xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">operational memory core</p>
            <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Engineering knowledge graph</h3>
            <p className="agent-muted mt-2 text-sm">Persistent repository memory derived from incidents, investigations, PR reviews, recoveries, workflows, and activity.</p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              void loadMemory(true);
              void loadContext(true);
            }}
            className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            Optimize Context
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <MemoryMetric label="Memory blocks" value={`${memory?.stats.memoryCount || 0}`} />
          <MemoryMetric label="Graph nodes" value={`${memory?.stats.nodeCount || 0}`} />
          <MemoryMetric label="Graph edges" value={`${memory?.stats.edgeCount || 0}`} />
        </div>

        <div className="mt-5 grid gap-3">
          {(memory?.memories.length || 0) === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: 'var(--border)' }}>
              No engineering memory has been learned yet. Run workflow simulation, process webhooks, or click Refresh Memory.
            </div>
          ) : memory?.memories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setExpandedId(item.id)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                expandedId === item.id ? 'border-sky-300/60 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.subject}</p>
                  <p className="agent-muted mt-1 text-xs">{item.memoryType.replaceAll('_', ' ')}</p>
                </div>
                <MemorySeverity severity={item.severity} />
              </div>
              <p className="agent-muted mt-3 text-sm leading-6">{item.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-2 py-1">confidence {item.confidenceScore}%</span>
                <span className="rounded-full border border-white/10 px-2 py-1">seen {item.occurrenceCount}x</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <ContextOptimizationPanel contextBundle={contextBundle} />

        <div className="agent-soft rounded-3xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">knowledge graph visualization</p>
              <h3 className="mt-2 text-xl font-bold">Operational relationship map</h3>
            </div>
            <StatusBadge tone={(memory?.stats.highRiskMemoryCount || 0) > 0 ? 'warning' : 'healthy'}>
              {(memory?.stats.highRiskMemoryCount || 0) > 0 ? 'risk memory' : 'stable memory'}
            </StatusBadge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {importantNodes.map((node, index) => (
              <div key={node.id} className="relative rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.9)]" />
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-sky-300">{node.nodeType}</p>
                <p className="mt-2 truncate font-semibold">{node.label}</p>
                <p className="agent-muted mt-1 text-xs">weight {node.weight} · signal {index + 1}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="agent-soft rounded-3xl p-5">
            <h4 className="font-semibold">Memory-powered insights</h4>
            <div className="mt-4 grid gap-2">
              {(memory?.insights.length ? memory.insights : ['No memory insight has been generated yet.']).map((insight) => (
                <p key={insight} className="agent-muted rounded-2xl bg-white/[0.03] px-3 py-2 text-sm leading-6">{insight}</p>
              ))}
            </div>
          </div>

          <div className="agent-soft rounded-3xl p-5">
            <h4 className="font-semibold">Graph relationships</h4>
            <div className="mt-4 grid gap-2">
              {importantEdges.length ? importantEdges.map((edge) => (
                <p key={edge.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-sky-100">
                  {edge.relationType.replaceAll('_', ' ')} · weight {edge.weight}
                </p>
              )) : <p className="agent-muted text-sm">No graph edges have been learned yet.</p>}
            </div>
          </div>
        </div>

        {activeMemory ? (
          <div className="agent-soft rounded-3xl p-5">
            <h4 className="font-semibold">Selected memory evidence</h4>
            <p className="agent-muted mt-2 text-sm">{activeMemory.summary}</p>
            <pre className="mt-4 max-h-56 overflow-auto rounded-2xl bg-slate-950/70 p-4 text-xs text-sky-100">
              {formatEvidence(activeMemory.evidence)}
            </pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ContextOptimizationPanel({ contextBundle }: { contextBundle: ContextBundleViewModel }) {
  return (
    <div className="agent-soft rounded-3xl p-5">
      {/* // made by bob */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">context engineering layer</p>
          <h3 className="mt-2 text-xl font-bold">AI-ready memory optimization</h3>
          <p className="agent-muted mt-2 text-sm">Only compressed, high-priority operational context is routed into Bob or Groq workflows.</p>
        </div>
        <StatusBadge tone={contextBundle ? 'healthy' : 'info'}>{contextBundle ? contextBundle.provider.toUpperCase() : 'assembling'}</StatusBadge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MemoryMetric label="Estimated tokens" value={`${contextBundle?.estimatedTokens || 0}/${contextBundle?.tokenBudget || 0}`} />
        <MemoryMetric label="Token savings" value={`${contextBundle?.savedTokens || 0}`} />
        <MemoryMetric label="Compression" value={`${contextBundle?.compressionRatio || 0}%`} />
        <MemoryMetric label="Skipped noise" value={`${contextBundle?.skippedBlocks || 0}`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Context sources</h4>
          <div className="mt-3 grid gap-2">
            {(contextBundle?.contextSources.length ? contextBundle.contextSources : ['Context sources will appear after the optimizer runs.']).slice(0, 8).map((source) => (
              <p key={source} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <span className="text-emerald-300">✓</span> <span className="agent-muted">{source}</span>
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h4 className="font-semibold">Memory layers</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <LayerPill label="Session Memory" value={contextBundle?.stats.sessionBlocks || 0} />
            <LayerPill label="Repository Memory" value={contextBundle?.stats.repositoryBlocks || 0} />
            <LayerPill label="Incident Memory" value={contextBundle?.stats.incidentBlocks || 0} />
            <LayerPill label="Context Cache" value={contextBundle?.stats.cacheBlocks || 0} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {(contextBundle?.includedBlocks || []).slice(0, 6).map((block) => (
          <div key={block.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{block.title}</p>
              <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-1 text-[0.65rem] text-sky-200">
                {block.layer} · {block.tokenEstimate} tokens · priority {block.priorityScore}
              </span>
            </div>
            <p className="agent-muted mt-2 line-clamp-2 text-sm leading-6">{block.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LayerPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}

function MemoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MemorySeverity({ severity }: { severity: string }) {
  const tone = severity === 'CRITICAL' || severity === 'HIGH'
    ? 'border-red-300/30 bg-red-400/10 text-red-300'
    : severity === 'MEDIUM'
      ? 'border-amber-300/30 bg-amber-400/10 text-amber-300'
      : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-300';

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{severity}</span>;
}

function formatEvidence(value: string | null): string {
  if (!value) return 'No evidence payload stored.';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

// Made with Bob
// made by bob
