import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface PushFixBranchResult {
  success: boolean;
  branchName: string;
  error?: string;
}

/**
 * Pushes a branch to the remote origin repository.
 * 
 * @param localPath - Local repository path
 * @param branchName - Branch name to push
 * @returns Object indicating success, branch name, and any error message
 */
export async function pushFixBranch(
  localPath: string,
  branchName: string
): Promise<PushFixBranchResult> {
  try {
    // Validate inputs
    if (!localPath || !branchName) {
      return {
        success: false,
        branchName: '',
        error: 'Local path and branch name are required',
      };
    }

    // Push branch to origin without shell interpolation.
    await execFileAsync('git', ['push', 'origin', branchName], {
      cwd: localPath,
      timeout: 120000, // 2 minute timeout for push operations
    });

    return {
      success: true,
      branchName,
    };
  } catch (error) {
    let errorMessage = 'Unknown error occurred during push';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      branchName: '',
      error: `Failed to push branch: ${errorMessage}`,
    };
  }
}

// Made with Bob
