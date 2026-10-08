import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { findHostConfig, HOST_IDS, loadHostDeclaration, resolveHostId, resolveHostPaths } from '../hosts.js'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function writeDeclaration(content: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-hosts-'))
  temporaryRoots.push(root)
  const declarationPath = path.join(root, 'hosts.yaml')
  fs.writeFileSync(declarationPath, content, 'utf8')
  return declarationPath
}

function fixture(hosts: unknown[] = [{ id: 'example', home_rel_path: '.example' }]) {
  return {
    schema_version: 1,
    global_agent_skills: { home_rel_path: '.agents', skills_dir_name: 'skills' },
    hosts,
  }
}

describe('host declarations', () => {
  it('registers a new host entirely from YAML and resolves portable paths and defaults', () => {
    const config = {
      id: 'example',
      aliases: ['example desktop'],
      home_rel_path: 'AppData\\Local\\Example Host',
      skills_dir_name: 'skills-custom',
      excluded_skills: ['skip-me'],
      project_skills: false,
      mcp: {
        home_rel_path: '.',
        rel_dir: 'config/mcp',
        file_name: 'mcp.json',
        servers_key: 'mcpServers',
        format: 'json',
        require_host_home: true,
        default_top_level: { inputs: [] },
        server_defaults: { type: 'local', enabled: true },
        server_overrides: { codegraph: { args: ['serve', '--mcp'] } },
        server_command_format: 'command-array',
      },
    }
    const declaration = loadHostDeclaration(writeDeclaration(stringify(fixture([
      config,
      { id: 'minimal', home_rel_path: '.minimal' },
    ]))))

    expect(declaration.globalAgentSkills).toEqual({ homeRelPath: '.agents', skillsDirName: 'skills' })
    expect(declaration.hosts.map(host => host.id)).toEqual(['example', 'minimal'])
    const resolved = resolveHostPaths(declaration.hosts[0]!, path.resolve('user'))
    expect(resolved).toMatchObject({
      hostHome: path.resolve('user', 'AppData', 'Local', 'Example Host'),
      skillsDirName: 'skills-custom',
      excludedSkills: ['skip-me'],
      projectSkills: false,
      mcpHome: path.resolve('user'),
      mcp: {
        relDir: 'config/mcp',
        fileName: 'mcp.json',
        serversKey: 'mcpServers',
        format: 'json',
        requireHostHome: true,
        defaultTopLevel: { inputs: [] },
        serverDefaults: { type: 'local', enabled: true },
        serverOverrides: { codegraph: { args: ['serve', '--mcp'] } },
        serverCommandFormat: 'command-array',
      },
    })
    expect(resolveHostPaths(declaration.hosts[1]!, path.resolve('user'))).toEqual({
      hostHome: path.resolve('user', '.minimal'),
      skillsDirName: 'skills',
      excludedSkills: [],
      projectSkills: true,
      mcpHome: path.resolve('user', '.minimal'),
      mcp: undefined,
    })
  })

  it('preserves the built-in host order and CLI-only aliases', () => {
    expect(HOST_IDS).toEqual([
      'claude',
      'codex',
      'hermes',
      'cursor',
      'qoderwork',
      'trae',
      'trae-cn',
      'trae-solo',
      'trae-solo-cn',
      'qoder',
      'opencode',
    ])
    expect(resolveHostId('hermes desktop')).toBe('hermes')
    expect(findHostConfig('hermes desktop')).toBe(findHostConfig('hermes'))
    expect(HOST_IDS).not.toContain('hermes desktop')
  })

  it.each([
    ['duplicate ids', [{ id: 'example', home_rel_path: '.a' }, { id: 'example', home_rel_path: '.b' }]],
    ['alias matching a later id', [{ id: 'one', aliases: ['two'], home_rel_path: '.a' }, { id: 'two', home_rel_path: '.b' }]],
    ['shared aliases', [{ id: 'one', aliases: ['desktop'], home_rel_path: '.a' }, { id: 'two', aliases: ['desktop'], home_rel_path: '.b' }]],
    ['repeated aliases', [{ id: 'one', aliases: ['desktop', 'desktop'], home_rel_path: '.a' }]],
    ['reserved id', [{ id: 'all', home_rel_path: '.a' }]],
    ['reserved alias', [{ id: 'one', aliases: ['all'], home_rel_path: '.a' }]],
  ])('rejects %s instead of choosing an ambiguous host', (_label, hosts) => {
    expect(() => loadHostDeclaration(writeDeclaration(stringify(fixture(hosts)))))
      .toThrow(/duplicate or reserved host id\/alias/u)
  })

  it.each([
    ['project_skills', 'false', /project_skills must be boolean/u],
    ['aliases', 'desktop', /aliases must be an array/u],
    ['id', 'Example', /id must contain lowercase/u],
    ['home_rel_path', null, /home_rel_path must be a non-empty string/u],
    ['project_skill', false, /unknown field "project_skill"/u],
    ['mcp', { format: 'xml' }, /format must be "json" or "toml"/u],
    ['mcp', { format: 'json', server_command_format: 'shell' }, /server_command_format must be/u],
    ['mcp', { format: 'json', rel_dir: '.', file_name: 'mcp.json', servers_key: 'mcpServers', server_overrides: { codegraph: [] } }, /server_overrides.codegraph must be a mapping/u],
  ])('rejects an invalid %s field (%j)', (field, value, message) => {
    const host = { id: 'example', home_rel_path: '.example', [field]: value }
    expect(() => loadHostDeclaration(writeDeclaration(stringify(fixture([host]))))).toThrow(message)
  })

  it.each(['/outside', 'C:/outside', 'C:outside', '\\\\server\\share', '../outside', 'config/../outside', 'config\\..\\outside'])('rejects a non-local path %s', (configured) => {
    const hosts = [{ id: 'example', home_rel_path: configured }]
    expect(() => loadHostDeclaration(writeDeclaration(stringify(fixture(hosts)))))
      .toThrow(/relative path without parent traversal/u)
  })

  it.each([
    ['home_rel_path', '../outside'],
    ['rel_dir', '../outside'],
    ['file_name', 'nested/mcp.json'],
  ])('rejects an invalid MCP %s path', (field, value) => {
    const mcp = { format: 'json', rel_dir: '.', file_name: 'mcp.json', servers_key: 'mcpServers', [field]: value }
    const hosts = [{ id: 'example', home_rel_path: '.example', mcp }]
    expect(() => loadHostDeclaration(writeDeclaration(stringify(fixture(hosts)))))
      .toThrow(/relative path without parent traversal|single file or directory name/u)
  })

  it('rejects invalid global skills paths and unsupported schemas', () => {
    const value = fixture()
    value.global_agent_skills.skills_dir_name = '../skills'
    expect(() => loadHostDeclaration(writeDeclaration(stringify(value)))).toThrow(/global_agent_skills.skills_dir_name/u)
    expect(() => loadHostDeclaration(writeDeclaration(stringify({ ...fixture(), schema_version: 2 })))).toThrow(/schema_version: 1/u)
    expect(() => loadHostDeclaration(writeDeclaration(stringify(fixture([]))))).toThrow(/hosts must be a non-empty array/u)
  })

  it.each([
    ['hosts: [\n', /is invalid/u],
    ['schema_version: 1\nschema_version: 1\n', /is invalid.*keys must be unique/isu],
    ['schema_version: 1\nglobal_agent_skills: &skills {home_rel_path: .agents, skills_dir_name: skills}\nhosts: [*skills]\n', /is invalid.*alias/isu],
    ['[]\n', /must be a mapping/u],
  ])('rejects an invalid YAML document', (content, message) => {
    expect(() => loadHostDeclaration(writeDeclaration(content))).toThrow(message)
  })
})
