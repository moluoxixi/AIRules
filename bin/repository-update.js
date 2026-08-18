import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

function formatCommand(command, args) {
  return [command, ...args].join(' ')
}

function runCommand(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  })

  if (result.error)
    throw result.error

  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : ''
    throw new Error(`${formatCommand(command, args)} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ''}`)
  }

  return typeof result.stdout === 'string' ? result.stdout.trim() : ''
}

function runGit(repoRoot, args) {
  return runCommand('git', ['-C', repoRoot, ...args], repoRoot)
}

function runNpm(repoRoot, args) {
  if (process.platform === 'win32') {
    return runCommand(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], repoRoot, { stdio: 'inherit' })
  }
  return runCommand('npm', args, repoRoot, { stdio: 'inherit' })
}

function samePath(left, right) {
  const normalize = value => path.resolve(value).replace(/\\/gu, '/').toLowerCase()
  return normalize(left) === normalize(right)
}

function requireCleanCheckout(repoRoot) {
  const dirty = runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
  if (dirty) {
    throw new Error(`AIRules checkout is dirty; commit or stash changes before installing a role: ${repoRoot}`)
  }
}

function requireBranchAndUpstream(repoRoot) {
  let branch
  try {
    branch = runGit(repoRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  }
  catch {
    throw new Error(`AIRules checkout must be on a branch before installing a role: ${repoRoot}`)
  }

  let upstream
  try {
    upstream = runGit(repoRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  }
  catch {
    throw new Error(`AIRules branch "${branch}" has no upstream; configure one before installing a role`)
  }

  return { branch, upstream }
}

function rebuildRepository(repoRoot, before, after) {
  const dependencyFiles = runGit(repoRoot, [
    'diff',
    '--name-only',
    before,
    after,
    '--',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
  ])
  if (dependencyFiles)
    runNpm(repoRoot, ['install'])
  runNpm(repoRoot, ['run', 'build'])
}

export function updateRepository(repoRoot, options = {}) {
  const resolvedRoot = realpathSync(path.resolve(repoRoot))
  if (!existsSync(path.join(resolvedRoot, '.git'))) {
    return {
      after: undefined,
      before: undefined,
      branch: undefined,
      changed: false,
      kind: 'package',
      repoRoot: resolvedRoot,
      upstream: undefined,
    }
  }

  const checkoutRoot = realpathSync(runGit(resolvedRoot, ['rev-parse', '--show-toplevel']))
  if (!samePath(checkoutRoot, resolvedRoot)) {
    throw new Error(`AIRules package root must be the Git checkout root: ${resolvedRoot} (checkout: ${checkoutRoot})`)
  }

  requireCleanCheckout(resolvedRoot)
  const { branch, upstream } = requireBranchAndUpstream(resolvedRoot)
  const before = runGit(resolvedRoot, ['rev-parse', 'HEAD'])
  runGit(resolvedRoot, ['pull', '--ff-only'])
  const after = runGit(resolvedRoot, ['rev-parse', 'HEAD'])
  const changed = before !== after

  if (changed && options.rebuild !== false)
    rebuildRepository(resolvedRoot, before, after)

  return {
    after,
    before,
    branch,
    changed,
    kind: 'checkout',
    repoRoot: resolvedRoot,
    upstream,
  }
}
