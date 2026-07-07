#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, linkSync, lstatSync, readlinkSync, statSync, symlinkSync } from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const claudePath = path.join(projectRoot, 'CLAUDE.md')

if (!existsSync(agentsPath)) {
  throw new Error(`AGENTS.md must exist before linking CLAUDE.md: ${agentsPath}`)
}

const relativeAgentsPath = path.relative(path.dirname(claudePath), agentsPath) || 'AGENTS.md'

function isWindowsSymlinkPrivilegeError(error) {
  return process.platform === 'win32' && ['EACCES', 'EPERM'].includes(error?.code)
}

function pointsToAgentsPath(linkPath) {
  const linkedPath = path.resolve(path.dirname(linkPath), readlinkSync(linkPath))
  return linkedPath === path.resolve(agentsPath)
}

function pathExistsIncludingBrokenLink(filePath) {
  try {
    lstatSync(filePath)
    return true
  }
  catch (error) {
    if (error?.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

function isSameFileAsAgents(filePath) {
  const agentsStats = statSync(agentsPath)
  const fileStats = statSync(filePath)
  return agentsStats.dev === fileStats.dev && agentsStats.ino === fileStats.ino
}

function gitFailureMessage(result) {
  return result.stderr?.trim() || result.error?.message || `exit code ${result.status}`
}

function configureGitSymlinks(projectRootPath) {
  const workTreeCheck = spawnSync('git', ['-C', projectRootPath, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
  })

  if (workTreeCheck.error || workTreeCheck.status !== 0 || workTreeCheck.stdout.trim() !== 'true') {
    return
  }

  const configResult = spawnSync('git', ['-C', projectRootPath, 'config', 'core.symlinks', 'true'], {
    encoding: 'utf8',
  })

  if (configResult.error || configResult.status !== 0) {
    throw new Error(`Failed to configure Git core.symlinks=true: ${gitFailureMessage(configResult)}`)
  }

  console.log(`[airules] Enabled Git core.symlinks for ${projectRootPath}`)
}

configureGitSymlinks(projectRoot)

if (pathExistsIncludingBrokenLink(claudePath)) {
  const existingClaude = lstatSync(claudePath)

  if (existingClaude.isSymbolicLink() && pointsToAgentsPath(claudePath)) {
    console.log(`[airules] CLAUDE.md already links to AGENTS.md: ${claudePath}`)
    process.exit(0)
  }

  if (existingClaude.isSymbolicLink()) {
    const currentTarget = readlinkSync(claudePath)
    throw new Error(`CLAUDE.md already links to a different target: ${claudePath} -> ${currentTarget}. Expected target: ${relativeAgentsPath}. remove or repair CLAUDE.md before rerunning init-project.`)
  }

  if (!existingClaude.isSymbolicLink() && isSameFileAsAgents(claudePath)) {
    console.log(`[airules] CLAUDE.md already hard-links to AGENTS.md: ${claudePath}`)
    process.exit(0)
  }

  throw new Error(`CLAUDE.md already exists and is not managed by AIRules: ${claudePath}. remove or repair CLAUDE.md before rerunning init-project.`)
}

// Use a relative symlink so the project directory stays movable after initialization.
try {
  symlinkSync(relativeAgentsPath, claudePath, 'file')
  console.log(`[airules] Linked ${claudePath} -> ${relativeAgentsPath}`)
}
catch (error) {
  if (!isWindowsSymlinkPrivilegeError(error)) {
    throw error
  }

  linkSync(agentsPath, claudePath)
  console.log(`[airules] Hard linked ${claudePath} -> ${agentsPath} (Windows file symlink privilege unavailable)`)
}
