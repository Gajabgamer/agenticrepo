import { GitHubWebhookPayload } from '@/types';

export interface PullRequestAnalysisResult {
  riskScore: number;
  summary: string;
}

export function analyzePullRequest(payload: GitHubWebhookPayload): PullRequestAnalysisResult {
  const repository = payload.repository?.name || 'unknown';
  const prNumber = payload.pull_request?.number || 0;
  const changedFiles = payload.pull_request?.changed_files || 0;
  
  let riskScore = 0;
  const riskyAreas: string[] = [];
  
  // Rule: +20 if changed files > 10
  if (changedFiles > 10) {
    riskScore += 20;
    riskyAreas.push(`high file count (${changedFiles} files)`);
  }
  
  // Get list of changed files from payload
  const files = payload.pull_request?.files || [];
  const filenames = files.map((file) => file.filename?.toLowerCase() || '');
  
  // Rule: +25 if filenames contain 'auth'
  const hasAuth = filenames.some((name: string) => name.includes('auth'));
  if (hasAuth) {
    riskScore += 25;
    riskyAreas.push('authentication files');
  }
  
  // Rule: +25 if filenames contain 'payment'
  const hasPayment = filenames.some((name: string) => name.includes('payment'));
  if (hasPayment) {
    riskScore += 25;
    riskyAreas.push('payment files');
  }
  
  // Rule: +15 if filenames contain 'config'
  const hasConfig = filenames.some((name: string) => name.includes('config'));
  if (hasConfig) {
    riskScore += 15;
    riskyAreas.push('configuration files');
  }
  
  // Rule: +15 if filenames contain 'test'
  const hasTest = filenames.some((name: string) => name.includes('test'));
  if (hasTest) {
    riskScore += 15;
    riskyAreas.push('test files');
  }
  
  // Generate summary
  const riskyAreasText = riskyAreas.length > 0 
    ? ` Detected risky areas: ${riskyAreas.join(', ')}.`
    : ' No specific risky areas detected.';
  
  const summary = `PR #${prNumber} in ${repository} with ${changedFiles} changed file(s).${riskyAreasText}`;
  
  return {
    riskScore,
    summary,
  };
}

// Made with Bob
