export interface FileContent {
  path: string;
  content: string;
}

export interface CodeFixInput {
  detectedErrors: string[];
  detectedFiles: string[];
  fileContents: FileContent[];
  engineeringSummary: string;
}

export interface CodeFixResult {
  updatedFiles: FileContent[];
}

/**
 * Generates code fixes for detected errors.
 * Currently uses deterministic TypeScript logic for safe, simple fixes.
 * Architecture designed for future IBM Bob AI integration.
 * 
 * @param input - Detected errors, files, contents, and engineering summary
 * @returns Updated files with fixes applied
 */
export async function generateCodeFix(input: CodeFixInput): Promise<CodeFixResult> {
  const { detectedErrors, detectedFiles, fileContents } = input;

  const updatedFiles: FileContent[] = [];

  // Process each file
  for (const file of fileContents) {
    if (detectedFiles.length > 0 && !detectedFiles.includes(file.path)) {
      continue;
    }

    let updatedContent = file.content;
    let hasChanges = false;

    // Apply safe, deterministic fixes
    const fixResult = applyDeterministicFixes(updatedContent, detectedErrors);
    
    if (fixResult.modified) {
      updatedContent = fixResult.content;
      hasChanges = true;
    }

    // Validate changes before adding to results
    if (hasChanges && validateFixedContent(file.content, updatedContent)) {
      updatedFiles.push({
        path: file.path,
        content: updatedContent,
      });
    }
  }

  return { updatedFiles };
}

/**
 * Applies deterministic, safe fixes to code content.
 * TODO: Replace with IBM Bob AI integration for intelligent fixes.
 */
function applyDeterministicFixes(
  content: string,
  errors: string[]
): { content: string; modified: boolean } {
  let modifiedContent = content;
  let hasModifications = false;

  // Fix 1: Add missing semicolons at end of statements
  if (errors.some(e => e.toLowerCase().includes('semicolon') || e.toLowerCase().includes('expected ;'))) {
    const fixed = fixMissingSemicolons(modifiedContent);
    if (fixed !== modifiedContent) {
      modifiedContent = fixed;
      hasModifications = true;
    }
  }

  // Fix 2: Fix common console typos
  if (errors.some(e => e.toLowerCase().includes('console') || e.toLowerCase().includes('consol'))) {
    const fixed = fixConsoleTypos(modifiedContent);
    if (fixed !== modifiedContent) {
      modifiedContent = fixed;
      hasModifications = true;
    }
  }

  // Fix 3: Add simple null checks for common patterns
  if (errors.some(e => e.toLowerCase().includes('cannot read property') || e.toLowerCase().includes('undefined'))) {
    const fixed = addSimpleNullChecks(modifiedContent, errors);
    if (fixed !== modifiedContent) {
      modifiedContent = fixed;
      hasModifications = true;
    }
  }

  // Fix 4: Add missing imports for common modules
  if (errors.some(e => e.toLowerCase().includes('module not found') || e.toLowerCase().includes('cannot find module'))) {
    const fixed = addMissingImports(modifiedContent, errors);
    if (fixed !== modifiedContent) {
      modifiedContent = fixed;
      hasModifications = true;
    }
  }

  return {
    content: modifiedContent,
    modified: hasModifications,
  };
}

/**
 * Fixes missing semicolons at end of simple statements.
 */
function fixMissingSemicolons(content: string): string {
  const lines = content.split('\n');
  const fixedLines = lines.map(line => {
    const trimmed = line.trim();
    
    // Skip empty lines, comments, and lines that already end with semicolon or special chars
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || 
        trimmed.endsWith(';') || trimmed.endsWith('{') || trimmed.endsWith('}') ||
        trimmed.endsWith(',') || trimmed.endsWith(':')) {
      return line;
    }

    // Add semicolon to simple single-line statements.
    if (
      /^(const|let|var|return|throw|import|export)\s+/.test(trimmed) &&
      !trimmed.endsWith(')') &&
      !trimmed.includes('{') &&
      !trimmed.includes('=>')
    ) {
      return line + ';';
    }

    if (/^[a-zA-Z_$][\w$]*\s*=/.test(trimmed) && !trimmed.includes('{')) {
      return line + ';';
    }

    return line;
  });

  return fixedLines.join('\n');
}

/**
 * Fixes common console typos (consol -> console).
 */
function fixConsoleTypos(content: string): string {
  return content.replace(/\bconsol\.log\b/g, 'console.log')
                .replace(/\bconsol\.error\b/g, 'console.error')
                .replace(/\bconsol\.warn\b/g, 'console.warn');
}

/**
 * Adds simple null checks for property access patterns.
 */
function addSimpleNullChecks(content: string, errors: string[]): string {
  const nullableProperties = extractNullableProperties(errors);

  if (nullableProperties.length === 0) {
    return content;
  }

  const lines = content.split('\n');
  const fixedLines = lines.map(line => applyNullCheckToLine(line, nullableProperties));

  return fixedLines.join('\n');
}

