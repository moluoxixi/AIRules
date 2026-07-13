import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stringify } from 'yaml'
import {
  compareContractFiles,
  createContractErrorAudit,
  serializeContractAudit,
  writeContractAudit,
} from '../contract-diff.js'

const temporaryRoots: string[] = []
const auditSchema = JSON.parse(fs.readFileSync(path.resolve('scripts', 'schemas', 'integration-audit.schema.json'), 'utf8'))
const validateAuditSchema = new Ajv2020({ allErrors: true, strict: true, strictRequired: false }).compile(auditSchema)

function expectValidAudit(audit: unknown): void {
  expect(validateAuditSchema(audit), JSON.stringify(validateAuditSchema.errors, null, 2)).toBe(true)
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-contract-diff-'))
  temporaryRoots.push(root)
  return root
}

function baseContract(): Record<string, any> {
  return {
    openapi: '3.1.0',
    info: { title: 'Orders', version: '1.0.0' },
    paths: {
      '/orders': {
        post: {
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateOrder' },
                examples: { ignored: { value: { invented: true } } },
              },
            },
          },
          responses: {
            201: {
              description: 'created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' },
                },
              },
            },
          },
        },
      },
      '/orders/{id}': {
        parameters: [{ $ref: '#/components/parameters/OrderId' }],
        get: {
          parameters: [{ name: 'expand', in: 'query', required: false, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Order' },
                },
              },
            },
            404: { description: 'missing' },
          },
        },
      },
    },
    components: {
      parameters: {
        OrderId: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      },
      schemas: {
        CreateOrder: {
          allOf: [
            {
              type: 'object',
              required: ['sku'],
              properties: {
                sku: { type: 'string' },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                quantity: { type: 'integer', format: 'int32' },
              },
            },
          ],
        },
        Order: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'currency', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid', readOnly: true },
            currency: { type: 'string', enum: ['CNY', 'USD'] },
            createdAt: { type: 'string', format: 'date-time' },
            note: { type: ['string', 'null'] },
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/Order' },
            },
          },
        },
      },
    },
  }
}

