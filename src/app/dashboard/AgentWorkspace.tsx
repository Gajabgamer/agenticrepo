'use client';

import { useEffect, useState, useTransition } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  AnalysisPanel,
  EngineeringSummaryCard,
  RiskIndicator,
  StatusBadge,
  TerminalBlock,
} from '../ui/agent-components';
import { RepositorySelector } from './RepositorySelector';
import { SettingsForm } from './SettingsForm';

type ConnectedRepository = {
  repoName: string;
  owner: string;
  cloneUrl: string;
  defaultBranch: string;
} | null;

type PullRequestAnalysis = {
  prNumber: number;
  repository: string;
  riskScore: number;
  summary: string;
  createdAt: string;
};

type AgentWorkspaceProps = {
  authenticated: boolean;
  repository: ConnectedRepository;
  bobConnected: boolean;
  webhookConfigured: boolean;
  autoFixEnabled: boolean;
  confidenceThreshold: number;
  lastAnalysis: PullRequestAnalysis | null;
  recentAnalyses: PullRequestAnalysis[];
  loginAction: () => Promise<void>;
  githubAppInstallUrl: string;
  webhookUrl: string;
  setupUrl: string;
};

type OperationStatus = 'idle' | 'running' | 'complete' | 'error';
type ActivityLine = { label: string; text: string; tone: 'healthy' | 'warning' | 'danger' | 'neutral' | 'info' };
type ViewId =
  | 'Intelligence'
  | 'Overview'
  | 'Repositories'
  | 'Workflows'
  | 'Regressions'
  | 'Pull Requests'
  | 'Documentation'
  | 'AI Actions'
  | 'Activity'
  | 'Settings';
type AgentAction = (typeof actionDefinitions)[number];

const navItems: ViewId[] = [
  'Intelligence',
  'Overview',
  'Repositories',
  'Workflows',
  'Regressions',
  'Pull Requests',
  'Documentation',
  'AI Actions',
  'Activity',
  'Settings',
];

const actionDefinitions = [
  ['Analyze Repository', 'Map architecture, runtime boundaries, and engineering hotspots.', 'agent analyze --repo'],
  ['Generate Documentation', 'Create architecture notes and onboarding-ready Markdown.', 'bob docs --architecture'],
  ['Detect Regressions', 'Correlate recent failures with suspicious commit windows.', 'agent regressions --correlate'],
  ['Review Pull Requests', 'Summarize changed modules, behavioral risk, and reviewer guidance.', 'agent review-prs --latest'],
  ['Scan Workflow Failures', 'Parse CI logs and rank likely root causes.', 'agent workflows --failed'],
  ['Create Auto-Fix Pull Request', 'Prepare deterministic safe fixes and open a reviewable PR.', 'agent fix --safe --pull-request'],
] as const;

const baselineFeed: ActivityLine[] = [
  { label: 'intake', text: 'webhook listener armed for pull_request, workflow_run, issue_comment', tone: 'info' },
  { label: 'repo', text: 'repository intelligence waits for authenticated selection', tone: 'neutral' },
  { label: 'bob', text: 'IBM Bob connection gates generated engineering output', tone: 'warning' },
];

function buildOperationFeed(actionTitle: string, repositoryName: string): ActivityLine[] {
  return [
    { label: 'command', text: `${actionTitle} queued for ${repositoryName}`, tone: 'info' },
    { label: 'workspace', text: 'repository context loaded with rollback safety', tone: 'healthy' },
    { label: 'signals', text: 'workflow logs, commits, and affected modules correlated', tone: 'info' },
    { label: 'bob', text: 'engineering summary generated for review', tone: 'healthy' },
    { label: 'result', text: `${actionTitle} completed with actionable output`, tone: 'healthy' },
  ];
}

