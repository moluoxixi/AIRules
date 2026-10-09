import type { VendorProjection, VendorRepo } from '../vendors.js'
import { describe, expect, it } from 'vitest'
import {
  composeCapabilities,
  composeCapabilityDefinitions,
} from '../capabilities.js'

const roleVendor: VendorRepo = {
  name: 'demo-role',
  source: 'https://example.com/airules.git',
  projections: [
    { kind: 'role-assets', sourceDir: 'roles/demo' },
  ],
}

describe('capability composition', () => {
  it('keeps capability order stable and leaves every input unchanged', () => {
    const capabilities = ['common', 'coding', 'productivity', 'frontend'] as const
    const before = JSON.stringify({ capabilities, roleVendor })

    const result = composeCapabilities(capabilities, { roleVendor })

    expect(result.map(vendor => vendor.name)).toEqual([
      'demo-role',
      'hindsight-memory',
      'mattpocock',
      'anthropic-skills',
    ])
    expect(result[0]?.projections).toEqual([
      { kind: 'role-assets', sourceDir: 'roles/demo' },
      { kind: 'namespace', sourceDir: 'capabilities/common/skills', output: 'common' },
      { kind: 'mcp', sourceFile: 'capabilities/common/mcps.json', output: 'mcps/common/mcp.json' },
      { kind: 'mcp', sourceFile: 'capabilities/coding/mcps.json', output: 'mcps/code/mcp.json' },
      { kind: 'mcp', sourceFile: 'capabilities/frontend/mcps.json', output: 'mcps/frontend/mcp.json' },
    ])
    expect(JSON.stringify({ capabilities, roleVendor })).toBe(before)

    result[0]!.projections.splice(0)
    expect(roleVendor.projections).toEqual([{ kind: 'role-assets', sourceDir: 'roles/demo' }])
  })

  it('rejects duplicate and unknown capability names', () => {
    expect(() => composeCapabilities(['common', 'common'], { roleVendor })).toThrow(/more than once/u)
    expect(() => composeCapabilities(['missing' as never], { roleVendor })).toThrow(/Unknown capability/u)
  })

  it('merges compatible vendors and removes exact duplicate projections', () => {
    const result = composeCapabilityDefinitions([
      {
        name: 'one',
        definition: {
          vendors: [vendor('shared', 'https://example.com/shared.git', [
            { kind: 'namespace', sourceDir: 'skills/a', output: 'a' },
          ])],
        },
      },
      {
        name: 'two',
        definition: {
          vendors: [vendor('shared', 'https://example.com/shared.git', [
            { kind: 'namespace', sourceDir: 'skills/a', output: 'a' },
            { kind: 'namespace', sourceDir: 'skills/b', output: 'b' },
          ])],
        },
      },
    ], { roleVendor, roleVendorPosition: 'after' })

    expect(result.map(entry => entry.name)).toEqual(['shared', 'demo-role'])
    expect(result[0]?.projections).toEqual([
      { kind: 'namespace', sourceDir: 'skills/a', output: 'a' },
      { kind: 'namespace', sourceDir: 'skills/b', output: 'b' },
    ])
  })

  it('allows partially overlapping explicit skills from the same source and effective setup', () => {
    const result = composeCapabilityDefinitions([
      {
        name: 'base',
        definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [
          { kind: 'skills', sourceBaseDir: 'skills/methods', skills: ['shared', 'one'] },
        ])] },
      },
      {
        name: 'extra',
        definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [
          { kind: 'skills', sourceBaseDir: 'skills', skills: [{ name: 'methods/shared', output: 'category/shared', setup: [] }, 'two'] },
          { kind: 'namespace', sourceDir: 'skills/methods', output: 'methods', setup: [] },
        ])] },
      },
    ], { roleVendor })
    expect(result[1]?.projections).toHaveLength(3)
  })

  it('rejects conflicting outputs inside a single skills projection with provenance', () => {
    expect(() => composeCapabilityDefinitions([{
      name: 'one',
      origin: 'child → template [one]',
      definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [{
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [{ name: 'a', output: 'nested/review' }, { name: 'b', output: 'review' }],
      }])] },
    }], { roleVendor })).toThrow(/skill:review.*child → template \[one\]/u)
  })

  it('normalizes absent setup defaults while rejecting differing skill setup', () => {
    const build = (command: string) => composeCapabilityDefinitions([
      { name: 'one', origin: 'child → left [one]', definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [{
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [{ name: 'review', setup: [{ command: 'prepare' }] }],
      }])] } },
      { name: 'two', origin: 'child → right [two]', definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [{
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [{ name: 'review', setup: [{ command, args: [], windowsCommandShim: false }] }],
      }])] } },
    ], { roleVendor })
    expect(build('prepare')[1]?.projections).toHaveLength(1)
    expect(() => build('different')).toThrow(/skill:review.*child → left.*child → right/u)
  })

  it('rejects vendor and output names that differ only by case', () => {
    expect(() => composeCapabilityDefinitions([
      { name: 'one', definition: { vendors: [vendor('Shared', 'https://example.com/shared.git', [])] } },
      { name: 'two', definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [])] } },
    ], { roleVendor })).toThrow(/Vendor names differ only by case/u)
    expect(() => composeCapabilityDefinitions([{
      name: 'one',
      definition: { vendors: [vendor('shared', 'https://example.com/shared.git', [{
        kind: 'skills',
        sourceBaseDir: 'skills',
        skills: [{ name: 'a', output: 'Review' }, { name: 'b', output: 'review' }],
      }])] },
    }], { roleVendor })).toThrow(/Projection target "skill:review"/u)
  })

  it.each([
    ['source', vendor('shared', 'https://example.com/other.git', [])],
    ['revision', { ...vendor('shared', 'https://example.com/shared.git', []), revision: 'b'.repeat(40) }],
    ['setup', { ...vendor('shared', 'https://example.com/shared.git', []), setup: [{ command: 'two' }] }],
  ])('rejects conflicting vendor %s definitions', (_field, conflicting) => {
    const first = {
      ...vendor('shared', 'https://example.com/shared.git', []),
      revision: 'a'.repeat(40),
      setup: [{ command: 'one' }],
    }
    if (_field === 'source') {
      conflicting.revision = first.revision
      conflicting.setup = first.setup
    }
    if (_field === 'revision')
      conflicting.setup = first.setup
    if (_field === 'setup')
      conflicting.revision = first.revision

    expect(() => composeCapabilityDefinitions([
      { name: 'one', definition: { vendors: [first] } },
      { name: 'two', definition: { vendors: [conflicting] } },
    ], { roleVendor })).toThrow(/conflicting source, revision, or setup/u)
  })

  it('rejects skill, MCP, and role projection target conflicts', () => {
    const conflicts: Array<[VendorProjection, VendorProjection]> = [
      [
        { kind: 'skills' as const, sourceBaseDir: 'skills', skills: ['same'] },
        { kind: 'skills' as const, sourceBaseDir: 'other', skills: ['same'] },
      ],
      [
        { kind: 'mcp' as const, sourceFile: 'mcps/a.json', output: 'mcps/shared/mcp.json' },
        { kind: 'mcp' as const, sourceFile: 'mcps/b.json', output: 'mcps/shared/mcp.json' },
      ],
      [
        { kind: 'role-assets' as const, sourceDir: 'roles/other' },
        { kind: 'role-assets' as const, sourceDir: 'roles/another' },
      ],
    ]

    for (const [left, right] of conflicts) {
      expect(() => composeCapabilityDefinitions([
        { name: 'one', definition: { vendors: [vendor('one', 'https://example.com/one.git', [left])] } },
        { name: 'two', definition: { vendors: [vendor('two', 'https://example.com/two.git', [right])] } },
      ], { roleVendor: vendor('demo-role', 'https://example.com/airules.git', []) })).toThrow(/Projection target/u)
    }
  })
})

function vendor(
  name: string,
  source: string,
  projections: VendorRepo['projections'],
): VendorRepo {
  return { name, source, projections }
}
