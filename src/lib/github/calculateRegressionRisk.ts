export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RegressionRiskInput {
  severityScore: number;
  detectedErrors: string[];
  detectedFiles: string[];
  suspiciousCommits: Array<{ sha: string }>;
  branch?: string;
}

export interface RegressionRiskResult {
  regressionRiskScore: number;
  confidenceLevel: ConfidenceLevel;
}

/**
 * Calculates regression risk score and confidence level based on workflow failure analysis.
 * Uses rule-based scoring to assess the likelihood of a regression.
 * 
 * @param input - Object containing severity score, detected errors, files, commits, and branch
 * @returns Regression risk score (0-100) and confidence level (LOW/MEDIUM/HIGH)
 */
export function calculateRegressionRisk(
  input: RegressionRiskInput
): RegressionRiskResult {
  let regressionRiskScore = 0;

  // +25 if suspicious commits > 0
  if (input.suspiciousCommits.length > 0) {
    regressionRiskScore += 25;
  }

  // +20 if detected files > 3
  if (input.detectedFiles.length > 3) {
    regressionRiskScore += 20;
  }

  // +20 if detected errors > 5
  if (input.detectedErrors.length > 5) {
    regressionRiskScore += 20;
  }

  // +15 if severityScore > 50
  if (input.severityScore > 50) {
    regressionRiskScore += 15;
  }

  // +20 if branch is main or master
  if (input.branch) {
    const branchLower = input.branch.toLowerCase();
    if (branchLower === 'main' || branchLower === 'master') {
      regressionRiskScore += 20;
    }
  }

  // Ensure score is within 0-100 range
  regressionRiskScore = Math.min(100, Math.max(0, regressionRiskScore));

  // Determine confidence level based on score
  const confidenceLevel = determineConfidenceLevel(regressionRiskScore);

  return {
    regressionRiskScore,
    confidenceLevel,
  };
}

/**
 * Determines confidence level based on regression risk score.
 * 
 * @param score - Regression risk score (0-100)
 * @returns Confidence level (LOW/MEDIUM/HIGH)
 */
function determineConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 71) {
    return 'HIGH';
  } else if (score >= 31) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}

// Made with Bob