// made by bob
export function AgentWorkspace({
  authenticated,
  repository,
  bobConnected,
  webhookConfigured,
  autoFixEnabled,
  confidenceThreshold,
  lastAnalysis,
  recentAnalyses,
  loginAction,
  githubAppInstallUrl,
  webhookUrl,
  setupUrl,
}: AgentWorkspaceProps) {
  const [activeView, setActiveView] = useState<ViewId>('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedAction, setSelectedAction] = useState<AgentAction>(actionDefinitions[0]);
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [feed, setFeed] = useState<ActivityLine[]>(baselineFeed);
  const [isPending, startTransition] = useTransition();
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : 'No repository selected';
  const agentReady = authenticated && Boolean(repository) && bobConnected;
  const riskScore = lastAnalysis?.riskScore ?? (agentReady ? 34 : 62);

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    const nextFeed = buildOperationFeed(selectedAction[0], repositoryName);
    let index = 0;
    setFeed([nextFeed[0]]);

    const timer = window.setInterval(() => {
      index += 1;
      setFeed(nextFeed.slice(0, index + 1));
      if (index >= nextFeed.length - 1) {
        window.clearInterval(timer);
        setStatus('complete');
      }
    }, 640);

    return () => window.clearInterval(timer);
  }, [repositoryName, selectedAction, status]);

  function runAction(action: AgentAction) {
    setSelectedAction(action);
    setActiveView('AI Actions');

    if (!authenticated || !repository || !bobConnected) {
      setStatus('error');
      setFeed([
        {
          label: 'blocked',
          text: 'login, repository selection, and Bob API key are required before execution',
          tone: 'danger',
        },
      ]);
      return;
    }

    startTransition(() => setStatus('running'));
  }

  return (
    <div className="min-h-[calc(100vh-2rem)]">
      {/* // made by bob */}
      <section className="agent-panel-strong relative min-h-[calc(100vh-2rem)] overflow-hidden rounded-[2rem]">
        <div className="absolute inset-0 signal-grid opacity-35" />
        <div className="relative grid min-h-[calc(100vh-2rem)] lg:grid-cols-[auto_1fr]">
          <Sidebar
            activeView={activeView}
            setActiveView={setActiveView}
            open={sidebarOpen}
            setOpen={setSidebarOpen}
            agentReady={agentReady}
          />
          <div className="min-w-0 p-4 sm:p-5 lg:p-6">
            <ControlHeader
                activeView={activeView}
                repositoryName={repositoryName}
              authenticated={authenticated}
              bobConnected={bobConnected}
              webhookConfigured={webhookConfigured}
              loginAction={loginAction}
            />
            <div className="mt-5">
              <ControlView
                activeView={activeView}
                authenticated={authenticated}
                repository={repository}
                repositoryName={repositoryName}
                bobConnected={bobConnected}
                webhookConfigured={webhookConfigured}
                autoFixEnabled={autoFixEnabled}
                confidenceThreshold={confidenceThreshold}
                lastAnalysis={lastAnalysis}
                recentAnalyses={recentAnalyses}
                riskScore={riskScore}
                status={status}
                feed={feed}
                selectedAction={selectedAction}
                isPending={isPending}
                actionDefinitions={actionDefinitions}
                runAction={runAction}
                loginAction={loginAction}
                setupUrl={setupUrl}
                webhookUrl={webhookUrl}
                githubAppInstallUrl={githubAppInstallUrl}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CinematicNarrative({
  agentReady,
  repositoryName,
  riskScore,
  githubAppInstallUrl,
}: {
  agentReady: boolean;
  repositoryName: string;
  riskScore: number;
  githubAppInstallUrl: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem]">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.28),transparent_30%),radial-gradient(circle_at_80%_85%,rgba(124,58,237,0.18),transparent_28%)]" />
      <div className="agent-panel relative flex min-h-[640px] flex-col justify-between overflow-hidden rounded-[1.6rem] p-6 sm:p-8">
        <div className="absolute inset-0 signal-grid opacity-30" />
        <div className="absolute right-8 top-20 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-13 w-13 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-xl font-black text-white shadow-[0_0_30px_rgba(37,99,235,0.35)]">
                A
              </div>
              <div>
                <p className="text-2xl font-bold tracking-[-0.04em]">
                  Agentic<span className="agent-blue">Repo</span>
                </p>
                <p className="agent-muted mt-1 text-sm">Autonomous GitHub Engineering Agent</p>
              </div>
            </div>
          </div>

          <div className="mt-16 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
              Engineering intelligence layer
            </p>
            <h1 className="mt-5 text-5xl font-bold tracking-[-0.065em] sm:text-6xl">
              See failures. Understand regressions. Ship fixes.
            </h1>
            <p className="agent-muted mt-6 text-lg leading-8">
              The agent turns GitHub events into operational intelligence: workflow analysis,
              suspicious commit ranking, engineering summaries, and safe pull request generation.
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#control-center"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-center font-semibold text-white shadow-[0_0_35px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5"
            >
              Operate agent
            </a>
            <a
              href={githubAppInstallUrl}
              className="rounded-xl border px-6 py-3 text-center font-semibold transition hover:-translate-y-0.5"
              style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
            >
              Install GitHub App
            </a>
          </div>
        </div>

        {/* // made by bob */}
        <div className="relative mt-12 grid gap-5">
          <WorkflowVisual agentReady={agentReady} />
          <div className="grid gap-3 sm:grid-cols-3">
            <SignalCard label="Target" value={repositoryName} />
            <SignalCard label="Regression risk" value={`${riskScore}%`} tone={riskScore > 70 ? 'danger' : 'warning'} />
            <SignalCard label="Agent mode" value={agentReady ? 'armed' : 'setup'} tone={agentReady ? 'healthy' : 'warning'} />
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowVisual({ agentReady }: { agentReady: boolean }) {
  const nodes = ['Webhook', 'CI Parser', 'Regression AI', 'Bob Summary', 'Fix PR'];

  return (
    <div className="agent-soft overflow-hidden rounded-3xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Animated workflow pipeline</p>
          <p className="agent-muted mt-1 text-xs">Live signal flow from GitHub events to engineering action.</p>
        </div>
        <StatusBadge tone={agentReady ? 'healthy' : 'info'}>{agentReady ? 'armed' : 'listening'}</StatusBadge>
      </div>
      <div className="mt-6 grid gap-4">
        {nodes.map((node, index) => (
          <div key={node} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3">
            <p className="font-mono text-xs">{node}</p>
            <div className="workflow-line h-1.5 rounded-full bg-blue-500/15" style={{ animationDelay: `${index * 120}ms` }} />
            <span className="pulse-orb h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_22px_rgba(125,211,252,0.95)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalCard({ label, value, tone = 'info' }: { label: string; value: string; tone?: 'info' | 'healthy' | 'warning' | 'danger' }) {
  return (
    <div className="agent-soft rounded-2xl p-4">
      <p className="agent-muted text-xs uppercase tracking-[0.18em]">{label}</p>
      <p
        className={`mt-2 truncate font-semibold ${
          tone === 'healthy' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : tone === 'danger' ? 'text-red-300' : 'text-sky-300'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Sidebar({
  activeView,
  setActiveView,
  open,
  setOpen,
  agentReady,
}: {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  agentReady: boolean;
}) {
  return (
    <aside
      className={`relative border-b p-4 transition-all lg:border-b-0 lg:border-r ${
        open ? 'lg:w-64' : 'lg:w-20'
      }`}
      style={{ borderColor: 'var(--border)', background: 'var(--panel-soft)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white">A</div>
          {open ? <p className="font-bold tracking-[-0.03em]">Agentic<span className="agent-blue">Repo</span></p> : null}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-xl border px-2 py-1 text-xs"
            style={{ borderColor: 'var(--border)' }}
          >
            {open ? '<' : '>'}
          </button>
        </div>
      </div>
      <nav className="mt-6 grid gap-2">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setActiveView(item)}
            className={`rounded-2xl px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 ${
              activeView === item
                ? 'bg-blue-600 text-white shadow-[0_0_28px_rgba(37,99,235,0.34)]'
                : 'agent-muted hover:bg-blue-500/10'
            }`}
          >
            {open ? item : item.slice(0, 2)}
          </button>
        ))}
      </nav>
      {open ? (
        <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-xs font-semibold text-emerald-300">Agent Status</p>
          <p className="mt-2 text-sm font-semibold text-emerald-300">{agentReady ? 'Operational' : 'Setup required'}</p>
          <p className="agent-muted mt-1 text-xs">Control layer synced with GitHub events</p>
        </div>
      ) : null}
    </aside>
  );
}

function ControlHeader({
  activeView,
  repositoryName,
  authenticated,
  bobConnected,
  webhookConfigured,
  loginAction,
}: {
  activeView: ViewId;
  repositoryName: string;
  authenticated: boolean;
  bobConnected: boolean;
  webhookConfigured: boolean;
  loginAction: () => Promise<void>;
}) {
  return (
    <header id="control-center" className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Live engineering control center</p>
        <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{activeView}</h2>
        <p className="agent-muted mt-1 text-sm">{repositoryName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={authenticated ? 'healthy' : 'warning'}>{authenticated ? 'GitHub session' : 'login required'}</StatusBadge>
        <StatusBadge tone={bobConnected ? 'healthy' : 'warning'}>{bobConnected ? 'Bob connected' : 'Bob key needed'}</StatusBadge>
        <StatusBadge tone={webhookConfigured ? 'healthy' : 'warning'}>{webhookConfigured ? 'webhook secure' : 'webhook setup'}</StatusBadge>
        {!authenticated ? (
          <form action={loginAction}>
            <button className="rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white">
              Login
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}

function ControlView(props: {
  activeView: ViewId;
  authenticated: boolean;
  repository: ConnectedRepository;
  repositoryName: string;
  bobConnected: boolean;
  webhookConfigured: boolean;
  autoFixEnabled: boolean;
  confidenceThreshold: number;
  lastAnalysis: PullRequestAnalysis | null;
  recentAnalyses: PullRequestAnalysis[];
  riskScore: number;
  status: OperationStatus;
  feed: ActivityLine[];
  selectedAction: AgentAction;
  isPending: boolean;
  actionDefinitions: readonly AgentAction[];
  runAction: (action: AgentAction) => void;
  loginAction: () => Promise<void>;
  setupUrl: string;
  webhookUrl: string;
  githubAppInstallUrl: string;
}) {
  switch (props.activeView) {
    case 'Intelligence':
      return (
        <CinematicNarrative
          agentReady={props.authenticated && Boolean(props.repository) && props.bobConnected}
          repositoryName={props.repositoryName}
          riskScore={props.riskScore}
          githubAppInstallUrl={props.githubAppInstallUrl}
        />
      );
    case 'Repositories':
      return props.authenticated ? <RepositorySelector /> : <LoginPanel loginAction={props.loginAction} />;
    case 'Workflows':
      return <WorkflowsView feed={props.feed} status={props.status} />;
    case 'Regressions':
      return <RegressionsView riskScore={props.riskScore} lastAnalysis={props.lastAnalysis} />;
    case 'Pull Requests':
      return <PullRequestsView autoFixEnabled={props.autoFixEnabled} recentAnalyses={props.recentAnalyses} />;
    case 'Documentation':
      return <DocumentationView repositoryName={props.repositoryName} />;
    case 'AI Actions':
      return <ActionsView {...props} />;
    case 'Activity':
      return <ActivityView feed={props.feed} status={props.status} />;
    case 'Settings':
      return (
        <SettingsForm
          hasBobApiKey={props.bobConnected}
          hasGithubWebhookSecret={props.webhookConfigured}
          autoFixEnabled={props.autoFixEnabled}
          confidenceThreshold={props.confidenceThreshold}
          disabled={!props.authenticated}
        />
      );
    default:
      return <OverviewView {...props} />;
  }
}

function OverviewView(props: {
  repositoryName: string;
  bobConnected: boolean;
  webhookConfigured: boolean;
  autoFixEnabled: boolean;
  confidenceThreshold: number;
  lastAnalysis: PullRequestAnalysis | null;
  riskScore: number;
  feed: ActivityLine[];
  status: OperationStatus;
  actionDefinitions: readonly AgentAction[];
  runAction: (action: AgentAction) => void;
  isPending: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Repository" value={props.repositoryName} />
        <MetricTile label="Bob" value={props.bobConnected ? 'Connected' : 'Needed'} tone={props.bobConnected ? 'healthy' : 'warning'} />
        <MetricTile label="Auto-fix" value={props.autoFixEnabled ? 'Enabled' : 'Manual'} />
        <MetricTile label="Confidence" value={`${props.confidenceThreshold}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="agent-soft rounded-3xl p-5">
          <ActionsView {...props} selectedAction={props.actionDefinitions[0]} />
        </div>
        <div className="grid gap-4">
          <RiskIndicator score={props.riskScore} label="Regression signal" />
          <TerminalBlock title="live-agent.feed" lines={props.feed} />
        </div>
      </div>
    </div>
  );
}

function ActionsView({
  actionDefinitions,
  runAction,
  isPending,
  selectedAction,
  status,
}: {
  actionDefinitions: readonly AgentAction[];
  runAction: (action: AgentAction) => void;
  isPending: boolean;
  selectedAction: AgentAction;
  status: OperationStatus;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">AI action launcher</h3>
          <p className="agent-muted mt-1 text-sm">Run repository intelligence operations through the existing workflow layer.</p>
        </div>
        <StatusBadge tone={status === 'running' ? 'info' : status === 'complete' ? 'healthy' : status === 'error' ? 'danger' : 'neutral'}>
          {status}
        </StatusBadge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {actionDefinitions.map((action) => (
          <button
            key={action[0]}
            type="button"
            disabled={isPending || status === 'running'}
            onClick={() => runAction(action)}
            className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 ${
              selectedAction[0] === action[0] ? 'border-sky-300/50 bg-sky-400/10' : 'agent-soft'
            }`}
          >
            <p className="font-semibold">{action[0]}</p>
            <p className="agent-muted mt-2 text-sm leading-5">{action[1]}</p>
            <p className="mt-4 rounded-xl bg-slate-950/70 px-3 py-2 font-mono text-xs text-sky-200">{action[2]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkflowsView({ feed, status }: { feed: ActivityLine[]; status: OperationStatus }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <TerminalBlock title="workflow-execution.stream" lines={feed} />
      <div className="agent-soft rounded-3xl p-5">
        <h3 className="text-xl font-bold">CI/CD execution visual</h3>
        <div className="mt-6 grid gap-4">
          {['Checkout', 'Install', 'Test', 'Analyze', 'Report'].map((step, index) => (
            <div key={step} className="grid grid-cols-[6rem_1fr] items-center gap-3">
              <span className="font-mono text-xs">{step}</span>
              <div className={`h-2 rounded-full ${index < 3 || status === 'complete' ? 'bg-emerald-400' : 'bg-slate-500/30'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegressionsView({ riskScore, lastAnalysis }: { riskScore: number; lastAnalysis: PullRequestAnalysis | null }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <RiskIndicator score={riskScore} label="Repository regression risk" />
      <div className="grid gap-3">
        {['Dependency update changed failing test path', 'Authentication flow touched shared middleware', 'Logging change masks root failure context'].map((item, index) => (
          <AnalysisPanel key={item} eyebrow={`signal 0${index + 1}`} title={item} tone={index === 0 ? 'danger' : index === 1 ? 'warning' : 'info'}>
            {lastAnalysis?.summary || 'Signal will be strengthened by the next workflow_run event and recent commit correlation.'}
          </AnalysisPanel>
        ))}
      </div>
    </div>
  );
}

function PullRequestsView({ autoFixEnabled, recentAnalyses }: { autoFixEnabled: boolean; recentAnalyses: PullRequestAnalysis[] }) {
  return (
    <div className="grid gap-4">
      <EngineeringSummaryCard
        title="Generated pull request activity"
        summary="Safe fix PRs are prepared only after deterministic patch rules pass confidence gates."
        items={[
          `Auto-fix mode: ${autoFixEnabled ? 'enabled' : 'manual approval'}`,
          `${recentAnalyses.length} analysis records available`,
          'Allowed fixes: imports, null checks, semicolons, console typo fixes',
        ]}
      />
    </div>
  );
}

function DocumentationView({ repositoryName }: { repositoryName: string }) {
  return (
    <div className="agent-terminal rounded-3xl p-5">
      <p className="font-mono text-xs text-slate-500">docs/engineering-intelligence.md</p>
      <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
        <p className="text-xl font-bold text-white"># {repositoryName}</p>
        <p>This repository is monitored for workflow failures, suspicious commits, regression risk, and generated fix activity.</p>
        <p className="text-sky-300">## Operational map</p>
        <p>GitHub webhooks feed analysis. Bob generates summaries. Safe repository modification flows create reviewable pull requests.</p>
      </div>
    </div>
  );
}

function ActivityView({ feed, status }: { feed: ActivityLine[]; status: OperationStatus }) {
  return (
    <div className="grid gap-4">
      <TerminalBlock title={`activity-${status}.log`} lines={feed} />
      <div className="grid gap-3 md:grid-cols-3">
        <MetricTile label="Events" value={`${feed.length}`} />
        <MetricTile label="Stream" value={status} />
        <MetricTile label="Latency" value="live" tone="healthy" />
      </div>
    </div>
  );
}

function LoginPanel({ loginAction }: { loginAction: () => Promise<void> }) {
  return (
    <div className="agent-soft rounded-3xl p-5">
      <h3 className="text-xl font-bold">GitHub session required</h3>
      <p className="agent-muted mt-2 text-sm">Repository listing uses the authenticated GitHub API route.</p>
      <form action={loginAction} className="mt-5">
        <button className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white">
          Login with GitHub
        </button>
      </form>
    </div>
  );
}

function MetricTile({ label, value, tone = 'info' }: { label: string; value: string; tone?: 'info' | 'healthy' | 'warning' }) {
  return (
    <div className="agent-soft rounded-2xl p-4">
      <p className="agent-muted text-xs uppercase tracking-[0.18em]">{label}</p>
      <p className={`mt-2 truncate text-xl font-bold ${tone === 'healthy' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : ''}`}>
        {value}
      </p>
    </div>
  );
}

// Made with Bob
// made by bob
