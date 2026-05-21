'use client';

import { useState, useTransition } from 'react';
import { StatusBadge } from '../ui/agent-components';

type TreeNode = {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  extension?: string;
  risk: 'low' | 'medium' | 'high';
  tags: string[];
  children: TreeNode[];
};

type Intelligence = {
  repository: string;
  defaultBranch: string;
  tree: TreeNode[];
  modules: Array<{ name: string; files: number; risk: 'low' | 'medium' | 'high'; responsibilities: string[] }>;
  workflows: Array<{ path: string; connectedModules: string[] }>;
  hotspots: Array<{ path: string; score: number; reasons: string[] }>;
  summary: string;
  patterns: string[];
  risks: string[];
  generatedDocs: string;
};

const riskTone = {
  low: 'text-signal-green',
  medium: 'text-signal-amber',
  high: 'text-signal-red',
};

// made by bob
export function RepositoryArchitectureExplorer() {
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [error, setError] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadIntelligence() {
    setError('');
    const response = await fetch('/api/repository/intelligence', { cache: 'no-store' });
    const data = await response.json() as { intelligence?: Intelligence; error?: string };

    if (!response.ok || !data.intelligence) {
      setError(data.error || 'Repository intelligence failed.');
      return;
    }

    startTransition(() => {
      setIntelligence(data.intelligence || null);
      setSelectedPath(data.intelligence?.hotspots[0]?.path || data.intelligence?.modules[0]?.name || null);
    });
  }

  return (
    <section className="grid gap-4">
      <div className="agent-soft rounded-3xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">repository intelligence</p>
            <h3 className="mt-2 text-2xl font-bold">Architecture Explorer</h3>
            <p className="agent-muted mt-1 text-sm">Maps real GitHub repository structure into modules, workflows, hotspots, and documentation context.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={isPending ? 'info' : intelligence ? 'healthy' : 'warning'}>{isPending ? 'mapping' : intelligence ? 'mapped' : 'not loaded'}</StatusBadge>
            <button
              type="button"
              onClick={() => void loadIntelligence()}
              className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
            >
              Analyze Architecture
            </button>
          </div>
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-signal-red">{error}</p> : null}
      </div>

      {intelligence ? (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-4">
            <ArchitectureGraph intelligence={intelligence} />
            <SmartFileTree nodes={intelligence.tree} selectedPath={selectedPath} setSelectedPath={setSelectedPath} />
          </div>
          <div className="grid gap-4">
            <InsightsPanel intelligence={intelligence} selectedPath={selectedPath} />
            <DocumentationPreview docs={intelligence.generatedDocs} />
          </div>
        </div>
      ) : (
        <div className="agent-terminal rounded-3xl p-5 text-sm text-slate-400">
          Run architecture analysis to fetch the real GitHub tree and connect it with AgenticRepo incidents, investigations, and workflow evidence.
        </div>
      )}
    </section>
  );
}

function SmartFileTree({
  nodes,
  selectedPath,
  setSelectedPath,
}: {
  nodes: TreeNode[];
  selectedPath: string | null;
  setSelectedPath: (path: string) => void;
}) {
  return (
    <div className="agent-soft rounded-3xl p-5">
      <h4 className="font-bold">Smart file tree</h4>
      <div className="mt-4 max-h-[580px] overflow-auto pr-2">
        {nodes.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} selectedPath={selectedPath} setSelectedPath={setSelectedPath} />
        ))}
      </div>
    </div>
  );
}

function TreeItem({
  node,
  depth,
  selectedPath,
  setSelectedPath,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  setSelectedPath: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2 || node.risk === 'high');
  const selected = selectedPath === node.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (node.type === 'tree') setOpen(!open);
          setSelectedPath(node.path);
        }}
        className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/[0.04] ${selected ? 'bg-sky-400/10' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        <span className="truncate">
          <span className={node.type === 'tree' ? 'text-sky-300' : 'text-slate-300'}>
            {node.type === 'tree' ? (open ? '▾' : '▸') : fileIcon(node.extension)} {node.name}
          </span>
        </span>
        <span className={`text-xs ${riskTone[node.risk]}`}>{node.tags.join(' ')}</span>
      </button>
      {open && node.children.length > 0 ? (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} setSelectedPath={setSelectedPath} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArchitectureGraph({ intelligence }: { intelligence: Intelligence }) {
  return (
    <div className="agent-soft rounded-3xl p-5">
      <h4 className="font-bold">Architecture graph</h4>
      <p className="agent-muted mt-1 text-sm">{intelligence.summary}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {intelligence.modules.slice(0, 8).map((module) => (
          <div key={module.name} className="agent-panel rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{module.name}</p>
              <span className={`text-xs font-semibold ${riskTone[module.risk]}`}>{module.risk}</span>
            </div>
            <p className="agent-muted mt-2 text-xs">{module.files} files</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {module.responsibilities.map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400">{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsPanel({ intelligence, selectedPath }: { intelligence: Intelligence; selectedPath: string | null }) {
  const selectedHotspot = intelligence.hotspots.find((hotspot) => hotspot.path === selectedPath);

  return (
    <div className="agent-soft rounded-3xl p-5">
      <h4 className="font-bold">Repository insights</h4>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InsightBlock title="Engineering patterns" items={intelligence.patterns} tone="success" />
        <InsightBlock title="Operational risks" items={intelligence.risks} tone="warning" />
        <InsightBlock title="Workflow relationships" items={intelligence.workflows.map((workflow) => `${workflow.path} -> ${workflow.connectedModules.join(', ') || 'repository-wide'}`)} tone="info" />
        <InsightBlock title="Hotspots" items={intelligence.hotspots.map((hotspot) => `${hotspot.path} (${hotspot.score})`)} tone="danger" />
      </div>
      {selectedHotspot ? (
        <div className="agent-terminal mt-4 rounded-2xl p-4 font-mono text-xs text-slate-300">
          <p>selected_hotspot={selectedHotspot.path}</p>
          <p>score={selectedHotspot.score}</p>
          <pre className="mt-3 whitespace-pre-wrap">reasons={JSON.stringify(selectedHotspot.reasons, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}

function DocumentationPreview({ docs }: { docs: string }) {
  return (
    <div className="agent-terminal rounded-3xl p-5">
      <p className="font-mono text-xs text-slate-500">docs/generated-architecture.md</p>
      <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-300">{docs}</pre>
    </div>
  );
}

function InsightBlock({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const color = tone === 'success' ? 'text-signal-green' : tone === 'warning' ? 'text-signal-amber' : tone === 'danger' ? 'text-signal-red' : 'text-signal-sky';

  return (
    <div className="agent-panel rounded-2xl p-4">
      <p className={`text-sm font-semibold ${color}`}>{title}</p>
      <div className="mt-3 grid gap-2">
        {(items.length ? items : ['No signals detected yet.']).slice(0, 6).map((item) => (
          <p key={item} className="agent-muted text-sm">{item}</p>
        ))}
      </div>
    </div>
  );
}

function fileIcon(extension?: string): string {
  if (extension === 'ts' || extension === 'tsx') return 'TS';
  if (extension === 'js' || extension === 'jsx') return 'JS';
  if (extension === 'json') return '{}';
  if (extension === 'yml' || extension === 'yaml') return 'CI';
  if (extension === 'md') return 'MD';
  return '·';
}

// Made with Bob
// made by bob
