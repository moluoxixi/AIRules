#!/usr/bin/env node
import { existsSync, lstatSync, readlinkSync, symlinkSync } from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const claudePath = path.join(projectRoot, 'CLAUDE.md')

if (!existsSync(agentsPath)) {
  throw new Error(`AGENTS.md must exist before linking CLAUDE.md: ${agentsPath}`)
}

const relativeAgentsPath = path.relative(path.dirname(claudePath), agentsPath) || 'AGENTS.md'

if (existsSync(claudePath)) {
  const existingClaude = lstatSync(claudePath)

  if (existingClaude.isSymbolicLink()) {
    const linkedPath = path.resolve(path.dirname(claudePath), readlinkSync(claudePath))
    if (linkedPath === path.resolve(agentsPath)) {
      console.log(`[airules] CLAUDE.md already links to AGENTS.md: ${claudePath}`)
      process.exit(0)
    }
  }

  throw new Error(`CLAUDE.md already exists and is not managed by AIRules: ${claudePath}`)
}

// Use a relative symlink so the project directory stays movable after initialization.
symlinkSync(relativeAgentsPath, claudePath, 'file')
console.log(`[airules] Linked ${claudePath} -> ${relativeAgentsPath}`)
