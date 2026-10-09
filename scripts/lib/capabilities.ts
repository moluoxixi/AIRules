import type {
  CapabilityDefinition,
  CapabilityName,
  CapabilitySelection,
  CapabilityVendorEntry,
  ComposeCapabilitiesOptions,
} from './types/capabilities.js'
import type { SetupCommand, SkillDef, VendorProjection, VendorRepo } from './types/manifest.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseDocument } from 'yaml'
import { setupIdentity } from './mcp-catalog.js'

export type { CapabilityDefinition, CapabilityName, CapabilitySelection, ComposeCapabilitiesOptions } from './types/capabilities.js'

/**
 * Capability content is data owned by each directory. This loader is the
 * shared runtime that turns capability.yaml into the existing vendor model.
 */
const capabilityRoot = resolveCapabilityRoot()
export const CAPABILITY_NAMES = Object.freeze(discoverCapabilityNames(capabilityRoot))
export const capabilityRegistry: Readonly<Record<CapabilityName, CapabilityDefinition>> = Object.freeze(
  Object.fromEntries(CAPABILITY_NAMES.map(name => [name, loadCapabilityDefinition(name)])),
)

export function loadCapabilityDefinition(name: CapabilityName): CapabilityDefinition {
  const declarationPath = path.join(capabilityRoot, name, 'capability.yaml')
  if (!fs.existsSync(declarationPath))
    throw new Error(`Capability "${name}" declaration is missing: ${declarationPath}`)

  const document = parseDocument(fs.readFileSync(declarationPath, 'utf8'), {
    merge: false,
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  })
  if (document.errors.length > 0) {
    throw new Error(`Capability "${name}" declaration is invalid: ${document.errors.map(error => error.message).join('; ')}`)
  }

  const value = document.toJS({ maxAliasCount: 0 }) as unknown
  if (!isRecord(value))
    throw new Error(`Capability "${name}" declaration must be a YAML mapping`)
  if (value.schema_version !== 1)
    throw new Error(`Capability "${name}" declaration must use schema_version: 1`)
  if (value.capability_id !== name)
    throw new Error(`Capability "${name}" declaration capability_id must equal "${name}"`)

  const roleProjections = readProjections(value.role_projections, name, true)
  const vendors = readVendors(value.vendors, name)
  return {
    ...(roleProjections.length === 0 ? {} : { roleProjections }),
    ...(vendors.length === 0 ? {} : { vendors }),
  }
}

function resolveCapabilityRoot(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    moduleDirectory,
    path.join(moduleDirectory, '..', 'capabilities'),
    path.join(moduleDirectory, '..', '..', 'capabilities'),
    path.join(moduleDirectory, '..', '..', '..', 'capabilities'),
  ]
  const root = candidates.find(candidate => fs.existsSync(path.join(candidate, 'common', 'capability.yaml')))
  if (!root)
    throw new Error(`Unable to locate capability declarations from ${moduleDirectory}`)
  return root
}

