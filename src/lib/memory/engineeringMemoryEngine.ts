import { getPrisma } from '@/lib/database/prisma';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { incidentKey } from '@/lib/incidents/incidentManager';

type MemorySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type MemoryInsight = {
  type: string;
  subject: string;
  summary: string;
  severity: MemorySeverity;
  confidenceScore: number;
  occurrenceCount: number;
  evidence: Record<string, unknown>;
};

type GraphNodeInput = {
  nodeType: string;
  label: string;
  summary?: string;
  severity?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
};

type GraphEdgeInput = {
  sourceKey: string;
  targetKey: string;
  relationType: string;
  weight?: number;
  evidence?: Record<string, unknown>;
};

export type EngineeringMemorySnapshot = {
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
    lastSeenAt: Date;
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
};

// made by bob
export async function refreshEngineeringMemory(repository?: string): Promise<EngineeringMemorySnapshot> {
  const prisma = getPrisma();
  const targetRepository = repository || await inferRepository();
  const [incidents, investigations, recoveries, pullRequestReviews, activityEvents] = await Promise.all([
    prisma.incident.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      include: { history: { orderBy: { createdAt: 'desc' }, take: 8 } },
      orderBy: { openedAt: 'desc' },
      take: 80,
    }),
    prisma.investigation.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
    prisma.workflowRecovery.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
    prisma.pullRequestReview.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
    prisma.activityEvent.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 120,
    }),
  ]);
  const repositoryName = targetRepository || inferRepositoryFromSignals(incidents, investigations, recoveries, pullRequestReviews, activityEvents);

  await upsertNode(repositoryName, {
    nodeType: 'repository',
    label: repositoryName,
    summary: `Operational memory root for ${repositoryName}`,
    severity: incidents.some((incident) => incident.status !== 'RESOLVED') ? 'MEDIUM' : 'LOW',
    weight: Math.max(1, incidents.length + investigations.length + recoveries.length),
  });

  const insights = [
    ...buildWorkflowMemories(repositoryName, incidents, recoveries, activityEvents),
    ...buildModuleMemories(repositoryName, incidents, investigations, pullRequestReviews),
    ...buildIncidentPatternMemories(repositoryName, incidents, investigations, recoveries),
    ...buildCommitMemories(repositoryName, investigations, activityEvents),
    ...buildRecoveryMemories(repositoryName, recoveries),
  ];

  for (const insight of insights) {
    await upsertMemory(repositoryName, insight);
  }

  await persistGraph(repositoryName, {
    incidents,
    investigations,
    recoveries,
    pullRequestReviews,
  });

  await logActivityEvent({
    eventType: 'engineering_memory',
    repository: repositoryName,
    severity: insights.some((insight) => insight.severity === 'HIGH' || insight.severity === 'CRITICAL') ? 'warning' : 'info',
    status: 'completed',
    summary: `Engineering memory refreshed with ${insights.length} operational insight(s)`,
    details: {
      incidents: incidents.length,
      investigations: investigations.length,
      recoveries: recoveries.length,
      pullRequestReviews: pullRequestReviews.length,
    },
  });

  return getEngineeringMemorySnapshot(repositoryName);
}

export async function getEngineeringMemorySnapshot(repository?: string): Promise<EngineeringMemorySnapshot> {
  const targetRepository = repository || await inferRepository();
  const prisma = getPrisma();
  const [memories, nodes, edges] = await Promise.all([
    prisma.engineeringMemory.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
      take: 40,
    }),
    prisma.knowledgeGraphNode.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: [{ weight: 'desc' }, { lastSeenAt: 'desc' }],
      take: 60,
    }),
    prisma.knowledgeGraphEdge.findMany({
      where: targetRepository ? { repository: targetRepository } : undefined,
      orderBy: [{ weight: 'desc' }, { lastSeenAt: 'desc' }],
      take: 90,
    }),
  ]);
  const repositoryName = targetRepository || memories[0]?.repository || nodes[0]?.repository || 'no repository memory';
  const highRiskMemoryCount = memories.filter((memory) => memory.severity === 'HIGH' || memory.severity === 'CRITICAL').length;
  const unstableWorkflowCount = memories.filter((memory) => memory.memoryType === 'workflow_instability').length;
  const riskyModuleCount = memories.filter((memory) => memory.memoryType === 'module_hotspot').length;

  return {
    repository: repositoryName,
    memories: memories.map((memory) => ({
      id: memory.id,
      memoryType: memory.memoryType,
      subject: memory.subject,
      summary: memory.summary,
      severity: memory.severity,
      confidenceScore: memory.confidenceScore,
      occurrenceCount: memory.occurrenceCount,
      evidence: memory.evidence,
      lastSeenAt: memory.lastSeenAt,
    })),
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeKey: node.nodeKey,
      nodeType: node.nodeType,
      label: node.label,
      summary: node.summary,
      severity: node.severity,
      weight: node.weight,
      metadata: node.metadata,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sourceKey: edge.sourceKey,
      targetKey: edge.targetKey,
      relationType: edge.relationType,
      weight: edge.weight,
      evidence: edge.evidence,
    })),
    insights: memories.slice(0, 8).map((memory) => memory.summary),
    stats: {
      memoryCount: memories.length,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      highRiskMemoryCount,
      unstableWorkflowCount,
      riskyModuleCount,
    },
  };
}

