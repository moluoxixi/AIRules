import type { BigIntStats } from 'node:fs'
import { Buffer } from 'node:buffer'
import childProcess from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseDocument } from 'yaml'

type JsonRecord = Record<string, unknown>

export type ContractAuditStatus = 'pass' | 'fail' | 'error'
export type ContractGapSeverity = 'blocking' | 'warning'
export type ContractGapKind
  = | 'MISSING_IN_ACTUAL'
    | 'MISSING_IN_EXPECTED'
    | 'TYPE_MISMATCH'
    | 'FORMAT_MISMATCH'
    | 'REQUIREDNESS_MISMATCH'
    | 'NULLABILITY_MISMATCH'
    | 'ENUM_MISMATCH'
    | 'ADDITIONAL_PROPERTIES_MISMATCH'
    | 'ACCESS_MISMATCH'
    | 'STYLE_MISMATCH'
    | 'EXPLODE_MISMATCH'
    | 'ALLOW_RESERVED_MISMATCH'

export type ContractSubject
  = | 'operation'
    | 'parameter'
    | 'request_body'
    | 'media_type'
    | 'response'
    | 'field'

export interface ContractSource {
  label: string
  path: string
  version?: string
  sha256?: string
  openapi?: string
}

export interface ContractValue {
  document_pointer?: string
  type?: string
  format?: string
  required?: boolean
  nullable?: boolean
  enum?: unknown[]
  additional_properties?: boolean | 'schema'
  access?: 'read-only' | 'write-only'
  style?: string
  explode?: boolean
  allow_reserved?: boolean
}

export interface ContractGap {
  id: string
  severity: ContractGapSeverity
  kind: ContractGapKind
  subject: ContractSubject
  method: string
  path: string
  parameter_in?: string
  status_code?: string
  media_type?: string
  field_path?: string
  expected: ContractValue | null
  actual: ContractValue | null
}

export interface ContractAuditError {
  code: 'CONTRACT_INPUT_ERROR'
  message: string
}

export interface ContractAudit {
  schema_version: 1
  tool: {
    name: 'airules-contract-diff'
    report_version: 1
  }
  status: ContractAuditStatus
  sources: {
    expected: ContractSource
    actual: ContractSource
  }
  summary: {
    total: number
    blocking: number
    warnings: number
    by_kind: Partial<Record<ContractGapKind, number>>
  }
  gaps: ContractGap[]
  errors: ContractAuditError[]
}

export interface CompareContractFilesOptions {
  expectedPath: string
  actualPath: string
  expectedLabel?: string
  actualLabel?: string
  expectedVersion?: string
  actualVersion?: string
}

interface ParsedContract {
  document: JsonRecord
  source: ContractSource
}

type AuditSourceName = keyof ContractAudit['sources']

const CONTRACT_ERROR_SOURCES = Symbol('airules.contract-error-sources')

interface ContractErrorWithSources extends Error {
  [CONTRACT_ERROR_SOURCES]?: Partial<Record<AuditSourceName, ContractSource>>
}

function attachContractErrorSources(
  error: unknown,
  sources: Partial<Record<AuditSourceName, ContractSource>>,
): ContractErrorWithSources {
  const failure = error instanceof Error ? error as ContractErrorWithSources : new Error(String(error)) as ContractErrorWithSources
  failure[CONTRACT_ERROR_SOURCES] = {
    ...(failure[CONTRACT_ERROR_SOURCES] ?? {}),
    ...sources,
  }
  return failure
}

function contractErrorSources(error: unknown): Partial<Record<AuditSourceName, ContractSource>> {
  return error instanceof Error
    ? (error as ContractErrorWithSources)[CONTRACT_ERROR_SOURCES] ?? {}
    : {}
}

interface NormalizedElement {
  key: string
  subject: ContractSubject
  method: string
  path: string
  parameterIn?: string
  statusCode?: string
  mediaType?: string
  fieldPath?: string
  parameterName?: string
  documentPointer: string
  direction?: 'request' | 'response'
  type?: string
  format?: string
  required?: boolean
  nullable?: boolean
  enum?: unknown[]
  additionalProperties?: boolean | 'schema'
  access?: 'read-only' | 'write-only'
  style?: string
  explode?: boolean
  allowReserved?: boolean
}

interface SchemaLayer {
  schema: JsonRecord
  pointer: string
}

interface ResolvedSchema {
  schema: JsonRecord
  pointer: string
  ref?: string
  overlays: SchemaLayer[]
}

const HTTP_METHODS = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace'] as const
const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  '$comment',
  '$defs',
  '$ref',
  'additionalProperties',
  'allOf',
  'const',
  'default',
  'deprecated',
  'description',
  'enum',
  'example',
  'examples',
  'externalDocs',
  'format',
  'items',
  'nullable',
  'properties',
  'readOnly',
  'required',
  'title',
  'type',
  'writeOnly',
  'definitions',
])

const JSON_TYPES = new Set(['array', 'boolean', 'integer', 'null', 'number', 'object', 'string'])
const OPENAPI_PATH_PATTERN = /^\/[^\s?#]*$/u
const OPENAPI_RESPONSE_KEY_PATTERN = /^(?:[1-5](?:\d{2}|XX)|default)$/u
const CONCRETE_MEDIA_TOKEN_PATTERN = /^[!#$%&'+.^`|~\w-]+$/u

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value: unknown, description: string): JsonRecord {
  if (!isRecord(value)) {
    throw new TypeError(`${description} must be an object`)
  }
  return value
}

function escapePointer(value: string): string {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1')
}

function isValidOpenApiPath(value: string): boolean {
  if (!OPENAPI_PATH_PATTERN.test(value)) {
    return false
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit <= 0x1F || codeUnit === 0x7F) {
      return false
    }
  }
  return true
}

function normalizeMediaType(value: string, pointer: string): string {
  const parts = value.split('/')
  if (parts.length !== 2) {
    throw new Error(`Invalid media type ${JSON.stringify(value)} at ${pointer}`)
  }
  const [type, subtype] = parts
  const valid = (type === '*' && subtype === '*')
    || (CONCRETE_MEDIA_TOKEN_PATTERN.test(type)
      && (subtype === '*' || CONCRETE_MEDIA_TOKEN_PATTERN.test(subtype)))
  if (!valid) {
    throw new Error(`Invalid media type ${JSON.stringify(value)} at ${pointer}`)
  }
  return `${type.toLowerCase()}/${subtype.toLowerCase()}`
}

function rejectUnsupportedWireSemantics(record: JsonRecord, pointer: string): void {
  for (const keyword of ['servers', 'security'] as const) {
    if (record[keyword] !== undefined) {
      throw new Error(`Unsupported OpenAPI ${keyword} at ${pointer}/${keyword}`)
    }
  }
}

function decodePointer(value: string): string {
  if (/~(?![01])/u.test(value)) {
    throw new Error(`Invalid JSON Pointer escape: ${value}`)
  }
  return value.replace(/~1/gu, '/').replace(/~0/gu, '~')
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

function sortedEnum(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return [...value].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)))
  }
  return undefined
}

function parseContract(filePath: string, label: string, version: string | undefined, sourceName: AuditSourceName): ParsedContract {
  if (label.trim() === '') {
    throw new Error('Contract source label must not be empty')
  }
  if (version !== undefined && version.trim() === '') {
    throw new Error('Contract source version must not be empty')
  }
  const resolvedPath = path.resolve(filePath)
  const initialTarget = fs.statSync(resolvedPath, { bigint: true })
  if (!initialTarget.isFile()) {
    throw new Error(`Contract source ${resolvedPath} must resolve to a regular file`)
  }
  const descriptor = fs.openSync(resolvedPath, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK)
  let rawBytes: Buffer
  try {
    const before = fs.fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) {
      throw new Error(`Contract source ${resolvedPath} must resolve to a regular file`)
    }
    rawBytes = fs.readFileSync(descriptor)
    const after = fs.fstatSync(descriptor, { bigint: true })
    if (!sameOpenFileState(before, after, `contract source ${resolvedPath}`)) {
      throw new Error(`Contract source ${resolvedPath} changed while it was read`)
    }
  }
  finally {
    fs.closeSync(descriptor)
  }
  const source: ContractSource = {
    label,
    path: resolvedPath,
    ...(version === undefined ? {} : { version }),
    sha256: sha256(rawBytes),
  }
  const rawContent = rawBytes.toString('utf8')
  const content = rawContent.replace(/^\uFEFF/u, '')
  try {
    const parsed = parseDocument(content, {
      merge: false,
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    })
    if (parsed.errors.length > 0) {
      throw new Error(`Invalid contract document ${resolvedPath}: ${parsed.errors.map(error => error.message).join('; ')}`)
    }
    const document = requireRecord(parsed.toJS({ maxAliasCount: 100 }), `Contract document ${resolvedPath}`)
    const openapi = document.openapi
    if (typeof openapi !== 'string' || !/^3\.\d+\.\d+(?:[-+].*)?$/u.test(openapi)) {
      throw new Error(`Unsupported contract document ${resolvedPath}: expected OpenAPI 3.x`)
    }
    requireRecord(document.paths, `OpenAPI paths in ${resolvedPath}`)
    if (isRecord(document.webhooks) && Object.keys(document.webhooks).length > 0) {
      throw new Error(`Unsupported OpenAPI webhooks in ${resolvedPath}`)
    }
    return {
      document,
      source: { ...source, openapi },
    }
  }
  catch (error) {
    throw attachContractErrorSources(error, { [sourceName]: source })
  }
}

function resolveLocalReference(document: JsonRecord, reference: string): { value: JsonRecord, pointer: string } {
  if (!reference.startsWith('#')) {
    throw new Error(`External or non-pointer reference is unsupported: ${reference}`)
  }

  let pointer: string
  try {
    pointer = decodeURIComponent(reference.slice(1))
  }
  catch {
    throw new Error(`Invalid URI encoding in local reference: ${reference}`)
  }
  if (!pointer.startsWith('/')) {
    throw new Error(`External or non-pointer reference is unsupported: ${reference}`)
  }

  let current: unknown = document
  for (const rawPart of pointer.slice(1).split('/')) {
    const part = decodePointer(rawPart)
    if (!isRecord(current) && !Array.isArray(current)) {
      throw new Error(`Unresolved local reference: ${reference}`)
    }
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/u.test(part)) {
        throw new Error(`Invalid array index in local reference: ${reference}`)
      }
      const index = Number(part)
      if (!Number.isSafeInteger(index) || index >= current.length) {
        throw new Error(`Unresolved local reference: ${reference}`)
      }
      current = current[index]
    }
    else {
      if (!Object.hasOwn(current, part)) {
        throw new Error(`Unresolved local reference: ${reference}`)
      }
      current = current[part]
    }
    if (current === undefined) {
      throw new Error(`Unresolved local reference: ${reference}`)
    }
  }

  return {
    value: requireRecord(current, `Referenced value ${reference}`),
    pointer: reference,
  }
}

function supportsSchemaReferenceSiblings(document: JsonRecord): boolean {
  const [, minor = '0'] = String(document.openapi).split('.')
  return Number(minor) >= 1
}

