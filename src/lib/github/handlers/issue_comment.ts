import { GitHubWebhookPayload } from '@/types';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';

export interface HandlerResult {
  success: boolean;
  message?: string;
}

export async function handleIssueComment(payload: GitHubWebhookPayload): Promise<HandlerResult> {
  const repository = payload.repository?.name || 'unknown';
  const action = payload.action || 'unknown';
  const issueNumber = payload.issue?.number || 'unknown';
  
  console.log('Issue comment event:', {
    repository,
    action,
    issueNumber,
    commentId: payload.comment?.id,
    isPullRequest: !!payload.issue?.pull_request,
  });

  await logActivityEvent({
    eventType: 'repository_investigation',
    repository,
    severity: 'info',
    status: 'completed',
    summary: `Processed comment (${action}) on issue #${issueNumber}`,
    details: {
      commentId: payload.comment?.id,
      isPullRequest: Boolean(payload.issue?.pull_request),
    },
    relatedIssue: typeof issueNumber === 'number' ? issueNumber : undefined,
  });
  
  return {
    success: true,
    message: `Processed comment (${action}) on issue #${issueNumber} in ${repository}`,
  };
}

// Made with Bob
