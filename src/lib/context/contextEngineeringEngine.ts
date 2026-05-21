import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { getPrisma } from '@/lib/database/prisma';
import { incidentKey } from '@/lib/incidents/incidentManager';
import { getEngineeringMemorySnapshot, refreshEngineeringMemory } from '@/lib/memory/engineeringMemoryEngine';

export type ContextLayer = 'session' | 'repository' | 'incident' | 'cache';
export type AiProviderProfile = 'bob' | 'groq';

export type OptimizedContextBlock = {
  id: string;
  layer: ContextLayer;
  sourceType: string;
  title: string;
  summary: string;
  compressedText: string;
  priorityScore: number;
  tokenEstimate: number;
  providerProfile: string;
};

export type OptimizedContextBundle = {
  repository: string;
  provider: AiProviderProfile;
  tokenBudget: number;
  estimatedTokens: number;
  savedTokens: number;
  compressionRatio: number;
  includedBlocks: OptimizedContextBlock[];
  skippedBlocks: number;
  contextSources: string[];
  promptPreamble: string;
  stats: {
    sessionBlocks: number;
    repositoryBlocks: number;
    incidentBlocks: number;
    cacheBlocks: number;
    candidateBlocks: number;
  };
};

type AssembleContextInput = {
  repository?: string;
  provider?: AiProviderProfile | string | null;
  workflowName?: string;
  files?: string[];
  branch?: string | null;
  purpose?: 'analysis' | 'documentation' | 'investigation' | 'recovery' | 'review' | 'terminal';
  tokenBudget?: number;
  refresh?: boolean;
};

type CandidateBlock = {
  layer: ContextLayer;
  sourceType: string;
  sourceId?: string;
  title: string;
  rawText: string;
  metadata?: Record<string, unknown>;
  basePriority: number;
};

// made by bob
export async function assembleOptimizedContext(input: AssembleContextInput = {}): Promise<OptimizedContextBundle> {
  const repository = input.repository || await inferRepository();
  const provider = input.provider === 'groq' ? 'groq' : 'bob';
  const tokenBudget = input.tokenBudget || providerBudget(provider);

  if (input.refresh) {
    await refreshEngineeringMemory(repository);
  }

  const candidates = await buildContextCandidates({
    repository,
    workflowName: input.workflowName,
    files: input.files || [],
    branch: input.branch,
    provider,
    purpose: input.purpose || 'analysis',
  });

  const compressedCandidates = candidates
    .map((candidate) => compressCandidate(candidate, input))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.tokenEstimate - b.tokenEstimate);
  const included: OptimizedContextBlock[] = [];
  let estimatedTokens = 0;

  for (const candidate of compressedCandidates) {
    if (estimatedTokens + candidate.tokenEstimate > tokenBudget && included.length > 0) {
      continue;
    }

    included.push(candidate);
    estimatedTokens += candidate.tokenEstimate;
  }

  await Promise.all(included.map((block) => upsertContextBlock(repository, block)));

  const rawTokenEstimate = candidates.reduce((total, candidate) => total + estimateTokens(candidate.rawText), 0);
  const contextSources = included.map((block) => `${labelLayer(block.layer)}: ${block.title}`);
  const bundle: OptimizedContextBundle = {
    repository,
    provider,
    tokenBudget,
    estimatedTokens,
    savedTokens: Math.max(0, rawTokenEstimate - estimatedTokens),
    compressionRatio: rawTokenEstimate > 0 ? Math.round((estimatedTokens / rawTokenEstimate) * 100) : 0,
    includedBlocks: included,
    skippedBlocks: Math.max(0, compressedCandidates.length - included.length),
    contextSources,
    promptPreamble: buildPromptPreamble(provider, included),
    stats: {
      sessionBlocks: included.filter((block) => block.layer === 'session').length,
      repositoryBlocks: included.filter((block) => block.layer === 'repository').length,
      incidentBlocks: included.filter((block) => block.layer === 'incident').length,
      cacheBlocks: included.filter((block) => block.layer === 'cache').length,
      candidateBlocks: candidates.length,
    },
  };

  await logActivityEvent({
    eventType: 'context_optimization',
    repository,
    severity: bundle.skippedBlocks > 0 ? 'info' : 'success',
    status: 'completed',
    summary: `Context optimized for ${provider.toUpperCase()}: ${estimatedTokens}/${tokenBudget} estimated tokens`,
    details: {
      provider,
      estimatedTokens,
      savedTokens: bundle.savedTokens,
      compressionRatio: bundle.compressionRatio,
      contextSources,
    },
  });

  return bundle;
}

