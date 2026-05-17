import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CreateFixBranchResult {
  success: boolean;
  branchName: string;
  error?: string;
}

/**
 * Creates and checks out a new branch in a local git repository.
 * The branch is created from the current checked out branch.
 * 
 * @param localPath - Local repository path
 * @param branchName - Name for the new branch
 * @returns Object indicating success, branch name, and any error message
 */
export async function createFixBranch(
  localPath: string,
  branchName: string
): Promise<CreateFixBranchResult> {
  try {
    // Validate inputs
    if (!localPath || !branchName) {
      return {
        success: false,
        branchName: '',
        error: 'Local path and branch name are required',
      };
    }

    // Execute git checkout -b command to create and checkout new branch.
    await execFileAsync('git', ['checkout', '-b', branchName], {
      cwd: localPath,
      timeout: 30000, // 30 second timeout
    });

    return {
      success: true,
      branchName,
    };
  } catch (error) {
    let errorMessage = 'Unknown error occurred during branch creation';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      branchName: '',
      error: `Failed to create branch: ${errorMessage}`,
    };
  }
}

// Made with Bob
