import path from 'path';

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportValidationError';
  }
}

/**
 * Validate that an import path is within the project root
 */
export function validateImportPath(importPath: string, projectRoot: string): string {
  const resolvedPath = path.resolve(importPath);
  const resolvedRoot = path.resolve(projectRoot);
  
  // Ensure path starts with project root
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new ImportValidationError(
      `Import path ${importPath} escapes project root ${projectRoot}`
    );
  }
  
  // Ensure path doesn't contain traversal
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ImportValidationError(
      `Import path ${importPath} contains traversal`
    );
  }
  
  return resolvedPath;
}
