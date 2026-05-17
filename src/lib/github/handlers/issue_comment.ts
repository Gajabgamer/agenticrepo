import { GitHubWebhookPayload } from '@/types';

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
  
  return {
    success: true,
    message: `Processed comment (${action}) on issue #${issueNumber} in ${repository}`,
  };
}

// Made with Bob
