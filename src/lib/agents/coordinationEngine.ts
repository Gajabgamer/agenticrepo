import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { getPrisma } from '@/lib/database/prisma';
import { incidentKey } from '@/lib/incidents/incidentManager';
import { getEngineeringMemorySnapshot } from '@/lib/memory/engineeringMemoryEngine';

export type AgentType =
  | 'Workflow Intelligence Agent'
  | 'Regression Detection Agent'
  | 'Repository Intelligence Agent'
  | 'Recovery Agent'
  | 'Documentation Agent';

type CoordinationInput = {
  repository: string;
  triggerType: 'workflow_failure' | 'terminal' | 'memory_refresh' | 'recovery' | 'manual';
  workflowName?: string;
  incidentKey?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

const agents: Array<{ type: AgentType; task: string }> = [
  { type: 'Workflow Intelligence Agent', task: 'Inspect workflow instability and CI/CD execution patterns.' },
  { type: 'Regression Detection Agent', task: 'Correlate regression signals, suspicious commits, and risky modules.' },
  { type: 'Repository Intelligence Agent', task: 'Map affected repository modules, hotspots, and architecture context.' },
  { type: 'Recovery Agent', task: 'Evaluate remediation strategy, auto-fix gates, and stabilization probability.' },
  { type: 'Documentation Agent', task: 'Generate operational explanation and engineering handoff summary.' },
];

// made by bob
export async function runAgentCoordination(input: CoordinationInput) {
  const prisma = getPrisma();
  const runKey = incidentKey(['agent-coordination', input.repository, input.triggerType, input.workflowName || input.incidentKey || 'manual']);
  const [incidents, investigations, recoveries, reviews, memory] = await Promise.all([
    prisma.incident.findMany({ where: { repository: input.repository }, orderBy: { openedAt: 'desc' }, take: 12 }),
    prisma.investigation.findMany({ where: { repository: input.repository }, orderBy: { startedAt: 'desc' }, take: 8 }),
    prisma.workflowRecovery.findMany({ where: { repository: input.repository }, orderBy: { startedAt: 'desc' }, take: 8 }),
    prisma.pullRequestReview.findMany({ where: { repository: input.repository }, orderBy: { startedAt: 'desc' }, take: 8 }),
    getEngineeringMemorySnapshot(input.repository),
  ]);
  const run = await prisma.agentCoordinationRun.upsert({
    where: { runKey },
    create: {
      runKey,
      repository: input.repository,
      triggerType: input.triggerType,
      status: 'RUNNING',
      priority: input.priority || inferPriority(incidents, recoveries, memory.stats.highRiskMemoryCount),
      activeAgent: agents[0].type,
      linkedWorkflow: input.workflowName,
      linkedIncidentKey: input.incidentKey,
    },
    update: {
      status: 'RUNNING',
      priority: input.priority || inferPriority(incidents, recoveries, memory.stats.highRiskMemoryCount),
      activeAgent: agents[0].type,
      completedAt: null,
    },
  });

  await prisma.agentTask.deleteMany({ where: { runId: run.id } });
  await prisma.agentFinding.deleteMany({ where: { runId: run.id } });

  for (const agent of agents) {
    await prisma.agentTask.create({
      data: {
        runId: run.id,
        agentType: agent.type,
        title: agent.task,
        status: 'COMPLETED',
        priority: input.priority || inferPriority(incidents, recoveries, memory.stats.highRiskMemoryCount),
        summary: buildTaskSummary(agent.type, { incidents, investigations, recoveries, reviews, memory }),
        context: JSON.stringify({
          repository: input.repository,
          workflowName: input.workflowName,
          triggerType: input.triggerType,
        }),
        completedAt: new Date(),
      },
    });
  }

  const findings = buildFindings({ incidents, investigations, recoveries, reviews, memory });
  for (const finding of findings) {
    await prisma.agentFinding.create({
      data: {
        runId: run.id,
        agentType: finding.agentType,
        findingType: finding.findingType,
        severity: finding.severity,
        summary: finding.summary,
        evidence: JSON.stringify(finding.evidence),
        confidence: finding.confidence,
      },
    });
  }

  const combinedConclusion = buildCombinedConclusion(input.repository, findings, memory.insights);
  const operationalSummary = [
    `${agents.length} specialized operational agent(s) completed coordination.`,
    `${findings.length} finding(s) produced from incidents, investigations, recovery, PR review, and memory graph signals.`,
    `Memory graph: ${memory.stats.nodeCount} node(s), ${memory.stats.edgeCount} edge(s), ${memory.stats.memoryCount} memory record(s).`,
  ].join(' ');
  const completed = await prisma.agentCoordinationRun.update({
    where: { id: run.id },
    data: {
      status: 'COMPLETED',
      activeAgent: 'Documentation Agent',
      combinedConclusion,
      operationalSummary,
      completedAt: new Date(),
    },
    include: {
      tasks: { orderBy: { startedAt: 'asc' } },
      findings: { orderBy: { createdAt: 'asc' } },
    },
  });

  await logActivityEvent({
    eventType: 'agent_coordination',
    repository: input.repository,
    severity: findings.some((finding) => finding.severity === 'CRITICAL' || finding.severity === 'HIGH') ? 'warning' : 'info',
    status: 'completed',
    summary: `Agent coordination completed: ${findings.length} finding(s)`,
    details: {
      runId: completed.id,
      agents: agents.map((agent) => agent.type),
      findingTypes: findings.map((finding) => finding.findingType),
    },
    relatedWorkflow: input.workflowName,
  });

  return completed;
}

export async function getLatestAgentCoordination(repository?: string) {
  return getPrisma().agentCoordinationRun.findMany({
    where: repository ? { repository } : undefined,
    include: {
      tasks: { orderBy: { startedAt: 'asc' } },
      findings: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { startedAt: 'desc' },
    take: 12,
  });
}

function buildTaskSummary(
  agentType: AgentType,
  context: {
    incidents: Array<{ status: string; relatedWorkflow: string | null; severity: string }>;
    investigations: Array<{ status: string; rootCause: string | null }>;
    recoveries: Array<{ strategy: string; status: string; stabilizationProbability: number }>;
    reviews: Array<{ riskClassification: string; riskScore: number }>;
    memory: Awaited<ReturnType<typeof getEngineeringMemorySnapshot>>;
  }
): string {
  switch (agentType) {
    case 'Workflow Intelligence Agent':
      return `${context.incidents.length} incident signal(s), ${context.incidents.filter((incident) => incident.relatedWorkflow).length} workflow-linked event(s).`;
    case 'Regression Detection Agent':
      return `${context.investigations.length} investigation(s), ${context.memory.stats.riskyModuleCount} risky module memory record(s).`;
    case 'Repository Intelligence Agent':
      return `${context.memory.stats.nodeCount} graph node(s), ${context.memory.stats.edgeCount} relationship edge(s) available.`;
    case 'Recovery Agent':
      return `${context.recoveries.length} recovery plan(s), latest strategy ${context.recoveries[0]?.strategy || 'not available'}.`;
    case 'Documentation Agent':
      return `${context.memory.insights.length} memory-backed insight(s) ready for operational summary.`;
  }
}

function buildFindings(context: {
  incidents: Array<{ status: string; severity: string; engineeringSummary: string }>;
  investigations: Array<{ rootCause: string | null; confidenceLevel: string | null }>;
  recoveries: Array<{ strategy: string; status: string; stabilizationProbability: number }>;
  reviews: Array<{ riskClassification: string; riskScore: number; reasoning: string }>;
  memory: Awaited<ReturnType<typeof getEngineeringMemorySnapshot>>;
}) {
  return [
    {
      agentType: 'Workflow Intelligence Agent' as AgentType,
      findingType: 'workflow_state',
      severity: context.incidents.some((incident) => incident.status !== 'RESOLVED') ? 'HIGH' : 'LOW',
      summary: `${context.incidents.filter((incident) => incident.status !== 'RESOLVED').length} active incident(s) influence workflow stability.`,
      confidence: Math.min(95, 50 + context.incidents.length * 5),
      evidence: { incidentCount: context.incidents.length },
    },
    {
      agentType: 'Regression Detection Agent' as AgentType,
      findingType: 'regression_memory',
      severity: context.memory.stats.riskyModuleCount > 0 ? 'HIGH' : 'MEDIUM',
      summary: `${context.memory.stats.riskyModuleCount} risky module memory record(s) and ${context.memory.stats.highRiskMemoryCount} high-risk memory record(s) available.`,
      confidence: Math.min(95, 45 + context.memory.stats.memoryCount * 4),
      evidence: context.memory.stats,
    },
    {
      agentType: 'Repository Intelligence Agent' as AgentType,
      findingType: 'knowledge_graph',
      severity: context.memory.stats.edgeCount > 10 ? 'MEDIUM' : 'LOW',
      summary: `Knowledge graph links ${context.memory.stats.nodeCount} operational node(s) through ${context.memory.stats.edgeCount} relationship(s).`,
      confidence: Math.min(90, 40 + context.memory.stats.edgeCount),
      evidence: { nodes: context.memory.stats.nodeCount, edges: context.memory.stats.edgeCount },
    },
    {
      agentType: 'Recovery Agent' as AgentType,
      findingType: 'recovery_posture',
      severity: context.recoveries[0]?.status === 'MANUAL_REVIEW' ? 'MEDIUM' : 'LOW',
      summary: context.recoveries[0]
        ? `Latest recovery strategy ${context.recoveries[0].strategy} estimates ${context.recoveries[0].stabilizationProbability}% stabilization.`
        : 'No recovery plan has been recorded yet.',
      confidence: context.recoveries[0]?.stabilizationProbability || 45,
      evidence: context.recoveries[0] || {},
    },
    {
      agentType: 'Documentation Agent' as AgentType,
      findingType: 'operational_report',
      severity: 'LOW',
      summary: context.memory.insights[0] || context.reviews[0]?.reasoning || 'No operational report insight available yet.',
      confidence: context.memory.insights.length ? 82 : 55,
      evidence: { insights: context.memory.insights.slice(0, 4) },
    },
  ];
}

function buildCombinedConclusion(repository: string, findings: Array<{ summary: string; severity: string }>, insights: string[]): string {
  const highFindings = findings.filter((finding) => finding.severity === 'HIGH' || finding.severity === 'CRITICAL').length;
  const leadingInsight = insights[0] || findings[0]?.summary || 'No prior operational memory yet.';
  return `${repository} coordination completed with ${highFindings} high-severity finding(s). Primary memory insight: ${leadingInsight}`;
}

function inferPriority(
  incidents: Array<{ severity: string; status: string }>,
  recoveries: Array<{ status: string }>,
  highRiskMemoryCount: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (incidents.some((incident) => incident.severity === 'CRITICAL' && incident.status !== 'RESOLVED')) return 'CRITICAL';
  if (incidents.some((incident) => incident.severity === 'HIGH' && incident.status !== 'RESOLVED') || highRiskMemoryCount > 2) return 'HIGH';
  if (recoveries.some((recovery) => recovery.status === 'MANUAL_REVIEW') || incidents.length > 0) return 'MEDIUM';
  return 'LOW';
}

// Made with Bob
// made by bob
