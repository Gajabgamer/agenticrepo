import { readFile, stat } from 'fs/promises';
import { join, resolve, relative } from 'path';

export interface FileContent {
  path: string;
  content: string;
}

export interface ReadRepositoryFilesResult {
  files: FileContent[];
}

// Maximum file size to read: 1MB
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Reads multiple files from a local repository safely.
 * Skips files that are missing, unreadable, or exceed size limits.
 * 
 * @param localPath - Local repository path
 * @param filePaths - Array of relative file paths to read
 * @returns Object containing array of successfully read files with their contents
 */
export async function readRepositoryFiles(
  localPath: string,
  filePaths: string[]
): Promise<ReadRepositoryFilesResult> {
  const files: FileContent[] = [];
  const repoRoot = resolve(localPath);

  for (const filePath of filePaths) {
    try {
      // Construct full file path
      const fullPath = resolve(join(repoRoot, filePath));
      const relativePath = relative(repoRoot, fullPath);

      if (relativePath.startsWith('..') || relativePath === '') {
        console.warn(`Skipping file ${filePath}: outside repository root`);
        continue;
      }

      // Check file size before reading
      const fileStats = await stat(fullPath);

      // Skip files that are too large
      if (fileStats.size > MAX_FILE_SIZE) {
        console.warn(`Skipping file ${filePath}: exceeds size limit (${fileStats.size} bytes)`);
        continue;
      }

      // Skip directories
      if (fileStats.isDirectory()) {
        console.warn(`Skipping ${filePath}: is a directory`);
        continue;
      }

      // Read file content
      const content = await readFile(fullPath, 'utf-8');

      files.push({
        path: filePath,
        content,
      });
    } catch (error) {
      // Log error but continue processing other files
      if (error instanceof Error) {
        console.warn(`Failed to read file ${filePath}: ${error.message}`);
      } else {
        console.warn(`Failed to read file ${filePath}: Unknown error`);
      }
      // Skip this file and continue with others
      continue;
    }
  }

  return { files };
}

// Made with Bob
