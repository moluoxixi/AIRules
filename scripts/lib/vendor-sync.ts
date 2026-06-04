import type { StdioOptions } from 'node:child_process'
import type { Vendor } from './vendors.js'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

function runGit(args: string[], cwd: string, options: { stdio?: StdioOptions } = {}): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const stderr = (result.stderr as string ?? '').trim()
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ''}`)
  }

  return (result.stdout as string ?? '').trim()
}

function listOriginHeadBranches(cloneDir: string): string[] {
  return runGit(['-C', cloneDir, 'ls-remote', '--heads', 'origin'], process.cwd())
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const ref = line.split('\t')[1]
      if (!ref?.startsWith('refs/heads/')) {
        throw new Error(`Unexpected origin branch format for ${cloneDir}: ${line}`)
      }

      return ref.slice('refs/heads/'.length)
    })
}

export function getRemoteDefaultBranch(cloneDir: string): string {
  let symbolicRefError: unknown
  const originHeadBranches = listOriginHeadBranches(cloneDir)

  try {
    const ref = runGit(['-C', cloneDir, 'symbolic-ref', 'refs/remotes/origin/HEAD'], process.cwd())
    const branch = ref.replace('refs/remotes/origin/', '')
    if (originHeadBranches.includes(branch)) {
      return branch
    }
  }
  catch (error) {
    symbolicRefError = error
  }

  const lines = runGit(['-C', cloneDir, 'ls-remote', '--symref', 'origin', 'HEAD'], process.cwd())
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const headLine = lines.find(line => line.startsWith('ref: ') && line.endsWith('HEAD'))
  if (headLine) {
    const prefix = 'ref: refs/heads/'
    const suffix = ' HEAD'
    if (!headLine.startsWith(prefix) || !headLine.endsWith(suffix)) {
      throw new Error(`Unexpected origin HEAD format for ${cloneDir}: ${headLine}`)
    }

    const branch = headLine.slice(prefix.length, -suffix.length)
    if (originHeadBranches.includes(branch)) {
      return branch
    }
  }

  const remoteBranches = runGit(['-C', cloneDir, 'branch', '-r', '--format=%(refname:lstrip=3)'], process.cwd())
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && line !== 'origin/HEAD')

  if (remoteBranches.length === 1) {
    return remoteBranches[0].replace(/^origin\//, '')
  }

  // Sparse file:// clones can lack local origin/* refs when remote HEAD is unset.
  if (originHeadBranches.length === 1) {
    return originHeadBranches[0]
  }

  throw new Error(`Unable to determine origin default branch for ${cloneDir}; symbolic-ref failed with: ${String(symbolicRefError)}`)
}

function getSparsePatterns(vendor: Vendor): string[] {
  if (!vendor.links?.length)
    return []
  const topDirs = new Set<string>()
  for (const link of vendor.links) {
    const first = link.source.split('/')[0]
    if (first)
      topDirs.add(first)
  }
  return [...topDirs]
}

function isLocalRepo(repoUrl: string): boolean {
  return !repoUrl.includes('://')
}

export function ensureVendorRepo(homeDir: string, vendor: Vendor): string {
  const cloneDir = path.resolve(homeDir, vendor.cloneDir)
  mkdirSync(path.dirname(cloneDir), { recursive: true })
  const sparsePatterns = getSparsePatterns(vendor)

  if (!existsSync(path.join(cloneDir, '.git'))) {
    if (isLocalRepo(vendor.repo)) {
      runGit(['clone', vendor.repo, cloneDir], process.cwd(), { stdio: 'inherit' })
    }
    else {
      runGit(['clone', '--depth', '1', '--filter=blob:none', '--sparse', vendor.repo, cloneDir], process.cwd(), { stdio: 'inherit' })
    }

    if (sparsePatterns.length > 0) {
      if (isLocalRepo(vendor.repo)) {
        runGit(['-C', cloneDir, 'sparse-checkout', 'init', '--cone'], process.cwd(), { stdio: 'inherit' })
      }
      runGit(['-C', cloneDir, 'sparse-checkout', 'set', ...sparsePatterns], process.cwd(), { stdio: 'inherit' })
    }
  }

  const defaultBranch = getRemoteDefaultBranch(cloneDir)
  const remoteRef = `origin/${defaultBranch}`

  if (!isLocalRepo(vendor.repo)) {
    runGit(['-C', cloneDir, 'fetch', '--depth', '1', '--prune', 'origin', defaultBranch], process.cwd(), { stdio: 'inherit' })
  }
  else {
    runGit(['-C', cloneDir, 'fetch', '--prune', 'origin', defaultBranch], process.cwd(), { stdio: 'inherit' })
  }

  if (sparsePatterns.length > 0) {
    if (isLocalRepo(vendor.repo)) {
      runGit(['-C', cloneDir, 'sparse-checkout', 'set', ...sparsePatterns], process.cwd(), { stdio: 'inherit' })
    }
    else {
      runGit(['-C', cloneDir, 'sparse-checkout', 'reapply'], process.cwd(), { stdio: 'inherit' })
    }
  }

  runGit(['-C', cloneDir, 'reset', '--hard'], process.cwd(), { stdio: 'inherit' })
  runGit(['-C', cloneDir, 'clean', '-fd'], process.cwd(), { stdio: 'inherit' })
  runGit(['-C', cloneDir, 'checkout', '-B', defaultBranch, remoteRef], process.cwd(), { stdio: 'inherit' })
  runGit(['-C', cloneDir, 'reset', '--hard', remoteRef], process.cwd(), { stdio: 'inherit' })
  runGit(['-C', cloneDir, 'clean', '-fd'], process.cwd(), { stdio: 'inherit' })
  return cloneDir
}