function resolveSchema(document: JsonRecord, value: unknown, pointer: string): ResolvedSchema {
  let schema = requireRecord(value, `Schema at ${pointer}`)
  let resolvedPointer = pointer
  let firstReference: string | undefined
  const references = new Set<string>()
  const overlays: SchemaLayer[] = []
  while (schema.$ref !== undefined) {
    if (typeof schema.$ref !== 'string') {
      throw new TypeError(`Schema $ref at ${resolvedPointer} must be a string`)
    }
    const reference = schema.$ref
    const siblingEntries = Object.entries(schema).filter(([key]) => key !== '$ref')
    if (siblingEntries.length > 0) {
      if (!supportsSchemaReferenceSiblings(document)) {
        throw new Error(`Schema $ref siblings are unsupported before OpenAPI 3.1 at ${resolvedPointer}: ${siblingEntries.map(([key]) => key).join(', ')}`)
      }
      overlays.push({ schema: Object.fromEntries(siblingEntries), pointer: resolvedPointer })
    }
    if (references.has(reference)) {
      throw new Error(`Cyclic schema aliases do not resolve to a concrete schema: ${reference}`)
    }
    references.add(reference)
    firstReference ??= reference
    const resolved = resolveLocalReference(document, reference)
    schema = resolved.value
    resolvedPointer = resolved.pointer
  }
  return {
    schema,
    pointer: resolvedPointer,
    ...(firstReference === undefined ? {} : { ref: firstReference }),
    overlays,
  }
}

function validateSchemaShape(document: JsonRecord, schema: JsonRecord, pointer: string): void {
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(keyword)) {
      throw new Error(`Unsupported schema keyword "${keyword}" at ${pointer}`)
    }
  }

  if (schema.type !== undefined) {
    if (typeof schema.type === 'string') {
      if (!JSON_TYPES.has(schema.type)) {
        throw new TypeError(`Schema type at ${pointer} is invalid: ${schema.type}`)
      }
    }
    else if (Array.isArray(schema.type) && supportsSchemaReferenceSiblings(document)) {
      if (schema.type.length === 0 || schema.type.some(type => typeof type !== 'string' || !JSON_TYPES.has(type))) {
        throw new TypeError(`Schema type array at ${pointer} is invalid`)
      }
      if (new Set(schema.type).size !== schema.type.length) {
        throw new TypeError(`Schema type array at ${pointer} contains duplicates`)
      }
    }
    else {
      throw new TypeError(`Schema type at ${pointer} must be a string${supportsSchemaReferenceSiblings(document) ? ' or string array' : ''}`)
    }
  }
  if (schema.format !== undefined && typeof schema.format !== 'string') {
    throw new TypeError(`Schema format at ${pointer} must be a string`)
  }
  if (schema.nullable !== undefined && typeof schema.nullable !== 'boolean') {
    throw new TypeError(`Schema nullable at ${pointer} must be a boolean`)
  }
  if (schema.readOnly !== undefined && typeof schema.readOnly !== 'boolean') {
    throw new TypeError(`Schema readOnly at ${pointer} must be a boolean`)
  }
  if (schema.writeOnly !== undefined && typeof schema.writeOnly !== 'boolean') {
    throw new TypeError(`Schema writeOnly at ${pointer} must be a boolean`)
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || schema.enum.length === 0)) {
    throw new TypeError(`Schema enum at ${pointer} must be a non-empty array`)
  }
  if (schema.allOf !== undefined && (!Array.isArray(schema.allOf) || schema.allOf.length === 0)) {
    throw new TypeError(`Schema allOf at ${pointer} must be a non-empty array`)
  }
  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    throw new TypeError(`Schema required at ${pointer} must be an array`)
  }
  if (schema.properties !== undefined && !isRecord(schema.properties)) {
    throw new TypeError(`Schema properties at ${pointer} must be an object`)
  }
  if (schema.items !== undefined && !isRecord(schema.items)) {
    throw new TypeError(`Schema items at ${pointer} must be an object`)
  }
  if (schema.additionalProperties !== undefined
    && typeof schema.additionalProperties !== 'boolean'
    && !isRecord(schema.additionalProperties)) {
    throw new TypeError(`Schema additionalProperties at ${pointer} must be a boolean or object`)
  }
}

function requiredPropertyNames(schema: JsonRecord, pointer: string): Set<string> {
  if (schema.required === undefined) {
    return new Set()
  }
  if (!Array.isArray(schema.required) || schema.required.some(name => typeof name !== 'string')) {
    throw new TypeError(`Schema required at ${pointer} must contain only strings`)
  }
  const names = schema.required as string[]
  if (new Set(names).size !== names.length) {
    throw new TypeError(`Schema required at ${pointer} contains duplicates`)
  }
  return new Set(names)
}

function inferType(schema: JsonRecord): string | undefined {
  if (typeof schema.type === 'string') {
    return schema.type
  }
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter(entry => typeof entry === 'string' && entry !== 'null').sort()
    return types.length > 0 ? types.join('|') : schema.type.includes('null') ? 'null' : undefined
  }
  if (isRecord(schema.properties)) {
    return 'object'
  }
  if (schema.items !== undefined) {
    return 'array'
  }
  if (schema.const !== undefined) {
    if (schema.const === null) {
      return 'null'
    }
    if (Array.isArray(schema.const)) {
      return 'array'
    }
    return typeof schema.const
  }
  return undefined
}

function nullableMode(schema: JsonRecord): true | undefined {
  return schema.nullable === true || schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null'))
    ? true
    : undefined
}

function accessMode(schema: JsonRecord): 'read-only' | 'write-only' | undefined {
  if (schema.readOnly === true && schema.writeOnly === true) {
    throw new Error('Schema cannot be both readOnly and writeOnly')
  }
  if (schema.readOnly === true) {
    return 'read-only'
  }
  if (schema.writeOnly === true) {
    return 'write-only'
  }
  return undefined
}

function additionalPropertiesMode(schema: JsonRecord): boolean | 'schema' | undefined {
  if (inferType(schema) !== 'object') {
    return undefined
  }
  if (schema.additionalProperties === false) {
    return false
  }
  if (isRecord(schema.additionalProperties)) {
    return 'schema'
  }
  return true
}

function collectComposedRequiredNames(
  document: JsonRecord,
  value: unknown,
  pointer: string,
  refStack: Set<string> = new Set(),
): Set<string> {
  const resolved = resolveSchema(document, value, pointer)
  validateSchemaShape(document, resolved.schema, resolved.pointer)
  const names = requiredPropertyNames(resolved.schema, resolved.pointer)

  if (resolved.ref && refStack.has(resolved.ref)) {
    return names
  }
  const nextRefStack = new Set(refStack)
  if (resolved.ref) {
    nextRefStack.add(resolved.ref)
  }

  for (const overlay of resolved.overlays) {
    for (const name of collectComposedRequiredNames(document, overlay.schema, overlay.pointer, nextRefStack)) {
      names.add(name)
    }
  }
  if (Array.isArray(resolved.schema.allOf)) {
    resolved.schema.allOf.forEach((part, index) => {
      for (const name of collectComposedRequiredNames(document, part, `${resolved.pointer}/allOf/${index}`, nextRefStack)) {
        names.add(name)
      }
    })
  }
  return names
}

function collectComposedPropertyNames(
  document: JsonRecord,
  value: unknown,
  pointer: string,
  refStack: Set<string> = new Set(),
): Set<string> {
  const resolved = resolveSchema(document, value, pointer)
  validateSchemaShape(document, resolved.schema, resolved.pointer)
  const names = new Set(isRecord(resolved.schema.properties) ? Object.keys(resolved.schema.properties) : [])

  if (resolved.ref && refStack.has(resolved.ref)) {
    return names
  }
  const nextRefStack = new Set(refStack)
  if (resolved.ref) {
    nextRefStack.add(resolved.ref)
  }

  for (const overlay of resolved.overlays) {
    for (const name of collectComposedPropertyNames(document, overlay.schema, overlay.pointer, nextRefStack)) {
      names.add(name)
    }
  }
  if (Array.isArray(resolved.schema.allOf)) {
    resolved.schema.allOf.forEach((part, index) => {
      for (const name of collectComposedPropertyNames(document, part, `${resolved.pointer}/allOf/${index}`, nextRefStack)) {
        names.add(name)
      }
    })
  }
  return names
}

function effectiveAccessMode(
  document: JsonRecord,
  value: unknown,
  pointer: string,
  refStack: Set<string> = new Set(),
): 'read-only' | 'write-only' | undefined {
  const resolved = resolveSchema(document, value, pointer)
  validateSchemaShape(document, resolved.schema, resolved.pointer)
  const modes = new Set<'read-only' | 'write-only'>()
  const ownMode = accessMode(resolved.schema)
  if (ownMode) {
    modes.add(ownMode)
  }

  if (!(resolved.ref && refStack.has(resolved.ref))) {
    const nextRefStack = new Set(refStack)
    if (resolved.ref) {
      nextRefStack.add(resolved.ref)
    }
    for (const overlay of resolved.overlays) {
      const mode = effectiveAccessMode(document, overlay.schema, overlay.pointer, nextRefStack)
      if (mode) {
        modes.add(mode)
      }
    }
    if (Array.isArray(resolved.schema.allOf)) {
      resolved.schema.allOf.forEach((part, index) => {
        const mode = effectiveAccessMode(document, part, `${resolved.pointer}/allOf/${index}`, nextRefStack)
        if (mode) {
          modes.add(mode)
        }
      })
    }
  }

  if (modes.size > 1) {
    throw new Error(`Conflicting readOnly/writeOnly contract definitions at ${pointer}`)
  }
  return [...modes][0]
}

function addElement(elements: Map<string, NormalizedElement>, element: NormalizedElement): void {
  const existing = elements.get(element.key)
  if (!existing) {
    elements.set(element.key, element)
    return
  }

  const merged = { ...existing }
  const mergeKeys = [
    'type',
    'format',
    'nullable',
    'enum',
    'access',
    'style',
    'explode',
    'allowReserved',
  ] as const
  for (const key of mergeKeys) {
    const existingValue = existing[key]
    const nextValue = element[key]
    if (existingValue !== undefined && nextValue !== undefined && stableStringify(existingValue) !== stableStringify(nextValue)) {
      throw new Error(`Conflicting allOf contract definitions at ${element.method} ${element.path} ${element.fieldPath ?? element.subject}`)
    }
    if (existingValue === undefined && nextValue !== undefined) {
      Object.assign(merged, { [key]: nextValue })
    }
  }
  const openness = [existing.additionalProperties, element.additionalProperties].filter(value => value !== undefined)
  if (openness.includes(false)) {
    merged.additionalProperties = false
  }
  else if (openness.includes('schema')) {
    merged.additionalProperties = 'schema'
  }
  else if (openness.includes(true)) {
    merged.additionalProperties = true
  }
  merged.required = existing.required === true || element.required === true
  merged.documentPointer = [existing.documentPointer, element.documentPointer].sort()[0]
  elements.set(element.key, merged)
}

function elementKey(element: Omit<NormalizedElement, 'key' | 'documentPointer'>): string {
  return [
    element.method,
    element.path,
    element.subject,
    element.parameterIn ?? '',
    element.statusCode ?? '',
    element.mediaType ?? '',
    element.fieldPath ?? '',
  ].join('\u0000')
}

