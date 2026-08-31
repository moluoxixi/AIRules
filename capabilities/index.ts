import type { SetupCommand, SkillDef, VendorProjection, VendorRepo } from '../scripts/lib/vendors.js'
import type {
  CapabilityDefinition,
  CapabilityName,
  CapabilitySelection,
  ComposeCapabilitiesOptions,
} from './types.js'
import { codingCapability } from './coding.js'
import { commonCapability } from './common.js'
import { engineeringCapability } from './engineering.js'
import { frontendCapability } from './frontend.js'
import { productivityCapability } from './productivity.js'

export type { CapabilityDefinition, CapabilityName, CapabilitySelection, ComposeCapabilitiesOptions } from './types.js'
export { CAPABILITY_NAMES } from './types.js'

export const capabilityRegistry: Readonly<Record<CapabilityName, CapabilityDefinition>> = Object.freeze({
  common: commonCapability,
  coding: codingCapability,
  frontend: frontendCapability,
  productivity: productivityCapability,
  engineering: engineeringCapability,
})

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
  const capabilityVendors: VendorRepo[] = []

  for (const selection of selections) {
    if (seenCapabilities.has(selection.name))
      throw new Error(`Capability "${selection.name}" is declared more than once`)
    seenCapabilities.add(selection.name)

    for (const projection of selection.definition.roleProjections ?? [])
      appendProjection(roleVendor, projection)
    for (const vendor of selection.definition.vendors ?? [])
      capabilityVendors.push(cloneVendor(vendor))
  }

  const sequence = options.roleVendorPosition === 'after'
    ? [...capabilityVendors, roleVendor]
    : [roleVendor, ...capabilityVendors]
  return mergeVendors(sequence)
}

function mergeVendors(sequence: readonly VendorRepo[]): VendorRepo[] {
  const result: VendorRepo[] = []
  const byName = new Map<string, VendorRepo>()

  for (const candidate of sequence) {
    const existing = byName.get(candidate.name)
    if (!existing) {
      const cloned = cloneVendor(candidate)
      byName.set(cloned.name, cloned)
      result.push(cloned)
      continue
    }

    if (
      existing.source !== candidate.source
      || existing.revision !== candidate.revision
      || setupKey(existing.setup) !== setupKey(candidate.setup)
    ) {
      throw new Error(`Vendor "${candidate.name}" has conflicting source, revision, or setup definitions`)
    }
    for (const projection of candidate.projections)
      appendProjection(existing, projection)
  }

  validateProjectionTargets(result)
  return result
}

function appendProjection(vendor: VendorRepo, projection: VendorProjection): void {
  const key = projectionKey(projection)
  if (vendor.projections.some(existing => projectionKey(existing) === key))
    return
  vendor.projections.push(cloneProjection(projection))
}

function validateProjectionTargets(vendors: readonly VendorRepo[]): void {
  const owners = new Map<string, { projection: string, vendor: string }>()
  for (const vendor of vendors) {
    for (const projection of vendor.projections) {
      const key = projectionKey(projection)
      for (const target of projectionTargets(projection)) {
        const owner = owners.get(target)
        if (owner) {
          throw new Error(
            `Projection target "${target}" conflicts between vendor "${owner.vendor}" and vendor "${vendor.name}"`,
          )
        }
        owners.set(target, { projection: key, vendor: vendor.name })
      }
    }
  }
}

function projectionTargets(projection: VendorProjection): string[] {
  if (projection.kind === 'namespace')
    return [`skill-namespace:${projection.output}`]
  if (projection.kind === 'skills') {
    return projection.skills.map((skill) => {
      const name = typeof skill === 'string' ? skill : skill.output ?? leafName(skill.name)
      return `skill:${name}`
    })
  }
  if (projection.kind === 'mcp')
    return [`mcp:${projection.output}`]
  if (projection.kind === 'role-assets')
    return ['role-assets']
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
    return skill
  return [skill.name, skill.output, setupKey(skill.setup)]
}

function setupKey(setup: readonly SetupCommand[] | undefined): string {
  return JSON.stringify((setup ?? []).map(command => [
    command.command,
    command.args ?? [],
    command.windowsCommandShim,
    command.skipIfCommandAvailable,
  ]))
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