function discoverCapabilityNames(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'capability.yaml')))
    .map(entry => entry.name)
    .sort()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function requireRecord(value: unknown, location: string): Record<string, unknown> {
  if (!isRecord(value))
    throw new TypeError(`${location} must be an object`)
  return value
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${location} must be a non-empty string`)
  return value
}

function optionalString(value: unknown, location: string): string | undefined {
  if (value === undefined)
    return undefined
  return requireString(value, location)
}

function readArray(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value))
    throw new TypeError(`${location} must be an array`)
  return value
}

function readField(record: Record<string, unknown>, snake: string, camel: string): unknown {
  return record[snake] ?? record[camel]
}

function readSetup(value: unknown, location: string): SetupCommand[] | undefined {
  if (value === undefined)
    return undefined
  return readArray(value, location).map((entry, index) => {
    const record = requireRecord(entry, `${location}[${index}]`)
    const command = requireString(record.command, `${location}[${index}].command`)
    const args = record.args
    if (args !== undefined && (!Array.isArray(args) || args.some(argument => typeof argument !== 'string'))) {
      throw new TypeError(`${location}[${index}].args must be an array of strings`)
    }
    const windowsCommandShim = readField(record, 'windows_command_shim', 'windowsCommandShim')
    const skipIfCommandAvailable = readField(record, 'skip_if_command_available', 'skipIfCommandAvailable')
    if (windowsCommandShim !== undefined && typeof windowsCommandShim !== 'boolean')
      throw new TypeError(`${location}[${index}].windows_command_shim must be boolean`)
    if (skipIfCommandAvailable !== undefined && typeof skipIfCommandAvailable !== 'string')
      throw new TypeError(`${location}[${index}].skip_if_command_available must be a string`)
    return {
      command,
      ...(args === undefined ? {} : { args: args as string[] }),
      ...(windowsCommandShim === undefined ? {} : { windowsCommandShim }),
      ...(skipIfCommandAvailable === undefined ? {} : { skipIfCommandAvailable }),
    }
  })
}

function capabilitySourcePath(name: string, configured: string): string {
  const normalized = configured.replaceAll('\\', '/')
  if (normalized.startsWith('capabilities/'))
    return normalized
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../'))
    throw new Error(`Capability "${name}" source path must stay inside its directory: ${configured}`)
  return path.posix.join('capabilities', name, normalized)
}

function readProjections(value: unknown, capabilityName: string, localSource: boolean): VendorProjection[] {
  if (value === undefined)
    return []
  return readArray(value, `Capability "${capabilityName}" projections`).map((entry, index) => {
    const location = `Capability "${capabilityName}" projection ${index}`
    const record = requireRecord(entry, location)
    const kind = requireString(record.kind, `${location}.kind`)
    if (kind === 'namespace') {
      const source = requireString(readField(record, 'source_dir', 'sourceDir'), `${location}.source_dir`)
      return {
        kind,
        sourceDir: localSource ? capabilitySourcePath(capabilityName, source) : source,
        output: requireString(record.output, `${location}.output`),
        ...(readSetup(record.setup, `${location}.setup`) === undefined
          ? {}
          : { setup: readSetup(record.setup, `${location}.setup`) }),
      }
    }
    if (kind === 'skills') {
      const source = requireString(readField(record, 'source_base_dir', 'sourceBaseDir'), `${location}.source_base_dir`)
      return {
        kind,
        sourceBaseDir: source,
        skills: readArray(record.skills, `${location}.skills`).map((skill, skillIndex) => readSkill(skill, `${location}.skills[${skillIndex}]`)),
      }
    }
    if (kind === 'mcp') {
      const source = requireString(readField(record, 'source_file', 'sourceFile'), `${location}.source_file`)
      return {
        kind,
        sourceFile: localSource ? capabilitySourcePath(capabilityName, source) : source,
        output: requireString(record.output, `${location}.output`),
      }
    }
    if (kind === 'role-assets') {
      return {
        kind,
        sourceDir: requireString(readField(record, 'source_dir', 'sourceDir'), `${location}.source_dir`),
      }
    }
    throw new Error(`${location} has unknown kind "${kind}"`)
  })
}

function readSkill(value: unknown, location: string): SkillDef {
  if (typeof value === 'string')
    return value
  const record = requireRecord(value, location)
  const name = requireString(record.name, `${location}.name`)
  const output = optionalString(record.output, `${location}.output`)
  const setup = readSetup(record.setup, `${location}.setup`)
  return {
    name,
    ...(output === undefined ? {} : { output }),
    ...(setup === undefined ? {} : { setup }),
  }
}

function readVendors(value: unknown, capabilityName: string): VendorRepo[] {
  if (value === undefined)
    return []
  return readArray(value, `Capability "${capabilityName}" vendors`).map((entry, index) => {
    const location = `Capability "${capabilityName}" vendor ${index}`
    const record = requireRecord(entry, location)
    const name = requireString(record.name, `${location}.name`)
    const source = requireString(record.source, `${location}.source`)
    const revision = optionalString(record.revision, `${location}.revision`)
    const setup = readSetup(record.setup, `${location}.setup`)
    const projections = readProjections(record.projections, capabilityName, false)
    if (projections.length === 0 && (!setup || setup.length === 0))
      throw new Error(`${location} must declare projections or setup`)
    return {
      name,
      source,
      ...(revision === undefined ? {} : { revision }),
      ...(setup === undefined ? {} : { setup }),
      projections,
    }
  })
}

export function composeCapabilities(
  capabilities: readonly CapabilityName[],
  options: ComposeCapabilitiesOptions,
): VendorRepo[] {
  const selections = capabilities.map((name) => {
    const definition = capabilityRegistry[name]
    if (!definition)
      throw new Error(`Unknown capability "${name}"`)
    return { name, definition }
  })
  return composeCapabilityDefinitions(selections, options)
}

export function composeCapabilityDefinitions(
  selections: readonly CapabilitySelection[],
  options: ComposeCapabilitiesOptions,
): VendorRepo[] {
  const seenCapabilities = new Set<string>()
  const roleVendor = cloneVendor(options.roleVendor)
  const capabilityVendors: Array<{ vendor: VendorRepo, origin: string }> = []
  const roleOrigin = options.roleOrigin ?? 'selected role installation'
  const roleProjections = new Map<string, string[]>()

  for (const selection of selections) {
    if (seenCapabilities.has(selection.name))
      throw new Error(`Capability "${selection.name}" is declared more than once`)
    seenCapabilities.add(selection.name)

    const origin = selection.origin ?? options.capabilityOrigins?.[selection.name] ?? `capability ${selection.name}`
    for (const projection of selection.definition.roleProjections ?? []) {
      appendProjection(roleVendor, projection)
      const key = projectionKey(projection)
      const origins = roleProjections.get(key) ?? []
      origins.push(origin)
      roleProjections.set(key, origins)
    }
    for (const vendor of selection.definition.vendors ?? [])
      capabilityVendors.push({ vendor: cloneVendor(vendor), origin })
  }

  const roleProjectionOrigins = roleVendor.projections.map((projection) => {
    const origins = roleProjections.get(projectionKey(projection))
    return origins?.length ? [...new Set(origins)] : [roleOrigin]
  })

  const sequence = options.roleVendorPosition === 'after'
    ? [...capabilityVendors, { vendor: roleVendor, origin: roleOrigin, projectionOrigins: roleProjectionOrigins }]
    : [{ vendor: roleVendor, origin: roleOrigin, projectionOrigins: roleProjectionOrigins }, ...capabilityVendors]
  return mergeVendors(sequence)
}

function mergeVendors(sequence: readonly CapabilityVendorEntry[]): VendorRepo[] {
  const result: VendorRepo[] = []
  const byName = new Map<string, { vendor: VendorRepo, origin: string, projectionOrigins: string[][] }>()

  for (const entry of sequence) {
    const candidate = entry.vendor
    const caseAlias = [...byName.keys()].find(name => name.toLowerCase() === candidate.name.toLowerCase() && name !== candidate.name)
    if (caseAlias)
      throw new Error(`Vendor names differ only by case: ${caseAlias} (${byName.get(caseAlias)!.origin}), ${candidate.name} (${entry.origin})`)
    const existingEntry = byName.get(candidate.name)
    const existing = existingEntry?.vendor
    if (!existing) {
      const cloned = cloneVendor(candidate)
      byName.set(cloned.name, {
        vendor: cloned,
        origin: entry.origin,
        projectionOrigins: entry.projectionOrigins ?? cloned.projections.map(() => [entry.origin]),
      })
      result.push(cloned)
      continue
    }

    if (
      existing.source !== candidate.source
      || existing.revision !== candidate.revision
      || setupKey(existing.setup) !== setupKey(candidate.setup)
    ) {
      throw new Error(`Vendor "${candidate.name}" has conflicting source, revision, or setup definitions between ${existingEntry?.origin} and ${entry.origin}`)
    }
    for (const [index, projection] of candidate.projections.entries()) {
      const projectionOwner = existing.projections.findIndex(existingProjection => projectionKey(existingProjection) === projectionKey(projection))
      if (projectionOwner >= 0) {
        const origins = entry.projectionOrigins?.[index] ?? [entry.origin]
        existingEntry!.projectionOrigins[projectionOwner] = [...new Set([...existingEntry!.projectionOrigins[projectionOwner]!, ...origins])]
        continue
      }
      appendProjection(existing, projection)
      existingEntry!.projectionOrigins.push(entry.projectionOrigins?.[index] ?? [entry.origin])
    }
    existingEntry!.origin = `${existingEntry!.origin}, ${entry.origin}`
  }

  validateProjectionTargets([...byName.values()])
  return result
}

function appendProjection(vendor: VendorRepo, projection: VendorProjection): void {
  const key = projectionKey(projection)
  if (vendor.projections.some(existing => projectionKey(existing) === key))
    return
  vendor.projections.push(cloneProjection(projection))
}

function validateProjectionTargets(vendors: readonly { vendor: VendorRepo, origin: string, projectionOrigins: string[][] }[]): void {
  const owners = new Map<string, { projection: string, vendor: string, origin: string }>()
  for (const entry of vendors) {
    const vendor = entry.vendor
    for (const [index, projection] of vendor.projections.entries()) {
      for (const { target, identity } of projectionClaims(projection)) {
        const owner = owners.get(target.toLowerCase())
        if (owner && (owner.vendor !== vendor.name || owner.projection !== identity)) {
          throw new Error(
            `Projection target "${target}" conflicts between vendor "${owner.vendor}" (${owner.origin}) and vendor "${vendor.name}" (${entry.projectionOrigins[index]?.join(', ') ?? entry.origin})`,
          )
        }
        owners.set(target.toLowerCase(), { projection: identity, vendor: vendor.name, origin: entry.projectionOrigins[index]?.join(', ') ?? entry.origin })
      }
    }
  }
}

function projectionClaims(projection: VendorProjection): Array<{ target: string, identity: string }> {
  const identity = projectionKey(projection)
  if (projection.kind === 'namespace')
    return [{ target: `skill-namespace:${leafName(projection.output)}`, identity }]
  if (projection.kind === 'skills') {
    return projection.skills.map((skill) => {
      const source = typeof skill === 'string' ? skill : skill.name
      const name = leafName(typeof skill === 'string' ? skill : skill.output ?? skill.name)
      return {
        target: `skill:${name}`,
        identity: JSON.stringify([
          path.posix.join(projection.sourceBaseDir.replaceAll('\\', '/'), source.replaceAll('\\', '/')),
          name,
          setupKey(typeof skill === 'string' ? undefined : skill.setup),
        ]),
      }
    })
  }
  if (projection.kind === 'mcp')
    return [{ target: `mcp:${projection.output}`, identity }]
  if (projection.kind === 'role-assets')
    return [{ target: 'role-assets', identity }]
  return assertNever(projection)
}

function projectionKey(projection: VendorProjection): string {
  if (projection.kind === 'namespace') {
    return JSON.stringify([
      projection.kind,
      projection.sourceDir,
      projection.output,
      setupKey(projection.setup),
    ])
  }
  if (projection.kind === 'skills') {
    return JSON.stringify([
      projection.kind,
      projection.sourceBaseDir,
      projection.skills.map(skillKey),
    ])
  }
  if (projection.kind === 'mcp')
    return JSON.stringify([projection.kind, projection.sourceFile, projection.output])
  if (projection.kind === 'role-assets')
    return JSON.stringify([projection.kind, projection.sourceDir])
  return assertNever(projection)
}

function skillKey(skill: SkillDef): unknown {
  if (typeof skill === 'string')
    return [skill, leafName(skill), setupKey(undefined)]
  return [skill.name, leafName(skill.output ?? skill.name), setupKey(skill.setup)]
}

function setupKey(setup: readonly SetupCommand[] | undefined): string {
  return setupIdentity(setup)
}

function cloneVendor(vendor: VendorRepo): VendorRepo {
  return {
    name: vendor.name,
    source: vendor.source,
    ...(vendor.revision === undefined ? {} : { revision: vendor.revision }),
    ...(vendor.setup === undefined ? {} : { setup: vendor.setup.map(cloneSetupCommand) }),
    projections: vendor.projections.map(cloneProjection),
  }
}

function cloneProjection(projection: VendorProjection): VendorProjection {
  if (projection.kind === 'namespace') {
    return {
      kind: projection.kind,
      sourceDir: projection.sourceDir,
      output: projection.output,
      ...(projection.setup === undefined ? {} : { setup: projection.setup.map(cloneSetupCommand) }),
    }
  }
  if (projection.kind === 'skills') {
    return {
      kind: projection.kind,
      sourceBaseDir: projection.sourceBaseDir,
      skills: projection.skills.map(cloneSkill),
    }
  }
  if (projection.kind === 'mcp')
    return { kind: projection.kind, sourceFile: projection.sourceFile, output: projection.output }
  if (projection.kind === 'role-assets')
    return { kind: projection.kind, sourceDir: projection.sourceDir }
  return assertNever(projection)
}

function cloneSkill(skill: SkillDef): SkillDef {
  if (typeof skill === 'string')
    return skill
  return {
    name: skill.name,
    ...(skill.output === undefined ? {} : { output: skill.output }),
    ...(skill.setup === undefined ? {} : { setup: skill.setup.map(cloneSetupCommand) }),
  }
}

function cloneSetupCommand(command: SetupCommand): SetupCommand {
  return {
    command: command.command,
    ...(command.args === undefined ? {} : { args: [...command.args] }),
    ...(command.windowsCommandShim === undefined ? {} : { windowsCommandShim: command.windowsCommandShim }),
    ...(command.skipIfCommandAvailable === undefined ? {} : { skipIfCommandAvailable: command.skipIfCommandAvailable }),
  }
}

function leafName(value: string): string {
  return value.replace(/\\/gu, '/').split('/').filter(Boolean).at(-1) ?? value
}

function assertNever(value: never): never {
  throw new Error(`Unknown vendor projection: ${JSON.stringify(value)}`)
}
