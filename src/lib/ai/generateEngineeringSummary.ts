import { WorkflowFailureAnalysis } from '../github/analyzeWorkflowFailure';
import { ParsedWorkflowLogs } from '../github/parseWorkflowLogs';
import { SuspiciousCommit } from '../github/correlateRecentCommits';
import { RegressionRiskResult } from '../github/calculateRegressionRisk';

export interface EngineeringSummaryInput {
  workflowAnalysis: WorkflowFailureAnalysis;
  parsedLogAnalysis: ParsedWorkflowLogs;
  suspiciousCommits: SuspiciousCommit[];
  regressionRisk: RegressionRiskResult;
}

export interface EngineeringSummaryResult {
  summary: string;
}

/**
 * Generates an engineering summary of workflow failure analysis.
 * Currently uses plain TypeScript string formatting.
 * Designed to be replaced with IBM Bob AI integration in the future.
 * 
 * @param input - Combined analysis data from workflow failure
 * @returns Engineering summary with probable cause, affected files, and recommendations
 */
export function generateEngineeringSummary(
  input: EngineeringSummaryInput
): EngineeringSummaryResult {
  const { workflowAnalysis, parsedLogAnalysis, suspiciousCommits, regressionRisk } = input;

  // Determine probable regression cause
  const probableCause = determineProbableCause(parsedLogAnalysis, suspiciousCommits);

  // Format affected files
  const affectedFilesSection = formatAffectedFiles(parsedLogAnalysis.files);

  // Format suspicious commits
  const suspiciousCommitsSection = formatSuspiciousCommits(suspiciousCommits);

  // Format confidence assessment
  const confidenceSection = formatConfidenceAssessment(regressionRisk);

  // Build complete summary
  const summary = `
## Engineering Summary

### Probable Regression Cause
${probableCause}

### Affected Files
${affectedFilesSection}

### Suspicious Commits
${suspiciousCommitsSection}

### Confidence Assessment
${confidenceSection}

### Recommendation
${generateRecommendation(regressionRisk, suspiciousCommits)}

---
*Note: This summary is generated using rule-based analysis. Future versions will integrate IBM Bob AI for enhanced insights.*
`.trim();

  return { summary };
}

/**
 * Determines the probable cause of regression based on log analysis and commits.
 */
function determineProbableCause(
  logAnalysis: ParsedWorkflowLogs,
  commits: SuspiciousCommit[]
): string {
  const errorTypes: string[] = [];

  // Analyze error patterns
  for (const error of logAnalysis.errors) {
    const lowerError = error.toLowerCase();
    if (lowerError.includes('test') || lowerError.includes('assertion')) {
      errorTypes.push('test failures');
    } else if (lowerError.includes('compile') || lowerError.includes('syntax')) {
      errorTypes.push('compilation errors');
    } else if (lowerError.includes('type')) {
      errorTypes.push('type errors');
    } else if (lowerError.includes('import') || lowerError.includes('module')) {
      errorTypes.push('import/module errors');
    }
  }

  const uniqueErrorTypes = [...new Set(errorTypes)];

  if (commits.length > 0 && uniqueErrorTypes.length > 0) {
    return `Recent commits introduced ${uniqueErrorTypes.join(', ')} affecting ${logAnalysis.files.length} file(s). The failure appears to be caused by changes in ${commits.length} suspicious commit(s).`;
  } else if (uniqueErrorTypes.length > 0) {
    return `Workflow failed due to ${uniqueErrorTypes.join(', ')} in ${logAnalysis.files.length} file(s). No recent commits were identified as directly related to the failing files.`;
  } else if (commits.length > 0) {
    return `Workflow failed after ${commits.length} recent commit(s) modified files related to the failure. Specific error patterns could not be determined from logs.`;
  } else {
    return `Workflow failed with ${logAnalysis.errors.length} error(s) detected. Unable to correlate with recent commits or identify specific error patterns.`;
  }
}

/**
 * Formats the affected files section.
 */
function formatAffectedFiles(files: string[]): string {
  if (files.length === 0) {
    return 'No specific files were identified in the failure logs.';
  }

  if (files.length <= 5) {
    return files.map(f => `- \`${f}\``).join('\n');
  }

  const topFiles = files.slice(0, 5);
  return topFiles.map(f => `- \`${f}\``).join('\n') + `\n- ... and ${files.length - 5} more file(s)`;
}

/**
 * Formats the suspicious commits section.
 */
function formatSuspiciousCommits(commits: SuspiciousCommit[]): string {
  if (commits.length === 0) {
    return 'No suspicious commits were identified that modified the affected files.';
  }

  return commits.map(commit => {
    const shortSha = commit.sha.substring(0, 7);
    const firstLine = commit.message.split('\n')[0];
    const fileCount = commit.matchedFiles.length;
    return `- **${shortSha}** by ${commit.author}: "${firstLine}" (${fileCount} matched file${fileCount > 1 ? 's' : ''})`;
  }).join('\n');
}

/**
 * Formats the confidence assessment section.
 */
function formatConfidenceAssessment(regressionRisk: RegressionRiskResult): string {
  const { regressionRiskScore, confidenceLevel } = regressionRisk;

  let assessment = `Regression Risk Score: **${regressionRiskScore}/100** (${confidenceLevel} confidence)`;

  if (confidenceLevel === 'HIGH') {
    assessment += '\n\nThis failure has a high likelihood of being a regression. Immediate investigation is recommended.';
  } else if (confidenceLevel === 'MEDIUM') {
    assessment += '\n\nThis failure may be a regression. Investigation is recommended to confirm the root cause.';
  } else {
    assessment += '\n\nThis failure has a low likelihood of being a regression. It may be an environmental issue or flaky test.';
  }

  return assessment;
}

/**
 * Generates recommendations based on the analysis.
 */
function generateRecommendation(
  regressionRisk: RegressionRiskResult,
  commits: SuspiciousCommit[]
): string {
  const recommendations: string[] = [];

  if (regressionRisk.confidenceLevel === 'HIGH') {
    recommendations.push('1. Review the suspicious commits immediately');
    recommendations.push('2. Consider reverting the most recent changes if the issue is blocking');
    recommendations.push('3. Run local tests to reproduce the failure');
  } else if (regressionRisk.confidenceLevel === 'MEDIUM') {
    recommendations.push('1. Investigate the suspicious commits for potential issues');
    recommendations.push('2. Check for environmental differences between local and CI');
    recommendations.push('3. Review recent dependency updates');
  } else {
    recommendations.push('1. Check for flaky tests or environmental issues');
    recommendations.push('2. Review CI/CD configuration changes');
    recommendations.push('3. Verify external service dependencies');
  }

  if (commits.length > 0) {
    recommendations.push(`4. Focus investigation on commits: ${commits.slice(0, 3).map(c => c.sha.substring(0, 7)).join(', ')}`);
  }

  return recommendations.join('\n');
}

// Made with Bob
