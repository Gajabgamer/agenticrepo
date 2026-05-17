import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CloneRepositoryResult {
  success: boolean;
  localPath: string;
  error?: string;
}

/**
 * Clones a GitHub repository to a local path using git CLI.
 * 
 * @param cloneUrl - Repository clone URL (HTTPS or SSH)
 * @param localPath - Local target path for the cloned repository
 * @returns Object indicating success, local path, and any error message
 */
export async function cloneRepository(
  cloneUrl: string,
  localPath: string
): Promise<CloneRepositoryResult> {
  try {
    // Validate inputs
    if (!cloneUrl || !localPath) {
      return {
        success: false,
        localPath: '',
        error: 'Clone URL and local path are required',
      };
    }

    // Execute git clone command without shell interpolation.
    await execFileAsync('git', ['clone', cloneUrl, localPath], {
      timeout: 300000, // 5 minute timeout
    });

    return {
      success: true,
      localPath,
    };
  } catch (error) {
    let errorMessage = 'Unknown error occurred during clone';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      localPath: '',
      error: `Failed to clone repository: ${errorMessage}`,
    };
  }
}

// Made with Bob
