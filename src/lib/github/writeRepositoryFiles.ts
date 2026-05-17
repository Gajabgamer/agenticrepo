import { writeFile, mkdir } from 'fs/promises';
import { join, resolve, dirname, relative } from 'path';

export interface FileToWrite {
  path: string;
  content: string;
}

export interface WriteRepositoryFilesResult {
  success: boolean;
  updatedFiles: string[];
  errors?: string[];
}

/**
 * Safely writes multiple files to a local repository.
 * Prevents writing outside repository root and handles failures gracefully.
 * 
 * @param localPath - Local repository path
 * @param files - Array of files to write with their paths and contents
 * @returns Object indicating success, list of updated files, and any errors
 */
export async function writeRepositoryFiles(
  localPath: string,
  files: FileToWrite[]
): Promise<WriteRepositoryFilesResult> {
  const updatedFiles: string[] = [];
  const errors: string[] = [];

  // Resolve repository root to absolute path
  const repoRoot = resolve(localPath);

  for (const file of files) {
    try {
      // Validate file path
      if (!file.path || file.path.trim() === '') {
        errors.push('Invalid file path: empty or undefined');
        continue;
      }

      // Construct full file path
      const fullPath = resolve(join(repoRoot, file.path));

      // Security check: ensure file is within repository root
      const relativePath = relative(repoRoot, fullPath);
      if (relativePath.startsWith('..') || resolve(fullPath) !== fullPath) {
        errors.push(`Security violation: path ${file.path} is outside repository root`);
        continue;
      }

      // Create directory if it doesn't exist
      const fileDir = dirname(fullPath);
      await mkdir(fileDir, { recursive: true });

      // Write file content
      await writeFile(fullPath, file.content, 'utf-8');

      updatedFiles.push(file.path);
    } catch (error) {
      // Log error and continue processing other files
      if (error instanceof Error) {
        errors.push(`Failed to write ${file.path}: ${error.message}`);
      } else {
        errors.push(`Failed to write ${file.path}: Unknown error`);
      }
      continue;
    }
  }

  return {
    success: updatedFiles.length > 0,
    updatedFiles,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Made with Bob