function collectSchemaElements(options: {
  document: JsonRecord
  schema: unknown
  pointer: string
  elements: Map<string, NormalizedElement>
  operation: { method: string, path: string }
  context: {
    direction: 'request' | 'response'
    statusCode?: string
    mediaType?: string
    parameterIn?: string
    parameterName?: string
    fieldPath: string
    required: boolean
  }
  refStack: Set<string>
  inheritedRequiredNames?: ReadonlySet<string>
  inheritedPropertyNames?: ReadonlySet<string>
}): void {
  const resolved = resolveSchema(options.document, options.schema, options.pointer)
  const schema = resolved.schema
  validateSchemaShape(options.document, schema, resolved.pointer)
  const composedRequiredNames = collectComposedRequiredNames(
    options.document,
    options.schema,
    options.pointer,
    options.refStack,
  )
  const effectiveRequiredNames = new Set(options.inheritedRequiredNames)
  for (const name of composedRequiredNames) {
    effectiveRequiredNames.add(name)
  }
  const composedPropertyNames = collectComposedPropertyNames(
    options.document,
    options.schema,
    options.pointer,
    options.refStack,
  )
  const effectivePropertyNames = new Set(options.inheritedPropertyNames)
  for (const name of composedPropertyNames) {
    effectivePropertyNames.add(name)
  }

  const nullable = nullableMode(schema)
  const access = accessMode(schema)
  const elementWithoutIdentity: Omit<NormalizedElement, 'key' | 'documentPointer'> = {
    subject: 'field',
    method: options.operation.method,
    path: options.operation.path,
    direction: options.context.direction,
    ...(options.context.statusCode === undefined ? {} : { statusCode: options.context.statusCode }),
    ...(options.context.mediaType === undefined ? {} : { mediaType: options.context.mediaType }),
    ...(options.context.parameterIn === undefined ? {} : { parameterIn: options.context.parameterIn }),
    ...(options.context.parameterName === undefined ? {} : { parameterName: options.context.parameterName }),
    fieldPath: options.context.fieldPath,
    type: inferType(schema),
    ...(typeof schema.format === 'string' ? { format: schema.format } : {}),
    required: options.context.required,
    ...(nullable === undefined ? {} : { nullable }),
    ...(sortedEnum(schema.enum ?? (schema.const === undefined ? undefined : [schema.const])) === undefined
      ? {}
      : { enum: sortedEnum(schema.enum ?? [schema.const]) }),
    ...(additionalPropertiesMode(schema) === undefined
      ? {}
      : { additionalProperties: additionalPropertiesMode(schema) }),
    ...(access === undefined ? {} : { access }),
  }
  addElement(options.elements, {
    ...elementWithoutIdentity,
    key: elementKey(elementWithoutIdentity),
    documentPointer: resolved.pointer,
  })

  for (const requiredName of [...effectiveRequiredNames].filter(name => !effectivePropertyNames.has(name)).sort()) {
    const requiredElement: Omit<NormalizedElement, 'key' | 'documentPointer'> = {
      subject: 'field',
      method: options.operation.method,
      path: options.operation.path,
      direction: options.context.direction,
      ...(options.context.statusCode === undefined ? {} : { statusCode: options.context.statusCode }),
      ...(options.context.mediaType === undefined ? {} : { mediaType: options.context.mediaType }),
      ...(options.context.parameterIn === undefined ? {} : { parameterIn: options.context.parameterIn }),
      ...(options.context.parameterName === undefined ? {} : { parameterName: options.context.parameterName }),
      fieldPath: options.context.fieldPath === '$'
        ? requiredName
        : `${options.context.fieldPath}.${requiredName}`,
      required: true,
    }
    addElement(options.elements, {
      ...requiredElement,
      key: elementKey(requiredElement),
      documentPointer: `${resolved.pointer}/required`,
    })
  }

  if (resolved.ref && options.refStack.has(resolved.ref)) {
    return
  }
  const nextRefStack = new Set(options.refStack)
  if (resolved.ref) {
    nextRefStack.add(resolved.ref)
  }

  for (const overlay of resolved.overlays) {
    collectSchemaElements({
      ...options,
      schema: overlay.schema,
      pointer: overlay.pointer,
      refStack: nextRefStack,
      inheritedRequiredNames: effectiveRequiredNames,
      inheritedPropertyNames: effectivePropertyNames,
    })
  }

  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((part, index) => collectSchemaElements({
      ...options,
      schema: part,
      pointer: `${resolved.pointer}/allOf/${index}`,
      refStack: nextRefStack,
      inheritedRequiredNames: effectiveRequiredNames,
      inheritedPropertyNames: effectivePropertyNames,
    }))
  }

  if (isRecord(schema.properties)) {
    for (const [propertyName, propertySchema] of Object.entries(schema.properties).sort(([left], [right]) => left.localeCompare(right))) {
      const propertyPointer = `${resolved.pointer}/properties/${escapePointer(propertyName)}`
      const propertyAccess = effectiveAccessMode(options.document, propertySchema, propertyPointer, nextRefStack)
      if ((options.context.direction === 'request' && propertyAccess === 'read-only')
        || (options.context.direction === 'response' && propertyAccess === 'write-only')) {
        continue
      }
      collectSchemaElements({
        ...options,
        schema: propertySchema,
        pointer: propertyPointer,
        context: {
          ...options.context,
          fieldPath: options.context.fieldPath === '$'
            ? propertyName
            : `${options.context.fieldPath}.${propertyName}`,
          required: effectiveRequiredNames.has(propertyName),
        },
        refStack: nextRefStack,
        inheritedRequiredNames: undefined,
        inheritedPropertyNames: undefined,
      })
    }
  }

  if (schema.items !== undefined) {
    collectSchemaElements({
      ...options,
      schema: schema.items,
      pointer: `${resolved.pointer}/items`,
      context: {
        ...options.context,
        fieldPath: `${options.context.fieldPath}[]`,
        required: true,
      },
      refStack: nextRefStack,
      inheritedRequiredNames: undefined,
      inheritedPropertyNames: undefined,
    })
  }

  if (isRecord(schema.additionalProperties)) {
    collectSchemaElements({
      ...options,
      schema: schema.additionalProperties,
      pointer: `${resolved.pointer}/additionalProperties`,
      context: {
        ...options.context,
        fieldPath: options.context.fieldPath === '$' ? '*' : `${options.context.fieldPath}.*`,
        required: false,
      },
      refStack: nextRefStack,
      inheritedRequiredNames: undefined,
      inheritedPropertyNames: undefined,
    })
  }
}

function resolveObject(
  document: JsonRecord,
  value: unknown,
  pointer: string,
  allowReferenceAnnotations = false,
): { value: JsonRecord, pointer: string } {
  let record = requireRecord(value, `Value at ${pointer}`)
  let resolvedPointer = pointer
  const references = new Set<string>()
  while (record.$ref !== undefined) {
    if (typeof record.$ref !== 'string') {
      throw new TypeError(`$ref at ${resolvedPointer} must be a string`)
    }
    const reference = record.$ref
    const siblings = Object.keys(record).filter(key => key !== '$ref')
    const allowedSiblings = allowReferenceAnnotations && supportsSchemaReferenceSiblings(document)
      ? new Set(['description', 'summary'])
      : new Set<string>()
    const unsupportedSiblings = siblings.filter(key => !allowedSiblings.has(key))
    if (unsupportedSiblings.length > 0) {
      throw new Error(`$ref siblings are unsupported at ${resolvedPointer}: ${unsupportedSiblings.join(', ')}`)
    }
    if (references.has(reference)) {
      throw new Error(`Cyclic object reference: ${reference}`)
    }
    references.add(reference)
    const resolved = resolveLocalReference(document, reference)
    record = resolved.value
    resolvedPointer = resolved.pointer
  }
  return { value: record, pointer: resolvedPointer }
}

function parameterSerialization(
  parameter: JsonRecord,
  location: string,
  pointer: string,
): { style: string, explode: boolean, allowReserved: boolean } {
  const stylesByLocation: Record<string, readonly string[]> = {
    cookie: ['form'],
    header: ['simple'],
    path: ['label', 'matrix', 'simple'],
    query: ['deepObject', 'form', 'pipeDelimited', 'spaceDelimited'],
  }
  const allowedStyles = stylesByLocation[location]
  if (!allowedStyles) {
    throw new Error(`Unsupported parameter location at ${pointer}: ${location}`)
  }
  if (parameter.style !== undefined && typeof parameter.style !== 'string') {
    throw new TypeError(`Parameter style at ${pointer} must be a string`)
  }
  const style = typeof parameter.style === 'string'
    ? parameter.style
    : location === 'query' || location === 'cookie' ? 'form' : 'simple'
  if (!allowedStyles.includes(style)) {
    throw new Error(`Unsupported parameter style at ${pointer}: ${style}`)
  }
  if (parameter.explode !== undefined && typeof parameter.explode !== 'boolean') {
    throw new TypeError(`Parameter explode at ${pointer} must be a boolean`)
  }
  if (parameter.allowReserved !== undefined && typeof parameter.allowReserved !== 'boolean') {
    throw new TypeError(`Parameter allowReserved at ${pointer} must be a boolean`)
  }
  if (parameter.allowReserved !== undefined && location !== 'query') {
    throw new Error(`Parameter allowReserved is only supported for query parameters at ${pointer}`)
  }
  if (parameter.allowEmptyValue !== undefined) {
    throw new Error(`Unsupported parameter keyword "allowEmptyValue" at ${pointer}`)
  }
  return {
    style,
    explode: typeof parameter.explode === 'boolean' ? parameter.explode : style === 'form',
    allowReserved: parameter.allowReserved === true,
  }
}

function addStructuralElement(
  elements: Map<string, NormalizedElement>,
  element: Omit<NormalizedElement, 'key'>,
): void {
  addElement(elements, {
    ...element,
    key: elementKey(element),
  })
}

function collectParameters(options: {
  document: JsonRecord
  pathParameters: unknown
  operationParameters: unknown
  operation: { method: string, path: string }
  basePointer: string
  elements: Map<string, NormalizedElement>
}): void {
  const parameters = new Map<string, { value: JsonRecord, pointer: string }>()
  const addParameters = (value: unknown, pointer: string) => {
    if (value === undefined) {
      return
    }
    if (!Array.isArray(value)) {
      throw new TypeError(`Parameters at ${pointer} must be an array`)
    }
    value.forEach((entry, index) => {
      const resolved = resolveObject(options.document, entry, `${pointer}/${index}`, true)
      const name = resolved.value.name
      const location = resolved.value.in
      if (typeof name !== 'string' || typeof location !== 'string') {
        throw new TypeError(`Parameter at ${resolved.pointer} requires string name and in fields`)
      }
      parameters.set(`${location}\u0000${name}`, resolved)
    })
  }
  addParameters(options.pathParameters, `${options.basePointer}/parameters`)
  addParameters(options.operationParameters, `${options.basePointer}/${options.operation.method.toLowerCase()}/parameters`)

  for (const resolved of [...parameters.values()].sort((left, right) => left.pointer.localeCompare(right.pointer))) {
    const name = String(resolved.value.name)
    const parameterIn = String(resolved.value.in)
    if (resolved.value.content !== undefined) {
      throw new Error(`Parameter content is unsupported at ${resolved.pointer}`)
    }
    if (resolved.value.schema === undefined) {
      throw new Error(`Parameter at ${resolved.pointer} requires exactly one of schema or content`)
    }
    if (resolved.value.required !== undefined && typeof resolved.value.required !== 'boolean') {
      throw new TypeError(`Parameter required at ${resolved.pointer} must be a boolean`)
    }
    const serialization = parameterSerialization(resolved.value, parameterIn, resolved.pointer)
    const element: Omit<NormalizedElement, 'key'> = {
      subject: 'parameter',
      method: options.operation.method,
      path: options.operation.path,
      parameterIn,
      fieldPath: name,
      parameterName: name,
      documentPointer: resolved.pointer,
      direction: 'request',
      required: resolved.value.required === true,
      ...serialization,
    }
    addStructuralElement(options.elements, element)

    if (resolved.value.schema !== undefined) {
      collectSchemaElements({
        document: options.document,
        schema: resolved.value.schema,
        pointer: `${resolved.pointer}/schema`,
        elements: options.elements,
        operation: options.operation,
        context: {
          direction: 'request',
          parameterIn,
          parameterName: name,
          fieldPath: name,
          required: true,
        },
        refStack: new Set(),
      })
    }
  }
}

