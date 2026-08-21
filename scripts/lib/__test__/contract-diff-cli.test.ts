import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../../..')
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const airulesCli = path.join(repoRoot, 'scripts', 'cli.ts')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-contract-cli-'))
  temporaryRoots.push(root)
  return root
}

function contract(required: string[] = ['id']): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: { title: 'Demo', version: '1' },
    paths: {
      '/demo': {
        get: {
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}

function write(root: string, name: string, value: unknown): string {
  const file = path.join(root, name)
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  return file
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [tsxCli, airulesCli, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

function run(args: string[]) {
  return runCli(['contract-diff', ...args])
}

describe('contract-diff CLI', () => {
  it('returns zero and writes a passing report for equivalent contracts', () => {
    const root = temporaryRoot()
    const expected = write(root, 'expected.json', contract())
    const actual = write(root, 'actual.json', contract())
    const output = path.join(root, 'evidence', 'audit.json')
    const result = run([
      '--expected',
      expected,
      '--actual',
      actual,
      '--expected-label',
      'provider',
      '--actual-label',
      'consumer',
      '--expected-version',
      'provider@1',
      '--actual-version',
      'consumer@2',
      '--output',
      output,
    ])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: 'pass',
      sources: {
        expected: { label: 'provider', version: 'provider@1' },
        actual: { label: 'consumer', version: 'consumer@2' },
      },
    })
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(JSON.parse(result.stdout))
  })

  it('returns two while preserving the blocking gap report', () => {
    const root = temporaryRoot()
    const expected = contract(['id', 'name'])
    const actual = contract(['id'])
    ;(actual.paths as any)['/demo'].get.responses[200].content['application/json'].schema.properties.name.type = 'integer'
    const result = run([
      '--expected',
      write(root, 'expected.json', expected),
      '--actual',
      write(root, 'actual.json', actual),
    ])
    const audit = JSON.parse(result.stdout)

    expect(result.status).toBe(2)
    expect(audit.status).toBe('fail')
    expect(audit.summary.blocking).toBeGreaterThan(0)
    expect(audit.gaps.map((gap: any) => gap.kind)).toEqual(expect.arrayContaining(['REQUIREDNESS_MISMATCH', 'TYPE_MISMATCH']))
  })

  it('returns one and writes an error report for unsupported input', () => {
    const root = temporaryRoot()
    const expected = write(root, 'expected.json', contract())
    const unsupported = write(root, 'unsupported.json', { asyncapi: '3.0.0', channels: {} })
    const output = path.join(root, 'error.json')
    const result = run(['--expected', expected, '--actual', unsupported, '--output', output])
    const audit = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(audit).toMatchObject({
      status: 'error',
      gaps: [],
      errors: [{ code: 'CONTRACT_INPUT_ERROR' }],
    })
    expect(audit.sources.expected.sha256).toBe(createHash('sha256').update(fs.readFileSync(expected)).digest('hex'))
    expect(audit.sources.actual.sha256).toBe(createHash('sha256').update(fs.readFileSync(unsupported)).digest('hex'))
    expect(audit.errors[0].message).toMatch(/expected OpenAPI 3\.x/i)
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('returns one and writes an error audit when a required path is missing', () => {
    const root = temporaryRoot()
    const expected = write(root, 'expected.json', contract())
    const output = path.join(root, 'missing-argument.json')
    const result = run(['--expected', expected, '--output', output])
    const audit = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(result.stderr).toBe('')
    expect(audit).toMatchObject({
      status: 'error',
      errors: [{ code: 'CONTRACT_INPUT_ERROR', message: expect.stringMatching(/requires non-empty --expected and --actual/i) }],
    })
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('preserves a structured error audit when parseArgs rejects a missing option value', () => {
    const root = temporaryRoot()
    const expected = write(root, 'expected.json', contract())
    const output = path.join(root, 'parse-error.json')
    const result = run(['--output', output, '--expected', expected, '--actual'])
    const audit = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(result.stderr).toBe('')
    expect(audit).toMatchObject({
      status: 'error',
      errors: [{ code: 'CONTRACT_INPUT_ERROR' }],
    })
    expect(audit.errors[0].message).toMatch(/option '--actual(?: <value>)?'.*argument/i)
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('returns a structured error without overwriting an input when output is unsafe', () => {
    const root = temporaryRoot()
    const expected = write(root, 'expected.json', contract())
    const actual = write(root, 'actual.json', contract())
    const result = run(['--expected', expected, '--actual', actual, '--output', expected])
    const audit = JSON.parse(result.stdout)

    expect(result.status).toBe(1)
    expect(result.stderr).toBe('')
    expect(audit.status).toBe('error')
    expect(audit.errors[0].message).toMatch(/must not overwrite an input contract/i)
    expect(JSON.parse(fs.readFileSync(expected, 'utf8'))).toEqual(contract())
  })

  it('publishes machine-readable capabilities and a package-consistent version', () => {
    const packageVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version
    const capabilitiesResult = run(['--capabilities'])
    const versionResult = runCli(['--version'])

    expect(capabilitiesResult.status).toBe(0)
    expect(capabilitiesResult.stderr).toBe('')
    expect(JSON.parse(capabilitiesResult.stdout)).toEqual({
      name: 'airules-contract-diff',
      report_version: 1,
      cli_version: packageVersion,
      exit_codes: { pass: 0, fail: 2, error: 1 },
    })
    expect(versionResult.status).toBe(0)
    expect(versionResult.stderr).toBe('')
    expect(versionResult.stdout.trim()).toBe(packageVersion)
    expect(packageVersion).toBe('0.2.3')
  })

  it('documents the command without requiring contract paths', () => {
    const result = run(['--help'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('airules contract-diff --expected')
    expect(result.stdout).toContain('2  存在阻断差异')
  })
})
