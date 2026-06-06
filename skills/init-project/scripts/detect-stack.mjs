#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const [projectRootArg] = process.argv.slice(2)

if (!projectRootArg) {
  throw new Error('Usage: detect-stack.mjs <project-root>')
}

const projectRoot = path.resolve(projectRootArg)

if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
  throw new Error(`Project root must be an existing directory: ${projectRoot}`)
}

const stackOrder = ['frontend', 'component-library', 'node', 'nestjs', 'java']
const stackReferences = {
  'frontend': ['frontend-docs-standard.md', 'frontend-code-standard.md'],
  'component-library': ['frontend-docs-standard.md', 'frontend-code-standard.md'],
  'node': ['backend-docs-standard.md', 'node-code-standard.md'],
  'nestjs': ['backend-docs-standard.md', 'nestjs-code-standard.md'],
  'java': ['backend-docs-standard.md', 'java-code-standard.md'],
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

const markerFiles = new Set([
  'package.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'nest-cli.json',
  'angular.json',
])

const markerPrefixes = [
  'vite.config.',
  'next.config.',
  'nuxt.config.',
  'svelte.config.',
]

const frontendDeps = new Set([
  '@angular/core',
  '@nuxt/kit',
  '@sveltejs/kit',
  '@vitejs/plugin-react',
  '@vitejs/plugin-vue',
  'next',
  'nuxt',
  'react',
  'react-dom',
  'solid-js',
  'svelte',
  'vite',
  'vue',
])

const componentLibraryPeerDeps = new Set([
  '@angular/core',
  'react',
  'solid-js',
  'svelte',
  'vue',
])

const nodeBackendDeps = new Set([
  '@apollo/server',
  '@hapi/hapi',
  'apollo-server',
  'express',
  'fastify',
  'graphql-yoga',
  'hono',
  'koa',
  'restify',
])

const nestDeps = new Set([
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/graphql',
  '@nestjs/microservices',
  '@nestjs/platform-express',
  '@nestjs/platform-fastify',
])

const frontendConfigFiles = [
  'angular.json',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.ts',
  'vite.config.mts',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'nuxt.config.js',
  'nuxt.config.mjs',
  'nuxt.config.ts',
  'svelte.config.js',
  'svelte.config.mjs',
  'svelte.config.ts',
]

const frontendEntryFiles = [
  'index.html',
  'src/App.jsx',
  'src/App.tsx',
  'src/App.vue',
  'src/main.jsx',
  'src/main.tsx',
  'src/main.vue',
]

const componentLibraryEntryFiles = [
  'src/index.js',
  'src/index.mjs',
  'src/index.ts',
  'src/index.tsx',
]

const nodeEntryFiles = [
  'src/server.js',
  'src/server.mjs',
  'src/server.ts',
  'src/app.js',
  'src/app.ts',
]

const nestEntryFiles = [
  'src/main.js',
  'src/main.ts',
]

const javaEntryFiles = [
  'src/main/java',
  'src/main/kotlin',
]

const projectRoots = discoverProjectRoots(projectRoot)
const analyses = projectRoots.map(root => analyzeRoot(root))
const selectedStacks = selectStacks(analyses)
const references = [...new Set(selectedStacks.flatMap(stack => stackReferences[stack]))]
const evidence = analyses.flatMap(analysis => analysis.evidence)

const output = {
  projectRoot: normalizePath(projectRoot),
  projectRoots: projectRoots.map(root => normalizePath(path.relative(projectRoot, root) || '.')),
  stacks: selectedStacks,
  references,
  evidence,
}

console.log(JSON.stringify(output, null, 2))

function discoverProjectRoots(root) {
  const roots = new Set()

  walk(root, 0)

  if (roots.size === 0) {
    roots.add(root)
  }

  return [...roots].sort()

  function walk(currentDir, depth) {
    if (depth > 4) {
      return
    }

    const entries = readdirSync(currentDir, { withFileTypes: true })
    if (entries.some(entry => entry.isFile() && isMarkerFile(entry.name))) {
      roots.add(currentDir)
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || ignoredDirs.has(entry.name) || entry.name.startsWith('.')) {
        continue
      }

      walk(path.join(currentDir, entry.name), depth + 1)
    }
  }
}