function collectContent(options: {
  document: JsonRecord
  content: unknown
  pointer: string
  elements: Map<string, NormalizedElement>
  operation: { method: string, path: string }
  direction: 'request' | 'response'
  statusCode?: string
}): void {
  const content = requireRecord(options.content, `Content at ${options.pointer}`)
  const normalizedMediaTypes = new Map<string, string>()
  for (const [mediaType, rawMedia] of Object.entries(content).sort(([left], [right]) => left.localeCompare(right))) {
    const normalizedMediaType = normalizeMediaType(mediaType, options.pointer)
    const existingMediaType = normalizedMediaTypes.get(normalizedMediaType)
    if (existingMediaType !== undefined) {
      throw new Error(
        `Duplicate media type keys ${JSON.stringify(existingMediaType)} and ${JSON.stringify(mediaType)} at ${options.pointer}`,
      )
    }
    normalizedMediaTypes.set(normalizedMediaType, mediaType)
    const media = requireRecord(rawMedia, `Media type ${mediaType} at ${options.pointer}`)
    const mediaPointer = `${options.pointer}/${escapePointer(mediaType)}`
    if (media.encoding !== undefined) {
      throw new Error(`Media type encoding is unsupported at ${mediaPointer}/encoding`)
    }
    addStructuralElement(options.elements, {
      subject: 'media_type',
      method: options.operation.method,
      path: options.operation.path,
      ...(options.statusCode === undefined ? {} : { statusCode: options.statusCode }),
      mediaType: normalizedMediaType,
      documentPointer: mediaPointer,
      direction: options.direction,
      required: true,
    })
    if (media.schema !== undefined) {
      collectSchemaElements({
        document: options.document,
        schema: media.schema,
        pointer: `${mediaPointer}/schema`,
        elements: options.elements,
        operation: options.operation,
        context: {
          direction: options.direction,
          ...(options.statusCode === undefined ? {} : { statusCode: options.statusCode }),
          mediaType: normalizedMediaType,
          fieldPath: '$',
          required: true,
        },
        refStack: new Set(),
      })
    }
  }
}

function normalizeContract(document: JsonRecord): Map<string, NormalizedElement> {
  const elements = new Map<string, NormalizedElement>()
  const paths = requireRecord(document.paths, 'OpenAPI paths')
  const openapi = typeof document.openapi === 'string' ? document.openapi : ''
  rejectUnsupportedWireSemantics(document, '#')

  if (document.components !== undefined) {
    const components = requireRecord(document.components, 'OpenAPI components')
    if (components.securitySchemes !== undefined) {
      throw new Error('Unsupported OpenAPI securitySchemes at #/components/securitySchemes')
    }
  }

  for (const [apiPath, rawPathItem] of Object.entries(paths).sort(([left], [right]) => left.localeCompare(right))) {
    if (!isValidOpenApiPath(apiPath)) {
      throw new Error(`Invalid OpenAPI path key ${JSON.stringify(apiPath)} at #/paths`)
    }
    const pathPointer = `#/paths/${escapePointer(apiPath)}`
    const resolvedPathItem = resolveObject(document, rawPathItem, pathPointer)
    rejectUnsupportedWireSemantics(resolvedPathItem.value, resolvedPathItem.pointer)
    for (const methodName of HTTP_METHODS) {
      const rawOperation = resolvedPathItem.value[methodName]
      if (rawOperation === undefined) {
        continue
      }
      const operation = requireRecord(rawOperation, `Operation ${methodName.toUpperCase()} ${apiPath}`)
      const method = methodName.toUpperCase()
      const operationIdentity = { method, path: apiPath }
      const operationPointer = `${resolvedPathItem.pointer}/${methodName}`
      rejectUnsupportedWireSemantics(operation, operationPointer)
      if (operation.callbacks !== undefined) {
        throw new Error(`Unsupported OpenAPI callbacks at ${operationPointer}`)
      }
      addStructuralElement(elements, {
        subject: 'operation',
        ...operationIdentity,
        documentPointer: operationPointer,
      })

      collectParameters({
        document,
        pathParameters: resolvedPathItem.value.parameters,
        operationParameters: operation.parameters,
        operation: operationIdentity,
        basePointer: resolvedPathItem.pointer,
        elements,
      })

      if (operation.requestBody !== undefined) {
        const requestBody = resolveObject(document, operation.requestBody, `${operationPointer}/requestBody`, true)
        const requestRequired = requestBody.value.required === true
        addStructuralElement(elements, {
          subject: 'request_body',
          ...operationIdentity,
          documentPointer: requestBody.pointer,
          direction: 'request',
          required: requestRequired,
        })
        if (requestBody.value.content !== undefined) {
          collectContent({
            document,
            content: requestBody.value.content,
            pointer: `${requestBody.pointer}/content`,
            elements,
            operation: operationIdentity,
            direction: 'request',
          })
        }
      }

      const responses = requireRecord(operation.responses, `Responses for ${method} ${apiPath}`)
      if (Object.keys(responses).length === 0) {
        throw new Error(`OpenAPI responses must contain at least one response at ${operationPointer}/responses`)
      }
      for (const [statusCode, rawResponse] of Object.entries(responses).sort(([left], [right]) => left.localeCompare(right))) {
        if (!OPENAPI_RESPONSE_KEY_PATTERN.test(statusCode)) {
          throw new Error(
            `Invalid OpenAPI response key ${JSON.stringify(statusCode)} for ${openapi} at ${operationPointer}/responses`,
          )
        }
        const response = resolveObject(document, rawResponse, `${operationPointer}/responses/${escapePointer(statusCode)}`, true)
        if (response.value.headers !== undefined) {
          const headers = requireRecord(response.value.headers, `Response headers at ${response.pointer}/headers`)
          if (Object.keys(headers).length > 0) {
            throw new Error(`Response headers are unsupported at ${response.pointer}/headers`)
          }
        }
        addStructuralElement(elements, {
          subject: 'response',
          ...operationIdentity,
          statusCode,
          documentPointer: response.pointer,
          direction: 'response',
          required: true,
        })
        if (response.value.content !== undefined) {
          collectContent({
            document,
            content: response.value.content,
            pointer: `${response.pointer}/content`,
            elements,
            operation: operationIdentity,
            direction: 'response',
            statusCode,
          })
        }
      }
    }
  }

  return elements
}

function contractValue(element: NormalizedElement): ContractValue {
  return {
    document_pointer: element.documentPointer,
    ...(element.type === undefined ? {} : { type: element.type }),
    ...(element.format === undefined ? {} : { format: element.format }),
    ...(element.required === undefined ? {} : { required: element.required }),
    ...(element.nullable === undefined ? {} : { nullable: element.nullable }),
    ...(element.enum === undefined ? {} : { enum: element.enum }),
    ...(element.additionalProperties === undefined ? {} : { additional_properties: element.additionalProperties }),
    ...(element.access === undefined ? {} : { access: element.access }),
    ...(element.style === undefined ? {} : { style: element.style }),
    ...(element.explode === undefined ? {} : { explode: element.explode }),
    ...(element.allowReserved === undefined ? {} : { allow_reserved: element.allowReserved }),
  }
}

function gapBase(element: NormalizedElement): Omit<ContractGap, 'id' | 'severity' | 'kind' | 'expected' | 'actual'> {
  return {
    subject: element.subject,
    method: element.method,
    path: element.path,
    ...(element.parameterIn === undefined ? {} : { parameter_in: element.parameterIn }),
    ...(element.statusCode === undefined ? {} : { status_code: element.statusCode }),
    ...(element.mediaType === undefined ? {} : { media_type: element.mediaType }),
    ...(element.fieldPath === undefined ? {} : { field_path: element.fieldPath }),
  }
}

function missingActualSeverity(element: NormalizedElement): ContractGapSeverity {
  return element.subject === 'operation'
    || element.subject === 'response'
    || element.subject === 'media_type'
    || element.required === true
    ? 'blocking'
    : 'warning'
}

function missingExpectedSeverity(element: NormalizedElement): ContractGapSeverity {
  const requestRequirement = element.direction === 'request'
    && (element.subject === 'parameter' || element.subject === 'field' || element.subject === 'request_body')
    && element.required === true
  return requestRequirement ? 'blocking' : 'warning'
}

function sameEnum(left: unknown[] | undefined, right: unknown[] | undefined): boolean {
  return stableStringify(left) === stableStringify(right)
}

function ancestorElement(
  element: NormalizedElement,
  subject: ContractSubject,
  overrides: Pick<Partial<NormalizedElement>, 'statusCode' | 'mediaType'> = {},
): Omit<NormalizedElement, 'key' | 'documentPointer'> {
  return {
    subject,
    method: element.method,
    path: element.path,
    ...(overrides.statusCode === undefined ? {} : { statusCode: overrides.statusCode }),
    ...(overrides.mediaType === undefined ? {} : { mediaType: overrides.mediaType }),
  }
}

function missingAncestor(
  element: NormalizedElement,
  own: Map<string, NormalizedElement>,
  counterpart: Map<string, NormalizedElement>,
): boolean {
  const operation = ancestorElement(element, 'operation')
  const operationKey = elementKey(operation)
  if (element.subject !== 'operation' && own.has(operationKey) && !counterpart.has(operationKey)) {
    return true
  }

  if (element.subject === 'field' && element.parameterIn !== undefined && element.parameterName !== undefined) {
    const parameterKey = elementKey({
      subject: 'parameter',
      method: element.method,
      path: element.path,
      parameterIn: element.parameterIn,
      fieldPath: element.parameterName,
    })
    if (own.has(parameterKey) && !counterpart.has(parameterKey)) {
      return true
    }
  }

  if (element.direction === 'request' && (element.subject === 'media_type' || element.subject === 'field')) {
    const requestBodyKey = elementKey(ancestorElement(element, 'request_body'))
    if (own.has(requestBodyKey) && !counterpart.has(requestBodyKey)) {
      return true
    }
  }
  if (element.direction === 'response' && (element.subject === 'media_type' || element.subject === 'field')) {
    const responseKey = elementKey(ancestorElement(element, 'response', { statusCode: element.statusCode }))
    if (own.has(responseKey) && !counterpart.has(responseKey)) {
      return true
    }
  }
  if (element.subject === 'field' && element.mediaType !== undefined) {
    const mediaTypeKey = elementKey(ancestorElement(element, 'media_type', {
      statusCode: element.statusCode,
      mediaType: element.mediaType,
    }))
    if (own.has(mediaTypeKey) && !counterpart.has(mediaTypeKey)) {
      return true
    }
  }
  return false
}