export async function getContextMemoryStatus(repository?: string, provider: AiProviderProfile | string | null = 'bob') {
  return assembleOptimizedContext({
    repository,
    provider,
    purpose: 'analysis',
    refresh: false,
  });
}

async function buildContextCandidates(input: {
  repository: string;
  workflowName?: string;
  files: string[];
  branch?: string | null;
  provider: AiProviderProfile;
  purpose: NonNullable<AssembleContextInput['purpose']>;
}): Promise<CandidateBlock[]> {
  const prisma = getPrisma();
  const [activityEvents, incidents, investigations, recoveries, reviews, memorySnapshot, cachedBlocks] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { repository: input.repository },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.incident.findMany({
      where: { repository: input.repository },
      orderBy: { openedAt: 'desc' },
      take: 12,
    }),
    prisma.investigation.findMany({
      where: { repository: input.repository },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
    prisma.workflowRecovery.findMany({
      where: { repository: input.repository },
      orderBy: { startedAt: 'desc' },
      take: 8,
    }),
    prisma.pullRequestReview.findMany({
      where: { repository: input.repository },
      orderBy: { startedAt: 'desc' },
      take: 8,
    }),
    getEngineeringMemorySnapshot(input.repository),
    prisma.contextMemoryBlock.findMany({
      where: { repository: input.repository },
      orderBy: [{ priorityScore: 'desc' }, { lastUsedAt: 'desc' }],
      take: 20,
    }),
  ]);

  const candidates: CandidateBlock[] = [];

  candidates.push({
    layer: 'session',
    sourceType: 'active_context',
    title: 'Active operational context',
    rawText: [
      `Repository: ${input.repository}`,
      `Branch: ${input.branch || 'current/default branch'}`,
      `Purpose: ${input.purpose}`,
      `Workflow: ${input.workflowName || 'not workflow-specific'}`,
      `Relevant files: ${input.files.length ? input.files.join(', ') : 'not file-specific'}`,
    ].join('\n'),
    basePriority: 96,
    metadata: { branch: input.branch, workflowName: input.workflowName, files: input.files },
  });

  for (const event of activityEvents.filter((event) => event.eventType === 'terminal_command' || event.eventType === 'repository_investigation' || event.eventType === 'context_optimization').slice(0, 8)) {
    candidates.push({
      layer: 'session',
      sourceType: event.eventType,
      sourceId: event.id,
      title: event.summary,
      rawText: `${event.summary}\n${event.details || ''}`,
      basePriority: 58,
      metadata: { createdAt: event.createdAt.toISOString(), status: event.status },
    });
  }

  for (const memory of memorySnapshot.memories.slice(0, 14)) {
    candidates.push({
      layer: memory.memoryType.includes('workflow') || memory.memoryType.includes('module') ? 'repository' : 'incident',
      sourceType: memory.memoryType,
      sourceId: memory.id,
      title: memory.subject,
      rawText: `${memory.summary}\nEvidence: ${memory.evidence || 'none'}`,
      basePriority: priorityFromSeverity(memory.severity) + Math.min(18, memory.occurrenceCount * 3),
      metadata: { severity: memory.severity, confidenceScore: memory.confidenceScore },
    });
  }

  for (const node of memorySnapshot.nodes.slice(0, 10)) {
    candidates.push({
      layer: 'repository',
      sourceType: `graph_${node.nodeType}`,
      sourceId: node.id,
      title: node.label,
      rawText: `${node.nodeType}: ${node.label}. ${node.summary || 'Repository relationship node.'} Weight=${node.weight}`,
      basePriority: 46 + Math.min(20, node.weight),
      metadata: { nodeKey: node.nodeKey, severity: node.severity },
    });
  }

  for (const incident of incidents) {
    candidates.push({
      layer: 'incident',
      sourceType: 'incident',
      sourceId: incident.id,
      title: incident.incidentKey,
      rawText: [
        incident.engineeringSummary,
        `Status=${incident.status}`,
        `Severity=${incident.severity}`,
        `Workflow=${incident.relatedWorkflow || 'none'}`,
        `Affected files=${incident.affectedFiles || 'none'}`,
      ].join('\n'),
      basePriority: priorityFromSeverity(incident.severity) + (incident.status !== 'RESOLVED' ? 16 : 0),
      metadata: { status: incident.status, relatedWorkflow: incident.relatedWorkflow },
    });
  }

  for (const investigation of investigations) {
    candidates.push({
      layer: 'incident',
      sourceType: 'investigation',
      sourceId: investigation.id,
      title: investigation.currentStage || investigation.investigationKey,
      rawText: [
        investigation.rootCause || 'Root cause pending',
        investigation.conclusion || 'Conclusion pending',
        `Confidence=${investigation.confidenceLevel || 'unknown'}`,
        `Affected files=${investigation.affectedFiles || 'none'}`,
      ].join('\n'),
      basePriority: 72,
      metadata: { status: investigation.status, relatedWorkflow: investigation.relatedWorkflow },
    });
  }

  for (const recovery of recoveries) {
    candidates.push({
      layer: 'incident',
      sourceType: 'recovery',
      sourceId: recovery.id,
      title: recovery.strategy,
      rawText: [
        recovery.probableRootCause,
        recovery.proposedRemediation,
        recovery.validationSummary,
        `Stabilization=${recovery.stabilizationProbability}%`,
      ].join('\n'),
      basePriority: 68 + Math.round(recovery.stabilizationProbability / 10),
      metadata: { status: recovery.status, workflowName: recovery.workflowName },
    });
  }

  for (const review of reviews) {
    candidates.push({
      layer: 'repository',
      sourceType: 'pull_request_review',
      sourceId: review.id,
      title: `PR #${review.prNumber} ${review.riskClassification}`,
      rawText: [
        review.reasoning,
        review.architectureImpact,
        review.workflowImpact,
        `Changed files=${review.changedFiles || 'none'}`,
      ].join('\n'),
      basePriority: 48 + Math.round(review.riskScore / 2),
      metadata: { riskScore: review.riskScore, prNumber: review.prNumber },
    });
  }

  for (const block of cachedBlocks) {
    candidates.push({
      layer: 'cache',
      sourceType: block.sourceType,
      sourceId: block.id,
      title: block.title,
      rawText: block.compressedText,
      basePriority: Math.max(35, block.priorityScore - 10),
      metadata: { providerProfile: block.providerProfile, previousTokenEstimate: block.tokenEstimate },
    });
  }

  return dedupeCandidates(candidates).map((candidate) => ({
    ...candidate,
    basePriority: candidate.basePriority + relevanceBoost(candidate, input),
  }));
}