function analyzeRoot(root) {
  const analysis = {
    root,
    scores: {
      'frontend': 0,
      'component-library': 0,
      'node': 0,
      'nestjs': 0,
      'java': 0,
    },
    evidence: [],
  }

  analyzePackageJson(root, analysis)
  analyzeConfigFiles(root, analysis)
  analyzeEntrypoints(root, analysis)
  analyzeJavaFiles(root, analysis)

  return analysis
}

function analyzePackageJson(root, analysis) {
  const packagePath = path.join(root, 'package.json')
  if (!existsSync(packagePath)) {
    return
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const dependencies = collectDependencyNames(packageJson)
  const source = relativeSource(root, 'package.json')
  const peerDependencies = new Set(Object.keys(packageJson.peerDependencies ?? {}))

  for (const dependency of dependencies) {
    if (frontendDeps.has(dependency)) {
      addEvidence(analysis, 'frontend', source, `dependency "${dependency}"`, 10)
    }

    if (nodeBackendDeps.has(dependency)) {
      addEvidence(analysis, 'node', source, `backend dependency "${dependency}"`, 10)
    }

    if (nestDeps.has(dependency)) {
      addEvidence(analysis, 'nestjs', source, `NestJS dependency "${dependency}"`, 12)
    }
    else if (dependency.startsWith('@nestjs/')) {
      addEvidence(analysis, 'nestjs', source, `NestJS scoped dependency "${dependency}"`, 7)
    }
  }

  if (hasPublicPackageEntry(packageJson) && hasFrameworkPeerDependency(peerDependencies)) {
    addEvidence(analysis, 'component-library', source, 'package exposes public entry and framework peerDependency', 10)
  }

  if (isComponentLibraryPackageName(packageJson.name)) {
    addEvidence(analysis, 'component-library', source, `package name "${packageJson.name}" indicates component library`, 3)
  }

  for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts ?? {})) {
    const sourceSignal = `script "${scriptName}" contains "${scriptCommand}"`

    if (scriptCommand.includes('vite') || scriptCommand.includes('next') || scriptCommand.includes('nuxt')) {
      addEvidence(analysis, 'frontend', source, sourceSignal, 6)
    }

    if (scriptCommand.includes('nest start') || scriptCommand.includes('nest build')) {
      addEvidence(analysis, 'nestjs', source, sourceSignal, 8)
    }

    if (scriptCommand.includes('storybook')) {
      addEvidence(analysis, 'component-library', source, sourceSignal, 4)
    }
  }
}

function analyzeConfigFiles(root, analysis) {
  if (existsSync(path.join(root, 'nest-cli.json'))) {
    addEvidence(analysis, 'nestjs', relativeSource(root, 'nest-cli.json'), 'nest-cli.json exists', 12)
  }

  for (const configFile of frontendConfigFiles) {
    const configPath = path.join(root, configFile)
    if (existsSync(configPath)) {
      addEvidence(analysis, 'frontend', relativeSource(root, configFile), `${configFile} exists`, 10)

      const content = readFileSync(configPath, 'utf8')
      if (hasViteLibraryBuild(content)) {
        addEvidence(analysis, 'component-library', relativeSource(root, configFile), `${configFile} contains build.lib`, 10)
      }
    }
  }
}