function compareElements(expected: Map<string, NormalizedElement>, actual: Map<string, NormalizedElement>): ContractGap[] {
  const pending: Array<Omit<ContractGap, 'id'>> = []
  const keys = [...new Set([...expected.keys(), ...actual.keys()])].sort()

  for (const key of keys) {
    const expectedElement = expected.get(key)
    const actualElement = actual.get(key)
    if (expectedElement && !actualElement) {
      if (missingAncestor(expectedElement, expected, actual)) {
        continue
      }
      pending.push({
        ...gapBase(expectedElement),
        severity: missingActualSeverity(expectedElement),
        kind: 'MISSING_IN_ACTUAL',
        expected: contractValue(expectedElement),
        actual: null,
      })
      continue
    }
    if (!expectedElement && actualElement) {
      if (missingAncestor(actualElement, actual, expected)) {
        continue
      }
      pending.push({
        ...gapBase(actualElement),
        severity: missingExpectedSeverity(actualElement),
        kind: 'MISSING_IN_EXPECTED',
        expected: null,
        actual: contractValue(actualElement),
      })
      continue
    }
    const expectedValue = expectedElement as NormalizedElement
    const actualValue = actualElement as NormalizedElement

    const comparisons: Array<[ContractGapKind, boolean]> = [
      ['TYPE_MISMATCH', expectedValue.type !== actualValue.type],
      ['FORMAT_MISMATCH', expectedValue.format !== actualValue.format],
      ['REQUIREDNESS_MISMATCH', expectedValue.required !== actualValue.required],
      ['NULLABILITY_MISMATCH', expectedValue.nullable !== actualValue.nullable],
      ['ENUM_MISMATCH', !sameEnum(expectedValue.enum, actualValue.enum)],
      ['ADDITIONAL_PROPERTIES_MISMATCH', expectedValue.additionalProperties !== actualValue.additionalProperties],
      ['ACCESS_MISMATCH', expectedValue.access !== actualValue.access],
      ['STYLE_MISMATCH', expectedValue.style !== actualValue.style],
      ['EXPLODE_MISMATCH', expectedValue.explode !== actualValue.explode],
      ['ALLOW_RESERVED_MISMATCH', expectedValue.allowReserved !== actualValue.allowReserved],
    ]
    for (const [kind, differs] of comparisons) {
      if (differs) {
        pending.push({
          ...gapBase(expectedValue),
          severity: 'blocking',
          kind,
          expected: contractValue(expectedValue),
          actual: contractValue(actualValue),
        })
      }
    }
  }

  return pending.map((gap, index) => ({
    id: `GAP-${String(index + 1).padStart(3, '0')}`,
    ...gap,
  }))
}

function summarize(gaps: ContractGap[]): ContractAudit['summary'] {
  const byKind: Partial<Record<ContractGapKind, number>> = {}
  for (const gap of gaps) {
    byKind[gap.kind] = (byKind[gap.kind] ?? 0) + 1
  }
  return {
    total: gaps.length,
    blocking: gaps.filter(gap => gap.severity === 'blocking').length,
    warnings: gaps.filter(gap => gap.severity === 'warning').length,
    by_kind: Object.fromEntries(Object.entries(byKind).sort(([left], [right]) => left.localeCompare(right))),
  }
}

function emptySummary(): ContractAudit['summary'] {
  return { total: 0, blocking: 0, warnings: 0, by_kind: {} }
}

export function compareContractFiles(options: CompareContractFilesOptions): ContractAudit {
  let expected: ParsedContract
  try {
    expected = parseContract(options.expectedPath, options.expectedLabel ?? 'expected', options.expectedVersion, 'expected')
  }
  catch (error) {
    throw attachContractErrorSources(error, contractErrorSources(error))
  }
  let actual: ParsedContract
  try {
    actual = parseContract(options.actualPath, options.actualLabel ?? 'actual', options.actualVersion, 'actual')
  }
  catch (error) {
    throw attachContractErrorSources(error, { expected: expected.source, ...contractErrorSources(error) })
  }
  try {
    const gaps = compareElements(normalizeContract(expected.document), normalizeContract(actual.document))
    const summary = summarize(gaps)

    return {
      schema_version: 1,
      tool: { name: 'airules-contract-diff', report_version: 1 },
      status: summary.blocking > 0 ? 'fail' : 'pass',
      sources: { expected: expected.source, actual: actual.source },
      summary,
      gaps,
      errors: [],
    }
  }
  catch (error) {
    throw attachContractErrorSources(error, { expected: expected.source, actual: actual.source })
  }
}

export function createContractErrorAudit(
  options: CompareContractFilesOptions,
  error: unknown,
): ContractAudit {
  const capturedSources = contractErrorSources(error)
  const source = (
    sourceName: AuditSourceName,
    filePath: string,
    label: string | undefined,
    fallbackLabel: string,
    version?: string,
  ): ContractSource => {
    const captured = capturedSources[sourceName]
    if (captured !== undefined) {
      return captured
    }
    const resolvedPath = path.resolve(filePath)
    const sourceSha256 = captureErrorAuditSourceSha256(resolvedPath)
    return {
      label: label?.trim() ? label : fallbackLabel,
      path: resolvedPath,
      ...(version?.trim() ? { version } : {}),
      ...(sourceSha256 === undefined ? {} : { sha256: sourceSha256 }),
    }
  }
  const rawMessage = error instanceof Error ? error.message : String(error)
  return {
    schema_version: 1,
    tool: { name: 'airules-contract-diff', report_version: 1 },
    status: 'error',
    sources: {
      expected: source('expected', options.expectedPath, options.expectedLabel, 'expected', options.expectedVersion),
      actual: source('actual', options.actualPath, options.actualLabel, 'actual', options.actualVersion),
    },
    summary: emptySummary(),
    gaps: [],
    errors: [{
      code: 'CONTRACT_INPUT_ERROR',
      message: rawMessage.trim() ? rawMessage : 'Unknown contract input error',
    }],
  }
}

export function serializeContractAudit(audit: ContractAudit): string {
  return `${JSON.stringify(audit, null, 2)}\n`
}

function pathIdentityKey(filePath: string): string {
  const resolved = path.resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isReservedWindowsTargetName(targetName: string): boolean {
  const stem = targetName.split('.')[0]?.toUpperCase() ?? ''
  return ['CON', 'PRN', 'AUX', 'NUL', 'CLOCK$', 'CONIN$', 'CONOUT$'].includes(stem)
    || /^(?:COM|LPT)[1-9]$/u.test(stem)
}

function assertSafeAuditTargetName(targetName: string): void {
  if (targetName === '' || targetName === '.' || targetName === '..') {
    throw new Error('Contract audit target basename must be a non-empty ordinary directory entry')
  }
  if (process.platform !== 'win32') {
    return
  }
  const invalidCharacters = '<>:"/\\|?*'
  const hasInvalidCharacter = [...targetName].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1F || invalidCharacters.includes(character)
  })
  if (hasInvalidCharacter || /[. ]$/u.test(targetName) || isReservedWindowsTargetName(targetName)) {
    throw new Error(`Contract audit target basename is unsafe on Windows: ${JSON.stringify(targetName)}`)
  }
}

interface StableFileSnapshot {
  resolvedPath: string
  linkIdentity: string
  targetIdentity: string
  realPath: string
  sha256: string
  ordinaryFile: boolean
}

type OptionalFileSnapshot
  = | { exists: false }
    | { exists: true, file: StableFileSnapshot }

interface StableInputSnapshot {
  resolvedPath: string
  linkIdentity: string
  linkState: string
  targetIdentity: string | null
  targetState: string | null
  realPath: string | null
  sha256?: string
  ordinaryFile: boolean
}

type OptionalInputSnapshot
  = | { exists: false }
    | { exists: true, file: StableInputSnapshot }

interface InputFileSnapshot {
  resolvedPath: string
  state: OptionalInputSnapshot
}

interface DirectoryEntrySnapshot {
  resolvedPath: string
  identity: string
  realPath: string
}

interface OutputDirectorySnapshot {
  resolvedPath: string
  entries: DirectoryEntrySnapshot[]
}

function missingPathError(error: unknown): boolean {
  return isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function unreadablePathError(error: unknown): boolean {
  return isRecord(error) && (error.code === 'EACCES' || error.code === 'EPERM')
}

function filesystemIdentity(stats: BigIntStats, description: string): string {
  if (stats.ino === 0n) {
    throw new Error(`Stable filesystem identity is unavailable for ${description}`)
  }
  return `${stats.dev}:${stats.ino}:${stats.mode & 0o170000n}`
}

function sameOpenFileState(left: BigIntStats, right: BigIntStats, description: string): boolean {
  return filesystemIdentity(left, description) === filesystemIdentity(right, description)
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
}

function filesystemState(stats: BigIntStats, description: string): string {
  return `${filesystemIdentity(stats, description)}:${stats.size}:${stats.mtimeNs}:${stats.ctimeNs}`
}

function stableInputSnapshot(
  resolvedPath: string,
  description: string,
  link: BigIntStats,
  target: BigIntStats | null,
  realPath: string | null,
  bytes?: Buffer,
): StableInputSnapshot {
  return {
    resolvedPath,
    linkIdentity: filesystemIdentity(link, description),
    linkState: filesystemState(link, description),
    targetIdentity: target === null ? null : filesystemIdentity(target, description),
    targetState: target === null ? null : filesystemState(target, description),
    realPath: realPath === null ? null : pathIdentityKey(realPath),
    ...(bytes === undefined ? {} : { sha256: sha256(bytes) }),
    ordinaryFile: link.isFile(),
  }
}

function captureStableInputSnapshot(filePath: string, description: string): StableInputSnapshot {
  const resolvedPath = path.resolve(filePath)
  const linkBefore = fs.lstatSync(resolvedPath, { bigint: true })
  let targetBefore: BigIntStats
  try {
    targetBefore = fs.statSync(resolvedPath, { bigint: true })
  }
  catch (error) {
    if (!missingPathError(error)) {
      throw error
    }
    const linkAfter = fs.lstatSync(resolvedPath, { bigint: true })
    let targetStillMissing = false
    try {
      fs.statSync(resolvedPath, { bigint: true })
    }
    catch (recheckError) {
      if (!missingPathError(recheckError)) {
        throw recheckError
      }
      targetStillMissing = true
    }
    const linkFinal = fs.lstatSync(resolvedPath, { bigint: true })
    if (!targetStillMissing
      || !sameOpenFileState(linkBefore, linkAfter, description)
      || !sameOpenFileState(linkAfter, linkFinal, description)) {
      throw new Error(`${description} changed while its missing target was captured`)
    }
    return stableInputSnapshot(resolvedPath, description, linkFinal, null, null)
  }
  const realPathBefore = fs.realpathSync.native(resolvedPath)

  if (!targetBefore.isFile()) {
    const linkAfter = fs.lstatSync(resolvedPath, { bigint: true })
    const targetAfter = fs.statSync(resolvedPath, { bigint: true })
    const realPathAfter = fs.realpathSync.native(resolvedPath)
    if (!sameOpenFileState(linkBefore, linkAfter, description)
      || !sameOpenFileState(targetBefore, targetAfter, description)
      || pathIdentityKey(realPathBefore) !== pathIdentityKey(realPathAfter)) {
      throw new Error(`${description} changed while its identity was captured`)
    }
    return stableInputSnapshot(resolvedPath, description, linkAfter, targetAfter, realPathAfter)
  }

  let descriptor: number
  try {
    descriptor = fs.openSync(resolvedPath, 'r')
  }
  catch (error) {
    if (!unreadablePathError(error)) {
      throw error
    }
    const linkAfter = fs.lstatSync(resolvedPath, { bigint: true })
    const targetAfter = fs.statSync(resolvedPath, { bigint: true })
    const realPathAfter = fs.realpathSync.native(resolvedPath)
    if (!sameOpenFileState(linkBefore, linkAfter, description)
      || !sameOpenFileState(targetBefore, targetAfter, description)
      || pathIdentityKey(realPathBefore) !== pathIdentityKey(realPathAfter)) {
      throw new Error(`${description} changed while its readability was checked`)
    }
    return stableInputSnapshot(resolvedPath, description, linkAfter, targetAfter, realPathAfter)
  }

  let opened: { before: BigIntStats, after: BigIntStats, bytes: Buffer }
  try {
    const before = fs.fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) {
      throw new Error(`${description} must resolve to a regular file`)
    }
    const bytes = fs.readFileSync(descriptor)
    const after = fs.fstatSync(descriptor, { bigint: true })
    opened = { before, after, bytes }
  }
  finally {
    fs.closeSync(descriptor)
  }
  const linkAfter = fs.lstatSync(resolvedPath, { bigint: true })
  const targetAfter = fs.statSync(resolvedPath, { bigint: true })
  const realPathAfter = fs.realpathSync.native(resolvedPath)
  if (!sameOpenFileState(linkBefore, linkAfter, description)
    || !sameOpenFileState(targetBefore, targetAfter, description)
    || !sameOpenFileState(opened.before, opened.after, description)
    || filesystemIdentity(opened.after, description) !== filesystemIdentity(targetAfter, description)
    || pathIdentityKey(realPathBefore) !== pathIdentityKey(realPathAfter)) {
    throw new Error(`${description} changed while its identity was captured`)
  }
  return stableInputSnapshot(resolvedPath, description, linkAfter, targetAfter, realPathAfter, opened.bytes)
}

