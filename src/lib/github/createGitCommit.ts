import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface CreateGitCommitResult {
  success: boolean;
  commitSha: string;
  error?: string;
}

/**
 * Stages all modified files and creates a git commit in a local repository.
 * 
 * @param localPath - Local repository path
 * @param commitMessage - Commit message
 * @returns Object indicating success, commit SHA, and any error message
 */
export async function createGitCommit(
  localPath: string,
  commitMessage: string,
  filePaths: string[] = []
): Promise<CreateGitCommitResult> {
  try {
    // Validate inputs
    if (!localPath || !commitMessage) {
      return {
        success: false,
        commitSha: '',
        error: 'Local path and commit message are required',
      };
    }

    const addArgs = filePaths.length > 0 ? ['add', '--', ...filePaths] : ['add', '-A'];

    // Stage only generated fix files when provided.
    await execFileAsync('git', addArgs, {
      cwd: localPath,
      timeout: 30000, // 30 second timeout
    });

    const { stdout: stagedDiff } = await execFileAsync('git', ['diff', '--cached', '--name-only'], {
      cwd: localPath,
      timeout: 10000,
    });

    if (!stagedDiff.trim()) {
      return {
        success: false,
        commitSha: '',
        error: 'No generated file changes were staged for commit',
      };
    }

    // Create commit
    await execFileAsync('git', [
      '-c',
      'user.name=github-agent',
      '-c',
      'user.email=github-agent@example.invalid',
      'commit',
      '-m',
      commitMessage,
    ], {
      cwd: localPath,
      timeout: 30000,
    });

    // Get the commit SHA
    const { stdout: commitSha } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: localPath,
      timeout: 10000,
    });

    return {
      success: true,
      commitSha: commitSha.trim(),
    };
  } catch (error) {
    let errorMessage = 'Unknown error occurred during commit';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      commitSha: '',
      error: `Failed to create commit: ${errorMessage}`,
    };
  }
}

// Made with Bob
