import { cloneRepository } from './cloneRepository';
import { createFixBranch } from './createFixBranch';
import { readRepositoryFiles } from './readRepositoryFiles';
import { writeRepositoryFiles } from './writeRepositoryFiles';
import { createGitCommit } from './createGitCommit';
import { pushFixBranch } from './pushFixBranch';
import { createPullRequest } from './createPullRequest';
import { generateFixPatch } from './generateFixPatch';
import { generateCodeFix } from '@/lib/ai/generateCodeFix';
import { SuspiciousCommit } from './correlateRecentCommits';
import { RegressionRiskResult } from './calculateRegressionRisk';
import { tmpdir } from 'os';
import { basename, join, resolve } from 'path';
import { rm } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface AutoFixWorkflowInput {
  repositoryCloneUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  baseBranch: string;
  detectedFiles: string[];
  detectedErrors: string[];
  suspiciousCommits: SuspiciousCommit[];
  regressionRisk: RegressionRiskResult;
  engineeringSummary?: string;
  installationId?: number;
}

export interface AutoFixWorkflowResult {
  success: boolean;
  branchName?: string;
  pullRequestUrl?: string;
  error?: string;
}

/**
 * Orchestrates the automated fix workflow from repository clone to pull request creation.
 * Uses existing utilities to perform each step of the workflow.
 * 
 * @param input - Workflow input parameters
 * @returns Object indicating success, branch name, PR URL, and any error
 */
