import { ServiceResponse } from '@/types';

/**
 * Create a standardized service response
 */
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string
): ServiceResponse<T> {
  return {
    success,
    data,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate environment variables
 */
export function validateEnv(requiredVars: string[]): void {
  const missing = requiredVars.filter((varName) => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry logic for API calls
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i));
      }
    }
  }
  
  throw lastError!;
}

// Made with Bob