function captureOptionalInputSnapshot(filePath: string, description: string): OptionalInputSnapshot {
  try {
    fs.lstatSync(filePath)
  }
  catch (error) {
    if (missingPathError(error)) {
      return { exists: false }
    }
    throw error
  }
  return { exists: true, file: captureStableInputSnapshot(filePath, description) }
}

function sameStableInputSnapshot(left: StableInputSnapshot, right: StableInputSnapshot): boolean {
  return pathIdentityKey(left.resolvedPath) === pathIdentityKey(right.resolvedPath)
    && left.linkIdentity === right.linkIdentity
    && left.linkState === right.linkState
    && left.targetIdentity === right.targetIdentity
    && left.targetState === right.targetState
    && left.realPath === right.realPath
    && left.sha256 === right.sha256
    && left.ordinaryFile === right.ordinaryFile
}

function sameOptionalInputSnapshot(left: OptionalInputSnapshot, right: OptionalInputSnapshot): boolean {
  if (!left.exists || !right.exists) {
    return left.exists === right.exists
  }
  return sameStableInputSnapshot(left.file, right.file)
}

function captureStableFileSnapshot(filePath: string, description: string): StableFileSnapshot {
  const resolvedPath = path.resolve(filePath)
  const linkBefore = fs.lstatSync(resolvedPath, { bigint: true })
  const realPathBefore = fs.realpathSync.native(resolvedPath)
  const opened = (() => {
    const descriptor = fs.openSync(resolvedPath, 'r')
    try {
      const before = fs.fstatSync(descriptor, { bigint: true })
      if (!before.isFile()) {
        throw new Error(`${description} must resolve to a regular file`)
      }
      const bytes = fs.readFileSync(descriptor)
      const after = fs.fstatSync(descriptor, { bigint: true })
      return { before, after, bytes }
    }
    finally {
      fs.closeSync(descriptor)
    }
  })()
  const linkAfter = fs.lstatSync(resolvedPath, { bigint: true })
  const targetAfter = fs.statSync(resolvedPath, { bigint: true })
  const realPathAfter = fs.realpathSync.native(resolvedPath)
  if (filesystemIdentity(linkBefore, description) !== filesystemIdentity(linkAfter, description)
    || !sameOpenFileState(opened.before, opened.after, description)
    || filesystemIdentity(opened.after, description) !== filesystemIdentity(targetAfter, description)
    || pathIdentityKey(realPathBefore) !== pathIdentityKey(realPathAfter)) {
    throw new Error(`${description} changed while its identity was captured`)
  }
  return {
    resolvedPath,
    linkIdentity: filesystemIdentity(linkAfter, description),
    targetIdentity: filesystemIdentity(targetAfter, description),
    realPath: pathIdentityKey(realPathAfter),
    sha256: sha256(opened.bytes),
    ordinaryFile: linkAfter.isFile(),
  }
}

function captureErrorAuditSourceSha256(filePath: string): string | undefined {
  const resolvedPath = path.resolve(filePath)
  const description = `error audit source ${resolvedPath}`
  const snapshot = captureOptionalInputSnapshot(resolvedPath, description)
  return snapshot.exists ? snapshot.file.sha256 : undefined
}

function captureOptionalFileSnapshot(filePath: string, description: string): OptionalFileSnapshot {
  try {
    fs.lstatSync(filePath)
  }
  catch (error) {
    if (missingPathError(error)) {
      return { exists: false }
    }
    throw error
  }
  return { exists: true, file: captureStableFileSnapshot(filePath, description) }
}

function sameStableFileSnapshot(left: StableFileSnapshot, right: StableFileSnapshot): boolean {
  return pathIdentityKey(left.resolvedPath) === pathIdentityKey(right.resolvedPath)
    && left.linkIdentity === right.linkIdentity
    && left.targetIdentity === right.targetIdentity
    && left.realPath === right.realPath
    && left.sha256 === right.sha256
    && left.ordinaryFile === right.ordinaryFile
}

function sameOptionalFileSnapshot(left: OptionalFileSnapshot, right: OptionalFileSnapshot): boolean {
  if (!left.exists || !right.exists) {
    return left.exists === right.exists
  }
  return sameStableFileSnapshot(left.file, right.file)
}

function ancestorPaths(directoryPath: string): string[] {
  const resolvedPath = path.resolve(directoryPath)
  const root = path.parse(resolvedPath).root
  const segments = resolvedPath.slice(root.length).split(path.sep).filter(Boolean)
  const ancestors = [root]
  let current = root
  for (const segment of segments) {
    current = path.join(current, segment)
    ancestors.push(current)
  }
  return ancestors
}

function captureOutputDirectorySnapshot(directoryPath: string): OutputDirectorySnapshot {
  const resolvedPath = path.resolve(directoryPath)
  const entries = ancestorPaths(resolvedPath).map((ancestor): DirectoryEntrySnapshot => {
    const stats = fs.lstatSync(ancestor, { bigint: true })
    const realPath = fs.realpathSync.native(ancestor)
    if (!stats.isDirectory() || stats.isSymbolicLink()
      || pathIdentityKey(realPath) !== pathIdentityKey(ancestor)) {
      throw new Error(`Contract audit output parent must not contain symbolic links or junctions: ${ancestor}`)
    }
    return {
      resolvedPath: path.resolve(ancestor),
      identity: filesystemIdentity(stats, `contract audit output ancestor ${ancestor}`),
      realPath: pathIdentityKey(realPath),
    }
  })
  return { resolvedPath, entries }
}

function sameOutputDirectorySnapshot(left: OutputDirectorySnapshot, right: OutputDirectorySnapshot): boolean {
  return pathIdentityKey(left.resolvedPath) === pathIdentityKey(right.resolvedPath)
    && left.entries.length === right.entries.length
    && left.entries.every((entry, index) => {
      const counterpart = right.entries[index]
      return counterpart !== undefined
        && pathIdentityKey(entry.resolvedPath) === pathIdentityKey(counterpart.resolvedPath)
        && entry.identity === counterpart.identity
        && entry.realPath === counterpart.realPath
    })
}

function sameExistingFile(leftPath: string, rightPath: string): boolean {
  try {
    const left = fs.statSync(leftPath)
    const right = fs.statSync(rightPath)
    if (left.dev === right.dev && left.ino !== 0 && left.ino === right.ino) {
      return true
    }
    return pathIdentityKey(fs.realpathSync.native(leftPath)) === pathIdentityKey(fs.realpathSync.native(rightPath))
  }
  catch (error) {
    if (!missingPathError(error)) {
      throw error
    }
    try {
      const left = fs.lstatSync(leftPath)
      const right = fs.lstatSync(rightPath)
      return left.dev === right.dev && left.ino !== 0 && left.ino === right.ino
    }
    catch (linkError) {
      if (missingPathError(linkError)) {
        return false
      }
      throw linkError
    }
  }
}

function assertDistinctOutput(resolvedOutput: string, inputPaths: string[]): void {
  for (const inputPath of inputPaths) {
    const resolvedInput = path.resolve(inputPath)
    if (pathIdentityKey(resolvedInput) === pathIdentityKey(resolvedOutput)
      || sameExistingFile(resolvedInput, resolvedOutput)) {
      throw new Error('Contract audit output must not overwrite an input contract')
    }
  }
}

function captureInputFileSnapshots(inputPaths: string[]): InputFileSnapshot[] {
  return inputPaths.map((inputPath) => {
    const resolvedPath = path.resolve(inputPath)
    return {
      resolvedPath,
      state: captureOptionalInputSnapshot(resolvedPath, `input contract ${resolvedPath}`),
    }
  })
}

function protectedInputPaths(audit: ContractAudit, inputPaths: string[]): string[] {
  const paths = new Map<string, string>()
  for (const inputPath of inputPaths) {
    paths.set(pathIdentityKey(inputPath), inputPath)
  }
  for (const sourceName of ['expected', 'actual'] as const) {
    const source = audit.sources[sourceName]
    paths.set(pathIdentityKey(source.path), source.path)
    if (source.sha256 === undefined) {
      if (audit.status !== 'error') {
        throw new Error(`Contract audit ${sourceName} source is missing audit.sources.${sourceName}.sha256`)
      }
      continue
    }
    if (!/^[a-f0-9]{64}$/u.test(source.sha256)) {
      throw new Error(`Contract audit ${sourceName} source has an invalid audit.sources.${sourceName}.sha256`)
    }
  }
  return [...paths.values()]
}

function assertAuditSourcesMatchSnapshots(audit: ContractAudit, inputs: InputFileSnapshot[]): void {
  const snapshots = new Map(inputs.map(input => [pathIdentityKey(input.resolvedPath), input]))
  for (const sourceName of ['expected', 'actual'] as const satisfies readonly AuditSourceName[]) {
    const source = audit.sources[sourceName]
    if (source.sha256 === undefined) {
      continue
    }
    const snapshot = snapshots.get(pathIdentityKey(source.path))
    if (snapshot === undefined || !snapshot.state.exists || snapshot.state.file.sha256 !== source.sha256) {
      throw new Error(
        `Contract audit ${sourceName} source content does not match audit.sources.${sourceName}.sha256`,
      )
    }
  }
}

function recaptureInputs(baseline: InputFileSnapshot[]): InputFileSnapshot[] {
  return baseline.map((input) => {
    let current: OptionalInputSnapshot
    try {
      current = captureOptionalInputSnapshot(input.resolvedPath, `input contract ${input.resolvedPath}`)
    }
    catch {
      throw new Error(`Input contract changed before audit promotion: ${input.resolvedPath}`)
    }
    if (!sameOptionalInputSnapshot(input.state, current)) {
      throw new Error(`Input contract changed before audit promotion: ${input.resolvedPath}`)
    }
    return { resolvedPath: input.resolvedPath, state: current }
  })
}

function assertOutputDirectoryUnchanged(baseline: OutputDirectorySnapshot): void {
  let current: OutputDirectorySnapshot
  try {
    current = captureOutputDirectorySnapshot(baseline.resolvedPath)
  }
  catch {
    throw new Error('Contract audit output directory changed before audit promotion')
  }
  if (!sameOutputDirectorySnapshot(baseline, current)) {
    throw new Error('Contract audit output directory changed before audit promotion')
  }
}

interface AuditCommitFileSnapshot {
  linkIdentity: string
  targetIdentity: string
  realPath: string
  sha256: string
  ordinaryFile: boolean
}

