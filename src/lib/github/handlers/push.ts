import { GitHubWebhookPayload } from '@/types';

export interface HandlerResult {
  success: boolean;
  message?: string;
}

export async function handlePush(payload: GitHubWebhookPayload): Promise<HandlerResult> {
  const repository = payload.repository?.name || 'unknown';
  const branch = payload.ref?.replace('refs/heads/', '') || 'unknown';
  
  console.log('Push event:', {
    repository,
    branch,
    pusher: payload.pusher?.name,
  });
  
  return {
    success: true,
    message: `Processed push to ${repository}/${branch}`,
  };
}

// Made with Bob
