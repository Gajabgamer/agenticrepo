export type WorkflowStageStatus = 'start' | 'success' | 'warning' | 'error' | 'skipped';

export interface WorkflowLogEntry {
  stage: string;
  status: WorkflowStageStatus;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export class StructuredWorkflowLogger {
  private readonly entries: WorkflowLogEntry[] = [];

  log(
    stage: string,
    status: WorkflowStageStatus,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const entry: WorkflowLogEntry = {
      stage,
      status,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(entry);
    console.log(JSON.stringify(entry));
  }

  getEntries(): WorkflowLogEntry[] {
    return [...this.entries];
  }
}

// Made with Bob
