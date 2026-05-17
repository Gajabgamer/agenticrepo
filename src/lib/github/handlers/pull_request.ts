import { prisma } from '@/lib/database/prisma';
import { analyzePullRequest } from '@/lib/github/analyzePullRequest';
import { GitHubWebhookPayload } from '@/types';

export interface HandlerResult {
  success: boolean;
  message?: string;
}

export async function handlePullRequest(payload: GitHubWebhookPayload): Promise<HandlerResult> {
  const repository = payload.repository?.name || 'unknown';
  const action = payload.action || 'unknown';
  const prNumber = payload.pull_request?.number || 0;
  const branch = payload.pull_request?.head?.ref || 'unknown';
  
  console.log('Pull request event:', {
    repository,
    action,
    prNumber,
    branch,
    title: payload.pull_request?.title,
  });
  
  // Run analysis only for 'opened' and 'synchronize' actions
  if (action === 'opened' || action === 'synchronize') {
    const analysis = analyzePullRequest(payload);
    
    // Log analysis results
    console.log('Risk score:', analysis.riskScore);
    console.log('Summary:', analysis.summary);
    
    // Save to database
    await prisma.pullRequestAnalysis.create({
      data: {
        prNumber,
        repository,
        riskScore: analysis.riskScore,
        summary: analysis.summary,
      },
    });
  }
  
  return {
    success: true,
    message: `Processed PR #${prNumber} (${action}) in ${repository}`,
  };
}

// Made with Bob