function writeJson(root: string, name: string, document: unknown): string {
  const file = path.join(root, name)
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`)
  return file
}

function writeYaml(root: string, name: string, document: unknown, bom = false): string {
  const file = path.join(root, name)
  fs.writeFileSync(file, `${bom ? '\uFEFF' : ''}${stringify(document)}`)
  return file
}

function writeRaw(root: string, name: string, content: string): string {
  const file = path.join(root, name)
  fs.writeFileSync(file, content)
  return file
}

function withCommitPreload<T>(root: string, configuration: Record<string, unknown>, action: () => T): T {
  const preload = writeRaw(root, `commit-preload-${Math.random().toString(16).slice(2)}.cjs`, String.raw`
const fs = require('node:fs')
const configuration = JSON.parse(Buffer.from(process.env.AIRULES_CONTRACT_AUDIT_RACE, 'base64').toString('utf8'))
if (configuration.action === 'replace-source-on-load') {
  fs.renameSync(configuration.sourcePath, configuration.displacedSourcePath)
  fs.renameSync(configuration.replacementSourcePath, configuration.sourcePath)
  fs.writeFileSync(configuration.marker, JSON.stringify({ action: configuration.action, replaced: true }))
}
if (configuration.action === 'replace-target-on-load') {
  fs.renameSync(configuration.targetPath, configuration.displacedTargetPath)
  fs.renameSync(configuration.replacementTargetPath, configuration.targetPath)
  fs.writeFileSync(configuration.marker, JSON.stringify({ action: configuration.action, replaced: true }))
}
const originalFsync = fs.fsyncSync.bind(fs)
const originalFtruncate = fs.ftruncateSync.bind(fs)
const originalOpen = fs.openSync.bind(fs)
const originalWrite = fs.writeSync.bind(fs)
let intercepted = false
fs.openSync = (filePath, flags, ...rest) => {
  if (!intercepted && filePath === configuration.targetName && flags === 'wx+') {
    intercepted = true
    let outcome = { action: configuration.action, intercepted: true }
    if (configuration.action === 'install-target') {
      fs.writeFileSync(filePath, 'concurrent target\n')
    }
    else if (configuration.action === 'install-identical-target') {
      fs.writeFileSync(filePath, configuration.targetContent)
    }
    else if (configuration.action === 'install-protected-link') {
      fs.linkSync(configuration.protectedPath, filePath)
    }
    else if (configuration.action === 'replace-target-after-open') {
      const descriptor = originalOpen(filePath, flags, ...rest)
      fs.renameSync(filePath, configuration.displacedName)
      fs.writeFileSync(filePath, 'concurrent target\n')
      fs.writeFileSync(configuration.marker, JSON.stringify(outcome))
      return descriptor
    }
    else if (configuration.action === 'swap-output-ancestor') {
      try {
        fs.renameSync(configuration.outputDirectory, configuration.displacedDirectory)
        fs.symlinkSync(
          configuration.attackerDirectory,
          configuration.outputDirectory,
          process.platform === 'win32' ? 'junction' : 'dir',
        )
        outcome = { ...outcome, switched: true }
      }
      catch (error) {
        outcome = { ...outcome, switched: false, errorCode: error && error.code }
      }
    }
    fs.writeFileSync(configuration.marker, JSON.stringify(outcome))
  }
  return originalOpen(filePath, flags, ...rest)
}
let markerIntercepted = false
let rollbackWriteFailed = false
fs.writeSync = (descriptor, buffer, offset, length, position) => {
  const semanticMarker = !markerIntercepted
    && Buffer.isBuffer(buffer)
    && length === 1
    && position === 0
    && buffer[offset] === 0x7B
  if (semanticMarker && (configuration.action === 'replace-input-on-marker'
    || configuration.action === 'alias-input-on-marker'
    || configuration.action === 'fail-marker-rollback'
    || configuration.action === 'fail-marker-rollback-write'
    || configuration.action === 'fail-marker-invalidation')) {
    markerIntercepted = true
    fs.renameSync(configuration.sourcePath, configuration.displacedSourcePath)
    if (configuration.action === 'alias-input-on-marker')
      fs.linkSync(configuration.targetName, configuration.sourcePath)
    else
      fs.renameSync(configuration.replacementSourcePath, configuration.sourcePath)
    fs.writeFileSync(configuration.marker, JSON.stringify({ action: configuration.action, replaced: true }))
  }
  const rollbackMarker = !rollbackWriteFailed
    && Buffer.isBuffer(buffer)
    && length === 1
    && position === 0
    && buffer[offset] === 0x21
  if (rollbackMarker && (configuration.action === 'fail-marker-rollback-write'
    || configuration.action === 'fail-marker-invalidation')) {
    rollbackWriteFailed = true
    throw new Error('injected semantic marker rollback write failure')
  }
  if (semanticMarker && configuration.action === 'throw-after-marker-write') {
    markerIntercepted = true
    const result = originalWrite(descriptor, buffer, offset, length, position)
    fs.writeFileSync(configuration.marker, JSON.stringify({ action: configuration.action, written: true }))
    throw new Error('injected ambiguous semantic marker write failure')
  }
  return originalWrite(descriptor, buffer, offset, length, position)
}
fs.ftruncateSync = (descriptor, length) => {
  if (length === 0 && configuration.action === 'fail-marker-invalidation')
    throw new Error('injected semantic marker truncation failure')
  return originalFtruncate(descriptor, length)
}
let fsyncCount = 0
fs.fsyncSync = (descriptor) => {
  originalFsync(descriptor)
  fsyncCount += 1
  if (fsyncCount === 1 && configuration.action === 'replace-input-after-stage') {
    fs.renameSync(configuration.sourcePath, configuration.displacedSourcePath)
    if (configuration.aliasPath) {
      fs.linkSync(configuration.aliasPath, configuration.sourcePath)
    }
    else {
      fs.renameSync(configuration.replacementSourcePath, configuration.sourcePath)
    }
    fs.writeFileSync(configuration.marker, JSON.stringify({ action: configuration.action, replaced: true }))
  }
  if (fsyncCount === 1 && configuration.action === 'fail-after-staged-fsync') {
    fs.writeFileSync(configuration.marker, JSON.stringify({ action: configuration.action, failed: true }))
    throw new Error('injected failure after staged audit fsync')
  }
  if (fsyncCount === 3 && configuration.action === 'fail-marker-rollback')
    throw new Error('injected semantic marker rollback fsync failure')
}
`)
  const previousNodeOptions = process.env.NODE_OPTIONS
  const previousRace = process.env.AIRULES_CONTRACT_AUDIT_RACE
  const requireOption = `--require=${JSON.stringify(preload.replace(/\\/gu, '/'))}`
  process.env.NODE_OPTIONS = [previousNodeOptions, requireOption].filter(Boolean).join(' ')
  process.env.AIRULES_CONTRACT_AUDIT_RACE = Buffer.from(JSON.stringify(configuration), 'utf8').toString('base64')
  try {
    return action()
  }
  finally {
    if (previousNodeOptions === undefined) {
      delete process.env.NODE_OPTIONS
    }
    else {
      process.env.NODE_OPTIONS = previousNodeOptions
    }
    if (previousRace === undefined) {
      delete process.env.AIRULES_CONTRACT_AUDIT_RACE
    }
    else {
      process.env.AIRULES_CONTRACT_AUDIT_RACE = previousRace
    }
  }
}

describe('contract diff normalization', () => {
  it('validates generated pass, fail, and error audits against the published schema', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    const actual = structuredClone(expected)
    delete actual.paths['/orders/{id}'].get.responses[404]
    const expectedPath = writeJson(root, 'expected.json', expected)
    const actualPath = writeJson(root, 'actual.json', actual)
    const passing = compareContractFiles({ expectedPath, actualPath: expectedPath })
    const failing = compareContractFiles({ expectedPath, actualPath })
    const errored = createContractErrorAudit({ expectedPath, actualPath }, new Error('unsupported input'))

    for (const audit of [passing, failing, errored]) {
      expectValidAudit(audit)
    }
    expect(auditSchema.properties.status.enum).toEqual(['pass', 'fail', 'error'])
    expect(auditSchema.$defs.gap.properties.kind.enum).toEqual(expect.arrayContaining([
      'MISSING_IN_ACTUAL',
      'MISSING_IN_EXPECTED',
      'TYPE_MISMATCH',
      'ADDITIONAL_PROPERTIES_MISMATCH',
      'ACCESS_MISMATCH',
      'STYLE_MISMATCH',
    ]))

    expect(validateAuditSchema({ ...passing, unexpected: true })).toBe(false)
    expect(validateAuditSchema({ ...passing, errors: [{ code: 'CONTRACT_INPUT_ERROR', message: 'invalid pass' }] })).toBe(false)
    const blockingGap = structuredClone(failing.gaps.find(gap => gap.severity === 'blocking'))
    expect(blockingGap).toBeDefined()
    expect(validateAuditSchema({
      ...passing,
      gaps: [blockingGap],
      summary: { total: 1, blocking: 0, warnings: 1, by_kind: { MISSING_IN_ACTUAL: 1 } },
    })).toBe(false)
    expect(validateAuditSchema({
      ...failing,
      gaps: [{ ...blockingGap, severity: 'warning' }],
      summary: { total: 1, blocking: 1, warnings: 0, by_kind: { MISSING_IN_ACTUAL: 1 } },
    })).toBe(false)
    const invalidLocator = structuredClone(failing)
    invalidLocator.gaps[0].subject = 'operation'
    invalidLocator.gaps[0].field_path = 'unrelated'
    delete invalidLocator.gaps[0].status_code
    expect(validateAuditSchema(invalidLocator)).toBe(false)
    const invalidMissingSide = structuredClone(failing)
    invalidMissingSide.gaps[0].actual = { document_pointer: '#/invented' }
    expect(validateAuditSchema(invalidMissingSide)).toBe(false)
    const invalidMismatchSeverity = structuredClone(failing)
    invalidMismatchSeverity.status = 'pass'
    invalidMismatchSeverity.gaps[0].kind = 'TYPE_MISMATCH'
    invalidMismatchSeverity.gaps[0].severity = 'warning'
    invalidMismatchSeverity.gaps[0].actual = structuredClone(invalidMismatchSeverity.gaps[0].expected)
    invalidMismatchSeverity.summary = { total: 1, blocking: 0, warnings: 1, by_kind: { TYPE_MISMATCH: 1 } }
    expect(validateAuditSchema(invalidMismatchSeverity)).toBe(false)
    const missingStatus = structuredClone(passing) as unknown as Record<string, unknown>
    delete missingStatus.status
    expect(validateAuditSchema(missingStatus)).toBe(false)
  })

  it('compares equivalent JSON and YAML contracts with immutable source metadata', () => {
    const root = temporaryRoot()
    const document = baseContract()
    const expectedPath = writeJson(root, 'expected.json', document)
    const actualPath = writeYaml(root, 'actual.yaml', document, true)

    const first = compareContractFiles({
      expectedPath,
      actualPath,
      expectedLabel: 'provider',
      actualLabel: 'consumer',
      expectedVersion: 'provider@abc123',
      actualVersion: 'consumer@def456',
    })
    const second = compareContractFiles({ expectedPath, actualPath })

    expect(first.status).toBe('pass')
    expect(first.summary).toEqual({ total: 0, blocking: 0, warnings: 0, by_kind: {} })
    expect(first.gaps).toEqual([])
    expect(first.sources.expected).toMatchObject({ label: 'provider', version: 'provider@abc123', openapi: '3.1.0' })
    expect(first.sources.actual).toMatchObject({ label: 'consumer', version: 'consumer@def456', openapi: '3.1.0' })
    expect(first.sources.expected.sha256).toBe(createHash('sha256').update(fs.readFileSync(expectedPath)).digest('hex'))
    expect(first.sources.actual.sha256).toBe(createHash('sha256').update(fs.readFileSync(actualPath)).digest('hex'))
    expect(serializeContractAudit(second)).toBe(serializeContractAudit(compareContractFiles({ expectedPath, actualPath })))
  })

  it('reports stable field and compatibility differences with risk-sensitive severity', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    const actual = structuredClone(expected)
    const actualOrder = actual.components.schemas.Order
    actualOrder.additionalProperties = true
    actualOrder.required = ['createdAt']
    actualOrder.properties.id = { type: 'integer' }
    actualOrder.properties.currency.enum = ['EUR']
    delete actualOrder.properties.createdAt.format
    actualOrder.properties.note.nullable = false
    actualOrder.properties.note.type = 'string'
    delete actualOrder.properties.children
    actual.paths['/orders'].post.requestBody.content['application/json'].schema = {
      type: 'object',
      additionalProperties: false,
      required: ['sku', 'coupon'],
      properties: {
        sku: { type: 'string' },
        quantity: { type: 'integer', format: 'int64' },
        coupon: { type: 'string' },
      },
    }
    actual.paths['/orders/{id}'].parameters[0] = {
      name: 'id',
      in: 'path',
      required: false,
      schema: { type: 'string' },
    }
    delete actual.paths['/orders/{id}'].get.responses[404]

    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'expected.json', expected),
      actualPath: writeYaml(root, 'actual.yaml', actual),
    })
    const kinds = new Set(audit.gaps.map(gap => gap.kind))

    expect(audit.status).toBe('fail')
    expect(audit.summary.blocking).toBeGreaterThan(0)
    expect(kinds).toEqual(new Set([
      'ACCESS_MISMATCH',
      'ADDITIONAL_PROPERTIES_MISMATCH',
      'ENUM_MISMATCH',
      'FORMAT_MISMATCH',
      'MISSING_IN_ACTUAL',
      'MISSING_IN_EXPECTED',
      'NULLABILITY_MISMATCH',
      'REQUIREDNESS_MISMATCH',
      'TYPE_MISMATCH',
    ]))
    expect(audit.gaps.map(gap => gap.id)).toEqual(audit.gaps.map((_, index) => `GAP-${String(index + 1).padStart(3, '0')}`))
    expect(audit.gaps).toContainEqual(expect.objectContaining({
      kind: 'MISSING_IN_EXPECTED',
      severity: 'blocking',
      subject: 'field',
      method: 'POST',
      path: '/orders',
      field_path: 'coupon',
    }))
    expect(audit.gaps).toContainEqual(expect.objectContaining({
      kind: 'MISSING_IN_ACTUAL',
      severity: 'warning',
      field_path: 'children',
    }))
    expect(audit.gaps).toContainEqual(expect.objectContaining({
      kind: 'MISSING_IN_ACTUAL',
      severity: 'blocking',
      subject: 'response',
      status_code: '404',
    }))
  })

  it('suppresses child gaps when an entire operation is absent', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    const actual = structuredClone(expected)
    delete actual.paths['/orders/{id}'].get

    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'expected.json', expected),
      actualPath: writeJson(root, 'actual.json', actual),
    })
    const affected = audit.gaps.filter(gap => gap.method === 'GET' && gap.path === '/orders/{id}')

    expect(affected).toEqual([
      expect.objectContaining({ subject: 'operation', kind: 'MISSING_IN_ACTUAL', severity: 'blocking' }),
    ])
  })

  it('fails closed for unsupported schemas and unresolved references', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    const actual = baseContract()
    actual.components.schemas.Order = { oneOf: [{ type: 'string' }, { type: 'integer' }] }
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'expected.json', expected),
      actualPath: writeJson(root, 'one-of.json', actual),
    })).toThrow(/unsupported schema keyword "oneOf"/i)

    actual.components.schemas.Order = { $ref: './external.yaml#/Order' }
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'expected-2.json', expected),
      actualPath: writeJson(root, 'external-ref.json', actual),
    })).toThrow(/external or non-pointer reference is unsupported/i)

    actual.components.schemas.Order = { $ref: '#/components/schemas/Missing' }
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'expected-3.json', expected),
      actualPath: writeJson(root, 'missing-ref.json', actual),
    })).toThrow(/unresolved local reference/i)
  })

  it('fails closed for malformed or unsupported OpenAPI documents', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'expected.json', baseContract())
    const invalidDocuments: Array<[string, string, RegExp]> = [
      ['invalid.yaml', 'openapi: [\n', /invalid contract document/i],
      ['array.json', '[]\n', /contract document .* must be an object/i],
      ['numeric-version.json', '{"openapi":3,"paths":{}}\n', /expected OpenAPI 3\.x/i],
      ['old-version.json', '{"openapi":"2.0.0","paths":{}}\n', /expected OpenAPI 3\.x/i],
      ['array-paths.json', '{"openapi":"3.1.0","paths":[]}\n', /OpenAPI paths .* must be an object/i],
      ['webhooks.json', '{"openapi":"3.1.0","paths":{},"webhooks":{"event":{}}}\n', /unsupported OpenAPI webhooks/i],
    ]

    for (const [name, content, error] of invalidDocuments) {
      expect(() => compareContractFiles({
        expectedPath,
        actualPath: writeRaw(root, name, content),
      }), name).toThrow(error)
    }
  })

  it('fails closed for unsupported security and server wire semantics at every OpenAPI scope', () => {
    const root = temporaryRoot()
    const cases: Array<[string, (document: Record<string, any>) => void, RegExp]> = [
      ['root-servers', (document) => { document.servers = [] }, /unsupported OpenAPI servers at #\/servers/i],
      ['root-security', (document) => { document.security = [] }, /unsupported OpenAPI security at #\/security/i],
      ['path-servers', (document) => { document.paths['/orders'].servers = [] }, /unsupported OpenAPI servers at #\/paths\/~1orders\/servers/i],
      ['path-security', (document) => { document.paths['/orders'].security = [] }, /unsupported OpenAPI security at #\/paths\/~1orders\/security/i],
      ['operation-servers', (document) => { document.paths['/orders'].post.servers = [] }, /unsupported OpenAPI servers at #\/paths\/~1orders\/post\/servers/i],
      ['operation-security', (document) => { document.paths['/orders'].post.security = [] }, /unsupported OpenAPI security at #\/paths\/~1orders\/post\/security/i],
      ['security-schemes', (document) => { document.components.securitySchemes = {} }, /unsupported OpenAPI securitySchemes at #\/components\/securitySchemes/i],
    ]

    for (const [name, mutate, error] of cases) {
      const actual = baseContract()
      mutate(actual)
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `${name}-expected.json`, baseContract()),
        actualPath: writeJson(root, `${name}-actual.json`, actual),
      }), name).toThrow(error)
    }
  })

  it('fails closed for invalid OpenAPI path keys', () => {
    const root = temporaryRoot()
    const invalidPaths = [
      '',
      'orders',
      '/orders?limit=1',
      '/orders#details',
      '/order items',
      '/orders\u00A0archive',
      ...Array.from({ length: 0x20 }, (_, code) => `/orders${String.fromCharCode(code)}archive`),
      `/orders${String.fromCharCode(0x7F)}archive`,
    ]

    for (const [index, invalidPath] of invalidPaths.entries()) {
      const actual = baseContract()
      actual.paths[invalidPath] = { get: { responses: { 200: { description: 'invalid path' } } } }
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `invalid-path-${index}-expected.json`, baseContract()),
        actualPath: writeJson(root, `invalid-path-${index}-actual.json`, actual),
      }), JSON.stringify(invalidPath)).toThrow(/invalid OpenAPI path key/i)
    }
  })

  it('accepts only OpenAPI response status codes, ranges, and default', () => {
    const root = temporaryRoot()
    const valid = baseContract()
    const responses = valid.paths['/orders/{id}'].get.responses
    responses.default = { description: 'fallback' }
    responses['1XX'] = { description: 'informational range' }
    responses['2XX'] = { description: 'success range' }
    responses['5XX'] = { description: 'server error range' }
    responses[100] = { description: 'continue' }
    responses[599] = { description: 'upper OpenAPI response bound' }

    expect(compareContractFiles({
      expectedPath: writeJson(root, 'valid-responses-expected.json', valid),
      actualPath: writeYaml(root, 'valid-responses-actual.yaml', valid),
    })).toMatchObject({ status: 'pass', gaps: [] })

    const openApi30 = baseContract()
    openApi30.openapi = '3.0.3'
    openApi30.components.schemas.Order.properties.note = { type: 'string', nullable: true }
    openApi30.paths['/orders/{id}'].get.responses['2XX'] = { description: 'OpenAPI 3.0 response range' }
    expect(compareContractFiles({
      expectedPath: writeJson(root, 'range-30-expected.json', openApi30),
      actualPath: writeJson(root, 'range-30-actual.json', openApi30),
    })).toMatchObject({ status: 'pass', gaps: [] })

    const emptyResponses = baseContract()
    emptyResponses.paths['/orders/{id}'].get.responses = {}
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'empty-responses-expected.json', baseContract()),
      actualPath: writeJson(root, 'empty-responses-actual.json', emptyResponses),
    })).toThrow(/responses must contain at least one response/i)

    const invalidResponseKeys = [
      '',
      'DEFAULT',
      '099',
      '600',
      '20',
      '2000',
      '2xx',
      '2X0',
      '200 OK',
      '+200',
      'x-extension',
    ]
    for (const [index, responseKey] of invalidResponseKeys.entries()) {
      const actual = baseContract()
      actual.paths['/orders/{id}'].get.responses[responseKey] = { description: 'invalid response key' }
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `invalid-response-${index}-expected.json`, baseContract()),
        actualPath: writeJson(root, `invalid-response-${index}-actual.json`, actual),
      }), JSON.stringify(responseKey)).toThrow(/invalid OpenAPI response key/i)
    }
  })

  it('normalizes strict media types and ranges while failing closed for invalid or duplicate keys', () => {
    const root = temporaryRoot()
    const valid = baseContract()
    for (const mediaType of ['application/vnd.acme+json', 'text/*', '*/*']) {
      valid.paths['/orders'].post.requestBody.content[mediaType] = {}
    }
    expect(compareContractFiles({
      expectedPath: writeJson(root, 'valid-media-expected.json', valid),
      actualPath: writeYaml(root, 'valid-media-actual.yaml', valid),
    }).status).toBe('pass')

    const caseExpected = baseContract()
    const expectedContent = caseExpected.paths['/orders'].post.requestBody.content
    const expectedMedia = expectedContent['application/json']
    delete expectedContent['application/json']
    expectedContent['Application/Vnd.Acme+JSON'] = expectedMedia
    const caseActual = structuredClone(caseExpected)
    const actualContent = caseActual.paths['/orders'].post.requestBody.content
    const actualMedia = actualContent['Application/Vnd.Acme+JSON']
    delete actualContent['Application/Vnd.Acme+JSON']
    actualContent['application/vnd.acme+json'] = actualMedia
    expect(compareContractFiles({
      expectedPath: writeJson(root, 'case-media-expected.json', caseExpected),
      actualPath: writeJson(root, 'case-media-actual.json', caseActual),
    })).toMatchObject({ status: 'pass', gaps: [] })

    const duplicate = baseContract()
    duplicate.paths['/orders'].post.requestBody.content['Application/JSON'] = {}
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'duplicate-media-expected.json', baseContract()),
      actualPath: writeJson(root, 'duplicate-media-actual.json', duplicate),
    })).toThrow(/duplicate media type keys/i)

    const invalidMediaTypes = [
      '',
      'application',
      '/json',
      'application/',
      'application//json',
      'application json',
      'application/(json)',
      '*/json',
      'application/*+json',
      'application/json; charset=utf-8',
    ]
    for (const [index, mediaType] of invalidMediaTypes.entries()) {
      const actual = baseContract()
      actual.paths['/orders'].post.requestBody.content[mediaType] = {}
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `invalid-media-${index}-expected.json`, baseContract()),
        actualPath: writeJson(root, `invalid-media-${index}-actual.json`, actual),
      }), JSON.stringify(mediaType)).toThrow(/invalid media type/i)
    }
  })

  it('validates local reference syntax, aliases, and array pointer segments', () => {
    const root = temporaryRoot()
    const referenceCases: Array<[string, (document: Record<string, any>) => void, RegExp]> = [
      ['non-string', (document) => { document.components.schemas.Order = { $ref: 42 } }, /Schema \$ref .* must be a string/i],
      ['invalid-escape', (document) => { document.components.schemas.Order = { $ref: '#/components/schemas/Bad~2' } }, /invalid JSON Pointer escape/i],
      ['primitive-hop', (document) => {
        document.components.schemas.Order = { $ref: '#/extension/value' }
        document.extension = 'primitive'
      }, /unresolved local reference/i],
      ['cyclic-alias', (document) => {
        document.components.schemas.Order = { $ref: '#/components/schemas/A' }
        document.components.schemas.A = { $ref: '#/components/schemas/B' }
        document.components.schemas.B = { $ref: '#/components/schemas/A' }
      }, /cyclic schema aliases/i],
    ]
    for (const [name, mutate, error] of referenceCases) {
      const expected = baseContract()
      const actual = baseContract()
      mutate(actual)
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `${name}-expected.json`, expected),
        actualPath: writeJson(root, `${name}-actual.json`, actual),
      }), name).toThrow(error)
    }

    const arrayPointerContract = baseContract()
    arrayPointerContract.extension = [{ type: 'object', properties: { value: { type: 'string' } } }]
    arrayPointerContract.components.schemas.Order = { $ref: '#/extension/0' }
    const arrayAudit = compareContractFiles({
      expectedPath: writeJson(root, 'array-pointer-expected.json', arrayPointerContract),
      actualPath: writeYaml(root, 'array-pointer-actual.yaml', arrayPointerContract),
    })
    expect(arrayAudit.status).toBe('pass')
  })

  it('composes OpenAPI 3.1 schema ref siblings while rejecting them before 3.1', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    expected.components.schemas.BaseOrder = {
      type: 'object',
      properties: { id: { type: 'string' } },
    }
    expected.components.schemas.Order = {
      $ref: '#/components/schemas/BaseOrder',
      description: 'composed alias',
      required: ['id'],
    }
    const actual = structuredClone(expected)
    delete actual.components.schemas.Order.required

    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'sibling-expected.json', expected),
      actualPath: writeJson(root, 'sibling-actual.json', actual),
    })
    expect(audit.gaps).toContainEqual(expect.objectContaining({
      kind: 'REQUIREDNESS_MISMATCH',
      field_path: 'id',
    }))

    const openApi30 = structuredClone(expected)
    openApi30.openapi = '3.0.3'
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'sibling-30-expected.json', openApi30),
      actualPath: writeJson(root, 'sibling-30-actual.json', openApi30),
    })).toThrow(/siblings are unsupported before OpenAPI 3\.1/i)
  })

  it('normalizes inferred schema shapes, consts, maps, and write-only fields', () => {
    const root = temporaryRoot()
    const document = baseContract()
    document.components.schemas.Order = {
      properties: {
        implicitObject: {
          properties: {
            fixed: { const: 'fixed-value' },
          },
        },
        implicitArray: { items: { type: 'string' } },
        nullOnly: { type: ['null'] },
        structuredEnum: { enum: [{ beta: 2, alpha: 1 }] },
        attributes: {
          type: 'object',
          additionalProperties: { type: 'integer' },
        },
        secret: { type: 'string', writeOnly: true },
      },
    }
    const mapContract = baseContract()
    mapContract.components.schemas.CreateOrder = {
      allOf: [
        { type: 'object' },
        { type: 'object', additionalProperties: { type: 'string' } },
      ],
    }

    expect(compareContractFiles({
      expectedPath: writeJson(root, 'inferred.json', document),
      actualPath: writeYaml(root, 'inferred.yaml', document),
    }).status).toBe('pass')
    expect(compareContractFiles({
      expectedPath: writeJson(root, 'map.json', mapContract),
      actualPath: writeYaml(root, 'map.yaml', mapContract),
    }).status).toBe('pass')
  })

  it('rejects conflicting allOf shapes and invalid parameter contracts', () => {
    const root = temporaryRoot()
    const conflicting = baseContract()
    conflicting.components.schemas.CreateOrder.allOf.push({ type: 'string' })
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'conflicting-expected.json', baseContract()),
      actualPath: writeJson(root, 'conflicting-actual.json', conflicting),
    })).toThrow(/conflicting allOf contract definitions/i)

    const parameterCases: Array<[string, (document: Record<string, any>) => void, RegExp]> = [
      ['not-array', (document) => { document.paths['/orders/{id}'].get.parameters = {} }, /parameters .* must be an array/i],
      ['missing-name', (document) => { document.paths['/orders/{id}'].get.parameters = [{ in: 'query', schema: {} }] }, /requires string name and in fields/i],
      ['missing-in', (document) => { document.paths['/orders/{id}'].get.parameters = [{ name: 'filter', schema: {} }] }, /requires string name and in fields/i],
      ['non-string-ref', (document) => { document.paths['/orders/{id}'].get.parameters = [{ $ref: 42 }] }, /\$ref .* must be a string/i],
      ['content', (document) => { document.paths['/orders/{id}'].get.parameters = [{ name: 'filter', in: 'query', content: { 'application/json': {} } }] }, /parameter content is unsupported/i],
    ]
    for (const [name, mutate, error] of parameterCases) {
      const actual = baseContract()
      mutate(actual)
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `${name}-expected.json`, baseContract()),
        actualPath: writeJson(root, `${name}-actual.json`, actual),
      }), name).toThrow(error)
    }
  })

  it('supports schema-less media while rejecting callbacks', () => {
    const root = temporaryRoot()
    const document = baseContract()
    document.paths['/orders/{id}'].get.parameters.push({ name: 'mode', in: 'query', schema: { enum: ['brief', 'full'] } })
    document.paths['/orders/{id}'].get.responses[200].content['text/plain'] = {}
    document.paths['/orders'].post.requestBody = { required: false }
    expect(compareContractFiles({
      expectedPath: writeJson(root, 'schema-less.json', document),
      actualPath: writeYaml(root, 'schema-less.yaml', document),
    }).status).toBe('pass')

    const callback = baseContract()
    callback.paths['/orders'].post.callbacks = { completed: {} }
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'callback-expected.json', baseContract()),
      actualPath: writeJson(root, 'callback-actual.json', callback),
    })).toThrow(/unsupported OpenAPI callbacks/i)
  })

  it('suppresses descendants for missing request bodies, responses, media, and extra operations', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    const actual = structuredClone(expected)
    delete actual.paths['/orders'].post.requestBody
    delete actual.paths['/orders/{id}'].get.responses[200]
    actual.paths['/orders'].post.responses[201].content = { 'text/plain': {} }
    const missingAudit = compareContractFiles({
      expectedPath: writeJson(root, 'ancestor-expected.json', expected),
      actualPath: writeJson(root, 'ancestor-actual.json', actual),
    })

    expect(missingAudit.gaps.filter(gap => gap.subject === 'request_body')).toHaveLength(1)
    expect(missingAudit.gaps.filter(gap => gap.status_code === '200')).toEqual([
      expect.objectContaining({ subject: 'response', kind: 'MISSING_IN_ACTUAL' }),
    ])
    expect(missingAudit.gaps.filter(gap => gap.status_code === '201' && gap.media_type === 'application/json')).toEqual([
      expect.objectContaining({ subject: 'media_type', kind: 'MISSING_IN_ACTUAL' }),
    ])

    const withExtraOperation = baseContract()
    withExtraOperation.paths['/extra'] = {
      get: {
        responses: {
          200: {
            description: 'extra',
            content: { 'application/json': { schema: { type: 'string' } } },
          },
        },
      },
    }
    const extraAudit = compareContractFiles({
      expectedPath: writeJson(root, 'extra-expected.json', baseContract()),
      actualPath: writeJson(root, 'extra-actual.json', withExtraOperation),
    })
    expect(extraAudit.gaps.filter(gap => gap.path === '/extra')).toEqual([
      expect.objectContaining({ subject: 'operation', kind: 'MISSING_IN_EXPECTED', severity: 'warning' }),
    ])
  })

  it('unions required fields declared across allOf branches', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    expected.components.schemas.Order = {
      allOf: [
        { type: 'object', properties: { id: { type: 'string' } } },
        { required: ['id'] },
      ],
    }
    const actual = structuredClone(expected)
    actual.components.schemas.Order.allOf[1] = {}

    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'allof-required-expected.json', expected),
      actualPath: writeJson(root, 'allof-required-actual.json', actual),
    })
    expect(audit.gaps).toContainEqual(expect.objectContaining({
      kind: 'REQUIREDNESS_MISMATCH',
      field_path: 'id',
    }))
  })

  it('never passes required-only fields without property schemas', () => {
    const root = temporaryRoot()
    const cases: Array<[string, Record<string, any>, Record<string, any>, string]> = []

    const directExpected = baseContract()
    directExpected.components.schemas.Order = { type: 'object', required: ['id'] }
    const directActual = structuredClone(directExpected)
    directActual.components.schemas.Order.required = []
    cases.push(['direct', directExpected, directActual, 'id'])

    const allOfExpected = baseContract()
    allOfExpected.components.schemas.Order = { allOf: [{ type: 'object' }, { required: ['code'] }] }
    const allOfActual = structuredClone(allOfExpected)
    allOfActual.components.schemas.Order.allOf[1] = {}
    cases.push(['allof', allOfExpected, allOfActual, 'code'])

    const overlayExpected = baseContract()
    overlayExpected.components.schemas.EmptyOrder = { type: 'object' }
    overlayExpected.components.schemas.Order = {
      $ref: '#/components/schemas/EmptyOrder',
      required: ['tenantId'],
    }
    const overlayActual = structuredClone(overlayExpected)
    delete overlayActual.components.schemas.Order.required
    cases.push(['ref-overlay', overlayExpected, overlayActual, 'tenantId'])

    for (const [name, expected, actual, fieldPath] of cases) {
      const audit = compareContractFiles({
        expectedPath: writeJson(root, `${name}-required-only-expected.json`, expected),
        actualPath: writeJson(root, `${name}-required-only-actual.json`, actual),
      })
      expect(audit.status, name).toBe('fail')
      expect(audit.gaps, name).toContainEqual(expect.objectContaining({
        kind: 'MISSING_IN_ACTUAL',
        severity: 'blocking',
        field_path: fieldPath,
      }))
    }
  })

  it('compares parameter object schemas and normalized serialization', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    expected.paths['/orders/{id}'].get.parameters[0] = {
      name: 'filter',
      in: 'query',
      required: false,
      style: 'deepObject',
      explode: true,
      allowReserved: true,
      schema: {
        type: 'object',
        required: ['term'],
        properties: {
          term: { type: 'string' },
          limit: { type: 'integer' },
        },
      },
    }
    const actual = structuredClone(expected)
    const actualParameter = actual.paths['/orders/{id}'].get.parameters[0]
    actualParameter.style = 'form'
    actualParameter.explode = false
    actualParameter.allowReserved = false
    actualParameter.schema.required = []
    actualParameter.schema.properties.term.type = 'integer'

    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'parameter-expected.json', expected),
      actualPath: writeJson(root, 'parameter-actual.json', actual),
    })
    expectValidAudit(audit)
    expect(audit.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'STYLE_MISMATCH', subject: 'parameter', field_path: 'filter' }),
      expect.objectContaining({ kind: 'EXPLODE_MISMATCH', subject: 'parameter', field_path: 'filter' }),
      expect.objectContaining({ kind: 'ALLOW_RESERVED_MISMATCH', subject: 'parameter', field_path: 'filter' }),
      expect.objectContaining({ kind: 'TYPE_MISMATCH', subject: 'field', parameter_in: 'query', field_path: 'filter.term' }),
      expect.objectContaining({ kind: 'REQUIREDNESS_MISMATCH', subject: 'field', parameter_in: 'query', field_path: 'filter.term' }),
    ]))
  })

  it('fails closed for unsupported wire constraints and invalid parameter schemas', () => {
    const root = temporaryRoot()
    const cases: Array<[string, (document: Record<string, any>) => void, RegExp]> = [
      ['constraint', (document) => { document.components.schemas.Order.properties.currency.minLength = 3 }, /unsupported schema keyword "minLength"/i],
      ['xml', (document) => { document.components.schemas.Order.xml = { name: 'order' } }, /unsupported schema keyword "xml"/i],
      ['schema-extension', (document) => { document.components.schemas.Order.properties.note['x-nullable'] = true }, /unsupported schema keyword "x-nullable"/i],
      ['invalid-type', (document) => { document.components.schemas.Order.type = 'tuple' }, /schema type .* is invalid/i],
      ['empty-type-array', (document) => { document.components.schemas.Order.type = [] }, /schema type array .* is invalid/i],
      ['invalid-type-array-member', (document) => { document.components.schemas.Order.type = ['string', 42] }, /schema type array .* is invalid/i],
      ['duplicate-type-array', (document) => { document.components.schemas.Order.type = ['string', 'string'] }, /schema type array .* contains duplicates/i],
      ['object-type', (document) => { document.components.schemas.Order.type = { name: 'object' } }, /schema type .* must be a string/i],
      ['numeric-format', (document) => { document.components.schemas.Order.format = 42 }, /schema format .* must be a string/i],
      ['string-nullable', (document) => { document.components.schemas.Order.nullable = 'yes' }, /schema nullable .* must be a boolean/i],
      ['string-read-only', (document) => { document.components.schemas.Order.readOnly = 'yes' }, /schema readOnly .* must be a boolean/i],
      ['string-write-only', (document) => { document.components.schemas.Order.writeOnly = 'yes' }, /schema writeOnly .* must be a boolean/i],
      ['empty-enum', (document) => { document.components.schemas.Order.enum = [] }, /schema enum .* must be a non-empty array/i],
      ['empty-all-of', (document) => { document.components.schemas.Order.allOf = [] }, /schema allOf .* must be a non-empty array/i],
      ['object-required', (document) => { document.components.schemas.Order.required = {} }, /schema required .* must be an array/i],
      ['array-properties', (document) => { document.components.schemas.Order.properties = [] }, /schema properties .* must be an object/i],
      ['array-items', (document) => { document.components.schemas.Order.items = [] }, /schema items .* must be an object/i],
      ['string-additional-properties', (document) => { document.components.schemas.Order.additionalProperties = 'closed' }, /schema additionalProperties .* must be a boolean or object/i],
      ['non-string-required-name', (document) => { document.components.schemas.Order.required = ['id', 42] }, /schema required .* must contain only strings/i],
      ['duplicate-required-name', (document) => { document.components.schemas.Order.required = ['id', 'id'] }, /schema required .* contains duplicates/i],
      ['conflicting-access', (document) => {
        document.components.schemas.Order.readOnly = true
        document.components.schemas.Order.writeOnly = true
      }, /schema cannot be both readOnly and writeOnly/i],
      ['parameter-one-of', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].schema = { oneOf: [{ type: 'string' }, { type: 'integer' }] }
      }, /unsupported schema keyword "oneOf"/i],
      ['parameter-array-schema', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].schema = []
      }, /schema .* must be an object/i],
      ['parameter-without-schema', (document) => {
        document.paths['/orders/{id}'].get.parameters[0] = { name: 'empty', in: 'query' }
      }, /requires exactly one of schema or content/i],
      ['parameter-location', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].in = 'matrix'
      }, /unsupported parameter location/i],
      ['parameter-numeric-style', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].style = 42
      }, /parameter style .* must be a string/i],
      ['parameter-unsupported-style', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].style = 'matrix'
      }, /unsupported parameter style/i],
      ['parameter-string-explode', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].explode = 'yes'
      }, /parameter explode .* must be a boolean/i],
      ['parameter-string-allow-reserved', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].allowReserved = 'yes'
      }, /parameter allowReserved .* must be a boolean/i],
      ['parameter-header-allow-reserved', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].in = 'header'
        document.paths['/orders/{id}'].get.parameters[0].allowReserved = true
      }, /parameter allowReserved is only supported for query parameters/i],
      ['parameter-allow-empty-value', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].allowEmptyValue = false
      }, /unsupported parameter keyword "allowEmptyValue"/i],
      ['parameter-string-required', (document) => {
        document.paths['/orders/{id}'].get.parameters[0].required = 'yes'
      }, /parameter required .* must be a boolean/i],
      ['media-encoding', (document) => {
        document.paths['/orders'].post.requestBody.content['multipart/form-data'] = {
          schema: { type: 'object', properties: { sku: { type: 'string' } } },
          encoding: { sku: { contentType: 'text/plain' } },
        }
      }, /media type encoding is unsupported/i],
      ['response-header', (document) => {
        document.paths['/orders/{id}'].get.responses[200].headers = {
          'X-Request-Id': { schema: { type: 'string' } },
        }
      }, /response headers are unsupported/i],
    ]

    for (const [name, mutate, error] of cases) {
      const actual = baseContract()
      mutate(actual)
      expect(() => compareContractFiles({
        expectedPath: writeJson(root, `${name}-expected.json`, baseContract()),
        actualPath: writeJson(root, `${name}-actual.json`, actual),
      }), name).toThrow(error)
    }
  })

  it('rejects empty contract source labels and versions', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'source-expected.json', baseContract())
    const actualPath = writeJson(root, 'source-actual.json', baseContract())

    expect(() => compareContractFiles({ expectedPath, actualPath, expectedLabel: ' ' }))
      .toThrow(/source label must not be empty/i)
    expect(() => compareContractFiles({ expectedPath, actualPath, actualVersion: '' }))
      .toThrow(/source version must not be empty/i)
  })

  it('applies readOnly and writeOnly fields only in their wire direction', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    expected.components.schemas.Order.required.push('secret')
    expected.components.schemas.Order.properties.secret = { type: 'string', writeOnly: true }
    expected.components.schemas.CreateOrder.allOf[0].required.push('serverId')
    expected.components.schemas.CreateOrder.allOf[0].properties.serverId = { type: 'string', readOnly: true }
    const actual = structuredClone(expected)
    actual.components.schemas.Order.required = actual.components.schemas.Order.required.filter((name: string) => name !== 'secret')
    delete actual.components.schemas.Order.properties.secret
    actual.components.schemas.CreateOrder.allOf[0].required
      = actual.components.schemas.CreateOrder.allOf[0].required.filter((name: string) => name !== 'serverId')
    delete actual.components.schemas.CreateOrder.allOf[0].properties.serverId

    expect(compareContractFiles({
      expectedPath: writeJson(root, 'direction-expected.json', expected),
      actualPath: writeJson(root, 'direction-actual.json', actual),
    }).status).toBe('pass')

    const incompatible = structuredClone(actual)
    incompatible.components.schemas.CreateOrder.allOf[0].required.push('serverId')
    incompatible.components.schemas.CreateOrder.allOf[0].properties.serverId = { type: 'string' }
    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'direction-expected-2.json', expected),
      actualPath: writeJson(root, 'direction-incompatible.json', incompatible),
    })
    expect(audit.gaps).toContainEqual(expect.objectContaining({
      kind: 'MISSING_IN_EXPECTED',
      severity: 'blocking',
      field_path: 'serverId',
    }))
  })

  it('resolves chained structural refs and rejects structural cycles and external refs', () => {
    const root = temporaryRoot()
    const expected = baseContract()
    expected.components.responses = {
      Alias: { $ref: '#/components/responses/Concrete' },
      Concrete: {
        description: 'ok',
        content: {
          'application/json': {
            schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
          },
        },
      },
    }
    expected.paths['/orders/{id}'].get.responses[200] = { $ref: '#/components/responses/Alias' }
    const actual = structuredClone(expected)
    actual.components.responses.Concrete.content['application/json'].schema.properties.id.type = 'integer'

    const audit = compareContractFiles({
      expectedPath: writeJson(root, 'response-chain-expected.json', expected),
      actualPath: writeJson(root, 'response-chain-actual.json', actual),
    })
    expect(audit.gaps).toContainEqual(expect.objectContaining({ kind: 'TYPE_MISMATCH', field_path: 'id' }))

    const cyclic = structuredClone(expected)
    cyclic.components.responses.Concrete = { $ref: '#/components/responses/Alias' }
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'response-cycle-expected.json', expected),
      actualPath: writeJson(root, 'response-cycle-actual.json', cyclic),
    })).toThrow(/cyclic object reference/i)

    const external = structuredClone(expected)
    external.paths['/orders/{id}'].get.responses[200] = { $ref: './responses.yaml#/Ok' }
    expect(() => compareContractFiles({
      expectedPath: writeJson(root, 'response-external-expected.json', expected),
      actualPath: writeJson(root, 'response-external-actual.json', external),
    })).toThrow(/external or non-pointer reference is unsupported/i)
  })

  it('writes audits without allowing an input contract to be overwritten', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'expected.json', baseContract())
    const actualPath = writeJson(root, 'actual.json', baseContract())
    const audit = compareContractFiles({ expectedPath, actualPath })
    const output = path.join(root, 'evidence', 'contract-diff.json')

    writeContractAudit(output, audit, [expectedPath, actualPath])
    writeContractAudit(output, audit, [expectedPath, actualPath])

    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
    expect(fs.readdirSync(path.dirname(output))).toEqual(['contract-diff.json'])
    const occupiedOutput = path.join(root, 'evidence', 'occupied.json')
    fs.writeFileSync(occupiedOutput, 'pre-existing evidence\n')
    expect(() => writeContractAudit(occupiedOutput, audit, [expectedPath, actualPath]))
      .toThrow(/already exists with different content; refusing to overwrite/i)
    expect(fs.readFileSync(occupiedOutput, 'utf8')).toBe('pre-existing evidence\n')
    expect(() => writeContractAudit(expectedPath, audit, [expectedPath, actualPath])).toThrow(/must not overwrite/i)
    if (process.platform === 'win32') {
      expect(() => writeContractAudit(path.join(root, 'EXPECTED.JSON'), audit, [expectedPath, actualPath])).toThrow(/must not overwrite/i)
    }

    const hardLink = path.join(root, 'expected-hard-link.json')
    fs.linkSync(expectedPath, hardLink)
    expect(() => writeContractAudit(hardLink, audit, [expectedPath, actualPath])).toThrow(/must not overwrite/i)

    const linkedDirectory = path.join(root, 'linked-contracts')
    fs.mkdirSync(linkedDirectory)
    const linkedExpected = writeJson(linkedDirectory, 'expected.json', baseContract())
    const directoryAlias = path.join(root, 'linked-contracts-alias')
    fs.symlinkSync(linkedDirectory, directoryAlias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(() => writeContractAudit(path.join(directoryAlias, 'expected.json'), audit, [linkedExpected])).toThrow(/must not overwrite/i)
    expect(fs.readFileSync(expectedPath, 'utf8')).toContain('"openapi"')
  })

  it('binds both current source contents to the SHA-256 identities recorded by comparison', () => {
    const root = temporaryRoot()
    for (const sourceName of ['expected', 'actual'] as const) {
      const expectedPath = writeJson(root, `${sourceName}-stale-expected.json`, baseContract())
      const actualPath = writeJson(root, `${sourceName}-stale-actual.json`, baseContract())
      const audit = compareContractFiles({ expectedPath, actualPath })
      const changedPath = sourceName === 'expected' ? expectedPath : actualPath
      fs.appendFileSync(changedPath, ' \n')
      const output = path.join(root, `${sourceName}-stale-evidence`, 'contract-diff.json')

      expect(() => writeContractAudit(output, audit, [expectedPath, actualPath]))
        .toThrow(new RegExp(`${sourceName} source content does not match audit\\.sources\\.${sourceName}\\.sha256`, 'i'))
      expect(fs.existsSync(path.dirname(output))).toBe(false)
    }

    const expectedPath = writeJson(root, 'missing-hash-expected.json', baseContract())
    const actualPath = writeJson(root, 'missing-hash-actual.json', baseContract())
    const audit = compareContractFiles({ expectedPath, actualPath })
    delete audit.sources.expected.sha256
    const output = path.join(root, 'missing-hash-evidence', 'contract-diff.json')
    expect(() => writeContractAudit(output, audit, [expectedPath, actualPath]))
      .toThrow(/expected source is missing audit\.sources\.expected\.sha256/i)
    expect(fs.existsSync(path.dirname(output))).toBe(false)
  })

  it('rechecks hashed sources inside the anchored commit child before publishing', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'input-race-expected.json', baseContract())
    const actualPath = writeJson(root, 'input-race-actual.json', baseContract())
    const replacement = baseContract()
    replacement.info.version = 'concurrent-replacement'
    const replacementPath = writeJson(root, 'input-race-replacement.json', replacement)
    const displacedPath = path.join(root, 'input-race-original.json')
    const marker = path.join(root, 'input-race-marker.json')
    const output = path.join(root, 'input-race-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'replace-source-on-load',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/expected source content does not match audit\.sources\.expected\.sha256/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    expect(fs.existsSync(output)).toBe(false)
  })

  it('rejects a same-content input replacement by exact child-side identity baseline', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'identity-race-expected.json', baseContract())
    const actualPath = writeJson(root, 'identity-race-actual.json', baseContract())
    const replacementPath = writeRaw(root, 'identity-race-replacement.json', fs.readFileSync(expectedPath, 'utf8'))
    const displacedPath = path.join(root, 'identity-race-original.json')
    const marker = path.join(root, 'identity-race-marker.json')
    const output = path.join(root, 'identity-race-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'replace-source-on-load',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    expect(fs.existsSync(output)).toBe(false)
  })

  it('refuses a target installed at the anchored exclusive-create entry point', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'target-race-expected.json', baseContract())
    const actualPath = writeJson(root, 'target-race-actual.json', baseContract())
    const output = path.join(root, 'target-race-evidence', 'contract-diff.json')
    const marker = path.join(root, 'target-race-marker.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'install-target',
      marker,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/target appeared at the exclusive create entry point/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ intercepted: true })
    expect(fs.readFileSync(output, 'utf8')).toBe('concurrent target\n')
    expect(fs.readdirSync(path.dirname(output))).toEqual(['contract-diff.json'])
  })

  it('refuses an identical target that appears after an absent target baseline', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'identical-target-expected.json', baseContract())
    const actualPath = writeJson(root, 'identical-target-actual.json', baseContract())
    const output = path.join(root, 'identical-target-evidence', 'contract-diff.json')
    const marker = path.join(root, 'identical-target-marker.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'install-identical-target',
      marker,
      targetContent: serializeContractAudit(audit),
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/target appeared at the exclusive create entry point/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ intercepted: true })
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('requires the exact existing target inode for idempotent reuse', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'existing-target-expected.json', baseContract())
    const actualPath = writeJson(root, 'existing-target-actual.json', baseContract())
    const output = path.join(root, 'existing-target-evidence', 'contract-diff.json')
    const marker = path.join(root, 'existing-target-marker.json')
    const displacedTargetPath = path.join(path.dirname(output), 'displaced-contract-diff.json')
    const replacementTargetPath = path.join(path.dirname(output), 'replacement-contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })
    writeContractAudit(output, audit, [expectedPath, actualPath])
    fs.writeFileSync(replacementTargetPath, serializeContractAudit(audit))

    expect(() => withCommitPreload(root, {
      action: 'replace-target-on-load',
      displacedTargetPath,
      marker,
      replacementTargetPath,
      targetName: path.basename(output),
      targetPath: output,
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/target changed after its baseline was captured/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('rejects an identical concurrent target that aliases any protected input inode', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'alias-race-expected.json', baseContract())
    const actualPath = writeJson(root, 'alias-race-actual.json', baseContract())
    const output = path.join(root, 'alias-race-evidence', 'contract-diff.json')
    const marker = path.join(root, 'alias-race-marker.json')
    const audit = compareContractFiles({ expectedPath, actualPath })
    const protectedPath = writeRaw(root, 'protected-audit-bytes.json', serializeContractAudit(audit))

    expect(() => withCommitPreload(root, {
      action: 'install-protected-link',
      marker,
      protectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath, protectedPath])))
      .toThrow(/must not overwrite or alias an input contract/i)

    const protectedStats = fs.statSync(protectedPath)
    const outputStats = fs.statSync(output)
    expect({ dev: outputStats.dev, ino: outputStats.ino }).toEqual({ dev: protectedStats.dev, ino: protectedStats.ino })
    expect(fs.readFileSync(protectedPath, 'utf8')).toBe(serializeContractAudit(audit))
  })

  it('leaves an invalid marked file when an input becomes an alias before semantic commit', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'staged-alias-expected.json', baseContract())
    const actualPath = writeJson(root, 'staged-alias-actual.json', baseContract())
    const displacedPath = path.join(root, 'staged-alias-original.json')
    const marker = path.join(root, 'staged-alias-marker.json')
    const output = path.join(root, 'staged-alias-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'replace-input-after-stage',
      aliasPath: actualPath,
      displacedSourcePath: displacedPath,
      marker,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit|expected source content does not match/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    const staged = fs.readFileSync(output, 'utf8')
    expect(staged.startsWith('!')).toBe(true)
    expect(() => JSON.parse(staged)).toThrow()
  })

  it('rolls the semantic marker back through the owned descriptor when an input is replaced at marker entry', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'marker-replace-expected.json', baseContract())
    const actualPath = writeJson(root, 'marker-replace-actual.json', baseContract())
    const displacedPath = path.join(root, 'marker-replace-original.json')
    const replacementPath = writeRaw(root, 'marker-replace-copy.json', fs.readFileSync(expectedPath, 'utf8'))
    const marker = path.join(root, 'marker-replace-marker.json')
    const output = path.join(root, 'marker-replace-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'replace-input-on-marker',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    const rolledBack = fs.readFileSync(output, 'utf8')
    expect(rolledBack.startsWith('!')).toBe(true)
    expect(() => JSON.parse(rolledBack)).toThrow()
  })

  it('rolls back every hardlink alias when the staged target replaces an input at marker entry', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'marker-alias-expected.json', baseContract())
    const actualPath = writeJson(root, 'marker-alias-actual.json', baseContract())
    const displacedPath = path.join(root, 'marker-alias-original.json')
    const marker = path.join(root, 'marker-alias-marker.json')
    const output = path.join(root, 'marker-alias-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'alias-input-on-marker',
      displacedSourcePath: displacedPath,
      marker,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit|expected source content does not match/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    const outputStats = fs.statSync(output)
    const aliasStats = fs.statSync(expectedPath)
    expect({ dev: outputStats.dev, ino: outputStats.ino }).toEqual({ dev: aliasStats.dev, ino: aliasStats.ino })
    for (const file of [output, expectedPath]) {
      const rolledBack = fs.readFileSync(file, 'utf8')
      expect(rolledBack.startsWith('!')).toBe(true)
      expect(() => JSON.parse(rolledBack)).toThrow()
    }
  })

  it('falls back to descriptor truncation when semantic marker rollback fsync cannot be confirmed', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'rollback-failure-expected.json', baseContract())
    const actualPath = writeJson(root, 'rollback-failure-actual.json', baseContract())
    const displacedPath = path.join(root, 'rollback-failure-original.json')
    const replacementPath = writeRaw(root, 'rollback-failure-copy.json', fs.readFileSync(expectedPath, 'utf8'))
    const marker = path.join(root, 'rollback-failure-marker.json')
    const output = path.join(root, 'rollback-failure-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'fail-marker-rollback',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit/i)
    expect(fs.statSync(output).size).toBe(0)
    expect(() => JSON.parse(fs.readFileSync(output, 'utf8'))).toThrow()
  })

  it('invalidates an ambiguously written semantic marker before reporting failure', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'ambiguous-marker-expected.json', baseContract())
    const actualPath = writeJson(root, 'ambiguous-marker-actual.json', baseContract())
    const marker = path.join(root, 'ambiguous-marker.json')
    const output = path.join(root, 'ambiguous-marker-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'throw-after-marker-write',
      marker,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/ambiguous semantic marker write failure/iu)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ written: true })
    expect(fs.readFileSync(output, 'utf8').startsWith('!')).toBe(true)
    expect(() => JSON.parse(fs.readFileSync(output, 'utf8'))).toThrow()
  })

  it('falls back to descriptor truncation when the semantic marker rollback write fails once', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'rollback-write-expected.json', baseContract())
    const actualPath = writeJson(root, 'rollback-write-actual.json', baseContract())
    const displacedPath = path.join(root, 'rollback-write-original.json')
    const replacementPath = writeRaw(root, 'rollback-write-copy.json', fs.readFileSync(expectedPath, 'utf8'))
    const marker = path.join(root, 'rollback-write-marker.json')
    const output = path.join(root, 'rollback-write-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'fail-marker-rollback-write',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit/i)
    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    expect(fs.statSync(output).size).toBe(0)
    expect(() => JSON.parse(fs.readFileSync(output, 'utf8'))).toThrow()
  })

  it('reports when neither descriptor-only semantic invalidation strategy can be guaranteed', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'invalidation-failure-expected.json', baseContract())
    const actualPath = writeJson(root, 'invalidation-failure-actual.json', baseContract())
    const displacedPath = path.join(root, 'invalidation-failure-original.json')
    const replacementPath = writeRaw(root, 'invalidation-failure-copy.json', fs.readFileSync(expectedPath, 'utf8'))
    const marker = path.join(root, 'invalidation-failure-marker.json')
    const output = path.join(root, 'invalidation-failure-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'fail-marker-invalidation',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/semantic invalidation could not be guaranteed.*rollback write failure.*truncation failure/iu)
  })

  it('never rolls back an invalid marked file after a staged-write failure', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'partial-expected.json', baseContract())
    const actualPath = writeJson(root, 'partial-actual.json', baseContract())
    const marker = path.join(root, 'partial-marker.json')
    const output = path.join(root, 'partial-evidence', 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'fail-after-staged-fsync',
      marker,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/injected failure after staged audit fsync/i)

    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ failed: true })
    const partial = fs.readFileSync(output, 'utf8')
    expect(partial.startsWith('!')).toBe(true)
    expect(() => JSON.parse(partial)).toThrow()
    expect(() => writeContractAudit(output, audit, [expectedPath, actualPath]))
      .toThrow(/already exists with different content/i)

    fs.unlinkSync(output)
    writeContractAudit(output, audit, [expectedPath, actualPath])
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('never rolls back a target replaced immediately after direct creation', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'target-replace-expected.json', baseContract())
    const actualPath = writeJson(root, 'target-replace-actual.json', baseContract())
    const output = path.join(root, 'target-replace-evidence', 'contract-diff.json')
    const displacedName = 'committed-before-concurrent-replacement.json'
    const marker = path.join(root, 'target-replace-marker.json')
    const audit = compareContractFiles({ expectedPath, actualPath })

    expect(() => withCommitPreload(root, {
      action: 'replace-target-after-open',
      displacedName,
      marker,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/output target changed before semantic commit/i)

    expect(fs.readFileSync(output, 'utf8')).toBe('concurrent target\n')
    expect(fs.readFileSync(path.join(path.dirname(output), displacedName), 'utf8').startsWith('!')).toBe(true)
  })

  it('anchors direct creation when the named output ancestor is swapped at commit entry', () => {
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'link-junction-expected.json', baseContract())
    const actualPath = writeJson(root, 'link-junction-actual.json', baseContract())
    const outputDirectory = path.join(root, 'link-junction-evidence')
    const displacedDirectory = path.join(root, 'link-junction-evidence-original')
    const attackerDirectory = path.join(root, 'link-junction-attacker')
    const marker = path.join(root, 'link-junction-marker.json')
    fs.mkdirSync(attackerDirectory)
    const output = path.join(outputDirectory, 'contract-diff.json')
    const audit = compareContractFiles({ expectedPath, actualPath })
    let writeError: unknown

    try {
      withCommitPreload(root, {
        action: 'swap-output-ancestor',
        attackerDirectory,
        displacedDirectory,
        marker,
        outputDirectory,
        targetName: path.basename(output),
      }, () => writeContractAudit(output, audit, [expectedPath, actualPath]))
    }
    catch (error) {
      writeError = error
    }
    finally {
      if (fs.existsSync(displacedDirectory)) {
        if (fs.existsSync(outputDirectory)) {
          try {
            fs.unlinkSync(outputDirectory)
          }
          catch {
            fs.rmdirSync(outputDirectory)
          }
        }
        fs.renameSync(displacedDirectory, outputDirectory)
      }
    }

    const outcome = JSON.parse(fs.readFileSync(marker, 'utf8'))
    expect(outcome).toMatchObject({ action: 'swap-output-ancestor', intercepted: true })
    if (outcome.switched === true) {
      expect(writeError).toMatchObject({ message: expect.stringMatching(/output directory changed/i) })
    }
    else {
      expect(writeError).toBeUndefined()
      expect(outcome.errorCode).toBeTruthy()
    }
    expect(fs.existsSync(path.join(attackerDirectory, 'contract-diff.json'))).toBe(false)
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('keeps the bytes that caused a parse error even if the source is replaced before audit creation', () => {
    const root = temporaryRoot()
    const invalidBytes = 'openapi: [\n'
    const expectedPath = writeRaw(root, 'provenance-invalid.yaml', invalidBytes)
    const actualPath = writeJson(root, 'provenance-actual.json', baseContract())
    let comparisonError: unknown
    try {
      compareContractFiles({ expectedPath, actualPath })
    }
    catch (error) {
      comparisonError = error
    }
    expect(comparisonError).toBeInstanceOf(Error)

    fs.writeFileSync(expectedPath, `${JSON.stringify(baseContract(), null, 2)}\n`)
    const audit = createContractErrorAudit({ expectedPath, actualPath }, comparisonError)
    expect(audit.sources.expected.sha256).toBe(createHash('sha256').update(invalidBytes).digest('hex'))
    expect(audit.sources.actual.sha256).toBe(createHash('sha256').update(fs.readFileSync(actualPath)).digest('hex'))
    const output = path.join(root, 'provenance-evidence', 'audit.json')
    expect(() => writeContractAudit(output, audit, [expectedPath, actualPath]))
      .toThrow(/expected source content does not match audit\.sources\.expected\.sha256/i)
    expect(fs.existsSync(path.dirname(output))).toBe(false)
  })

  it('binds both parsed source snapshots when normalization fails', () => {
    const root = temporaryRoot()
    const unsupportedExpected = baseContract()
    unsupportedExpected.security = []
    const expectedPath = writeJson(root, 'normalize-provenance-expected.json', unsupportedExpected)
    const actualPath = writeJson(root, 'normalize-provenance-actual.json', baseContract())
    const expectedSha256 = createHash('sha256').update(fs.readFileSync(expectedPath)).digest('hex')
    const actualSha256 = createHash('sha256').update(fs.readFileSync(actualPath)).digest('hex')
    let normalizationError: unknown
    try {
      compareContractFiles({ expectedPath, actualPath })
    }
    catch (error) {
      normalizationError = error
    }
    expect(normalizationError).toBeInstanceOf(Error)

    fs.writeFileSync(expectedPath, `${JSON.stringify(baseContract(), null, 2)}\n`)
    fs.writeFileSync(actualPath, `${JSON.stringify({ ...baseContract(), info: { title: 'Changed', version: '2' } }, null, 2)}\n`)
    const audit = createContractErrorAudit({ expectedPath, actualPath }, normalizationError)
    expect(audit.sources).toMatchObject({
      expected: { sha256: expectedSha256, openapi: '3.1.0' },
      actual: { sha256: actualSha256, openapi: '3.1.0' },
    })
  })

  it('writes a structured error audit for a directory source without opening it as contract bytes', () => {
    const root = temporaryRoot()
    const expectedPath = path.join(root, 'directory-expected')
    fs.mkdirSync(expectedPath)
    const actualPath = writeJson(root, 'directory-actual.json', baseContract())
    let comparisonError: unknown
    try {
      compareContractFiles({ expectedPath, actualPath })
    }
    catch (error) {
      comparisonError = error
    }
    const audit = createContractErrorAudit({ expectedPath, actualPath }, comparisonError)
    expect(audit.sources.expected.sha256).toBeUndefined()
    expect(audit.sources.actual.sha256).toBe(createHash('sha256').update(fs.readFileSync(actualPath)).digest('hex'))
    const output = path.join(root, 'directory-error-evidence', 'audit.json')
    writeContractAudit(output, audit, [expectedPath, actualPath])
    expectValidAudit(JSON.parse(fs.readFileSync(output, 'utf8')))
  })

  it('writes a structured error audit for a dangling link while protecting the link inode', () => {
    const root = temporaryRoot()
    const missingTarget = path.join(root, 'missing-contract.json')
    const expectedPath = path.join(root, 'dangling-expected.json')
    try {
      fs.symlinkSync(
        path.basename(missingTarget),
        expectedPath,
        process.platform === 'win32' ? 'file' : undefined,
      )
    }
    catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : ''
      if (process.platform !== 'win32' || (code !== 'EACCES' && code !== 'EPERM'))
        throw error
      try {
        fs.symlinkSync(missingTarget, expectedPath, 'junction')
      }
      catch (junctionError) {
        const junctionCode = junctionError !== null && typeof junctionError === 'object' && 'code' in junctionError
          ? String(junctionError.code)
          : ''
        if (junctionCode === 'EACCES' || junctionCode === 'EPERM')
          return
        throw junctionError
      }
    }
    const actualPath = writeJson(root, 'dangling-actual.json', baseContract())
    let comparisonError: unknown
    try {
      compareContractFiles({ expectedPath, actualPath })
    }
    catch (error) {
      comparisonError = error
    }
    expect(comparisonError).toBeInstanceOf(Error)

    const audit = createContractErrorAudit({ expectedPath, actualPath }, comparisonError)
    expect(audit.sources.expected.sha256).toBeUndefined()
    expect(audit.sources.actual.sha256).toBe(createHash('sha256').update(fs.readFileSync(actualPath)).digest('hex'))
    const output = path.join(root, 'dangling-error-evidence', 'audit.json')
    writeContractAudit(output, audit, [expectedPath, actualPath])
    expectValidAudit(JSON.parse(fs.readFileSync(output, 'utf8')))

    expect(() => writeContractAudit(expectedPath, audit, [expectedPath, actualPath]))
      .toThrow(/must not overwrite/i)

    const aliasPath = path.join(root, 'dangling-expected-alias.json')
    try {
      fs.linkSync(expectedPath, aliasPath)
    }
    catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : ''
      if (process.platform === 'win32' && ['EACCES', 'ENOENT', 'EPERM'].includes(code))
        return
      throw error
    }
    expect(() => writeContractAudit(aliasPath, audit, [expectedPath, actualPath]))
      .toThrow(/must not overwrite/i)
  })

  it('never opens a FIFO while capturing an identity-only error source', () => {
    if (process.platform === 'win32')
      return
    const root = temporaryRoot()
    const expectedPath = path.join(root, 'fifo-expected')
    const created = spawnSync('mkfifo', [expectedPath], { encoding: 'utf8' })
    if (created.error || created.status !== 0)
      return
    const actualPath = writeJson(root, 'fifo-actual.json', baseContract())
    let comparisonError: unknown
    try {
      compareContractFiles({ expectedPath, actualPath })
    }
    catch (error) {
      comparisonError = error
    }
    const audit = createContractErrorAudit({ expectedPath, actualPath }, comparisonError)
    expect(audit.sources.expected.sha256).toBeUndefined()
    const output = path.join(root, 'fifo-evidence', 'audit.json')
    writeContractAudit(output, audit, [expectedPath, actualPath])
    expectValidAudit(JSON.parse(fs.readFileSync(output, 'utf8')))
  })

  it('fails closed when an identity-only directory input drifts inside the anchored writer', () => {
    const root = temporaryRoot()
    const expectedPath = path.join(root, 'identity-only-directory')
    const replacementPath = path.join(root, 'identity-only-directory-replacement')
    const displacedPath = path.join(root, 'identity-only-directory-original')
    fs.mkdirSync(expectedPath)
    fs.mkdirSync(replacementPath)
    const actualPath = writeJson(root, 'identity-only-actual.json', baseContract())
    const marker = path.join(root, 'identity-only-marker.json')
    const output = path.join(root, 'identity-only-evidence', 'audit.json')
    const audit = createContractErrorAudit({ expectedPath, actualPath }, new Error('directory input'))

    expect(() => withCommitPreload(root, {
      action: 'replace-source-on-load',
      displacedSourcePath: displacedPath,
      marker,
      replacementSourcePath: replacementPath,
      sourcePath: expectedPath,
      targetName: path.basename(output),
    }, () => writeContractAudit(output, audit, [expectedPath, actualPath])))
      .toThrow(/input contract changed before audit commit/i)
    expect(JSON.parse(fs.readFileSync(marker, 'utf8'))).toMatchObject({ replaced: true })
    expect(fs.existsSync(output)).toBe(false)
  })

  it('returns a CLI error audit for a directory source with an independent output', () => {
    const root = temporaryRoot()
    const expectedPath = path.join(root, 'cli-directory-expected')
    fs.mkdirSync(expectedPath)
    const actualPath = writeJson(root, 'cli-directory-actual.json', baseContract())
    const output = path.join(root, 'cli-directory-evidence', 'audit.json')
    const repoRoot = path.resolve()
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.join(repoRoot, 'scripts', 'cli.ts'),
      'contract-diff',
      '--expected',
      expectedPath,
      '--actual',
      actualPath,
      '--output',
      output,
    ], { cwd: repoRoot, encoding: 'utf8' })

    expect(result.status).toBe(1)
    expect(result.stderr).toBe('')
    const audit = JSON.parse(result.stdout)
    expect(audit).toMatchObject({ status: 'error', errors: [{ code: 'CONTRACT_INPUT_ERROR' }] })
    expect(audit.sources.expected.sha256).toBeUndefined()
    expectValidAudit(audit)
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(audit)
  })

  it('rejects a Windows alternate-data-stream output before creating or opening it', () => {
    if (process.platform !== 'win32')
      return
    const root = temporaryRoot()
    const expectedPath = writeJson(root, 'ads-expected.json', baseContract())
    const actualPath = writeJson(root, 'ads-actual.json', baseContract())
    const originalExpected = fs.readFileSync(expectedPath)
    const audit = compareContractFiles({ expectedPath, actualPath })
    const output = `${expectedPath}:audit`

    expect(() => writeContractAudit(output, audit, [expectedPath, actualPath])).toThrow(/unsafe on Windows/i)
    expect(fs.readFileSync(expectedPath)).toEqual(originalExpected)
    expect(fs.existsSync(output)).toBe(false)
  })

  it('fails closed when a readable error source changes during hash capture', () => {
    const root = temporaryRoot()
    const expectedPath = writeRaw(root, 'error-race-expected.yaml', 'openapi: [\n')
    const actualPath = writeRaw(root, 'error-race-actual.yaml', 'openapi: 3.1.0\n')
    const replacementPath = writeRaw(root, 'error-race-replacement.yaml', 'openapi: 3.0.3\n')
    const displacedPath = path.join(root, 'error-race-original.yaml')
    const originalOpen = fs.openSync.bind(fs)
    let replaced = false
    vi.spyOn(fs, 'openSync').mockImplementation((filePath, flags, mode) => {
      if (!replaced && path.resolve(String(filePath)) === expectedPath) {
        replaced = true
        fs.renameSync(expectedPath, displacedPath)
        fs.renameSync(replacementPath, expectedPath)
      }
      return originalOpen(filePath, flags, mode)
    })

    expect(() => createContractErrorAudit({ expectedPath, actualPath }, new Error('invalid input')))
      .toThrow(/error audit source .* changed while its identity was captured/i)
  })

  it('omits a hash only for a stably unreadable error source', () => {
    const root = temporaryRoot()
    const expectedPath = writeRaw(root, 'unreadable-error-source.yaml', 'openapi: [\n')
    const missingActual = path.join(root, 'missing-error-source.yaml')
    const originalOpen = fs.openSync.bind(fs)
    vi.spyOn(fs, 'openSync').mockImplementation((filePath, flags, mode) => {
      if (path.resolve(String(filePath)) === expectedPath) {
        throw Object.assign(new Error('access denied'), { code: 'EACCES' })
      }
      return originalOpen(filePath, flags, mode)
    })

    const audit = createContractErrorAudit({ expectedPath, actualPath: missingActual }, new Error('invalid input'))
    expect(audit.sources.expected.sha256).toBeUndefined()
    expect(audit.sources.actual.sha256).toBeUndefined()
  })

  it('hashes stable readable error sources while omitting unavailable source hashes', () => {
    const root = temporaryRoot()
    const missingExpected = path.join(root, 'missing-expected.yaml')
    const missingActual = path.join(root, 'missing-actual.yaml')
    const audit = createContractErrorAudit({
      expectedPath: missingExpected,
      actualPath: missingActual,
      expectedLabel: 'provider',
    }, new Error('unsupported input'))

    expect(audit).toMatchObject({
      status: 'error',
      sources: { expected: { label: 'provider' }, actual: { label: 'actual' } },
      summary: { total: 0, blocking: 0, warnings: 0 },
      gaps: [],
      errors: [{ code: 'CONTRACT_INPUT_ERROR', message: 'unsupported input' }],
    })
    expect(audit.sources.expected.sha256).toBeUndefined()

    const readableExpected = writeRaw(root, 'readable-invalid-expected.yaml', 'openapi: [\n')
    const readableActual = writeRaw(root, 'readable-invalid-actual.json', '{"asyncapi":"3.0.0"}\n')
    const readableAudit = createContractErrorAudit({
      expectedPath: readableExpected,
      actualPath: readableActual,
    }, new Error('invalid readable inputs'))
    expect(readableAudit.sources.expected.sha256)
      .toBe(createHash('sha256').update(fs.readFileSync(readableExpected)).digest('hex'))
    expect(readableAudit.sources.actual.sha256)
      .toBe(createHash('sha256').update(fs.readFileSync(readableActual)).digest('hex'))
    const readableOutput = path.join(root, 'readable-error-evidence', 'audit.json')
    writeContractAudit(readableOutput, readableAudit, [readableExpected, readableActual])
    expect(JSON.parse(fs.readFileSync(readableOutput, 'utf8'))).toEqual(readableAudit)

    const staleReadableAudit = createContractErrorAudit({
      expectedPath: readableExpected,
      actualPath: readableActual,
    }, new Error('stale readable input'))
    fs.appendFileSync(readableActual, ' ')
    const staleOutput = path.join(root, 'stale-readable-error-evidence', 'audit.json')
    expect(() => writeContractAudit(staleOutput, staleReadableAudit, [readableExpected, readableActual]))
      .toThrow(/actual source content does not match audit\.sources\.actual\.sha256/i)
    expect(fs.existsSync(path.dirname(staleOutput))).toBe(false)

    const stringError = createContractErrorAudit({
      expectedPath: missingExpected,
      actualPath: missingActual,
      expectedVersion: 'expected@1',
      actualVersion: 'actual@2',
    }, 'plain failure')
    expect(stringError.sources).toMatchObject({
      expected: { label: 'expected', version: 'expected@1' },
      actual: { label: 'actual', version: 'actual@2' },
    })
    expect(stringError.errors[0].message).toBe('plain failure')

    const sanitizedError = createContractErrorAudit({
      expectedPath: missingExpected,
      actualPath: missingActual,
      expectedLabel: ' ',
      actualLabel: '',
      expectedVersion: '',
    }, '')
    expect(sanitizedError.sources.expected).toMatchObject({ label: 'expected' })
    expect(sanitizedError.sources.actual).toMatchObject({ label: 'actual' })
    expect(sanitizedError.sources.expected.version).toBeUndefined()
    expect(sanitizedError.errors[0].message).toBe('Unknown contract input error')
    expectValidAudit(sanitizedError)
  })
})