function compressCandidate(candidate: CandidateBlock, input: AssembleContextInput): OptimizedContextBlock {
  const compressedText = compressText(candidate.rawText, maxCharsForLayer(candidate.layer, input.provider === 'groq' ? 'groq' : 'bob'));
  const summary = firstSentence(compressedText);
  const tokenEstimate = estimateTokens(compressedText);

  return {
    id: incidentKey(['context-block-runtime', candidate.layer, candidate.sourceType, candidate.title]),
    layer: candidate.layer,
    sourceType: candidate.sourceType,
    title: candidate.title,
    summary,
    compressedText,
    priorityScore: Math.min(100, candidate.basePriority),
    tokenEstimate,
    providerProfile: input.provider === 'groq' ? 'groq' : 'bob',
  };
}

async function upsertContextBlock(repository: string, block: OptimizedContextBlock) {
  const blockKey = incidentKey(['context', repository, block.layer, block.sourceType, block.title]);

  await getPrisma().contextMemoryBlock.upsert({
    where: { blockKey },
    create: {
      blockKey,
      repository,
      layer: block.layer,
      sourceType: block.sourceType,
      title: block.title,
      summary: block.summary,
      compressedText: block.compressedText,
      priorityScore: block.priorityScore,
      tokenEstimate: block.tokenEstimate,
      providerProfile: block.providerProfile,
      metadata: JSON.stringify({ generatedBy: 'context-engine' }),
    },
    update: {
      summary: block.summary,
      compressedText: block.compressedText,
      priorityScore: block.priorityScore,
      tokenEstimate: block.tokenEstimate,
      providerProfile: block.providerProfile,
      lastUsedAt: new Date(),
    },
  });
}

