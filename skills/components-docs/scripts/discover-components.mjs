#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const [projectRootArg] = process.argv.slice(2)

if (!projectRootArg) {
  throw new Error('Usage: discover-components.mjs <project-root>')
}

const projectRoot = path.resolve(projectRootArg)

if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
  throw new Error(`Project root must be an existing directory: ${projectRoot}`)
}

const ignoredDirs = new Set([
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  'coverage',
  'dist',
  'build',
  'out',
  'target',
  'node_modules',
  'vendor',
])

const frameworkPeerDeps = new Set([
  '@angular/core',
  'react',
  'solid-js',
  'svelte',
  'vue',
])

const componentExtensions = new Set([
  '.jsx',
  '.svelte',
  '.tsx',
  '.vue',
])

const publicEntryFiles = [
  'src/index.js',
  'src/index.jsx',
  'src/index.mjs',
  'src/index.ts',
  'src/index.tsx',
  'index.js',
  'index.jsx',
  'index.mjs',
  'index.ts',
  'index.tsx',
]

const componentRoots = discoverProjectRoots(projectRoot)
  .filter(isComponentLibraryRoot)
  .map(root => ({
    root,
    components: discoverComponents(root),
  }))
  .filter(root => root.components.length > 0)

const components = componentRoots
  .flatMap(root => root.components.map(component => ({
    ...component,
    root: normalizePath(path.relative(projectRoot, root.root) || '.'),
  })))
  .sort((left, right) => `${left.root}/${left.name}`.localeCompare(`${right.root}/${right.name}`))

const output = {
  projectRoot: normalizePath(projectRoot),
  componentRoots: componentRoots.map(root => ({
    root: normalizePath(path.relative(projectRoot, root.root) || '.'),
    componentCount: root.components.length,
  })),
  components,
}

console.log(JSON.stringify(output, null, 2))

function discoverProjectRoots(root) {
  const roots = new Set()

  for (const workspaceRoot of discoverWorkspaceRoots(root)) {
    roots.add(workspaceRoot)
  }

  walk(root, 0)

  if (roots.size === 0) {
    roots.add(root)
  }

  return [...roots].sort()

  function walk(currentDir, depth) {
    if (depth > 6) {
      return
    }

    if (existsSync(path.join(currentDir, 'package.json'))) {
      roots.add(currentDir)
    }

    for (const entry of listSubdirectories(currentDir)) {
      walk(entry, depth + 1)
    }
  }
}

function discoverWorkspaceRoots(root) {
  return collectPackageWorkspacePatterns(root)
    .flatMap(pattern => resolveWorkspacePattern(root, pattern))
    .filter(candidateRoot => existsSync(path.join(candidateRoot, 'package.json')))
}