type AuditCommitOptionalFileSnapshot
  = | { exists: false }
    | { exists: true, file: AuditCommitFileSnapshot }

interface AuditCommitInputFileSnapshot {
  linkIdentity: string
  linkState: string
  targetIdentity: string | null
  targetState: string | null
  realPath: string | null
  sha256?: string
  ordinaryFile: boolean
}

type AuditCommitOptionalInputSnapshot
  = | { exists: false }
    | { exists: true, file: AuditCommitInputFileSnapshot }

interface AuditCommitInput {
  baseline: AuditCommitOptionalInputSnapshot
  path: string
  sourceNames: AuditSourceName[]
}

interface AuditCommitRequest {
  contentSha256: string
  directoryIdentity: string
  protectedInputs: AuditCommitInput[]
  targetBaseline: AuditCommitOptionalFileSnapshot
  targetName: string
}

interface AuditCommitResponse {
  message?: string
  ok: boolean
}

const AUDIT_COMMIT_RESPONSE_PREFIX = 'AIRULES_CONTRACT_AUDIT_COMMIT:'
const AUDIT_COMMIT_CHILD_SCRIPT = String.raw`
'use strict'
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const RESPONSE_PREFIX = 'AIRULES_CONTRACT_AUDIT_COMMIT:'

function digest(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function missingPath(error) {
  return error !== null && typeof error === 'object'
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

function identity(stats, description) {
  if (stats.ino === 0n) {
    throw new Error('Stable filesystem identity is unavailable for ' + description)
  }
  return String(stats.dev) + ':' + String(stats.ino) + ':' + String(stats.mode & 0o170000n)
}

function sameOpenState(left, right, description) {
  return identity(left, description) === identity(right, description)
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs
}

function state(stats, description) {
  return identity(stats, description) + ':' + String(stats.size) + ':' + String(stats.mtimeNs) + ':' + String(stats.ctimeNs)
}

function pathIdentity(value) {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function reservedWindowsTargetName(targetName) {
  const stem = String(targetName.split('.')[0] || '').toUpperCase()
  return ['CON', 'PRN', 'AUX', 'NUL', 'CLOCK$', 'CONIN$', 'CONOUT$'].includes(stem)
    || /^(?:COM|LPT)[1-9]$/.test(stem)
}

function assertSafeTargetName(targetName) {
  if (targetName === '' || targetName === '.' || targetName === '..'
    || targetName.includes('/') || targetName.includes('\\')) {
    throw new Error('Contract audit target must be a non-empty direct child of the anchored output directory')
  }
  if (process.platform !== 'win32')
    return
  const invalidCharacters = '<>:"/\\|?*'
  const hasInvalidCharacter = Array.from(targetName).some((character) => {
    const codePoint = character.codePointAt(0) || 0
    return codePoint <= 0x1F || invalidCharacters.includes(character)
  })
  if (hasInvalidCharacter || /[. ]$/.test(targetName) || reservedWindowsTargetName(targetName))
    throw new Error('Contract audit target basename is unsafe on Windows: ' + JSON.stringify(targetName))
}

function stableFile(filePath, description, requireOrdinaryLink) {
  const linkBefore = fs.lstatSync(filePath, { bigint: true })
  if (requireOrdinaryLink && (!linkBefore.isFile() || linkBefore.isSymbolicLink())) {
    throw new Error(description + ' must be an ordinary file')
  }
  const realBefore = fs.realpathSync.native(filePath)
  const descriptor = fs.openSync(filePath, 'r')
  let opened
  try {
    const before = fs.fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) {
      throw new Error(description + ' must resolve to a regular file')
    }
    const bytes = fs.readFileSync(descriptor)
    const after = fs.fstatSync(descriptor, { bigint: true })
    opened = { before, after, bytes }
  }
  finally {
    fs.closeSync(descriptor)
  }
  const linkAfter = fs.lstatSync(filePath, { bigint: true })
  const targetAfter = fs.statSync(filePath, { bigint: true })
  const realAfter = fs.realpathSync.native(filePath)
  if (identity(linkBefore, description) !== identity(linkAfter, description)
    || !sameOpenState(opened.before, opened.after, description)
    || identity(opened.after, description) !== identity(targetAfter, description)
    || pathIdentity(realBefore) !== pathIdentity(realAfter)) {
    throw new Error(description + ' changed while its identity was captured')
  }
  return {
    bytes: opened.bytes,
    linkIdentity: identity(linkAfter, description),
    linkState: state(linkAfter, description),
    ordinaryFile: linkAfter.isFile(),
    realPath: pathIdentity(realAfter),
    sha256: digest(opened.bytes),
    targetIdentity: identity(targetAfter, description),
    targetState: state(targetAfter, description),
  }
}

function stableIdentity(filePath, description) {
  const linkBefore = fs.lstatSync(filePath, { bigint: true })
  let targetBefore
  try {
    targetBefore = fs.statSync(filePath, { bigint: true })
  }
  catch (error) {
    if (!missingPath(error))
      throw error
    const linkAfter = fs.lstatSync(filePath, { bigint: true })
    let targetStillMissing = false
    try {
      fs.statSync(filePath, { bigint: true })
    }
    catch (recheckError) {
      if (!missingPath(recheckError))
        throw recheckError
      targetStillMissing = true
    }
    const linkFinal = fs.lstatSync(filePath, { bigint: true })
    if (!targetStillMissing
      || !sameOpenState(linkBefore, linkAfter, description)
      || !sameOpenState(linkAfter, linkFinal, description)) {
      throw new Error(description + ' changed while its missing target was captured')
    }
    return {
      linkIdentity: identity(linkFinal, description),
      linkState: state(linkFinal, description),
      ordinaryFile: linkFinal.isFile(),
      realPath: null,
      targetIdentity: null,
      targetState: null,
    }
  }
  const realBefore = fs.realpathSync.native(filePath)
  const linkAfter = fs.lstatSync(filePath, { bigint: true })
  const targetAfter = fs.statSync(filePath, { bigint: true })
  const realAfter = fs.realpathSync.native(filePath)
  if (!sameOpenState(linkBefore, linkAfter, description)
    || !sameOpenState(targetBefore, targetAfter, description)
    || pathIdentity(realBefore) !== pathIdentity(realAfter)) {
    throw new Error(description + ' changed while its identity was captured')
  }
  return {
    linkIdentity: identity(linkAfter, description),
    linkState: state(linkAfter, description),
    ordinaryFile: linkAfter.isFile(),
    realPath: pathIdentity(realAfter),
    targetIdentity: identity(targetAfter, description),
    targetState: state(targetAfter, description),
  }
}

function optionalStableFile(filePath, description, requireOrdinaryLink) {
  try {
    return stableFile(filePath, description, requireOrdinaryLink)
  }
  catch (error) {
    if (missingPath(error)) {
      return undefined
    }
    throw error
  }
}

function optionalInput(filePath, description, baseline) {
  try {
    return baseline.exists && baseline.file.sha256 !== undefined
      ? stableFile(filePath, description, false)
      : stableIdentity(filePath, description)
  }
  catch (error) {
    if (missingPath(error)) {
      return undefined
    }
    throw error
  }
}

function assertDirectoryIdentity(relativePath, expectedIdentity, description) {
  const stats = fs.statSync(relativePath, { bigint: true })
  if (!stats.isDirectory() || identity(stats, description) !== expectedIdentity) {
    throw new Error(description + ' identity does not match the anchored output directory')
  }
}

function readDescriptor(descriptor, length) {
  const bytes = Buffer.alloc(length)
  let offset = 0
  while (offset < length) {
    const count = fs.readSync(descriptor, bytes, offset, length - offset, offset)
    if (count === 0) {
      break
    }
    offset += count
  }
  if (offset !== length) {
    throw new Error('Contract audit target payload could not be read completely')
  }
  return bytes
}

function writeDescriptor(descriptor, content, position) {
  let offset = 0
  while (offset < content.length) {
    const count = fs.writeSync(descriptor, content, offset, content.length - offset, position + offset)
    if (count === 0) {
      throw new Error('Contract audit target payload could not be written completely')
    }
    offset += count
  }
}

function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : String(error)
}

function rollbackSemanticMarker(descriptor, payloadIdentity, contentLength, validationError) {
  try {
    writeDescriptor(descriptor, Buffer.from('!', 'ascii'), 0)
    fs.fsyncSync(descriptor)
    const rolledBackStats = fs.fstatSync(descriptor, { bigint: true })
    if (!rolledBackStats.isFile()
      || identity(rolledBackStats, 'rolled-back contract audit target') !== payloadIdentity
      || rolledBackStats.size !== BigInt(contentLength)) {
      throw new Error('rolled-back target descriptor identity or size changed')
    }
    const marker = readDescriptor(descriptor, 1)
    if (marker[0] !== 0x21)
      throw new Error('rolled-back target marker is not invalid JSON')
  }
  catch (markerInvalidationError) {
    try {
      fs.ftruncateSync(descriptor, 0)
      fs.fsyncSync(descriptor)
      const truncatedStats = fs.fstatSync(descriptor, { bigint: true })
      if (!truncatedStats.isFile()
        || identity(truncatedStats, 'truncated contract audit target') !== payloadIdentity
        || truncatedStats.size !== 0n) {
        throw new Error('truncated target descriptor identity or size changed')
      }
    }
    catch (truncateInvalidationError) {
      throw new Error(
        'Contract audit semantic invalidation could not be guaranteed after validation error: '
        + errorMessage(validationError)
        + '; marker invalidation error: ' + errorMessage(markerInvalidationError)
        + '; truncation invalidation error: ' + errorMessage(truncateInvalidationError),
      )
    }
  }
  throw validationError
}

function sameContent(snapshot, content, expectedSha256) {
  return snapshot.sha256 === expectedSha256 && snapshot.bytes.equals(content)
}

function sameSnapshot(snapshot, baseline) {
  return snapshot.linkIdentity === baseline.linkIdentity
    && snapshot.targetIdentity === baseline.targetIdentity
    && snapshot.realPath === baseline.realPath
    && snapshot.sha256 === baseline.sha256
    && snapshot.ordinaryFile === baseline.ordinaryFile
}

function sameInputSnapshot(snapshot, baseline) {
  return snapshot.linkIdentity === baseline.linkIdentity
    && snapshot.linkState === baseline.linkState
    && snapshot.targetIdentity === baseline.targetIdentity
    && snapshot.targetState === baseline.targetState
    && snapshot.realPath === baseline.realPath
    && snapshot.sha256 === baseline.sha256
    && snapshot.ordinaryFile === baseline.ordinaryFile
}

function sameOptionalSnapshot(snapshot, baseline) {
  if (snapshot === undefined || baseline.exists === false) {
    return snapshot === undefined && baseline.exists === false
  }
  return sameSnapshot(snapshot, baseline.file)
}

function sameOptionalInputSnapshot(snapshot, baseline) {
  if (snapshot === undefined || baseline.exists === false) {
    return snapshot === undefined && baseline.exists === false
  }
  return sameInputSnapshot(snapshot, baseline.file)
}

function assertNotProtectedInput(snapshot, protectedInputIdentities) {
  if (protectedInputIdentities.has(snapshot.targetIdentity)) {
    throw new Error('Contract audit output must not overwrite or alias an input contract')
  }
}

function inputChanged(input, current) {
  for (const sourceName of input.sourceNames) {
    if (input.baseline.exists && current !== undefined
      && input.baseline.file.sha256 !== current.sha256) {
      throw new Error(
        'Contract audit ' + sourceName + ' source content does not match audit.sources.'
        + sourceName + '.sha256',
      )
    }
  }
  throw new Error('Input contract changed before audit commit: ' + input.path)
}

function assertInputsMatch(inputs) {
  const identities = new Set()
  for (const input of inputs) {
    let current
    try {
      current = optionalInput(input.path, 'protected input contract ' + input.path, input.baseline)
    }
    catch {
      inputChanged(input, undefined)
    }
    if (!sameOptionalInputSnapshot(current, input.baseline)) {
      inputChanged(input, current)
    }
    if (current !== undefined && current.targetIdentity !== null) {
      identities.add(current.targetIdentity)
    }
  }
  return identities
}

function targetChangedSinceBaseline(targetBaseline) {
  if (targetBaseline.exists) {
    throw new Error('Contract audit output target changed after its baseline was captured')
  }
  throw new Error('Contract audit output target appeared after its absent baseline was captured')
}

function commit(request, content) {
  assertSafeTargetName(request.targetName)
  if (content.length === 0 || content[0] !== 0x7B) {
    throw new Error('Serialized contract audit must begin with a JSON object marker')
  }
  if (digest(content) !== request.contentSha256) {
    throw new Error('Contract audit payload hash changed before commit')
  }
  assertDirectoryIdentity('.', request.directoryIdentity, 'contract audit output directory')

  const initialInputIdentities = assertInputsMatch(request.protectedInputs)
  const initialTarget = optionalStableFile(request.targetName, 'contract audit target baseline', true)
  if (!sameOptionalSnapshot(initialTarget, request.targetBaseline)) {
    if (initialTarget !== undefined) {
      assertNotProtectedInput(initialTarget, initialInputIdentities)
    }
    targetChangedSinceBaseline(request.targetBaseline)
  }

  if (request.targetBaseline.exists) {
    const finalInputIdentities = assertInputsMatch(request.protectedInputs)
    const existing = optionalStableFile(request.targetName, 'existing contract audit target', true)
    if (!sameOptionalSnapshot(existing, request.targetBaseline)) {
      targetChangedSinceBaseline(request.targetBaseline)
    }
    assertNotProtectedInput(existing, finalInputIdentities)
    if (sameContent(existing, content, request.contentSha256)) {
      return
    }
    throw new Error('Contract audit output already exists with different content; refusing to overwrite it')
  }

  const createInputIdentities = assertInputsMatch(request.protectedInputs)
  let descriptor
  try {
    descriptor = fs.openSync(request.targetName, 'wx+', 0o600)
  }
  catch (error) {
    if (!error || error.code !== 'EEXIST') {
      throw error
    }
    let concurrent
    try {
      concurrent = optionalStableFile(request.targetName, 'concurrent contract audit target', true)
    }
    catch {
      concurrent = undefined
    }
    if (concurrent !== undefined) {
      assertNotProtectedInput(concurrent, createInputIdentities)
    }
    throw new Error('Contract audit output target appeared at the exclusive create entry point')
  }

  try {
    const before = fs.fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) {
      throw new Error('Contract audit target payload must be a regular file')
    }
    const payloadIdentity = identity(before, 'contract audit target payload')
    const stagedContent = Buffer.from(content)
    stagedContent[0] = 0x21
    writeDescriptor(descriptor, stagedContent, 0)
    fs.fsyncSync(descriptor)
    const after = fs.fstatSync(descriptor, { bigint: true })
    if (!after.isFile()
      || identity(after, 'contract audit target payload') !== payloadIdentity
      || after.size !== BigInt(content.length)) {
      throw new Error('Contract audit target payload changed while its invalid marker was written')
    }
    const written = readDescriptor(descriptor, content.length)
    if (!written.equals(stagedContent)) {
      throw new Error('Contract audit target payload content changed while its invalid marker was written')
    }

    const stagedTarget = stableFile(request.targetName, 'staged contract audit target', true)
    if (stagedTarget.targetIdentity !== payloadIdentity || !stagedTarget.bytes.equals(stagedContent)) {
      throw new Error('Contract audit output target changed before semantic commit')
    }
    const commitInputIdentities = assertInputsMatch(request.protectedInputs)
    assertNotProtectedInput(stagedTarget, commitInputIdentities)

    let markerAttempted = false
    try {
      markerAttempted = true
      writeDescriptor(descriptor, content.subarray(0, 1), 0)
      fs.fsyncSync(descriptor)
      const committedStats = fs.fstatSync(descriptor, { bigint: true })
      if (!committedStats.isFile()
        || identity(committedStats, 'committed contract audit target') !== payloadIdentity
        || committedStats.size !== BigInt(content.length)) {
        throw new Error('Contract audit target payload changed during semantic commit')
      }
      const committedBytes = readDescriptor(descriptor, content.length)
      if (digest(committedBytes) !== request.contentSha256 || !committedBytes.equals(content)) {
        throw new Error('Contract audit target payload content changed during semantic commit')
      }
      const postMarkerInputIdentities = assertInputsMatch(request.protectedInputs)
      const installed = stableFile(request.targetName, 'installed contract audit target', true)
      if (installed.targetIdentity !== payloadIdentity
        || !sameContent(installed, content, request.contentSha256)) {
        throw new Error('Contract audit output target changed during semantic commit')
      }
      assertNotProtectedInput(installed, postMarkerInputIdentities)
    }
    catch (error) {
      if (markerAttempted)
        rollbackSemanticMarker(descriptor, payloadIdentity, content.length, error)
      throw error
    }
  }
  finally {
    fs.closeSync(descriptor)
  }
}

try {
  const envelope = fs.readFileSync(0)
  const separator = envelope.indexOf(0x0A)
  if (separator < 1) {
    throw new Error('Contract audit commit envelope is invalid')
  }
  const request = JSON.parse(Buffer.from(envelope.subarray(0, separator).toString('ascii'), 'base64').toString('utf8'))
  const content = envelope.subarray(separator + 1)
  commit(request, content)
  process.stdout.write(RESPONSE_PREFIX + JSON.stringify({ ok: true }) + '\n')
}
catch (error) {
  const message = error instanceof Error && error.message ? error.message : String(error)
  process.stdout.write(RESPONSE_PREFIX + JSON.stringify({ ok: false, message }) + '\n')
  process.exitCode = 1
}
`