export async function runAutoFixWorkflow(
  input: AutoFixWorkflowInput
): Promise<AutoFixWorkflowResult> {
  const {
    repositoryCloneUrl,
    repositoryOwner,
    repositoryName,
    baseBranch,
    detectedFiles,
    detectedErrors,
    suspiciousCommits,
    installationId,
  } = input;

  let localPath = '';
  let branchName = '';
  let branchPushed = false;

  try {
    // Step 1: Clone repository
    console.log('[AutoFix] Step 1: Cloning repository...');
    localPath = join(tmpdir(), `autofix-${Date.now()}`);
    const cloneResult = await cloneRepository(repositoryCloneUrl, localPath);
    
    if (!cloneResult.success) {
      return {
        success: false,
        error: `Failed to clone repository: ${cloneResult.error}`,
      };
    }
    console.log(`[AutoFix] Repository cloned to: ${localPath}`);

    // Step 2: Generate fix patch metadata
    console.log('[AutoFix] Step 2: Generating fix patch metadata...');
    const patchMetadata = generateFixPatch({
      detectedErrors,
      detectedFiles,
      suspiciousCommits,
    });
    branchName = patchMetadata.branchName;
    console.log(`[AutoFix] Branch name: ${branchName}`);

    // Step 3: Create fix branch
    console.log('[AutoFix] Step 3: Creating fix branch...');
    const branchResult = await createFixBranch(localPath, branchName);
    
    if (!branchResult.success) {
      return {
        success: false,
        error: `Failed to create branch: ${branchResult.error}`,
      };
    }
    console.log(`[AutoFix] Branch created: ${branchName}`);

    // Step 4: Read detected files
    console.log('[AutoFix] Step 4: Reading detected files...');
    const readResult = await readRepositoryFiles(localPath, detectedFiles);
    console.log(`[AutoFix] Read ${readResult.files.length} file(s)`);

    // Step 5: Generate AI-powered code fixes
    console.log('[AutoFix] Step 5: Generating AI-powered code fixes...');
    const codeFixResult = await generateCodeFix({
      detectedErrors,
      detectedFiles,
      fileContents: readResult.files,
      engineeringSummary: input.engineeringSummary || '',
    });

    // Check if any fixes were generated
    if (codeFixResult.updatedFiles.length === 0) {
      console.log('[AutoFix] No fixes generated. Skipping workflow.');
      return {
        success: false,
        error: 'No fixes could be generated for the detected errors',
      };
    }

    console.log(`[AutoFix] Generated fixes for ${codeFixResult.updatedFiles.length} file(s)`);
    console.log('[AutoFix] Updated file paths:', codeFixResult.updatedFiles.map(f => f.path));

    // Step 6: Write updated files
    console.log('[AutoFix] Step 6: Writing updated files...');
    const writeResult = await writeRepositoryFiles(localPath, codeFixResult.updatedFiles);
    
    if (!writeResult.success) {
      return {
        success: false,
        error: `Failed to write files: ${writeResult.errors?.join(', ')}`,
      };
    }
    console.log(`[AutoFix] Updated ${writeResult.updatedFiles.length} file(s)`);

    // Step 7: Create git commit
    console.log('[AutoFix] Step 7: Creating git commit...');
    const commitResult = await createGitCommit(
      localPath,
      patchMetadata.commitMessage,
      codeFixResult.updatedFiles.map(file => file.path)
    );
    
    if (!commitResult.success) {
      return {
        success: false,
        error: `Failed to create commit: ${commitResult.error}`,
      };
    }
    console.log(`[AutoFix] Commit created: ${commitResult.commitSha}`);

    // Step 8: Push branch
    console.log('[AutoFix] Step 8: Pushing branch to origin...');
    const pushResult = await pushFixBranch(localPath, branchName);
    
    if (!pushResult.success) {
      return {
        success: false,
        error: `Failed to push branch: ${pushResult.error}`,
      };
    }
    branchPushed = true;
    console.log(`[AutoFix] Branch pushed: ${branchName}`);

    // Step 9: Create pull request
    console.log('[AutoFix] Step 9: Creating pull request...');
    const prResult = await createPullRequest(
      repositoryOwner,
      repositoryName,
      patchMetadata.pullRequestTitle,
      patchMetadata.pullRequestBody,
      branchName,
      baseBranch,
      installationId
    );
    console.log(`[AutoFix] Pull request created: ${prResult.pullRequestUrl}`);

    return {
      success: true,
      branchName,
      pullRequestUrl: prResult.pullRequestUrl,
    };
  } catch (error) {
    let errorMessage = 'Unknown error occurred during auto-fix workflow';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error(`[AutoFix] Workflow failed: ${errorMessage}`);
    await rollbackAutoFixWorkflow(localPath, branchName, branchPushed);

    return {
      success: false,
      branchName: branchName || undefined,
      error: errorMessage,
    };
  } finally {
    await cleanupLocalClone(localPath);
  }
}

async function rollbackAutoFixWorkflow(
  localPath: string,
  branchName: string,
  branchPushed: boolean
): Promise<void> {
  if (!localPath || !branchName || !branchPushed) {
    return;
  }

  try {
    console.log(`[AutoFix] Rolling back remote branch: ${branchName}`);
    await execFileAsync('git', ['push', 'origin', '--delete', branchName], {
      cwd: localPath,
      timeout: 120000,
    });
  } catch (rollbackError) {
    console.error(
      '[AutoFix] Failed to rollback remote branch:',
      rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
    );
  }
}

async function cleanupLocalClone(localPath: string): Promise<void> {
  if (!localPath) {
    return;
  }

  const tempRoot = resolve(tmpdir());
  const resolvedLocalPath = resolve(localPath);

  if (!resolvedLocalPath.startsWith(tempRoot) || !basename(resolvedLocalPath).startsWith('autofix-')) {
    console.warn(`[AutoFix] Skipping cleanup for unsafe path: ${localPath}`);
    return;
  }

  try {
    await rm(resolvedLocalPath, { recursive: true, force: true });
    console.log(`[AutoFix] Cleaned up local clone: ${resolvedLocalPath}`);
  } catch (cleanupError) {
    console.error(
      '[AutoFix] Failed to cleanup local clone:',
      cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
    );
  }
}

// Made with Bob
