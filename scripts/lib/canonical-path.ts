import fs from 'node:fs'
import path from 'node:path'

function isMissingPathError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT'
}

function isFilesystemError(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code
}

function lexicalPathKey(input: string): string {
  const resolved = path.resolve(input).replaceAll('\\', '/')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/**
 * Resolve filesystem aliases for every existing ancestor while preserving a
 * not-yet-created suffix. macOS exposes paths such as /var through a symlink to
 * /private/var, so lexical path.resolve() alone is not a stable identity.
 */
export function canonicalPath(input: string): string {
  let current = path.resolve(input)
  const missingSegments: string[] = []

  while (true) {
    try {
      const existingRoot = fs.realpathSync.native(current)
      return path.resolve(existingRoot, ...missingSegments.reverse())
    }
    catch (error) {
      if (!isMissingPathError(error)) {
        throw error
      }
      const parent = path.dirname(current)
      if (parent === current) {
        throw error
      }
      missingSegments.push(path.basename(current))
      current = parent
    }
  }
}

export function canonicalPathKey(input: string): string {
  const resolved = canonicalPath(input).replaceAll('\\', '/')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function areSamePaths(left: string, right: string): boolean {
  if (!left || !right) {
    return false
  }

  try {
    return canonicalPathKey(left) === canonicalPathKey(right)
  }
  catch (error) {
    // Equality is used while repairing cyclic links. Containment checks must
    // remain strict and continue to surface ELOOP through canonicalPath().
    if (!isFilesystemError(error, 'ELOOP')) {
      throw error
    }
    return lexicalPathKey(left) === lexicalPathKey(right)
  }
}

export function isPathInside(root: string, target: string): boolean {
  const canonicalRoot = canonicalPath(root)
  const canonicalTarget = canonicalPath(target)
  const relative = path.relative(canonicalRoot, canonicalTarget)
  return relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}
