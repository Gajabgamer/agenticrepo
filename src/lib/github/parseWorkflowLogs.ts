export interface ParsedWorkflowLogs {
  errors: string[];
  files: string[];
  summary: string;
}

/**
 * Parses workflow logs to extract errors, file references, and generate a summary.
 * Uses simple regex and string matching to detect failure patterns.
 * 
 * @param rawLogs - Raw log text from workflow run
 * @returns Parsed log information with errors, files, and summary
 */
export function parseWorkflowLogs(rawLogs: string): ParsedWorkflowLogs {
  const lines = rawLogs.split('\n');
  const errors: string[] = [];
  const filesSet = new Set<string>();
  
  // Patterns for detecting errors
  const errorPatterns = [
    /error:/i,
    /failed:/i,
    /failure:/i,
    /exception:/i,
    /fatal:/i,
    /\[error\]/i,
    /\[fail\]/i,
    /❌/,
    /✗/,
  ];

  // Patterns for detecting test failures
  const testFailurePatterns = [
    /test.*failed/i,
    /\d+\s+failed/i,
    /failing\s+test/i,
    /assertion.*failed/i,
    /expected.*but.*got/i,
  ];

  // Patterns for extracting file paths
  const filePatterns = [
    // Standard file paths with extensions
    /(?:^|\s)([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)(?:\s|:|$)/g,
    // File paths in quotes
    /"([^"]+\.[a-zA-Z0-9]+)"/g,
    // File paths in parentheses
    /\(([^)]+\.[a-zA-Z0-9]+)\)/g,
    // At file:line patterns
    /at\s+([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/g,
    // In file patterns
    /in\s+([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/g,
  ];

  // Process each line
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for error patterns
    const isErrorLine = errorPatterns.some(pattern => pattern.test(trimmedLine));
    const isTestFailure = testFailurePatterns.some(pattern => pattern.test(trimmedLine));

    if (isErrorLine || isTestFailure) {
      // Clean up ANSI codes and timestamps
      const cleanedLine = trimmedLine
        .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
        .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '') // Remove timestamps
        .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '') // Remove time prefixes
        .substring(0, 200); // Limit length

      if (cleanedLine.length > 10) {
        errors.push(cleanedLine);
      }
    }

    // Extract file references
    for (const pattern of filePatterns) {
      const matches = trimmedLine.matchAll(pattern);
      for (const match of matches) {
        const filePath = match[1];
        if (filePath && isValidFilePath(filePath)) {
          filesSet.add(filePath);
        }
      }
    }
  }

  const files = Array.from(filesSet);

  // Generate summary
  const summary = generateSummary(errors, files);

  return {
    errors: errors.slice(0, 10), // Limit to first 10 errors
    files: files.slice(0, 20), // Limit to first 20 files
    summary,
  };
}

/**
 * Validates if a string looks like a valid file path
 */
function isValidFilePath(path: string): boolean {
  // Must have an extension
  if (!/\.[a-zA-Z0-9]+$/.test(path)) return false;
  
  // Should not be too short or too long
  if (path.length < 3 || path.length > 200) return false;
  
  // Should not contain suspicious characters
  if (/[<>"|?*]/.test(path)) return false;
  
  // Should not be a URL
  if (/^https?:\/\//.test(path)) return false;
  
  // Common file extensions
  const validExtensions = [
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rb', 'php',
    'c', 'cpp', 'h', 'hpp', 'cs', 'rs', 'swift', 'kt',
    'json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'conf',
    'md', 'txt', 'sh', 'bash', 'sql', 'css', 'scss', 'html',
  ];
  
  const ext = path.split('.').pop()?.toLowerCase();
  return ext ? validExtensions.includes(ext) : false;
}

/**
 * Generates a summary of detected failure patterns
 */
function generateSummary(errors: string[], files: string[]): string {
  const parts: string[] = [];

  // Analyze error patterns
  const errorTypes = new Set<string>();
  for (const error of errors) {
    const lowerError = error.toLowerCase();
    if (lowerError.includes('test') || lowerError.includes('assertion')) {
      errorTypes.add('test failures');
    } else if (lowerError.includes('compile') || lowerError.includes('syntax')) {
      errorTypes.add('compilation errors');
    } else if (lowerError.includes('import') || lowerError.includes('module')) {
      errorTypes.add('import/module errors');
    } else if (lowerError.includes('type')) {
      errorTypes.add('type errors');
    } else if (lowerError.includes('timeout')) {
      errorTypes.add('timeout errors');
    } else {
      errorTypes.add('runtime errors');
    }
  }

  if (errorTypes.size > 0) {
    parts.push(`Detected ${Array.from(errorTypes).join(', ')}`);
  }

  // Analyze affected files
  if (files.length > 0) {
    const directories = new Set<string>();
    for (const file of files) {
      const dir = file.split('/').slice(0, -1).join('/');
      if (dir) directories.add(dir);
    }

    if (directories.size > 0) {
      const topDirs = Array.from(directories).slice(0, 3);
      parts.push(`affecting ${files.length} file(s) in ${topDirs.join(', ')}`);
    } else {
      parts.push(`affecting ${files.length} file(s)`);
    }
  }

  if (parts.length === 0) {
    return 'Workflow failed with unspecified errors';
  }

  return parts.join('; ');
}

// Made with Bob
