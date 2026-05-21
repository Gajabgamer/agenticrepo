import { prisma } from '@/lib/database/prisma';
import { analyzePullRequest } from '@/lib/github/analyzePullRequest';
import { logActivityEvent } from '@/lib/activity/logActivityEvent';
import { incidentKey, severityFromScore, upsertIncident } from '@/lib/incidents/incidentManager';
import { runAutonomousPullRequestReviewFromWebhook } from '@/lib/pr-review/prReviewEngine';
import { refreshEngineeringMemory } from '@/lib/memory/engineeringMemoryEngine';
import { GitHubWebhookPayload } from '@/types';

export interface HandlerResult {
  success: boolean;
  message?: string;
}

export async function handlePullRequest(payload: GitHubWebhookPayload): Promise<HandlerResult> {
  const repository = payload.repository?.full_name || payload.repository?.name || 'unknown';
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
    const review = await runAutonomousPullRequestReviewFromWebhook(payload);
    
    // Log analysis results
    console.log('Risk score:', analysis.riskScore);
    console.log('Summary:', analysis.summary);
    console.log('PR review classification:', review.riskClassification);
    await refreshEngineeringMemory(repository);
    
    // Save to database
    await prisma.pullRequestAnalysis.create({
      data: {
        prNumber,
        repository,
        riskScore: analysis.riskScore,
        summary: analysis.summary,
      },
    });

    await logActivityEvent({
      eventType: 'ai_analysis',
      repository,
      severity: analysis.riskScore >= 70 ? 'danger' : analysis.riskScore >= 40 ? 'warning' : 'success',
      status: 'completed',
      summary: analysis.summary,
      details: {
        action,
        branch,
        riskScore: analysis.riskScore,
      },
      relatedPr: prNumber,
    });

    if (analysis.riskScore >= 70) {
      await upsertIncident({
        incidentKey: incidentKey(['pull-request', repository, prNumber]),
        severity: severityFromScore(analysis.riskScore),
        repository,
        affectedBranch: branch,
        engineeringSummary: analysis.summary,
        status: 'ANALYZING',
        relatedPr: prNumber,
        historySummary: `High-risk pull request analysis detected for PR #${prNumber}`,
      historyDetails: {
        action,
        riskScore: analysis.riskScore,
      },
    });
    }
  }
  
  return {
    success: true,
    message: `Processed PR #${prNumber} (${action}) in ${repository}`,
  };
}

// Made with Bob