function toAuditCommitSnapshot(snapshot: OptionalFileSnapshot): AuditCommitOptionalFileSnapshot {
  if (!snapshot.exists) {
    return { exists: false }
  }
  return {
    exists: true,
    file: {
      linkIdentity: snapshot.file.linkIdentity,
      targetIdentity: snapshot.file.targetIdentity,
      realPath: snapshot.file.realPath,
      sha256: snapshot.file.sha256,
      ordinaryFile: snapshot.file.ordinaryFile,
    },
  }
}

function toAuditCommitInputSnapshot(snapshot: OptionalInputSnapshot): AuditCommitOptionalInputSnapshot {
  if (!snapshot.exists) {
    return { exists: false }
  }
  return {
    exists: true,
    file: {
      linkIdentity: snapshot.file.linkIdentity,
      linkState: snapshot.file.linkState,
      targetIdentity: snapshot.file.targetIdentity,
      targetState: snapshot.file.targetState,
      realPath: snapshot.file.realPath,
      ...(snapshot.file.sha256 === undefined ? {} : { sha256: snapshot.file.sha256 }),
      ordinaryFile: snapshot.file.ordinaryFile,
    },
  }
}

function commitContractAudit(
  resolvedOutput: string,
  content: string,
  contentSha256: string,
  audit: ContractAudit,
  inputBaseline: InputFileSnapshot[],
  targetBaseline: OptionalFileSnapshot,
  outputDirectory: OutputDirectorySnapshot,
): void {
  const directoryEntry = outputDirectory.entries.at(-1)
  if (directoryEntry === undefined) {
    throw new Error('Contract audit output directory identity is unavailable')
  }
  const targetName = path.basename(resolvedOutput)
  const sourceNamesByPath = new Map<string, AuditSourceName[]>()
  for (const sourceName of ['expected', 'actual'] as const) {
    const sourceKey = pathIdentityKey(audit.sources[sourceName].path)
    sourceNamesByPath.set(sourceKey, [...(sourceNamesByPath.get(sourceKey) ?? []), sourceName])
  }
  const request: AuditCommitRequest = {
    contentSha256,
    directoryIdentity: directoryEntry.identity,
    protectedInputs: inputBaseline.map((input): AuditCommitInput => ({
      baseline: toAuditCommitInputSnapshot(input.state),
      path: input.resolvedPath,
      sourceNames: sourceNamesByPath.get(pathIdentityKey(input.resolvedPath)) ?? [],
    })),
    targetBaseline: toAuditCommitSnapshot(targetBaseline),
    targetName,
  }
  const encodedRequest = Buffer.from(JSON.stringify(request), 'utf8').toString('base64')
  const commitEnvelope = Buffer.concat([
    Buffer.from(`${encodedRequest}\n`, 'ascii'),
    Buffer.from(content, 'utf8'),
  ])
  const result = childProcess.spawnSync(
    process.execPath,
    ['--input-type=commonjs', '--eval', AUDIT_COMMIT_CHILD_SCRIPT],
    {
      cwd: outputDirectory.resolvedPath,
      encoding: 'utf8',
      input: commitEnvelope,
      maxBuffer: 1024 * 1024,
      shell: false,
      windowsHide: true,
    },
  )
  if (result.error !== undefined) {
    throw new Error(`Unable to start anchored contract audit commit: ${result.error.message}`)
  }
  const responseLine = result.stdout
    .split(/\r?\n/u)
    .reverse()
    .find(line => line.startsWith(AUDIT_COMMIT_RESPONSE_PREFIX))
  if (responseLine === undefined) {
    const detail = result.stderr.trim() || `child exit status ${String(result.status)}`
    throw new Error(`Anchored contract audit commit returned no valid response: ${detail}`)
  }
  let response: AuditCommitResponse
  try {
    response = JSON.parse(responseLine.slice(AUDIT_COMMIT_RESPONSE_PREFIX.length)) as AuditCommitResponse
  }
  catch {
    throw new Error('Anchored contract audit commit returned an invalid response')
  }
  if (!response.ok || result.status !== 0) {
    throw new Error(response.message?.trim() || 'Anchored contract audit commit failed')
  }
}

export function writeContractAudit(outputPath: string, audit: ContractAudit, inputPaths: string[] = []): void {
  const resolvedOutput = path.resolve(outputPath)
  assertSafeAuditTargetName(path.basename(resolvedOutput))
  const protectedInputs = protectedInputPaths(audit, inputPaths)
  assertDistinctOutput(resolvedOutput, protectedInputs)
  const inputBaseline = captureInputFileSnapshots(protectedInputs)
  assertAuditSourcesMatchSnapshots(audit, inputBaseline)
  const content = serializeContractAudit(audit)
  const contentSha256 = sha256(content)
  const outputDirectoryPath = path.dirname(resolvedOutput)
  fs.mkdirSync(outputDirectoryPath, { recursive: true })
  const outputDirectoryBaseline = captureOutputDirectorySnapshot(outputDirectoryPath)
  const targetBaseline = captureOptionalFileSnapshot(resolvedOutput, `contract audit output ${resolvedOutput}`)
  recaptureInputs(inputBaseline)
  assertOutputDirectoryUnchanged(outputDirectoryBaseline)
  commitContractAudit(
    resolvedOutput,
    content,
    contentSha256,
    audit,
    inputBaseline,
    targetBaseline,
    outputDirectoryBaseline,
  )
  assertOutputDirectoryUnchanged(outputDirectoryBaseline)
}
