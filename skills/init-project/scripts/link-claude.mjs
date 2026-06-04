#!/usr/bin/env node
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

function isSameFileAsAgents(filePath) {
  const agentsStats = statSync(agentsPath)
  const fileStats = statSync(filePath)
  return agentsStats.dev === fileStats.dev && agentsStats.ino === fileStats.ino
}

if (existsSync(claudePath)) {
  const existingClaude = lstatSync(claudePath)

  if (existingClaude.isSymbolicLink() && pointsToAgentsPath(claudePath)) {
    console.log(`[airules] CLAUDE.md already links to AGENTS.md: ${claudePath}`)
    process.exit(0)
  }

  if (!existingClaude.isSymbolicLink() && isSameFileAsAgents(claudePath)) {
    console.log(`[airules] CLAUDE.md already hard-links to AGENTS.md: ${claudePath}`)
    process.exit(0)
  }

  throw new Error(`CLAUDE.md already exists and is not managed by AIRules: ${claudePath}`)
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