function buildPromptPreamble(provider: AiProviderProfile, blocks: OptimizedContextBlock[]): string {
  const providerInstruction = provider === 'groq'
    ? 'Use concise reasoning and preserve only high-signal operational facts.'
    : 'Use structured engineering reasoning with repository memory and incident evidence.';

  return [
    providerInstruction,
    'Do not assume entire repository context. Use only the retrieved compressed context below.',
    ...blocks.map((block) => `[${labelLayer(block.layer)}:${block.sourceType}] ${block.compressedText}`),
  ].join('\n\n');
}

function compressText(value: string, maxChars: number): string {
  const normalized = value
    .replace(/\s+/g, ' ')
    .replace(/("githubAccessToken"|"bobApiKey"|"groqApiKey"|"TURSO_AUTH_TOKEN"|"DATABASE_URL")\s*:\s*"[^"]+"/gi, '$1:"[redacted]"')
    .trim();
  if (normalized.length <= maxChars) return normalized;

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const selected: string[] = [];
  for (const sentence of sentences) {
    if ((selected.join(' ').length + sentence.length) > maxChars) break;
    selected.push(sentence);
  }

  const text = selected.length ? selected.join(' ') : normalized.slice(0, maxChars);
  return `${text.trim()} ... [compressed]`;
}

function relevanceBoost(candidate: CandidateBlock, input: { workflowName?: string; files: string[]; purpose: string }): number {
  let boost = 0;
  const raw = `${candidate.title} ${candidate.rawText}`.toLowerCase();
  if (input.workflowName && raw.includes(input.workflowName.toLowerCase())) boost += 12;
  if (input.files.some((file) => raw.includes(file.toLowerCase()) || raw.includes(inferModule(file).toLowerCase()))) boost += 18;
  if (input.purpose === 'recovery' && candidate.sourceType.includes('recovery')) boost += 16;
  if (input.purpose === 'review' && candidate.sourceType.includes('pull_request')) boost += 14;
  if (input.purpose === 'documentation' && candidate.layer === 'repository') boost += 12;
  return boost;
}

function dedupeCandidates(candidates: CandidateBlock[]): CandidateBlock[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.layer}:${candidate.sourceType}:${candidate.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function providerBudget(provider: AiProviderProfile): number {
  return provider === 'groq' ? 2200 : 3200;
}

function maxCharsForLayer(layer: ContextLayer, provider: AiProviderProfile): number {
  const multiplier = provider === 'groq' ? 0.72 : 1;
  const base = layer === 'session' ? 520 : layer === 'repository' ? 680 : layer === 'incident' ? 760 : 460;
  return Math.round(base * multiplier);
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function firstSentence(value: string): string {
  return value.split(/(?<=[.!?])\s+/)[0]?.slice(0, 220) || value.slice(0, 220);
}

function labelLayer(layer: ContextLayer): string {
  switch (layer) {
    case 'session':
      return 'Session Memory';
    case 'repository':
      return 'Repository Memory';
    case 'incident':
      return 'Incident Memory';
    case 'cache':
      return 'Context Cache';
  }
}

function priorityFromSeverity(severity: string): number {
  if (severity === 'CRITICAL') return 94;
  if (severity === 'HIGH') return 82;
  if (severity === 'MEDIUM') return 64;
  return 42;
}

async function inferRepository(): Promise<string> {
  const prisma = getPrisma();
  const repository = await prisma.connectedRepository.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (repository) return `${repository.owner}/${repository.repoName}`;
  const incident = await prisma.incident.findFirst({ orderBy: { openedAt: 'desc' } });
  return incident?.repository || 'no repository context';
}

function inferModule(file: string): string {
  const parts = file.split('/');
  if (parts[0] === 'src' && parts[1]) return `src/${parts[1]}`;
  if (parts[0] === 'app' && parts[1]) return `app/${parts[1]}`;
  if (parts[0] === '.github') return '.github/workflows';
  return parts[0] || file;
}

// Made with Bob
// made by bob