function applyNullCheckToLine(line: string, nullableProperties: string[]): string {
  const trimmed = line.trim();

  if (
    !trimmed ||
    trimmed.startsWith('import ') ||
    trimmed.startsWith('export ') ||
    trimmed.startsWith('//') ||
    line.includes('?.')
  ) {
    return line;
  }

  return line.replace(/\b([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)\b/g, (match, objectName, propertyName) => {
    const blockedObjects = new Set([
      'console',
      'process',
      'Math',
      'JSON',
      'Date',
      'Object',
      'Array',
      'String',
      'Number',
      'Boolean',
      'Promise',
    ]);

    if (blockedObjects.has(objectName) || !nullableProperties.includes(propertyName)) {
      return match;
    }

    return `${objectName}?.${propertyName}`;
  });
}

function extractNullableProperties(errors: string[]): string[] {
  const properties = new Set<string>();

  for (const error of errors) {
    const matches = [
      error.match(/Cannot read (?:properties|property) of (?:undefined|null).*['"`]([A-Za-z_$][\w$]*)['"`]/i),
      error.match(/Cannot read (?:properties|property) ['"`]([A-Za-z_$][\w$]*)['"`] of (?:undefined|null)/i),
    ];

    for (const match of matches) {
      if (match?.[1]) {
        properties.add(match[1]);
      }
    }
  }

  return Array.from(properties);
}

/**
 * Adds missing imports based on error messages.
 */
function addMissingImports(content: string, errors: string[]): string {
  const importLines = new Set<string>();
  const existingImports = new Set(
    content
      .split('\n')
      .filter(line => line.trim().startsWith('import '))
      .map(line => line.trim())
  );

  for (const error of errors) {
    const missingName = extractMissingName(error);
    const importLine = missingName ? getSafeImportForName(missingName) : null;

    if (importLine && !existingImports.has(importLine)) {
      importLines.add(importLine);
    }
  }

  if (importLines.size === 0) {
    return content;
  }

  const lines = content.split('\n');

  // Find where to insert imports (after existing imports or at top)
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() && !lines[i].trim().startsWith('//')) {
      break;
    }
  }

  lines.splice(insertIndex, 0, ...Array.from(importLines));
  return lines.join('\n');
}

function extractMissingName(error: string): string | null {
  const match =
    error.match(/Cannot find name ['"`]?([A-Za-z_$][\w$]*)['"`]?/i) ||
    error.match(/['"`]([A-Za-z_$][\w$]*)['"`] is not defined/i);

  return match?.[1] || null;
}

function getSafeImportForName(name: string): string | null {
  const reactImports = new Set([
    'Activity',
    'Suspense',
    'startTransition',
    'use',
    'useActionState',
    'useDeferredValue',
    'useEffect',
    'useEffectEvent',
    'useId',
    'useOptimistic',
    'useReducer',
    'useRef',
    'useState',
    'useTransition',
  ]);

  const nextServerImports = new Set(['NextRequest', 'NextResponse']);
  const nextImports = new Set(['Metadata']);

  if (reactImports.has(name)) {
    return `import { ${name} } from 'react';`;
  }

  if (nextServerImports.has(name)) {
    return `import { ${name} } from 'next/server';`;
  }

  if (nextImports.has(name)) {
    return `import type { ${name} } from 'next';`;
  }

  return null;
}

/**
 * Validates that fixed content is safe and maintains structure.
 */
function validateFixedContent(original: string, fixed: string): boolean {
  // Basic validation checks
  
  // Check 1: Content should not be empty
  if (!fixed || fixed.trim().length === 0) {
    return false;
  }

  // Check 2: Should not have drastically changed length (safety check)
  const lengthDiff = Math.abs(fixed.length - original.length);
  const maxAllowedDiff = original.length * 0.2; // 20% max change
  if (lengthDiff > maxAllowedDiff) {
    return false;
  }

  // Check 3: Should maintain basic structure (same number of braces)
  const originalBraces = (original.match(/[{}]/g) || []).length;
  const fixedBraces = (fixed.match(/[{}]/g) || []).length;
  if (originalBraces !== fixedBraces) {
    return false;
  }

  // Check 4: Should not remove all content
  if (fixed.length < original.length * 0.5) {
    return false;
  }

  return true;
}

/**
 * Future: IBM Bob AI integration point.
 * This function will be replaced with actual AI-powered fix generation.
 * 
 * @param input - Code fix input with context
 * @returns AI-generated code fixes
 */
export async function generateAICodeFix(input: CodeFixInput): Promise<CodeFixResult> {
  // TODO: Integrate with IBM Bob AI
  // const bobResponse = await ibmBobClient.generateFix({
  //   errors: input.detectedErrors,
  //   files: input.fileContents,
  //   context: input.engineeringSummary,
  // });
  // return { updatedFiles: bobResponse.fixes };

  // For now, use deterministic fixes
  return generateCodeFix(input);
}

// Made with Bob
