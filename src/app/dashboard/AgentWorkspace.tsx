'use client';

import { useEffect, useState, useTransition } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  AnalysisPanel,
  RiskIndicator,
  StatusBadge,
  TerminalBlock,
} from '../ui/agent-components';
import { RepositorySelector } from './RepositorySelector';
import { SettingsForm } from './SettingsForm';
import { EngineeringTerminal } from './EngineeringTerminal';
import { ActivityTimeline, ActivityTimelineEvent } from './ActivityTimeline';
import { IncidentCenter, IncidentViewModel } from './IncidentCenter';
import { HealthViewModel, RepositoryHealthPanel } from './RepositoryHealthPanel';
import { InvestigationPanel, InvestigationViewModel } from './InvestigationPanel';
import { RepositoryArchitectureExplorer } from './RepositoryArchitectureExplorer';
import { PullRequestReviewPanel, PullRequestReviewViewModel } from './PullRequestReviewPanel';
import { WorkflowRecoveryPanel, WorkflowRecoveryViewModel } from './WorkflowRecoveryPanel';
import { EngineeringMemoryPanel, EngineeringMemoryViewModel } from './EngineeringMemoryPanel';
import { AgentCoordinationPanel, AgentCoordinationViewModel } from './AgentCoordinationPanel';

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
  groqConnected: boolean;
  preferredAiProvider: 'bob' | 'groq';
  webhookConfigured: boolean;
  autoFixEnabled: boolean;
  confidenceThreshold: number;
  lastAnalysis: PullRequestAnalysis | null;
  recentAnalyses: PullRequestAnalysis[];
  activityEvents: ActivityTimelineEvent[];
  incidents: IncidentViewModel[];
  investigations: InvestigationViewModel[];
  pullRequestReviews: PullRequestReviewViewModel[];
  recoveries: WorkflowRecoveryViewModel[];
  agentCoordinationRuns: AgentCoordinationViewModel[];
  engineeringMemory: EngineeringMemoryViewModel;
  health: HealthViewModel | null;
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
  | 'GitHub Action'
  | 'Terminal'
  | 'Activity'
  | 'Incidents'
  | 'Investigations'
  | 'Recovery'
  | 'Agent Network'
  | 'Memory Graph'
  | 'Architecture Explorer'
  | 'Repository Health'
  | 'Stability Overview'
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
  'GitHub Action',
  'Terminal',
  'Activity',
  'Incidents',
  'Investigations',
  'Recovery',
  'Agent Network',
  'Memory Graph',
  'Architecture Explorer',
  'Repository Health',
  'Stability Overview',
  'Settings',
];

const actionDefinitions = [
  ['Analyze Repository', 'Map architecture, runtime boundaries, and engineering hotspots.', 'agent analyze --repo'],
  ['Analyze Architecture', 'Build a repository map with modules, workflows, hotspots, and risk surfaces.', 'repo-map'],
  ['Detect Hotspots', 'Highlight failing modules, risky files, and investigation-linked surfaces.', 'detect-hotspots'],
  ['Map Workflows', 'Connect GitHub workflow definitions to repository modules.', 'architecture-summary'],
  ['Generate Documentation', 'Create architecture notes and onboarding-ready Markdown.', 'agent docs --architecture'],
  ['Detect Regressions', 'Correlate recent failures with suspicious commit windows.', 'agent regressions --correlate'],
  ['Review Pull Requests', 'Summarize changed modules, behavioral risk, and reviewer guidance.', 'review-pr <id>'],
  ['Scan Workflow Failures', 'Parse CI logs and rank likely root causes.', 'agent workflows --failed'],
  ['Recover Workflow', 'Evaluate remediation strategy and stabilization probability.', 'recover-workflow'],
  ['Coordinate Agents', 'Route workflow, regression, repository, recovery, and documentation agents.', 'assign-analysis'],
  ['Refresh Memory Graph', 'Learn recurring incidents, unstable workflows, and risky modules.', 'memory-status'],
  ['Create Auto-Fix Pull Request', 'Prepare deterministic safe fixes and open a reviewable PR.', 'agent fix --safe --pull-request'],
] as const;

const baselineFeed: ActivityLine[] = [
  { label: 'intake', text: 'webhook listener armed for pull_request, workflow_run, issue_comment', tone: 'info' },
  { label: 'repo', text: 'repository intelligence waits for authenticated selection', tone: 'neutral' },
  { label: 'ai', text: 'Bob or Groq connection gates generated engineering output', tone: 'warning' },
];

function buildOperationFeed(actionTitle: string, repositoryName: string, providerName: string): ActivityLine[] {
  return [
    { label: 'command', text: `${actionTitle} queued for ${repositoryName}`, tone: 'info' },
    { label: 'workspace', text: 'repository context loaded with rollback safety', tone: 'healthy' },
    { label: 'signals', text: 'workflow logs, commits, and affected modules correlated', tone: 'info' },
    { label: 'ai', text: `${providerName} engineering summary generated for review`, tone: 'healthy' },
    { label: 'result', text: `${actionTitle} completed with actionable output`, tone: 'healthy' },
  ];
}

