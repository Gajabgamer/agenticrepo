import { dispatchEvent, HandlerResult } from '@/lib/github/handlers/dispatcher';
import { GitHubWebhookPayload } from '@/types';
import {
  createIssueCommentWebhookPayload,
  createPullRequestWebhookPayload,
  createWorkflowRunWebhookPayload,
  MockPayloadOptions,
} from './mockPayloads';
import { StructuredWorkflowLogger } from './structuredLogger';

export async function simulateWebhook(
  eventType: 'pull_request' | 'workflow_run' | 'issue_comment',
  payload: GitHubWebhookPayload,
  logger = new StructuredWorkflowLogger()
): Promise<HandlerResult> {
  logger.log('webhook.dispatch', 'start', `Dispatching ${eventType} webhook`, {
    repository: payload.repository.full_name,
    action: payload.action,
  });

  const result = await dispatchEvent(eventType, payload);

  logger.log(
    'webhook.dispatch',
    result.success ? 'success' : 'error',
    result.message || 'Webhook handled',
    { eventType }
  );

  return result;
}

export function createLocalWebhookFixtures(options: MockPayloadOptions = {}) {
  return {
    pullRequest: createPullRequestWebhookPayload(options),
    workflowRun: createWorkflowRunWebhookPayload(options),
    issueComment: createIssueCommentWebhookPayload(options),
  };
}

// Made with Bob