export async function getSimilarOperationalMemories(input: {
  repository: string;
  files?: string[];
  workflowName?: string;
  limit?: number;
}) {
  const memories = await getPrisma().engineeringMemory.findMany({
    where: { repository: input.repository },
    orderBy: [{ confidenceScore: 'desc' }, { occurrenceCount: 'desc' }],
    take: 80,
  });
  const queryFiles = new Set(input.files || []);

  return memories
    .map((memory) => {
      const evidence = safeJson(memory.evidence);
      const evidenceFiles = Array.isArray(evidence?.files) ? evidence.files.filter((item): item is string => typeof item === 'string') : [];
      const fileOverlap = evidenceFiles.filter((file) => queryFiles.has(file)).length;
      const workflowMatch = input.workflowName && memory.subject.toLowerCase().includes(input.workflowName.toLowerCase()) ? 2 : 0;
      const score = fileOverlap * 3 + workflowMatch + memory.occurrenceCount + Math.round(memory.confidenceScore / 25);

      return { memory, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit || 5)
    .map((item) => item.memory);
}

function buildWorkflowMemories(
  repository: string,
  incidents: Array<{ relatedWorkflow: string | null; status: string; severity: string; affectedFiles: string | null }>,
  recoveries: Array<{ workflowName: string | null; status: string; strategy: string; stabilizationProbability: number }>,
  activityEvents: Array<{ eventType: string; relatedWorkflow: string | null }>
): MemoryInsight[] {
  const workflowCounts = new Map<string, { failures: number; recoveries: number; files: string[]; strategies: string[] }>();

  for (const incident of incidents) {
    const workflow = incident.relatedWorkflow || 'unknown workflow';
    const current = workflowCounts.get(workflow) || { failures: 0, recoveries: 0, files: [], strategies: [] };
    current.failures += 1;
    current.files.push(...parseStringArray(incident.affectedFiles));
    workflowCounts.set(workflow, current);
  }

  for (const recovery of recoveries) {
    const workflow = recovery.workflowName || 'unknown workflow';
    const current = workflowCounts.get(workflow) || { failures: 0, recoveries: 0, files: [], strategies: [] };
    current.recoveries += 1;
    current.strategies.push(recovery.strategy);
    workflowCounts.set(workflow, current);
  }

  for (const event of activityEvents.filter((event) => event.eventType === 'workflow_failure')) {
    const workflow = event.relatedWorkflow || 'unknown workflow';
    const current = workflowCounts.get(workflow) || { failures: 0, recoveries: 0, files: [], strategies: [] };
    current.failures += 1;
    workflowCounts.set(workflow, current);
  }

  return Array.from(workflowCounts.entries())
    .filter(([, value]) => value.failures + value.recoveries > 1)
    .map(([workflow, value]) => ({
      type: 'workflow_instability',
      subject: workflow,
      summary: `${workflow} has ${value.failures} failure signal(s) and ${value.recoveries} recovery attempt(s) in ${repository}.`,
      severity: value.failures >= 3 ? 'HIGH' : 'MEDIUM',
      confidenceScore: Math.min(95, 45 + value.failures * 12 + value.recoveries * 6),
      occurrenceCount: value.failures + value.recoveries,
      evidence: {
        workflow,
        files: Array.from(new Set(value.files)).slice(0, 12),
        strategies: Array.from(new Set(value.strategies)),
      },
    }));
}

function buildModuleMemories(
  repository: string,
  incidents: Array<{ affectedFiles: string | null; severity: string }>,
  investigations: Array<{ affectedFiles: string | null; rootCause: string | null }>,
  pullRequestReviews: Array<{ changedFiles: string | null; riskClassification: string; riskScore: number }>
): MemoryInsight[] {
  const moduleCounts = new Map<string, { count: number; files: string[]; reasons: string[]; maxRisk: number }>();
  const addFile = (file: string, reason: string, risk = 20) => {
    const moduleName = inferModule(file);
    const current = moduleCounts.get(moduleName) || { count: 0, files: [], reasons: [], maxRisk: 0 };
    current.count += 1;
    current.files.push(file);
    current.reasons.push(reason);
    current.maxRisk = Math.max(current.maxRisk, risk);
    moduleCounts.set(moduleName, current);
  };

  for (const incident of incidents) {
    for (const file of parseStringArray(incident.affectedFiles)) addFile(file, `incident severity ${incident.severity}`, incident.severity === 'CRITICAL' ? 90 : incident.severity === 'HIGH' ? 75 : 45);
  }

  for (const investigation of investigations) {
    for (const file of parseStringArray(investigation.affectedFiles)) addFile(file, investigation.rootCause || 'investigation evidence', 55);
  }

  for (const review of pullRequestReviews) {
    for (const file of parseChangedFiles(review.changedFiles)) addFile(file, `PR risk ${review.riskClassification}`, review.riskScore);
  }

  return Array.from(moduleCounts.entries())
    .filter(([, value]) => value.count > 1)
    .map(([module, value]) => ({
      type: 'module_hotspot',
      subject: module,
      summary: `${module} appears in ${value.count} operational signal(s), making it a recurring engineering hotspot.`,
      severity: value.maxRisk >= 80 ? 'CRITICAL' : value.maxRisk >= 60 ? 'HIGH' : 'MEDIUM',
      confidenceScore: Math.min(95, 40 + value.count * 10 + Math.round(value.maxRisk / 5)),
      occurrenceCount: value.count,
      evidence: {
        module,
        files: Array.from(new Set(value.files)).slice(0, 16),
        reasons: Array.from(new Set(value.reasons)).slice(0, 8),
      },
    }));
}

function buildIncidentPatternMemories(
  repository: string,
  incidents: Array<{ engineeringSummary: string; severity: string; status: string; affectedFiles: string | null }>,
  investigations: Array<{ rootCause: string | null; conclusion: string | null; confidenceLevel: string | null }>,
  recoveries: Array<{ probableRootCause: string; strategy: string }>
): MemoryInsight[] {
  const buckets = new Map<string, { count: number; summaries: string[]; files: string[] }>();
  const add = (label: string, summary: string, files: string[] = []) => {
    const current = buckets.get(label) || { count: 0, summaries: [], files: [] };
    current.count += 1;
    current.summaries.push(summary);
    current.files.push(...files);
    buckets.set(label, current);
  };

  for (const incident of incidents) add(classifyFailurePattern(incident.engineeringSummary), incident.engineeringSummary, parseStringArray(incident.affectedFiles));
  for (const investigation of investigations) add(classifyFailurePattern(`${investigation.rootCause || ''} ${investigation.conclusion || ''}`), investigation.rootCause || investigation.conclusion || 'Investigation pattern');
  for (const recovery of recoveries) add(classifyFailurePattern(recovery.probableRootCause), `${recovery.probableRootCause} Strategy: ${recovery.strategy}`);

  return Array.from(buckets.entries())
    .filter(([label, value]) => label !== 'general instability' && value.count > 1)
    .map(([label, value]) => ({
      type: 'failure_pattern',
      subject: label,
      summary: `Recurring ${label} pattern detected ${value.count} time(s) in ${repository}.`,
      severity: value.count >= 4 ? 'HIGH' : 'MEDIUM',
      confidenceScore: Math.min(92, 42 + value.count * 12),
      occurrenceCount: value.count,
      evidence: {
        pattern: label,
        examples: value.summaries.slice(0, 4),
        files: Array.from(new Set(value.files)).slice(0, 12),
      },
    }));
}

function buildCommitMemories(
  repository: string,
  investigations: Array<{ suspiciousCommits: string | null }>,
  activityEvents: Array<{ eventType: string; details: string | null }>
): MemoryInsight[] {
  const commits = new Map<string, { count: number; files: string[] }>();

  for (const investigation of investigations) {
    for (const commit of parseCommitEvidence(investigation.suspiciousCommits)) {
      const current = commits.get(commit.sha) || { count: 0, files: [] };
      current.count += 1;
      current.files.push(...commit.files);
      commits.set(commit.sha, current);
    }
  }

  for (const event of activityEvents.filter((item) => item.eventType === 'suspicious_commit')) {
    const details = safeJson(event.details);
    const eventCommits: unknown[] = Array.isArray(details?.commits) ? details.commits : [];
    for (const commit of eventCommits) {
      if (!commit || typeof commit !== 'object' || !('sha' in commit) || typeof commit.sha !== 'string') continue;
      const commitRecord = commit as { sha: string; matchedFiles?: unknown };
      const matchedFiles = commitRecord.matchedFiles;
      const files = Array.isArray(matchedFiles) ? matchedFiles.filter((item): item is string => typeof item === 'string') : [];
      const current = commits.get(commitRecord.sha) || { count: 0, files: [] };
      current.count += 1;
      current.files.push(...files);
      commits.set(commitRecord.sha, current);
    }
  }

  return Array.from(commits.entries())
    .filter(([, value]) => value.count > 1)
    .map(([sha, value]) => ({
      type: 'suspicious_commit_pattern',
      subject: sha.slice(0, 8),
      summary: `Commit ${sha.slice(0, 8)} has appeared in suspicious correlation evidence ${value.count} time(s).`,
      severity: value.count >= 3 ? 'HIGH' : 'MEDIUM',
      confidenceScore: Math.min(90, 45 + value.count * 14),
      occurrenceCount: value.count,
      evidence: {
        sha,
        files: Array.from(new Set(value.files)).slice(0, 12),
      },
    }));
}

function buildRecoveryMemories(repository: string, recoveries: Array<{ strategy: string; status: string; stabilizationProbability: number; probableRootCause: string }>): MemoryInsight[] {
  const strategies = new Map<string, { count: number; stabilized: number; probability: number; examples: string[] }>();

  for (const recovery of recoveries) {
    const current = strategies.get(recovery.strategy) || { count: 0, stabilized: 0, probability: 0, examples: [] };
    current.count += 1;
    current.stabilized += recovery.status === 'STABILIZED' ? 1 : 0;
    current.probability += recovery.stabilizationProbability;
    current.examples.push(recovery.probableRootCause);
    strategies.set(recovery.strategy, current);
  }

  return Array.from(strategies.entries())
    .filter(([, value]) => value.count > 0)
    .map(([strategy, value]) => {
      const averageProbability = Math.round(value.probability / value.count);
      return {
        type: 'recovery_outcome',
        subject: strategy,
        summary: `${strategy.replaceAll('_', ' ')} has been selected ${value.count} time(s), average stabilization probability ${averageProbability}%.`,
        severity: averageProbability >= 75 ? 'LOW' : 'MEDIUM',
        confidenceScore: Math.min(90, 35 + value.count * 10 + Math.round(averageProbability / 4)),
        occurrenceCount: value.count,
        evidence: {
          strategy,
          stabilized: value.stabilized,
          averageProbability,
          examples: value.examples.slice(0, 4),
          repository,
        },
      };
    });
}

async function persistGraph(
  repository: string,
  data: {
    incidents: Array<{ incidentKey: string; severity: string; relatedWorkflow: string | null; relatedPr: number | null; affectedFiles: string | null; engineeringSummary: string }>;
    investigations: Array<{ investigationKey: string; relatedWorkflow: string | null; relatedPr: number | null; affectedFiles: string | null; rootCause: string | null }>;
    recoveries: Array<{ recoveryKey: string; workflowName: string | null; strategy: string; status: string; affectedSystems: string | null }>;
    pullRequestReviews: Array<{ reviewKey: string; prNumber: number; changedModules: string | null; riskClassification: string; riskScore: number }>;
  }
) {
  const repoKey = nodeKey(repository, 'repository', repository);
  const edges: GraphEdgeInput[] = [];

  for (const incident of data.incidents) {
    const incidentKeyValue = nodeKey(repository, 'incident', incident.incidentKey);
    await upsertNode(repository, {
      nodeType: 'incident',
      label: incident.incidentKey,
      summary: incident.engineeringSummary,
      severity: incident.severity,
      weight: incident.severity === 'CRITICAL' ? 5 : incident.severity === 'HIGH' ? 4 : 2,
    });
    edges.push({ sourceKey: repoKey, targetKey: incidentKeyValue, relationType: 'has_incident', weight: 2 });

    if (incident.relatedWorkflow) {
      const workflowKey = nodeKey(repository, 'workflow', incident.relatedWorkflow);
      await upsertNode(repository, { nodeType: 'workflow', label: incident.relatedWorkflow, severity: incident.severity, weight: 3 });
      edges.push({ sourceKey: workflowKey, targetKey: incidentKeyValue, relationType: 'produced_incident', weight: 3 });
    }

    for (const file of parseStringArray(incident.affectedFiles)) {
      const moduleName = inferModule(file);
      const moduleKey = nodeKey(repository, 'module', moduleName);
      await upsertNode(repository, { nodeType: 'module', label: moduleName, summary: `Module affected by ${file}`, severity: incident.severity, weight: 3 });
      edges.push({ sourceKey: incidentKeyValue, targetKey: moduleKey, relationType: 'affects_module', weight: 3, evidence: { file } });
    }
  }

  for (const investigation of data.investigations) {
    const investigationKeyValue = nodeKey(repository, 'investigation', investigation.investigationKey);
    await upsertNode(repository, { nodeType: 'investigation', label: investigation.investigationKey, summary: investigation.rootCause || undefined, weight: 2 });
    edges.push({ sourceKey: repoKey, targetKey: investigationKeyValue, relationType: 'has_investigation', weight: 2 });

    for (const file of parseStringArray(investigation.affectedFiles)) {
      const moduleKey = nodeKey(repository, 'module', inferModule(file));
      await upsertNode(repository, { nodeType: 'module', label: inferModule(file), summary: `Module investigated through ${file}`, weight: 2 });
      edges.push({ sourceKey: investigationKeyValue, targetKey: moduleKey, relationType: 'investigates_module', weight: 2, evidence: { file } });
    }
  }

  for (const recovery of data.recoveries) {
    const recoveryKeyValue = nodeKey(repository, 'recovery', recovery.recoveryKey);
    await upsertNode(repository, { nodeType: 'recovery', label: recovery.strategy, summary: recovery.status, severity: recovery.status === 'MANUAL_REVIEW' ? 'MEDIUM' : 'LOW', weight: 2 });
    edges.push({ sourceKey: repoKey, targetKey: recoveryKeyValue, relationType: 'has_recovery', weight: 2 });

    if (recovery.workflowName) {
      const workflowKey = nodeKey(repository, 'workflow', recovery.workflowName);
      await upsertNode(repository, { nodeType: 'workflow', label: recovery.workflowName, weight: 2 });
      edges.push({ sourceKey: workflowKey, targetKey: recoveryKeyValue, relationType: 'recovered_by', weight: 3 });
    }
  }

  for (const review of data.pullRequestReviews) {
    const prKey = nodeKey(repository, 'pull_request', `PR #${review.prNumber}`);
    await upsertNode(repository, { nodeType: 'pull_request', label: `PR #${review.prNumber}`, summary: review.riskClassification, severity: review.riskScore >= 70 ? 'HIGH' : 'LOW', weight: 2 });
    edges.push({ sourceKey: repoKey, targetKey: prKey, relationType: 'has_pull_request', weight: 1 });

    for (const moduleName of parseStringArray(review.changedModules)) {
      const moduleKey = nodeKey(repository, 'module', moduleName);
      await upsertNode(repository, { nodeType: 'module', label: moduleName, severity: review.riskScore >= 70 ? 'HIGH' : undefined, weight: 2 });
      edges.push({ sourceKey: prKey, targetKey: moduleKey, relationType: 'changes_module', weight: review.riskScore >= 70 ? 3 : 1 });
    }
  }

  for (const edge of edges) {
    await upsertEdge(repository, edge);
  }
}

async function upsertMemory(repository: string, insight: MemoryInsight) {
  const key = incidentKey(['memory', repository, insight.type, insight.subject]);

  await getPrisma().engineeringMemory.upsert({
    where: { memoryKey: key },
    create: {
      memoryKey: key,
      repository,
      memoryType: insight.type,
      subject: insight.subject,
      summary: insight.summary,
      severity: insight.severity,
      confidenceScore: insight.confidenceScore,
      occurrenceCount: insight.occurrenceCount,
      evidence: JSON.stringify(insight.evidence),
    },
    update: {
      summary: insight.summary,
      severity: insight.severity,
      confidenceScore: insight.confidenceScore,
      occurrenceCount: insight.occurrenceCount,
      evidence: JSON.stringify(insight.evidence),
      lastSeenAt: new Date(),
    },
  });
}

async function upsertNode(repository: string, input: GraphNodeInput) {
  const key = nodeKey(repository, input.nodeType, input.label);

  await getPrisma().knowledgeGraphNode.upsert({
    where: { nodeKey: key },
    create: {
      nodeKey: key,
      repository,
      nodeType: input.nodeType,
      label: input.label,
      summary: input.summary,
      severity: input.severity,
      weight: input.weight || 1,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
    update: {
      summary: input.summary,
      severity: input.severity,
      weight: { increment: Math.max(1, input.weight || 1) },
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      lastSeenAt: new Date(),
    },
  });
}

async function upsertEdge(repository: string, input: GraphEdgeInput) {
  const key = incidentKey(['edge', repository, input.sourceKey, input.relationType, input.targetKey]);

  await getPrisma().knowledgeGraphEdge.upsert({
    where: { edgeKey: key },
    create: {
      edgeKey: key,
      repository,
      sourceKey: input.sourceKey,
      targetKey: input.targetKey,
      relationType: input.relationType,
      weight: input.weight || 1,
      evidence: input.evidence ? JSON.stringify(input.evidence) : undefined,
    },
    update: {
      weight: { increment: Math.max(1, input.weight || 1) },
      evidence: input.evidence ? JSON.stringify(input.evidence) : undefined,
      lastSeenAt: new Date(),
    },
  });
}

async function inferRepository(): Promise<string | undefined> {
  const prisma = getPrisma();
  const repository = await prisma.connectedRepository.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (repository) return `${repository.owner}/${repository.repoName}`;
  const incident = await prisma.incident.findFirst({ orderBy: { openedAt: 'desc' } });
  return incident?.repository;
}

function inferRepositoryFromSignals(
  incidents: Array<{ repository: string }>,
  investigations: Array<{ repository: string }>,
  recoveries: Array<{ repository: string }>,
  pullRequestReviews: Array<{ repository: string }>,
  activityEvents: Array<{ repository: string }>
): string {
  return incidents[0]?.repository || investigations[0]?.repository || recoveries[0]?.repository || pullRequestReviews[0]?.repository || activityEvents[0]?.repository || 'no repository memory';
}

function nodeKey(repository: string, type: string, label: string): string {
  return incidentKey(['node', repository, type, label]);
}

function inferModule(file: string): string {
  const parts = file.split('/');
  if (parts[0] === 'src' && parts[1]) return `src/${parts[1]}`;
  if (parts[0] === 'app' && parts[1]) return `app/${parts[1]}`;
  if (parts[0] === '.github') return '.github/workflows';
  return parts[0] || file;
}

function classifyFailurePattern(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('null') || lower.includes('undefined')) return 'runtime nullability regression';
  if (lower.includes('expected') || lower.includes('contract') || lower.includes('response')) return 'behavioral contract regression';
  if (lower.includes('module') || lower.includes('cannot resolve') || lower.includes('dependency')) return 'dependency resolution failure';
  if (lower.includes('timeout') || lower.includes('flaky')) return 'workflow flakiness';
  if (lower.includes('auth') || lower.includes('oauth')) return 'authentication instability';
  return 'general instability';
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  const parsed = safeUnknownJson(value);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

function parseChangedFiles(value: string | null): string[] {
  if (!value) return [];
  const parsed = safeUnknownJson(value);
  return Array.isArray(parsed)
    ? parsed.flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (item && typeof item === 'object' && 'filename' in item && typeof item.filename === 'string') return [item.filename];
        return [];
      })
    : [];
}

function parseCommitEvidence(value: string | null): Array<{ sha: string; files: string[] }> {
  const parsed = safeUnknownJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('sha' in item) || typeof item.sha !== 'string') return [];
    const matchedFiles = 'matchedFiles' in item ? item.matchedFiles : undefined;
    const files = Array.isArray(matchedFiles)
      ? matchedFiles.filter((file): file is string => typeof file === 'string')
      : [];
    return [{ sha: item.sha, files }];
  });
}

function safeUnknownJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function safeJson(value: string | null): Record<string, unknown> | null {
  const parsed = safeUnknownJson(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

// Made with Bob
// made by bob
