import { createGithubOctokit } from './auth';

export interface SuspiciousCommit {
  sha: string;
  author: string;
  message: string;
  matchedFiles: string[];
}

export interface CommitCorrelationResult {
  suspiciousCommits: SuspiciousCommit[];
}

/**
 * Correlates recent commits with detected failing files to identify suspicious commits.
 * Fetches recent commits from a branch and compares their changed files against
 * the detected files from workflow failure logs.
 * 
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param detectedFiles - Array of file paths detected in failure logs
 * @returns Object containing suspicious commits that modified detected files
 */
export async function correlateRecentCommits(
  owner: string,
  repo: string,
  branch: string,
  detectedFiles: string[],
  installationId?: number
): Promise<CommitCorrelationResult> {
  const octokit = await createGithubOctokit(installationId);

  try {
    // Fetch recent commits for the branch (limit to 10)
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: 10,
    });

    const suspiciousCommits: SuspiciousCommit[] = [];

    // Process each commit
    for (const commit of commits) {
      // Fetch commit details to get changed files
      const { data: commitDetails } = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.sha,
      });

      // Extract changed files from commit
      const changedFiles = commitDetails.files?.map(file => file.filename) || [];

      // Find matches between changed files and detected files
      const matchedFiles = findMatchingFiles(changedFiles, detectedFiles);

      // If there are matches, this commit is suspicious
      if (matchedFiles.length > 0) {
        suspiciousCommits.push({
          sha: commit.sha,
          author: commit.commit.author?.name || commit.author?.login || 'Unknown',
          message: commit.commit.message,
          matchedFiles,
        });
      }
    }

    return {
      suspiciousCommits,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to correlate commits: ${error.message}`);
    }
    throw new Error('Failed to correlate commits: Unknown error');
  }
}

/**
 * Finds matching files between commit changed files and detected files.
 * Uses exact matching and partial path matching.
 */
function findMatchingFiles(changedFiles: string[], detectedFiles: string[]): string[] {
  const matches = new Set<string>();

  for (const changedFile of changedFiles) {
    for (const detectedFile of detectedFiles) {
      // Exact match
      if (changedFile === detectedFile) {
        matches.add(changedFile);
        continue;
      }

      // Partial match - detected file ends with changed file path
      // (handles cases where detected file has different prefix)
      if (detectedFile.endsWith(changedFile)) {
        matches.add(changedFile);
        continue;
      }

      // Partial match - changed file ends with detected file path
      if (changedFile.endsWith(detectedFile)) {
        matches.add(changedFile);
        continue;
      }

      // Filename match (same filename, different paths)
      const changedFileName = changedFile.split('/').pop();
      const detectedFileName = detectedFile.split('/').pop();
      if (changedFileName && detectedFileName && changedFileName === detectedFileName) {
        matches.add(changedFile);
      }
    }
  }

  return Array.from(matches);
}

// Made with Bob
