#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertInstalledHosts, createInstallSandbox, writeFile, writeYaml } from './lib/__test__/fixtures/role-install.mjs'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = createInstallSandbox(packageRoot)

try {
  const revision = sandbox.git(['rev-parse', 'HEAD'], packageRoot)
  const marker = path.join(sandbox.root, 'remote-setup.txt')
  const setupScript = path.join(sandbox.root, 'setup.mjs')
  writeFile(setupScript, 'import fs from "node:fs"; fs.appendFileSync(process.argv[2], "setup\\n");\n')
  for (const [role, parents, capabilities] of [
    ['base', [], ['common']],
    ['left', ['base'], ['productivity']],
    ['right', ['base'], ['common', 'frontend']],
    ['diamond', ['left', 'right'], ['common']],
  ]) {
    writeYaml(path.join(sandbox.runtime, 'roles', role, 'role.yaml'), {
      schema_version: 2,
      role_id: role,
      extends_roles: parents,
      provides: { capabilities },
      installation: {
        hosts: role === 'diamond' ? ['claude', 'codex', 'opencode'] : ['cursor'],
        role_vendor: {
          name: `${role}-role`,
          source: 'https://github.com/moluoxixi/AIRules.git',
          revision,
          setup: role === 'diamond'
            ? [{ command: process.execPath, args: [setupScript, marker] }]
            : [{ command: 'parent-setup-must-not-run' }],
          projections: [],
        },
      },
    })
  }
  assert.equal(fs.existsSync(sandbox.home), false)
  const installed = sandbox.cli()
  assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`)
  const { loadVendorManifest } = await import(pathToFileURL(path.join(sandbox.runtime, 'dist', 'scripts', 'lib', 'vendors.js')).href)
  const { collectFlattenedSkillSources } = await import(pathToFileURL(path.join(sandbox.runtime, 'dist', 'scripts', 'lib', 'skill-projection.js')).href)
  const manifest = await loadVendorManifest(path.join(sandbox.runtime, 'roles', 'diamond', 'role.yaml'))
  assert.deepEqual(Object.keys(manifest.vendors), ['diamond-role', 'hindsight-memory', 'mattpocock', 'anthropic-skills'])
  const expected = new Map()
  for (const [name, vendor] of Object.entries(manifest.vendors)) {
    const checkout = path.join(sandbox.home, vendor.cloneDir)
    assert.equal(sandbox.git(['rev-parse', 'HEAD'], checkout), vendor.revision)
    assert.equal(sandbox.git(['remote', 'get-url', 'origin'], checkout), vendor.repo)
    for (const link of vendor.links) {
      if (link.kind === 'namespace-dir') {
        for (const skill of collectFlattenedSkillSources(path.join(checkout, link.source)))
          expected.set(skill.name, path.join(skill.source, 'SKILL.md'))
      }
      else if (link.kind === 'skill') {
        expected.set(path.basename(link.target), path.join(checkout, link.source, 'SKILL.md'))
      }
    }
    console.log(`Remote vendor verified: ${name}@${vendor.revision}`)
  }
  for (const skill of ['hindsight-memory', 'hindsight-docs', 'grilling', 'frontend-design'])
    assert.equal(expected.has(skill), true, `Missing real upstream skill: ${skill}`)
  const { claude, codex, openCode } = assertInstalledHosts(sandbox, [...expected.keys()], ['hindsight', 'playwright'])
  assert.deepEqual(claude.mcpServers.hindsight, { type: 'http', url: 'http://localhost:8888/mcp/' })
  assert.deepEqual(openCode.mcp.hindsight, { type: 'remote', enabled: true, url: 'http://localhost:8888/mcp/' })
  assert.match(codex, /url = "http:\/\/localhost:8888\/mcp\/"/u)
  for (const [name, source] of expected)
    assert.deepEqual(fs.readFileSync(path.join(sandbox.home, 'vendor', 'skills', name, 'SKILL.md')), fs.readFileSync(source))
  const visualization = path.join('skills', 'hindsight-memory', 'assets', 'compose.yaml')
  assert.deepEqual(
    fs.readFileSync(path.join(sandbox.home, 'vendor', visualization)),
    fs.readFileSync(path.join(sandbox.home, 'vendor', 'repos', 'diamond-role', 'capabilities', 'common', visualization)),
  )
  assert.equal(fs.readFileSync(marker, 'utf8'), 'setup\n')
  const verified = sandbox.cli('verify')
  assert.equal(verified.status, 0, `${verified.stdout}\n${verified.stderr}`)
  console.log(`Remote diamond installation verified: ${expected.size} real skills, memory visualization, two MCP servers, and three hosts.`)
}
finally {
  fs.rmSync(sandbox.root, { recursive: true, force: true })
}
