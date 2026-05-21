import { prisma } from '@/lib/database/prisma';

export type ActivityEventType =
  | 'workflow_failure'
  | 'ai_analysis'
  | 'regression_alert'
  | 'successful_fix'
  | 'pr_generation'
  | 'documentation_generation'
  | 'suspicious_commit'
  | 'issue_creation'
  | 'repository_investigation'
  | 'pr_review'
  | 'terminal_command'
  | 'autofix_execution'
  | 'workflow_recovery'
  | 'engineering_memory'
  | 'context_optimization'
  | 'agent_coordination';

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'danger';
export type ActivityStatus = 'started' | 'running' | 'completed' | 'failed' | 'blocked';

type LogActivityEventInput = {
  eventType: ActivityEventType;
  repository: string;
  severity: ActivitySeverity;
  status: ActivityStatus;
  summary: string;
  details?: Record<string, unknown> | string;
  relatedWorkflow?: string;
  relatedPr?: number;
  relatedIssue?: number;
  relatedUrl?: string;
};

// made by bob
export async function logActivityEvent(input: LogActivityEventInput): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        eventType: input.eventType,
        repository: input.repository,
        severity: input.severity,
        status: input.status,
        summary: input.summary,
        details: typeof input.details === 'string' ? input.details : input.details ? JSON.stringify(input.details) : undefined,
        relatedWorkflow: input.relatedWorkflow,
        relatedPr: input.relatedPr,
        relatedIssue: input.relatedIssue,
        relatedUrl: input.relatedUrl,
      },
    });
  } catch (error) {
    console.error(
      '[Activity] Failed to persist activity event:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// Made with Bob
// made by bob
