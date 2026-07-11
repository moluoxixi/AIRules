import type { ProjectionState } from '../projection-state.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hashProjectionValue,

  readProjectionState,
  removeManagedProjection,
  writeProjectionState,
} from '../projection-state.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function createHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-projection-state-'))
  temporaryRoots.push(home)
  return home
}

function createState(home: string): ProjectionState {
  return {
    version: 1,
    host: 'codex',
    role: 'alpha',
    skills: [{
      source: path.join(home, 'roles', 'alpha', 'skills', 'demo'),
      target: path.join(home, 'host', 'skills', 'demo'),
    }],
    hooks: [],
  }
}

function writeRawState(home: string, host: string, value: unknown): void {
  const target = path.join(home, 'state', 'projections', `${host}.json`)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

describe('projection state persistence', () => {
  it('round-trips a strict versioned projection state', () => {
    const home = createHome()
    const state = createState(home)

    writeProjectionState(home, state)

    expect(readProjectionState(home, 'codex')).toEqual(state)
  })

  it('rejects unknown fields', () => {
    const home = createHome()
    writeRawState(home, 'codex', { ...createState(home), automaticCleanup: true })

    expect(() => readProjectionState(home, 'codex')).toThrow(/unknown fields/i)
  })

  it('rejects mismatched host identities', () => {
    const home = createHome()
    writeRawState(home, 'codex', { ...createState(home), host: 'claude' })

    expect(() => readProjectionState(home, 'codex')).toThrow(/host.*codex/i)
  })
})

describe('managed projection cleanup', () => {
  it('removes a skill target that still links to its managed source', () => {
    const home = createHome()
    const source = path.join(home, 'roles', 'alpha', 'skills', 'demo')
    const target = path.join(home, 'host', 'skills', 'demo')
    fs.mkdirSync(source, { recursive: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
    const state = { ...createState(home), skills: [{ source, target }] }

    removeManagedProjection(state)

    expect(fs.existsSync(target)).toBe(false)
  })

  it('does not remove a skill target replaced by the user', () => {
    const home = createHome()
    const source = path.join(home, 'roles', 'alpha', 'skills', 'demo')
    const target = path.join(home, 'host', 'skills', 'demo')
    fs.mkdirSync(source, { recursive: true })
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, 'USER.md'), 'keep', 'utf8')
    const state = { ...createState(home), skills: [{ source, target }] }

    removeManagedProjection(state)

    expect(fs.readFileSync(path.join(target, 'USER.md'), 'utf8')).toBe('keep')
  })

  it('removes only unchanged managed MCP servers', () => {
    const home = createHome()
    const target = path.join(home, 'host', 'mcp.json')
    const originalManaged = { command: 'managed', args: ['serve'] }
    const originalChanged = { command: 'before' }
    const changedManaged = { command: 'after' }
    const user = { command: 'user' }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, `${JSON.stringify({
      model: 'keep',
      mcpServers: { managed: originalManaged, changedManaged, user },
    }, null, 2)}\n`, 'utf8')
    const state: ProjectionState = {
      ...createState(home),
      skills: [],
      mcp: {
        target,
        format: 'json',
        serversKey: 'mcpServers',
        servers: {
          managed: hashProjectionValue(originalManaged),
          changedManaged: hashProjectionValue(originalChanged),
        },
      },
    }

    removeManagedProjection(state)

    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({
      model: 'keep',
      mcpServers: { changedManaged, user },
    })
  })

  it('removes an unchanged managed rules block and preserves user content', () => {
    const home = createHome()
    const source = path.join(home, 'roles', 'alpha', 'rules', 'AGENTS.md')
    const target = path.join(home, 'host', 'SOUL.md')
    const ruleContent = '# alpha rules'
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(source, `${ruleContent}\n`, 'utf8')
    fs.writeFileSync(
      target,
      `# user soul\n\n<!-- AIRULES:BASELINE:START -->\n${ruleContent}\n<!-- AIRULES:BASELINE:END -->\n`,
      'utf8',
    )
    const state: ProjectionState = {
      ...createState(home),
      skills: [],
      rules: {
        source,
        target,
        mode: 'append',
        contentHash: hashProjectionValue(ruleContent),
      },
    }

    removeManagedProjection(state)

    expect(fs.readFileSync(target, 'utf8')).toBe('# user soul\n')
  })

  it('preserves a managed rules block changed by the user', () => {
    const home = createHome()
    const source = path.join(home, 'roles', 'alpha', 'rules', 'AGENTS.md')
    const target = path.join(home, 'host', 'SOUL.md')
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(source, '# alpha rules\n', 'utf8')
    fs.writeFileSync(
      target,
      '<!-- AIRULES:BASELINE:START -->\n# user changed rules\n<!-- AIRULES:BASELINE:END -->\n',
      'utf8',
    )
    const state: ProjectionState = {
      ...createState(home),
      skills: [],
      rules: {
        source,
        target,
        mode: 'append',
        contentHash: hashProjectionValue('# alpha rules'),
      },
    }

    removeManagedProjection(state)

    expect(fs.readFileSync(target, 'utf8')).toContain('# user changed rules')
  })

  it('removes only the unchanged managed hook entry and script file', () => {
    const home = createHome()
    const source = path.join(home, 'roles', 'alpha', 'hooks', 'alpha-hook.mjs')
    const scriptTarget = path.join(home, 'host', 'hooks', 'alpha-hook.mjs')
    const target = path.join(home, 'host', 'settings.json')
    const command = `node "${scriptTarget}"`
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(scriptTarget), { recursive: true })
    fs.writeFileSync(source, 'export {}\n', 'utf8')
    fs.copyFileSync(source, scriptTarget)
    fs.writeFileSync(target, `${JSON.stringify({
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command }] },
          { hooks: [{ type: 'command', command: 'echo user' }] },
        ],
      },
    }, null, 2)}\n`, 'utf8')
    const state: ProjectionState = {
      ...createState(home),
      skills: [],
      hooks: [{
        source,
        scriptTarget,
        scriptHash: hashProjectionValue('export {}\n'),
        target,
        format: 'json',
        nesting: 'group',
        event: 'Stop',
        scriptName: 'alpha-hook.mjs',
        command,
      }],
    }

    removeManagedProjection(state)

    expect(JSON.parse(fs.readFileSync(target, 'utf8')).hooks.Stop).toEqual([
      { hooks: [{ type: 'command', command: 'echo user' }] },
    ])
    expect(fs.existsSync(scriptTarget)).toBe(false)
  })

  it('removes only unchanged managed MCP tables from TOML', () => {
    const home = createHome()
    const target = path.join(home, 'host', 'config.toml')
    const originalManaged = { command: 'managed', args: ['serve'] }
    const originalChanged = { command: 'before' }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(
      target,
      [
        'model = "keep"',
        '',
        '# >>> AIRULES MCP >>>',
        '[mcp_servers.managed]',
        'command = "managed"',
        'args = ["serve"]',
        '',
        '[mcp_servers.changedManaged]',
        'command = "after"',
        '',
        '# <<< AIRULES MCP <<<',
        '',
      ].join('\n'),
      'utf8',
    )
    const state: ProjectionState = {
      ...createState(home),
      skills: [],
      mcp: {
        target,
        format: 'toml',
        serversKey: 'mcp_servers',
        servers: {
          managed: hashProjectionValue(originalManaged),
          changedManaged: hashProjectionValue(originalChanged),
        },
      },
    }

    removeManagedProjection(state)

    const result = fs.readFileSync(target, 'utf8')
    expect(result).toContain('model = "keep"')
    expect(result).not.toContain('[mcp_servers.managed]')
    expect(result).toContain('[mcp_servers.changedManaged]')
    expect(result).toContain('command = "after"')
  })

  it('removes an unchanged managed TOML hook block and script file', () => {
    const home = createHome()
    const source = path.join(home, 'roles', 'alpha', 'hooks', 'alpha-hook.mjs')
    const scriptTarget = path.join(home, 'host', 'hooks', 'alpha-hook.mjs')
    const target = path.join(home, 'host', 'config.toml')
    const script = 'export {}\n'
    const command = `node "${scriptTarget}"`
    fs.mkdirSync(path.dirname(source), { recursive: true })
    fs.mkdirSync(path.dirname(scriptTarget), { recursive: true })
    fs.writeFileSync(source, script, 'utf8')
    fs.copyFileSync(source, scriptTarget)
    fs.writeFileSync(
      target,
      [
        'model = "keep"',
        '',
        '# >>> AIRULES HOOK Stop alpha-hook.mjs >>>',
        '[[hooks.Stop]]',
        '',
        '[[hooks.Stop.hooks]]',
        'type = "command"',
        `command = '${command}'`,
        '',
        '# <<< AIRULES HOOK Stop alpha-hook.mjs <<<',
        '',
      ].join('\n'),
      'utf8',
    )
    const state: ProjectionState = {
      ...createState(home),
      skills: [],
      hooks: [{
        source,
        scriptTarget,
        scriptHash: hashProjectionValue(script),
        target,
        format: 'toml',
        nesting: 'group',
        event: 'Stop',
        scriptName: 'alpha-hook.mjs',
        command,
      }],
    }

    removeManagedProjection(state)

    const result = fs.readFileSync(target, 'utf8')
    expect(result).toBe('model = "keep"\n')
    expect(fs.existsSync(scriptTarget)).toBe(false)
  })
})
