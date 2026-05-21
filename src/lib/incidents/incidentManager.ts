import { prisma } from '@/lib/database/prisma';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'ANALYZING' | 'AUTOFIX_RUNNING' | 'RESOLVED';

type UpsertIncidentInput = {
  incidentKey: string;
  severity: IncidentSeverity;
  repository: string;
  affectedBranch?: string;
  affectedFiles?: string[];
  engineeringSummary: string;
  status: IncidentStatus;
  relatedWorkflow?: string;
  relatedPr?: number;
  relatedIssue?: number;
  relatedUrl?: string;
  historySummary: string;
  historyDetails?: Record<string, unknown> | string;
};

// made by bob
export async function upsertIncident(input: UpsertIncidentInput): Promise<void> {
  try {
    const details = typeof input.historyDetails === 'string'
      ? input.historyDetails
      : input.historyDetails
        ? JSON.stringify(input.historyDetails)
        : undefined;

    const incident = await prisma.incident.upsert({
      where: { incidentKey: input.incidentKey },
      create: {
        incidentKey: input.incidentKey,
        severity: input.severity,
        repository: input.repository,
        affectedBranch: input.affectedBranch,
        affectedFiles: input.affectedFiles ? JSON.stringify(input.affectedFiles) : undefined,
        engineeringSummary: input.engineeringSummary,
        status: input.status,
        relatedWorkflow: input.relatedWorkflow,
        relatedPr: input.relatedPr,
        relatedIssue: input.relatedIssue,
        relatedUrl: input.relatedUrl,
      },
      update: {
        severity: input.severity,
        affectedBranch: input.affectedBranch,
        affectedFiles: input.affectedFiles ? JSON.stringify(input.affectedFiles) : undefined,
        engineeringSummary: input.engineeringSummary,
        status: input.status,
        relatedWorkflow: input.relatedWorkflow,
        relatedPr: input.relatedPr,
        relatedIssue: input.relatedIssue,
        relatedUrl: input.relatedUrl,
        resolvedAt: input.status === 'RESOLVED' ? new Date() : null,
      },
    });

    await prisma.incidentHistory.create({
      data: {
        incidentId: incident.id,
        status: input.status,
        summary: input.historySummary,
        details,
      },
    });
  } catch (error) {
    console.error('[Incident] Failed to persist incident:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export function severityFromScore(score: number): IncidentSeverity {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function incidentKey(parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((part): part is string | number => part !== undefined && part !== null && part !== '')
    .map((part) => String(part).toLowerCase().replace(/[^a-z0-9]+/g, '-'))
    .join(':');
}

// Made with Bob
// made by bob