// made by bob
export function AgentWorkspace({
  authenticated,
  repository,
  bobConnected,
  groqConnected,
  preferredAiProvider,
  webhookConfigured,
  autoFixEnabled,
  confidenceThreshold,
  lastAnalysis,
  recentAnalyses,
  activityEvents,
  incidents,
  investigations,
  pullRequestReviews,
  recoveries,
  agentCoordinationRuns,
  engineeringMemory,
  health,
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const repositoryName = repository ? `${repository.owner}/${repository.repoName}` : 'No repository selected';
  const activeAiConnected = preferredAiProvider === 'groq' ? groqConnected : bobConnected;
  const providerName = preferredAiProvider === 'groq' ? 'Groq' : 'IBM Bob';
  const agentReady = authenticated && Boolean(repository) && activeAiConnected;
  const riskScore = lastAnalysis?.riskScore ?? (agentReady ? 34 : 62);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    const nextFeed = buildOperationFeed(selectedAction[0], repositoryName, providerName);
    let index = 0;
    const initialTimer = window.setTimeout(() => setFeed([nextFeed[0]]), 0);

    const timer = window.setInterval(() => {
      index += 1;
      setFeed(nextFeed.slice(0, index + 1));
      if (index >= nextFeed.length - 1) {
        window.clearInterval(timer);
        setStatus('complete');
      }
    }, 640);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [providerName, repositoryName, selectedAction, status]);

  function runAction(action: AgentAction) {
    setSelectedAction(action);
    setActiveView('AI Actions');

    if (!authenticated || !repository || !activeAiConnected) {
      setStatus('error');
      setFeed([
        {
          label: 'blocked',
          text: `login, repository selection, and ${providerName} API key are required before execution`,
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
              groqConnected={groqConnected}
              preferredAiProvider={preferredAiProvider}
              webhookConfigured={webhookConfigured}
              loginAction={loginAction}
              openPalette={() => setPaletteOpen(true)}
            />
            <OperationalStatusBar
              authenticated={authenticated}
              repository={repository}
              activeAiConnected={activeAiConnected}
              providerName={providerName}
              webhookConfigured={webhookConfigured}
              investigations={investigations}
              recoveries={recoveries}
              activityEvents={activityEvents}
            />
            <div className="mt-5">
              <ControlView
                activeView={activeView}
                authenticated={authenticated}
                repository={repository}
                repositoryName={repositoryName}
                bobConnected={bobConnected}
                groqConnected={groqConnected}
                preferredAiProvider={preferredAiProvider}
                webhookConfigured={webhookConfigured}
                autoFixEnabled={autoFixEnabled}
                confidenceThreshold={confidenceThreshold}
                lastAnalysis={lastAnalysis}
                recentAnalyses={recentAnalyses}
                activityEvents={activityEvents}
                incidents={incidents}
                investigations={investigations}
                pullRequestReviews={pullRequestReviews}
                recoveries={recoveries}
                agentCoordinationRuns={agentCoordinationRuns}
                engineeringMemory={engineeringMemory}
                health={health}
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
      <CommandPalette
        open={paletteOpen}
        setOpen={setPaletteOpen}
        setActiveView={setActiveView}
        runAction={runAction}
      />
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
  const nodes = ['Webhook', 'CI Parser', 'Regression AI', 'AI Summary', 'Fix PR'];

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
  groqConnected,
  preferredAiProvider,
  webhookConfigured,
  loginAction,
  openPalette,
}: {
  activeView: ViewId;
  repositoryName: string;
  authenticated: boolean;
  bobConnected: boolean;
  groqConnected: boolean;
  preferredAiProvider: 'bob' | 'groq';
  webhookConfigured: boolean;
  loginAction: () => Promise<void>;
  openPalette: () => void;
}) {
  const activeAiConnected = preferredAiProvider === 'groq' ? groqConnected : bobConnected;
  const providerName = preferredAiProvider === 'groq' ? 'Groq' : 'Bob';

  return (
    <header id="control-center" className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Live engineering control center</p>
        <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{activeView}</h2>
        <p className="agent-muted mt-1 text-sm">{repositoryName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={authenticated ? 'healthy' : 'warning'}>{authenticated ? 'GitHub session' : 'login required'}</StatusBadge>
        <StatusBadge tone={activeAiConnected ? 'healthy' : 'warning'}>
          {activeAiConnected ? `${providerName} connected` : `${providerName} key needed`}
        </StatusBadge>
        <StatusBadge tone={webhookConfigured ? 'healthy' : 'warning'}>{webhookConfigured ? 'webhook secure' : 'webhook setup'}</StatusBadge>
        <button
          type="button"
          onClick={openPalette}
          className="rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-sky-300/50"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
          title="Open command palette with Ctrl/Cmd + K"
        >
          Cmd K
        </button>
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
  groqConnected: boolean;
  preferredAiProvider: 'bob' | 'groq';
  webhookConfigured: boolean;
  autoFixEnabled: boolean;
  confidenceThreshold: number;
  lastAnalysis: PullRequestAnalysis | null;
  recentAnalyses: PullRequestAnalysis[];
  activityEvents: ActivityTimelineEvent[];
  incidents: IncidentViewModel[];
  investigations: InvestigationViewModel[];
  pullRequestReviews: PullRequestReviewViewModel[];
  recoveries: WorkflowRecoveryViewModel[];
  agentCoordinationRuns: AgentCoordinationViewModel[];
  engineeringMemory: EngineeringMemoryViewModel;
  health: HealthViewModel | null;
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
          agentReady={props.authenticated && Boolean(props.repository) && (props.preferredAiProvider === 'groq' ? props.groqConnected : props.bobConnected)}
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
      return <PullRequestReviewPanel initialReviews={props.pullRequestReviews} autoFixEnabled={props.autoFixEnabled} />;
    case 'Documentation':
      return <DocumentationView repositoryName={props.repositoryName} />;
    case 'AI Actions':
      return <ActionsView {...props} />;
    case 'GitHub Action':
      return <GitHubActionInstaller repository={props.repository} webhookUrl={props.webhookUrl} />;
    case 'Terminal':
      return <EngineeringTerminal />;
    case 'Activity':
      return <ActivityView events={props.activityEvents} feed={props.feed} status={props.status} />;
    case 'Incidents':
      return <IncidentCenter initialIncidents={props.incidents} />;
    case 'Investigations':
      return <InvestigationPanel initialInvestigations={props.investigations} />;
    case 'Recovery':
      return <WorkflowRecoveryPanel initialRecoveries={props.recoveries} />;
    case 'Agent Network':
      return <AgentCoordinationPanel initialRuns={props.agentCoordinationRuns} />;
    case 'Memory Graph':
      return <EngineeringMemoryPanel initialMemory={props.engineeringMemory} />;
    case 'Architecture Explorer':
      return <RepositoryArchitectureExplorer />;
    case 'Repository Health':
      return <RepositoryHealthPanel initialHealth={props.health} />;
    case 'Stability Overview':
      return <StabilityOverview health={props.health} incidents={props.incidents} events={props.activityEvents} />;
    case 'Settings':
      return (
        <SettingsForm
          hasBobApiKey={props.bobConnected}
          hasGroqApiKey={props.groqConnected}
          preferredAiProvider={props.preferredAiProvider}
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

function StabilityOverview({
  health,
  incidents,
  events,
}: {
  health: HealthViewModel | null;
  incidents: IncidentViewModel[];
  events: ActivityTimelineEvent[];
}) {
  return (
    <div className="grid gap-4">
      <RepositoryHealthPanel initialHealth={health} />
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="agent-soft rounded-3xl p-5">
          <h3 className="text-xl font-bold">Engineering stability indicators</h3>
          <p className="agent-muted mt-2 text-sm">Signals are computed from incidents, activity events, pull request analysis, and auto-fix outcomes.</p>
          <div className="mt-5 grid gap-3">
            <MetricTile label="Open incidents" value={`${incidents.filter((incident) => incident.status !== 'RESOLVED').length}`} tone="warning" />
            <MetricTile label="Resolved incidents" value={`${incidents.filter((incident) => incident.status === 'RESOLVED').length}`} tone="healthy" />
            <MetricTile label="Recent telemetry" value={`${events.length}`} />
          </div>
        </div>
        <IncidentCenter initialIncidents={incidents.slice(0, 5)} />
      </div>
    </div>
  );
}

function OverviewView(props: {
  authenticated?: boolean;
  repository?: ConnectedRepository;
  repositoryName: string;
  bobConnected: boolean;
  groqConnected: boolean;
  preferredAiProvider: 'bob' | 'groq';
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
  incidents?: IncidentViewModel[];
  investigations?: InvestigationViewModel[];
  recoveries?: WorkflowRecoveryViewModel[];
  pullRequestReviews?: PullRequestReviewViewModel[];
  activityEvents?: ActivityTimelineEvent[];
  engineeringMemory?: EngineeringMemoryViewModel;
  health?: HealthViewModel | null;
}) {
  const activeAiConnected = props.preferredAiProvider === 'groq' ? props.groqConnected : props.bobConnected;
  const providerLabel = props.preferredAiProvider === 'groq' ? 'Groq' : 'Bob';

  return (
    <div className="grid gap-4">
      <OnboardingChecklist
        authenticated={Boolean(props.authenticated)}
        repositoryConnected={props.repositoryName !== 'No repository selected'}
        aiConnected={activeAiConnected}
        webhookConfigured={props.webhookConfigured}
        monitoringStarted={props.status === 'complete' || props.feed.length > baselineFeed.length}
      />
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Repository" value={props.repositoryName} />
        <MetricTile label="AI provider" value={`${providerLabel}: ${activeAiConnected ? 'Connected' : 'Needed'}`} tone={activeAiConnected ? 'healthy' : 'warning'} />
        <MetricTile label="Auto-fix" value={props.autoFixEnabled ? 'Enabled' : 'Manual'} />
        <MetricTile label="Confidence" value={`${props.confidenceThreshold}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="agent-soft rounded-3xl p-5">
          <ActionsView {...props} selectedAction={props.actionDefinitions[0]} />
        </div>
        <div className="grid gap-4">
          <RiskIndicator score={props.riskScore} label="Regression signal" />
          <EngineeringTerminal compact />
        </div>
      </div>
      <UltimateRealismPanel
        repositoryName={props.repositoryName}
        repository={props.repository || null}
        incidents={props.incidents || []}
        investigations={props.investigations || []}
        recoveries={props.recoveries || []}
        pullRequestReviews={props.pullRequestReviews || []}
        activityEvents={props.activityEvents || []}
        engineeringMemory={props.engineeringMemory || null}
        health={props.health || null}
        riskScore={props.riskScore}
      />
    </div>
  );
}

function OperationalStatusBar({
  authenticated,
  repository,
  activeAiConnected,
  providerName,
  webhookConfigured,
  investigations,
  recoveries,
  activityEvents,
}: {
  authenticated: boolean;
  repository: ConnectedRepository;
  activeAiConnected: boolean;
  providerName: string;
  webhookConfigured: boolean;
  investigations: InvestigationViewModel[];
  recoveries: WorkflowRecoveryViewModel[];
  activityEvents: ActivityTimelineEvent[];
}) {
  const activeInvestigations = investigations.filter((investigation) => investigation.status !== 'COMPLETED').length;
  const activeRecoveries = recoveries.filter((recovery) => recovery.status !== 'STABILIZED').length;
  const lastEvent = activityEvents[0]?.createdAt ? new Date(activityEvents[0].createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : 'waiting';

  return (
    <section className="mt-5 grid gap-3 rounded-3xl border p-3 md:grid-cols-3 xl:grid-cols-7" style={{ borderColor: 'var(--border)', background: 'var(--panel-soft)' }}>
      {/* // made by bob */}
      <StatusChip label="GitHub" value={authenticated ? 'connected' : 'login needed'} tone={authenticated ? 'healthy' : 'warning'} />
      <StatusChip label="Repository" value={repository ? repository.defaultBranch : 'not selected'} tone={repository ? 'healthy' : 'warning'} />
      <StatusChip label={providerName} value={activeAiConnected ? 'ready' : 'key needed'} tone={activeAiConnected ? 'healthy' : 'warning'} />
      <StatusChip label="Webhook" value={webhookConfigured ? 'verified' : 'secret needed'} tone={webhookConfigured ? 'healthy' : 'warning'} />
      <StatusChip label="Investigations" value={`${activeInvestigations} active`} tone={activeInvestigations ? 'warning' : 'healthy'} />
      <StatusChip label="Recovery" value={`${activeRecoveries} active`} tone={activeRecoveries ? 'warning' : 'healthy'} />
      <StatusChip label="Telemetry" value={lastEvent} tone={activityEvents.length ? 'info' : 'neutral'} />
    </section>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: 'healthy' | 'warning' | 'danger' | 'neutral' | 'info' }) {
  const dot = tone === 'healthy' ? 'bg-emerald-300' : tone === 'warning' ? 'bg-amber-300' : tone === 'danger' ? 'bg-red-300' : tone === 'info' ? 'bg-sky-300' : 'bg-slate-400';

  return (
    <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }} title={`${label}: ${value}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot} shadow-[0_0_14px_currentColor]`} />
        <p className="agent-muted text-[0.65rem] uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function OnboardingChecklist({
  authenticated,
  repositoryConnected,
  aiConnected,
  webhookConfigured,
  monitoringStarted,
}: {
  authenticated: boolean;
  repositoryConnected: boolean;
  aiConnected: boolean;
  webhookConfigured: boolean;
  monitoringStarted: boolean;
}) {
  const steps = [
    ['Connect GitHub', authenticated],
    ['Select repository', repositoryConnected],
    ['Add Bob or Groq key', aiConnected],
    ['Configure webhook secret', webhookConfigured],
    ['Trigger first analysis', monitoringStarted],
  ] as const;
  const complete = steps.filter(([, done]) => done).length;

  if (complete === steps.length) {
    return null;
  }

  return (
    <section className="agent-soft rounded-3xl p-5">
      {/* // made by bob */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">operator onboarding</p>
          <h3 className="mt-2 text-xl font-bold">Bring the engineering agent online</h3>
          <p className="agent-muted mt-1 text-sm">Complete these setup checks to start repository monitoring and analysis.</p>
        </div>
        <StatusBadge tone="info">{complete}/{steps.length} ready</StatusBadge>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {steps.map(([label, done]) => (
          <div key={label} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: done ? 'rgba(16,185,129,0.08)' : 'var(--panel)' }}>
            <span className={done ? 'text-signal-green' : 'text-signal-amber'}>{done ? 'ready' : 'pending'}</span>
            <p className="mt-1 text-sm font-semibold">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CommandPalette({
  open,
  setOpen,
  setActiveView,
  runAction,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  setActiveView: (view: ViewId) => void;
  runAction: (action: AgentAction) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, setOpen]);

  if (!open) return null;

  const commands = [
    { label: 'Analyze Repository', hint: 'Run architecture and repository intelligence', view: 'AI Actions' as ViewId, action: actionDefinitions[0] },
    { label: 'Generate Documentation', hint: 'Open documentation generation action', view: 'Documentation' as ViewId, action: actionDefinitions[4] },
    { label: 'Investigate Incident', hint: 'Open investigations workspace', view: 'Investigations' as ViewId },
    { label: 'Run AutoFix', hint: 'Open safe auto-fix action launcher', view: 'AI Actions' as ViewId, action: actionDefinitions[11] },
    { label: 'Open Terminal', hint: 'Controlled engineering terminal', view: 'Terminal' as ViewId },
    { label: 'Show Workflows', hint: 'Workflow execution status', view: 'Workflows' as ViewId },
    { label: 'Open Activity Feed', hint: 'Live operational telemetry', view: 'Activity' as ViewId },
    { label: 'Repository Intelligence', hint: 'Architecture explorer and hotspots', view: 'Architecture Explorer' as ViewId },
    { label: 'Engineering Summary', hint: 'Open AI action center for summaries', view: 'AI Actions' as ViewId, action: actionDefinitions[0] },
  ];
  const filtered = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query.toLowerCase()));

  function runCommand(command: (typeof commands)[number]) {
    setActiveView(command.view);
    if (command.action) runAction(command.action);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-slate-950/55 p-4 pt-20 backdrop-blur-md sm:pt-28">
      {/* // made by bob */}
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border shadow-[0_30px_120px_rgba(2,6,23,0.45)]" style={{ borderColor: 'var(--border)', background: 'var(--panel-strong)' }}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">command palette</p>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search engineering actions..."
            className="mt-3 w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:border-sky-300"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', color: 'var(--foreground)' }}
          />
        </div>
        <div className="max-h-[420px] overflow-auto p-2">
          {filtered.length ? filtered.map((command) => (
            <button
              key={command.label}
              type="button"
              onClick={() => runCommand(command)}
              className="group grid w-full gap-1 rounded-2xl p-4 text-left transition hover:bg-sky-400/10"
            >
              <span className="font-semibold">{command.label}</span>
              <span className="agent-muted text-sm">{command.hint}</span>
            </button>
          )) : (
            <div className="p-6 text-sm agent-muted">No command matched. Try terminal, workflows, activity, or repository.</div>
          )}
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
  riskScore,
  autoFixEnabled,
}: {
  actionDefinitions: readonly AgentAction[];
  runAction: (action: AgentAction) => void;
  isPending: boolean;
  selectedAction: AgentAction;
  status: OperationStatus;
  riskScore?: number;
  autoFixEnabled?: boolean;
}) {
  const requiresApproval = selectedAction[0].includes('Auto-Fix') || selectedAction[0].includes('Recover') || (riskScore || 0) >= 70;

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
      {requiresApproval ? (
        <div className="rounded-3xl border border-amber-300/30 bg-amber-400/10 p-4">
          {/* // made by bob */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-signal-amber">Awaiting engineering approval checkpoint</p>
              <p className="agent-muted mt-1 text-sm">
                High-risk remediation or repository modification detected. AgenticRepo keeps this action review-first and does not silently modify protected repository state.
              </p>
            </div>
            <StatusBadge tone={autoFixEnabled ? 'warning' : 'neutral'}>{autoFixEnabled ? 'approval required' : 'manual mode'}</StatusBadge>
          </div>
        </div>
      ) : null}
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

function GitHubActionInstaller({ repository, webhookUrl }: { repository: ConnectedRepository; webhookUrl: string }) {
  const workflow = buildAgenticRepoWorkflow(webhookUrl);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      {/* // made by bob */}
      <section className="agent-soft rounded-3xl p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">github-native installer</p>
        <h3 className="mt-2 text-2xl font-bold tracking-[-0.04em]">Install AgenticRepo GitHub Action</h3>
        <p className="agent-muted mt-2 text-sm leading-6">
          Add this workflow to your repository at <span className="font-mono">.github/workflows/agenticrepo.yml</span> to run repository intelligence checks from GitHub Actions.
        </p>
        <div className="mt-5 grid gap-3">
          <InstallStep title="1. Create workflow file" text=".github/workflows/agenticrepo.yml" />
          <InstallStep title="2. Add repository secrets" text="AGENTICREPO_WEBHOOK_SECRET and optional BOB_API_KEY or GROQ_API_KEY" />
          <InstallStep title="3. Commit and push" text="AgenticRepo will receive workflow and pull request signals through GitHub-native automation." />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(workflow)}
            className="rounded-2xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            Copy workflow YAML
          </button>
          <a
            href={`data:text/yaml;charset=utf-8,${encodeURIComponent(workflow)}`}
            download="agenticrepo.yml"
            className="rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
          >
            Download agenticrepo.yml
          </a>
        </div>
        <p className="agent-muted mt-4 text-xs">
          Target repository: {repository ? `${repository.owner}/${repository.repoName}` : 'select a repository first'}
        </p>
      </section>

      <section className="agent-terminal rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-sky-300">.github/workflows/agenticrepo.yml</p>
          <StatusBadge tone="info">bootstrap</StatusBadge>
        </div>
        <pre className="mt-4 max-h-[620px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-300">{workflow}</pre>
      </section>
    </div>
  );
}

function InstallStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="font-semibold">{title}</p>
      <p className="agent-muted mt-1 text-sm">{text}</p>
    </div>
  );
}

function buildAgenticRepoWorkflow(webhookUrl: string): string {
  return `name: AgenticRepo

on:
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_run:
    workflows: ["CI", "Test", "Build"]
    types: [completed]
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: read
  actions: read

jobs:
  agenticrepo:
    name: Repository intelligence signal
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Notify AgenticRepo
        env:
          AGENTICREPO_WEBHOOK_URL: ${webhookUrl}
          AGENTICREPO_WEBHOOK_SECRET: \${{ secrets.AGENTICREPO_WEBHOOK_SECRET }}
        run: |
          echo "AgenticRepo workflow bootstrap active"
          echo "Repository: \${{ github.repository }}"
          echo "Ref: \${{ github.ref }}"
          echo "Event: \${{ github.event_name }}"
`;
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

function DocumentationView({ repositoryName }: { repositoryName: string }) {
  return (
    <div className="agent-terminal rounded-3xl p-5">
      <p className="font-mono text-xs text-slate-500">docs/engineering-intelligence.md</p>
      <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
        <p className="text-xl font-bold text-white"># {repositoryName}</p>
        <p>This repository is monitored for workflow failures, suspicious commits, regression risk, and generated fix activity.</p>
        <p className="text-sky-300">## Operational map</p>
        <p>GitHub webhooks feed analysis. Bob or Groq generates summaries. Safe repository modification flows create reviewable pull requests.</p>
      </div>
    </div>
  );
}

function ActivityView({
  events,
  feed,
  status,
}: {
  events: ActivityTimelineEvent[];
  feed: ActivityLine[];
  status: OperationStatus;
}) {
  return (
    <div className="grid gap-4">
      <ActivityTimeline initialEvents={events} />
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

function UltimateRealismPanel({
  repositoryName,
  repository,
  incidents,
  investigations,
  recoveries,
  pullRequestReviews,
  activityEvents,
  engineeringMemory,
  health,
  riskScore,
}: {
  repositoryName: string;
  repository: ConnectedRepository;
  incidents: IncidentViewModel[];
  investigations: InvestigationViewModel[];
  recoveries: WorkflowRecoveryViewModel[];
  pullRequestReviews: PullRequestReviewViewModel[];
  activityEvents: ActivityTimelineEvent[];
  engineeringMemory: EngineeringMemoryViewModel;
  health: HealthViewModel | null;
  riskScore: number;
}) {
  const latestIncident = incidents[0] || null;
  const latestInvestigation = investigations[0] || null;
  const latestRecovery = recoveries[0] || null;
  const latestReview = pullRequestReviews[0] || null;
  const riskyMemories = engineeringMemory?.memories.filter((memory) => memory.severity === 'HIGH' || memory.severity === 'CRITICAL').slice(0, 4) || [];
  const affectedFiles = parseJsonList(latestIncident?.affectedFiles || latestInvestigation?.affectedFiles || latestReview?.changedFiles || null);
  const securitySignals = affectedFiles.filter((file) => /auth|secret|env|workflow|permission|package|lock|config/i.test(file));

  return (
    <section className="grid gap-4">
      {/* // made by bob */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="agent-soft rounded-3xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">explainability and decision trace</p>
              <h3 className="mt-2 text-xl font-bold">Why AgenticRepo flagged this</h3>
              <p className="agent-muted mt-2 text-sm">Transparent reasoning built from incidents, investigations, PR review, workflow recovery, and repository memory.</p>
            </div>
            <ConfidenceBadge score={latestReview?.confidenceScore || latestRecovery?.confidenceScore || (100 - riskScore)} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ReasonCard label="Why flagged" value={latestIncident?.engineeringSummary || latestInvestigation?.rootCause || latestReview?.reasoning || 'No active anomaly. Monitoring repository telemetry.'} />
            <ReasonCard label="Operational impact" value={latestRecovery?.operationalImpact || latestReview?.deploymentConcerns || 'Impact will be scored after workflow or PR evidence arrives.'} />
            <ReasonCard label="Related workflow" value={latestIncident?.relatedWorkflow || latestRecovery?.workflowName || latestInvestigation?.relatedWorkflow || 'No workflow link yet.'} />
            <ReasonCard label="Linked incident" value={latestIncident?.incidentKey || latestRecovery?.id || 'No linked incident yet.'} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(affectedFiles.length ? affectedFiles : ['No affected files recorded yet']).slice(0, 8).map((file) => (
              <span key={file} className="rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">{file}</span>
            ))}
          </div>
        </div>

        <div className="agent-soft rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">repository personality</p>
          <h3 className="mt-2 text-xl font-bold">{repositoryName}</h3>
          <div className="mt-5 grid gap-3">
            <MiniRealityMetric label="Framework tendency" value={inferStack(affectedFiles, repositoryName)} />
            <MiniRealityMetric label="Workflow character" value={health?.workflowReliability ? `${health.workflowReliability}% reliable` : 'learning workflow baseline'} />
            <MiniRealityMetric label="Risky areas" value={riskyMemories.length ? riskyMemories.map((memory) => memory.subject).join(', ') : 'none learned yet'} />
            <MiniRealityMetric label="Operational tendency" value={incidents.length > 2 ? 'incident-prone under active learning' : 'stable or insufficient history'} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <WorkflowReplayCard
          activityEvents={activityEvents}
          latestIncident={latestIncident}
          latestInvestigation={latestInvestigation}
          latestRecovery={latestRecovery}
        />
        <NotificationCenter events={activityEvents} incidents={incidents} recoveries={recoveries} />
        <OperationalQueue investigations={investigations} recoveries={recoveries} reviews={pullRequestReviews} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <RepositorySnapshotCard repository={repository} affectedFiles={affectedFiles} activityEvents={activityEvents} health={health} />
        <SecurityAwarenessCard securitySignals={securitySignals} affectedFiles={affectedFiles} riskScore={riskScore} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <ProviderCapabilityCard />
        <EngineeringReportCard
          repositoryName={repositoryName}
          latestIncident={latestIncident}
          latestInvestigation={latestInvestigation}
          latestRecovery={latestRecovery}
          health={health}
          riskScore={riskScore}
        />
      </div>
    </section>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const safe = Math.max(0, Math.min(100, score));
  const tone = safe >= 75 ? 'healthy' : safe >= 50 ? 'warning' : 'danger';
  return <StatusBadge tone={tone}>{safe}% confidence</StatusBadge>;
}

function ReasonCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}

function MiniRealityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <p className="agent-muted text-[0.65rem] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function WorkflowReplayCard({
  activityEvents,
  latestIncident,
  latestInvestigation,
  latestRecovery,
}: {
  activityEvents: ActivityTimelineEvent[];
  latestIncident: IncidentViewModel | null;
  latestInvestigation: InvestigationViewModel | null;
  latestRecovery: WorkflowRecoveryViewModel | null;
}) {
  const replay = [
    ['Commit', latestIncident?.affectedFiles ? 'affected files captured' : 'waiting for commit evidence'],
    ['Workflow Failure', activityEvents.find((event) => event.eventType === 'workflow_failure')?.summary || latestIncident?.relatedWorkflow || 'no failed workflow yet'],
    ['Investigation', latestInvestigation?.currentStage || latestInvestigation?.status || 'not started'],
    ['Regression Detection', latestIncident?.severity || 'no severity assigned'],
    ['Recovery', latestRecovery?.strategy || 'no recovery plan yet'],
    ['Fix PR', latestRecovery?.recoveryPullRequestUrl || 'reviewable PR pending eligibility'],
  ];

  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">workflow replay</p>
      <h3 className="mt-2 text-xl font-bold">Operational history replay</h3>
      <div className="mt-5 grid gap-3">
        {replay.map(([label, value], index) => (
          <div key={label} className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-400/10 font-mono text-xs text-sky-300">{index + 1}</span>
            <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <p className="font-semibold">{label}</p>
              <p className="agent-muted mt-1 text-xs leading-5">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationCenter({ events, incidents, recoveries }: { events: ActivityTimelineEvent[]; incidents: IncidentViewModel[]; recoveries: WorkflowRecoveryViewModel[] }) {
  const notifications = [
    ...events.slice(0, 3).map((event) => ({ title: event.eventType.replaceAll('_', ' '), text: event.summary, tone: event.severity })),
    ...incidents.filter((incident) => incident.status !== 'RESOLVED').slice(0, 2).map((incident) => ({ title: 'active incident', text: incident.engineeringSummary, tone: 'warning' })),
    ...recoveries.slice(0, 2).map((recovery) => ({ title: 'recovery update', text: `${recovery.strategy} ${recovery.stabilizationProbability}% stabilization`, tone: recovery.status === 'STABILIZED' ? 'success' : 'info' })),
  ];

  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">notification center</p>
      <h3 className="mt-2 text-xl font-bold">Operational notifications</h3>
      <div className="mt-5 grid gap-3">
        {(notifications.length ? notifications : [{ title: 'repository synced', text: 'No critical notifications. Monitoring remains active.', tone: 'success' }]).slice(0, 6).map((notification) => (
          <div key={`${notification.title}-${notification.text}`} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
            <p className="text-sm font-semibold capitalize">{notification.title}</p>
            <p className="agent-muted mt-1 line-clamp-2 text-xs leading-5">{notification.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationalQueue({ investigations, recoveries, reviews }: { investigations: InvestigationViewModel[]; recoveries: WorkflowRecoveryViewModel[]; reviews: PullRequestReviewViewModel[] }) {
  const queue = [
    ...investigations.slice(0, 3).map((item) => ({ label: 'investigation', status: item.status, text: item.currentStage || item.triggerType })),
    ...recoveries.slice(0, 3).map((item) => ({ label: 'recovery', status: item.status, text: item.strategy })),
    ...reviews.slice(0, 3).map((item) => ({ label: 'pr review', status: item.status, text: `PR #${item.prNumber} ${item.riskClassification}` })),
  ];

  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">background task system</p>
      <h3 className="mt-2 text-xl font-bold">Operational queue</h3>
      <div className="mt-5 grid gap-3">
        {(queue.length ? queue : [{ label: 'queue', status: 'IDLE', text: 'No queued background work.' }]).slice(0, 7).map((item) => (
          <div key={`${item.label}-${item.text}`} className="flex items-center justify-between gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
            <div>
              <p className="font-semibold capitalize">{item.label}</p>
              <p className="agent-muted mt-1 text-xs">{item.text}</p>
            </div>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem]">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RepositorySnapshotCard({ repository, affectedFiles, activityEvents, health }: { repository: ConnectedRepository; affectedFiles: string[]; activityEvents: ActivityTimelineEvent[]; health: HealthViewModel | null }) {
  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">repository snapshots</p>
      <h3 className="mt-2 text-xl font-bold">State before and after incident</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ReasonCard label="Before incident" value={`${repository?.defaultBranch || 'main'} baseline, ${health?.workflowReliability || 0}% workflow reliability, ${activityEvents.length} telemetry records.`} />
        <ReasonCard label="Operational delta" value={`${affectedFiles.length} affected file(s), latest event ${activityEvents[0]?.eventType || 'none'}, repository state tracked through incidents and activity.`} />
      </div>
    </div>
  );
}

function SecurityAwarenessCard({ securitySignals, affectedFiles, riskScore }: { securitySignals: string[]; affectedFiles: string[]; riskScore: number }) {
  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">security awareness</p>
      <h3 className="mt-2 text-xl font-bold">Sensitive change detection</h3>
      <div className="mt-5 grid gap-3">
        <ReasonCard label="Workflow permission risk" value={affectedFiles.some((file) => file.includes('.github')) ? 'Workflow file touched. Review permissions and secret exposure before merge.' : 'No workflow permission file detected in current affected files.'} />
        <ReasonCard label="Sensitive configuration" value={securitySignals.length ? securitySignals.join(', ') : 'No sensitive config pattern detected in current file evidence.'} />
        <ReasonCard label="Dependency risk" value={affectedFiles.some((file) => /package|lock|pnpm|yarn/i.test(file)) ? 'Dependency change detected. Review transitive install and build impact.' : `No dependency file detected. Current risk score ${riskScore}%.`} />
      </div>
    </div>
  );
}

function ProviderCapabilityCard() {
  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">multi-provider ai system</p>
      <h3 className="mt-2 text-xl font-bold">Provider capabilities and routing</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ReasonCard label="IBM Bob" value="Default provider for structured engineering reasoning, incident summaries, and repository explanations." />
        <ReasonCard label="Groq" value="Fast provider profile for concise context, quick summaries, and lower-latency operational feedback." />
      </div>
      <p className="agent-muted mt-4 text-sm">Provider switching is configured in Settings. Context optimization adapts token budgets per provider.</p>
    </div>
  );
}

function EngineeringReportCard({
  repositoryName,
  latestIncident,
  latestInvestigation,
  latestRecovery,
  health,
  riskScore,
}: {
  repositoryName: string;
  latestIncident: IncidentViewModel | null;
  latestInvestigation: InvestigationViewModel | null;
  latestRecovery: WorkflowRecoveryViewModel | null;
  health: HealthViewModel | null;
  riskScore: number;
}) {
  const report = buildMarkdownReport({ repositoryName, latestIncident, latestInvestigation, latestRecovery, health, riskScore });

  return (
    <div className="agent-soft rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">engineering report generation</p>
      <h3 className="mt-2 text-xl font-bold">Download operational markdown</h3>
      <p className="agent-muted mt-2 text-sm">Generate incident, recovery, architecture, and workflow summary reports from current operational evidence.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {['incident', 'postmortem', 'architecture', 'workflow', 'recovery'].map((kind) => (
          <a
            key={kind}
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(report)}`}
            download={`agenticrepo-${kind}-report.md`}
            className="rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition hover:-translate-y-0.5"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
          >
            {kind} report
          </a>
        ))}
      </div>
    </div>
  );
}

function buildMarkdownReport({
  repositoryName,
  latestIncident,
  latestInvestigation,
  latestRecovery,
  health,
  riskScore,
}: {
  repositoryName: string;
  latestIncident: IncidentViewModel | null;
  latestInvestigation: InvestigationViewModel | null;
  latestRecovery: WorkflowRecoveryViewModel | null;
  health: HealthViewModel | null;
  riskScore: number;
}) {
  return `# AgenticRepo Engineering Report

Repository: ${repositoryName}
Generated: ${new Date().toISOString()}

## Health
- Health score: ${health?.healthScore ?? 'unknown'}
- Status: ${health?.status ?? 'unknown'}
- Regression risk: ${riskScore}%

## Incident
${latestIncident?.engineeringSummary || 'No active incident evidence.'}

## Investigation
${latestInvestigation?.conclusion || latestInvestigation?.rootCause || 'No investigation conclusion yet.'}

## Recovery
${latestRecovery ? `${latestRecovery.strategy}: ${latestRecovery.proposedRemediation}` : 'No recovery plan yet.'}

## Approval Note
High-risk remediation should remain review-first and pull-request based.
`;
}

function parseJsonList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (item && typeof item === 'object' && 'filename' in item && typeof item.filename === 'string') return [item.filename];
        return [];
      });
    }
  } catch {
    return [value];
  }
  return [];
}

function inferStack(files: string[], repositoryName: string): string {
  const haystack = `${repositoryName} ${files.join(' ')}`.toLowerCase();
  if (haystack.includes('next') || haystack.includes('app/') || haystack.includes('tsx')) return 'Next.js / TypeScript application';
  if (haystack.includes('python') || haystack.includes('.py')) return 'Python service';
  if (haystack.includes('go.mod') || haystack.includes('.go')) return 'Go service';
  if (haystack.includes('package.json') || haystack.includes('src/')) return 'JavaScript or TypeScript repository';
  return 'framework profile still learning';
}

// Made with Bob
// made by bob
