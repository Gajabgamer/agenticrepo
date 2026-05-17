import { ConfidenceLevel } from './calculateRegressionRisk';

export interface AutoFixEligibilityInput {
  regressionRiskScore: number;
  confidenceLevel: ConfidenceLevel;
  detectedFiles: string[];
  detectedErrors: string[];
}

export interface AutoFixEligibilityResult {
  allowed: boolean;
  reason: string;
}

/**
 * Determines if an auto-fix is safe to apply based on regression analysis.
 * Uses strict rules to prevent auto-fixes in sensitive areas or high-risk scenarios.
 * 
 * @param input - Regression analysis data
 * @returns Object indicating if auto-fix is allowed and the reason
 */
export function isSafeAutoFix(
  input: AutoFixEligibilityInput
): AutoFixEligibilityResult {
  const { regressionRiskScore, confidenceLevel, detectedFiles, detectedErrors } = input;

  // Check confidence level
  if (confidenceLevel !== 'HIGH') {
    return {
      allowed: false,
      reason: `Confidence level is ${confidenceLevel}, but HIGH confidence is required for auto-fix`,
    };
  }

  // Check number of detected files
  if (detectedFiles.length > 3) {
    return {
      allowed: false,
      reason: `Too many files affected (${detectedFiles.length}). Auto-fix is limited to 3 or fewer files`,
    };
  }

  // Check number of detected errors
  if (detectedErrors.length > 5) {
    return {
      allowed: false,
      reason: `Too many errors detected (${detectedErrors.length}). Auto-fix is limited to 5 or fewer errors`,
    };
  }

  // Check regression risk score
  if (regressionRiskScore > 90) {
    return {
      allowed: false,
      reason: `Regression risk score too high (${regressionRiskScore}). Auto-fix is limited to scores of 90 or below`,
    };
  }

  // Check for sensitive files
  const sensitiveFileCheck = checkForSensitiveFiles(detectedFiles);
  if (!sensitiveFileCheck.safe) {
    return {
      allowed: false,
      reason: sensitiveFileCheck.reason,
    };
  }

  // All checks passed
  return {
    allowed: true,
    reason: 'All safety checks passed. Auto-fix is allowed',
  };
}

/**
 * Checks if any detected files are in sensitive categories.
 */
function checkForSensitiveFiles(files: string[]): { safe: boolean; reason: string } {
  // Auth-related file patterns
  const authPatterns = [
    /auth/i,
    /login/i,
    /password/i,
    /token/i,
    /session/i,
    /oauth/i,
    /jwt/i,
    /credential/i,
  ];

  // Payment-related file patterns
  const paymentPatterns = [
    /payment/i,
    /billing/i,
    /checkout/i,
    /stripe/i,
    /paypal/i,
    /transaction/i,
    /invoice/i,
    /subscription/i,
  ];

  // Config file patterns
  const configPatterns = [
    /\.env/i,
    /config\.(js|ts|json|yaml|yml)$/i,
    /settings\.(js|ts|json|yaml|yml)$/i,
    /\.config\./i,
    /configuration/i,
  ];

  for (const file of files) {
    // Check auth-related files
    if (authPatterns.some(pattern => pattern.test(file))) {
      return {
        safe: false,
        reason: `Auto-fix blocked: detected auth-related file (${file})`,
      };
    }

    // Check payment-related files
    if (paymentPatterns.some(pattern => pattern.test(file))) {
      return {
        safe: false,
        reason: `Auto-fix blocked: detected payment-related file (${file})`,
      };
    }

    // Check config files
    if (configPatterns.some(pattern => pattern.test(file))) {
      return {
        safe: false,
        reason: `Auto-fix blocked: detected config file (${file})`,
      };
    }
  }

  return { safe: true, reason: '' };
}

// Made with Bob
