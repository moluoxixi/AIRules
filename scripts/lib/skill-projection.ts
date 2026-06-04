import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SKILL_FILE_NAME = 'SKILL.md'

export interface FlattenedSkillSource {
  name: string
  source: string
}

export interface DiscoverSkillOptions {
  followSymlinks?: boolean
}

const SKIPPABLE_LINK_ERROR_CODES = new Set(['ENOENT', 'ELOOP', 'ENOTDIR'])

function isSkippableLinkError(error: unknown): boolean {
  return SKIPPABLE_LINK_ERROR_CODES.has((error as NodeJS.ErrnoException).code ?? '')
}

function isTraversableDirectory(entry: import('node:fs').Dirent, childDir: string, followSymlinks: boolean): boolean {
  if (entry.isDirectory()) {
    return true
  }

  if (!followSymlinks || !entry.isSymbolicLink()) {
    return false
  }

  try {
    return statSync(childDir).isDirectory()
  }
  catch (error) {
    if (isSkippableLinkError(error)) {
      return false
    }

    throw error
  }
}

/**
 * vendor/skills 是分发边界，只暴露叶子 skill 名称，不继承源仓库分类路径。
 */
export function flattenedSkillName(value: string): string {
  return path.posix.basename(value.replace(/\\/g, '/'))
}

export function flattenedVendorSkillTarget(outputName: string): string {
  return path.posix.join('vendor', 'skills', flattenedSkillName(outputName))
}

/**
 * 递归收集真实 skill 根目录；包含 SKILL.md 的目录即为叶子 skill，内部子目录不再继续展开。
 */
export function discoverSkillDirectories(rootDir: string, options: DiscoverSkillOptions = {}): string[] {
  const skillDirs: string[] = []
  const followSymlinks = options.followSymlinks ?? true

  function visit(currentDir: string) {
    if (existsSync(path.join(currentDir, SKILL_FILE_NAME))) {
      skillDirs.push(currentDir)
      return
    }

    const entries = readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const childDir = path.join(currentDir, entry.name)
      if (isTraversableDirectory(entry, childDir, followSymlinks)) {
        visit(childDir)
      }
    }
  }

  visit(rootDir)
  return skillDirs.sort((left, right) => left.localeCompare(right))
}

export function collectFlattenedSkillSources(sourceDir: string): FlattenedSkillSource[] {
  const discoveredSources = discoverSkillDirectories(sourceDir)
  const sources = discoveredSources.length > 0
    ? discoveredSources
    : readdirSync(sourceDir)
        .filter(name => name !== '.gitignore')
        .sort((left, right) => left.localeCompare(right))
        .map(name => path.join(sourceDir, name))

  const seenNames = new Map<string, string>()
  return sources.map((source) => {
    const name = flattenedSkillName(path.basename(source))
    const nameKey = name.toLowerCase()
    const previousSource = seenNames.get(nameKey)
    if (previousSource && path.resolve(previousSource) !== path.resolve(source)) {
      throw new Error(`Flattened skill name collision "${name}": ${previousSource} conflicts with ${source}`)
    }

    seenNames.set(nameKey, source)
    return { name, source }
  })
}
