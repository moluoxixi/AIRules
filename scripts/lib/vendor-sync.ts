import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync, type StdioOptions } from 'node:child_process';
import type { Vendor } from './vendors.js';

function runGit(args: string[], cwd: string, options: { stdio?: StdioOptions } = {}): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'pipe'
  });

  if (result.status !== 0) {
    const stderr = (result.stderr as string ?? '').trim();
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  return (result.stdout as string ?? '').trim();
}

export function getRemoteDefaultBranch(cloneDir: string): string {
  try {
    const ref = runGit(['-C', cloneDir, 'symbolic-ref', 'refs/remotes/origin/HEAD'], process.cwd());
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    const lines = runGit(['-C', cloneDir, 'ls-remote', '--symref', 'origin', 'HEAD'], process.cwd())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const headLine = lines.find((line) => line.startsWith('ref: ') && line.endsWith('HEAD'));
    if (headLine) {
      const match = headLine.match(/^ref:\s+refs\/heads\/(.+)\s+HEAD$/);
      if (!match) {
        throw new Error(`Unexpected origin HEAD format for ${cloneDir}: ${headLine}`);
      }

      return match[1];
    }

    const remoteBranches = runGit(['-C', cloneDir, 'branch', '-r', '--format=%(refname:lstrip=3)'], process.cwd())
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && line !== 'origin/HEAD');

    if (remoteBranches.length === 1) {
      return remoteBranches[0].replace(/^origin\//, '');
    }

    throw new Error(`Unable to determine origin default branch for ${cloneDir}`);
  }
}

function getCurrentBranch(cloneDir: string): string {
  return runGit(['-C', cloneDir, 'branch', '--show-current'], process.cwd());
}

function getSparsePatterns(vendor: Vendor): string[] {
  if (!vendor.links?.length) return [];
  const topDirs = new Set<string>();
  for (const link of vendor.links) {
    const first = link.source.split('/')[0];
    if (first) topDirs.add(first);
  }
  return [...topDirs];
}

function isLocalRepo(repoUrl: string): boolean {
  return !repoUrl.includes('://');
}

export function ensureVendorRepo(homeDir: string, vendor: Vendor): string {
  const cloneDir = path.resolve(homeDir, vendor.cloneDir);
  mkdirSync(path.dirname(cloneDir), { recursive: true });
  const sparsePatterns = getSparsePatterns(vendor);

  if (!existsSync(path.join(cloneDir, '.git'))) {
    if (isLocalRepo(vendor.repo)) {
      runGit(['clone', vendor.repo, cloneDir], process.cwd(), { stdio: 'inherit' });
    } else {
      runGit(['clone', '--depth', '1', '--filter=blob:none', '--sparse',
              vendor.repo, cloneDir], process.cwd(), { stdio: 'inherit' });
    }

    if (sparsePatterns.length > 0) {
      if (isLocalRepo(vendor.repo)) {
        runGit(['-C', cloneDir, 'sparse-checkout', 'init', '--cone'],
               process.cwd(), { stdio: 'inherit' });
      }
      runGit(['-C', cloneDir, 'sparse-checkout', 'set', ...sparsePatterns],
             process.cwd(), { stdio: 'inherit' });
    }
  }

  const defaultBranch = getRemoteDefaultBranch(cloneDir);
  const remoteRef = `origin/${defaultBranch}`;

  if (!isLocalRepo(vendor.repo)) {
    runGit(['-C', cloneDir, 'fetch', '--depth', '1', '--prune', 'origin', defaultBranch],
           process.cwd(), { stdio: 'inherit' });
  } else {
    runGit(['-C', cloneDir, 'fetch', '--prune', 'origin', defaultBranch],
           process.cwd(), { stdio: 'inherit' });
  }

  if (sparsePatterns.length > 0) {
    if (isLocalRepo(vendor.repo)) {
      runGit(['-C', cloneDir, 'sparse-checkout', 'set', ...sparsePatterns],
             process.cwd(), { stdio: 'inherit' });
    } else {
      runGit(['-C', cloneDir, 'sparse-checkout', 'reapply'],
             process.cwd(), { stdio: 'inherit' });
    }
  }

  const currentBranch = getCurrentBranch(cloneDir);

  if (currentBranch !== defaultBranch) {
    runGit(['-C', cloneDir, 'checkout', '-B', defaultBranch,
            remoteRef], process.cwd(), { stdio: 'inherit' });
  } else {
    runGit(['-C', cloneDir, 'checkout', defaultBranch],
           process.cwd(), { stdio: 'inherit' });
  }

  runGit(['-C', cloneDir, 'merge', '--ff-only', remoteRef],
         process.cwd(), { stdio: 'inherit' });
  return cloneDir;
}