function analyzeEntrypoints(root, analysis) {
  for (const entryFile of frontendEntryFiles) {
    if (existsSync(path.join(root, entryFile))) {
      addEvidence(analysis, 'frontend', relativeSource(root, entryFile), `${entryFile} exists`, 5)
    }
  }

  for (const entryFile of componentLibraryEntryFiles) {
    const entryPath = path.join(root, entryFile)
    if (existsSync(entryPath) && readFileSync(entryPath, 'utf8').includes('export ')) {
      addEvidence(analysis, 'component-library', relativeSource(root, entryFile), `${entryFile} exports public API`, 5)
    }
  }

  for (const entryFile of nodeEntryFiles) {
    if (existsSync(path.join(root, entryFile))) {
      addEvidence(analysis, 'node', relativeSource(root, entryFile), `${entryFile} exists`, 4)
    }
  }

  for (const entryFile of nestEntryFiles) {
    const absoluteEntryFile = path.join(root, entryFile)
    if (existsSync(absoluteEntryFile) && readFileSync(absoluteEntryFile, 'utf8').includes('NestFactory')) {
      addEvidence(analysis, 'nestjs', relativeSource(root, entryFile), `${entryFile} imports or uses NestFactory`, 12)
    }
  }
}

function analyzeJavaFiles(root, analysis) {
  const pomPath = path.join(root, 'pom.xml')
  if (existsSync(pomPath)) {
    const source = relativeSource(root, 'pom.xml')
    const content = readFileSync(pomPath, 'utf8')

    addEvidence(analysis, 'java', source, 'pom.xml exists', 5)
    if (content.includes('spring-boot')) {
      addEvidence(analysis, 'java', source, 'pom.xml contains spring-boot', 12)
    }
  }

  for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
    const gradlePath = path.join(root, gradleFile)
    if (existsSync(gradlePath)) {
      const source = relativeSource(root, gradleFile)
      const content = readFileSync(gradlePath, 'utf8')

      addEvidence(analysis, 'java', source, `${gradleFile} exists`, 5)
      if (content.includes('org.springframework.boot') || content.includes('spring-boot-starter')) {
        addEvidence(analysis, 'java', source, `${gradleFile} contains Spring Boot`, 12)
      }
    }
  }

  for (const entry of javaEntryFiles) {
    if (existsSync(path.join(root, entry))) {
      addEvidence(analysis, 'java', relativeSource(root, entry), `${entry} exists`, 4)
    }
  }
}

function collectDependencyNames(packageJson) {
  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]
  const dependencies = new Set()

  for (const section of sections) {
    for (const dependency of Object.keys(packageJson[section] ?? {})) {
      dependencies.add(dependency)
    }
  }

  return dependencies
}

function selectStacks(analyses) {
  const selected = new Set()

  for (const analysis of analyses) {
    if (analysis.scores.frontend >= 8) {
      selected.add('frontend')
    }

    if (analysis.scores['component-library'] >= 10) {
      selected.add('component-library')
    }

    if (analysis.scores.nestjs >= 8) {
      selected.add('nestjs')
    }

    if (analysis.scores.java >= 8) {
      selected.add('java')
    }

    if (analysis.scores.node >= 8 && analysis.scores.nestjs < 8) {
      selected.add('node')
    }
  }

  return stackOrder.filter(stack => selected.has(stack))
}

function hasPublicPackageEntry(packageJson) {
  return Boolean(packageJson.exports ?? packageJson.main ?? packageJson.module ?? packageJson.types)
}

function hasFrameworkPeerDependency(peerDependencies) {
  return [...componentLibraryPeerDeps].some(dependency => peerDependencies.has(dependency))
}

function hasViteLibraryBuild(content) {
  return /\bbuild\s*:\s*\{[\s\S]*?\blib\s*:/.test(content)
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

function addEvidence(analysis, stack, source, signal, weight) {
  analysis.scores[stack] += weight
  analysis.evidence.push({
    stack,
    root: normalizePath(path.relative(projectRoot, analysis.root) || '.'),
    source,
    signal,
    weight,
  })
}

function isMarkerFile(fileName) {
  return markerFiles.has(fileName) || markerPrefixes.some(prefix => fileName.startsWith(prefix))
}

function relativeSource(root, source) {
  return normalizePath(path.relative(projectRoot, path.join(root, source)) || source)
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}
