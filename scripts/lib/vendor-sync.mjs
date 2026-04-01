import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runGit(args, cwd, options = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'pipe'
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }

  return (result.stdout ?? '').trim();
}

export function getRemoteDefaultBranch(cloneDir) {
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

function getCurrentBranch(cloneDir) {
  return runGit(['-C', cloneDir, 'branch', '--show-current'], process.cwd());
}

function getSparsePatterns(vendor) {
  if (!vendor.links?.length) return [];
  const topDirs = new Set();
  for (const link of vendor.links) {
    const first = link.source.split('/')[0];
    if (first) topDirs.add(first);
  }
  return [...topDirs];
}

function isLocalRepo(repoUrl) {
  // 本地 repo: 不含 :// 或使用 file://
  return !repoUrl.includes('://') || repoUrl.startsWith('file://');
}

export function ensureVendorRepo(homeDir, vendor) {
  const cloneDir = path.resolve(homeDir, vendor.cloneDir);
  mkdirSync(path.dirname(cloneDir), { recursive: true });

  if (!existsSync(path.join(cloneDir, '.git'))) {
    // 三重优化：shallow + partial + sparse（仅对远程 repo）
    // 本地 repo 不支持 --depth/--filter/--sparse，做普通 clone
    if (isLocalRepo(vendor.repo)) {
      runGit(['clone', vendor.repo, cloneDir], process.cwd(), { stdio: 'inherit' });
    } else {
      runGit(['clone', '--depth', '1', '--filter=blob:none', '--sparse',
              vendor.repo, cloneDir], process.cwd(), { stdio: 'inherit' });
    }

    // 从 links 配置中提取需要检出的顶级目录
    const sparsePatterns = getSparsePatterns(vendor);
    if (sparsePatterns.length > 0) {
      // 本地 clone 后也需要开启 sparse-checkout
      if (isLocalRepo(vendor.repo)) {
        runGit(['-C', cloneDir, 'sparse-checkout', 'init', '--cone'],
               process.cwd(), { stdio: 'inherit' });
      }
      runGit(['-C', cloneDir, 'sparse-checkout', 'set', ...sparsePatterns],
             process.cwd(), { stdio: 'inherit' });
    }
  }

  // 浅层 fetch
  runGit(['-C', cloneDir, 'fetch', '--depth', '1', '--prune', 'origin'],
         process.cwd(), { stdio: 'inherit' });

  const defaultBranch = getRemoteDefaultBranch(cloneDir);
  const currentBranch = getCurrentBranch(cloneDir);

  if (currentBranch !== defaultBranch) {
    runGit(['-C', cloneDir, 'checkout', '-B', defaultBranch,
            `origin/${defaultBranch}`], process.cwd(), { stdio: 'inherit' });
  }

  runGit(['-C', cloneDir, 'merge', '--ff-only', `origin/${defaultBranch}`],
         process.cwd(), { stdio: 'inherit' });
  return cloneDir;
}