function collectPackageWorkspacePatterns(root) {
  const packagePath = path.join(root, 'package.json')
  if (!existsSync(packagePath)) {
    return []
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const workspaces = packageJson.workspaces
  if (Array.isArray(workspaces)) {
    return workspaces.filter(pattern => typeof pattern === 'string' && !pattern.startsWith('!'))
  }

  if (Array.isArray(workspaces?.packages)) {
    return workspaces.packages.filter(pattern => typeof pattern === 'string' && !pattern.startsWith('!'))
  }

  return []
}

function resolveWorkspacePattern(root, pattern) {
  return expandWorkspacePattern(root, normalizePath(pattern).split('/').filter(Boolean))
}

function expandWorkspacePattern(currentDir, segments) {
  if (segments.length === 0) {
    return [currentDir]
  }

  const [segment, ...remainingSegments] = segments
  if (segment === '**') {
    return [
      ...expandWorkspacePattern(currentDir, remainingSegments),
      ...listSubdirectories(currentDir).flatMap(subdirectory => expandWorkspacePattern(subdirectory, segments)),
    ]
  }

  if (isGlobSegment(segment)) {
    const matcher = globSegmentMatcher(segment)

    return listSubdirectories(currentDir)
      .filter(subdirectory => matcher.test(path.basename(subdirectory)))
      .flatMap(subdirectory => expandWorkspacePattern(subdirectory, remainingSegments))
  }

  const nextDir = path.join(currentDir, segment)

  return existingDirectory(nextDir) ? expandWorkspacePattern(nextDir, remainingSegments) : []
}

function isComponentLibraryRoot(root) {
  const packagePath = path.join(root, 'package.json')
  if (!existsSync(packagePath)) {
    return false
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const peerDependencies = new Set(Object.keys(packageJson.peerDependencies ?? {}))

  return (
    isComponentLibraryPackageName(packageJson.name)
    || (hasFrameworkPeerDependency(peerDependencies) && hasComponentSource(root))
    || (hasPublicPackageEntry(packageJson) && hasFrameworkPeerDependency(peerDependencies))
  )
}

function discoverComponents(root) {
  const components = [
    ...discoverComponentDirectoryFiles(root),
    ...discoverPublicEntryComponentFiles(root),
  ]
  const seen = new Set()

  return components
    .map(filePath => ({
      name: componentNameFromFile(filePath),
      source: normalizePath(path.relative(projectRoot, filePath)),
    }))
    .filter((component) => {
      const key = `${component.name}:${component.source}`
      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

function discoverComponentDirectoryFiles(root) {
  return [
    path.join(root, 'src', 'components'),
    path.join(root, 'components'),
  ].flatMap(componentsDir => listComponentFiles(componentsDir))
}

function discoverPublicEntryComponentFiles(root) {
  return publicEntryFiles
    .map(entryFile => path.join(root, entryFile))
    .filter(entryPath => existsSync(entryPath))
    .flatMap(readExportedComponentFiles)
}

function readExportedComponentFiles(entryPath) {
  const entryDir = path.dirname(entryPath)
  const files = []

  for (const line of readFileSync(entryPath, 'utf8').split(/\r?\n/)) {
    if (!line.includes('export') || !line.includes('from')) {
      continue
    }

    const specifier = readExportSpecifier(line)
    if (specifier === null || !specifier.startsWith('.')) {
      continue
    }

    const componentFile = resolveComponentFile(entryDir, specifier)
    if (componentFile !== null) {
      files.push(componentFile)
    }
  }

  return files
}

function readExportSpecifier(line) {
  const fromIndex = line.indexOf('from')
  if (fromIndex < 0) {
    return null
  }

  const afterFrom = line.slice(fromIndex + 'from'.length).trim()
  const quote = afterFrom[0]
  if (quote !== '"' && quote !== '\'') {
    return null
  }

  const endIndex = afterFrom.indexOf(quote, 1)

  return endIndex > 0 ? afterFrom.slice(1, endIndex) : null
}

function resolveComponentFile(baseDir, specifier) {
  const absolutePath = path.resolve(baseDir, specifier)
  const candidates = [
    absolutePath,
    ...[...componentExtensions].map(extension => `${absolutePath}${extension}`),
    ...[...componentExtensions].map(extension => path.join(absolutePath, `index${extension}`)),
  ]

  return candidates.find(isComponentFile) ?? null
}

function listComponentFiles(dirPath) {
  if (!existingDirectory(dirPath)) {
    return []
  }

  return readdirSync(dirPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(dirPath, entry.name)
      if (entry.isDirectory() && !ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
        return listComponentFiles(entryPath)
      }

      return entry.isFile() && isComponentFile(entryPath) ? [entryPath] : []
    })
}

function hasComponentSource(root) {
  return (
    discoverComponentDirectoryFiles(root).length > 0
    || discoverPublicEntryComponentFiles(root).length > 0
  )
}

function hasPublicPackageEntry(packageJson) {
  return Boolean(packageJson.exports ?? packageJson.main ?? packageJson.module ?? packageJson.types)
}

function hasFrameworkPeerDependency(peerDependencies) {
  return [...frameworkPeerDeps].some(dependency => peerDependencies.has(dependency))
}

function isComponentLibraryPackageName(packageName) {
  if (typeof packageName !== 'string') {
    return false
  }

  const normalizedName = packageName.toLowerCase().replace(/^@[^/]+\//, '')
  const segments = normalizedName.split(/[._/-]+/)

  return (
    segments.some(segment => ['component', 'components', 'ui'].includes(segment))
    || normalizedName.includes('design-system')
    || normalizedName.includes('design_system')
  )
}

function componentNameFromFile(filePath) {
  const extension = path.extname(filePath)
  const basename = path.basename(filePath, extension)

  return basename.toLowerCase() === 'index' ? path.basename(path.dirname(filePath)) : basename
}

function isComponentFile(filePath) {
  return componentExtensions.has(path.extname(filePath))
}

function listSubdirectories(dirPath) {
  if (!existingDirectory(dirPath)) {
    return []
  }

  return readdirSync(dirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => !ignoredDirs.has(entry.name) && !entry.name.startsWith('.'))
    .map(entry => path.join(dirPath, entry.name))
}

function existingDirectory(dirPath) {
  return existsSync(dirPath) && statSync(dirPath).isDirectory()
}

function isGlobSegment(segment) {
  return segment.includes('*') || segment.includes('?')
}

function globSegmentMatcher(segment) {
  const pattern = segment
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')

  return new RegExp(`^${pattern}$`)
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').replace(/\/+$/g, '')
}
