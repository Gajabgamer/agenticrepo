import { GitHubWebhookPayload } from '@/types';
import { handlePush } from './push';
import { handlePullRequest } from './pull_request';
import { handleWorkflowRun } from './workflow_run';
import { handleIssueComment } from './issue_comment';

export interface HandlerResult {
  success: boolean;
  message?: string;
}

type EventHandler = (payload: GitHubWebhookPayload) => Promise<HandlerResult>;

const handlers: Record<string, EventHandler> = {
  push: handlePush,
  pull_request: handlePullRequest,
  workflow_run: handleWorkflowRun,
  issue_comment: handleIssueComment,
};

export async function dispatchEvent(
  eventType: string,
  payload: GitHubWebhookPayload
): Promise<HandlerResult> {
  const handler = handlers[eventType];
  
  if (!handler) {
    console.log(`No handler for event type: ${eventType}`);
    return {
      success: true,
      message: `No handler for event type: ${eventType}`,
    };
  }
  
  return handler(payload);
}

// Made with Bob
