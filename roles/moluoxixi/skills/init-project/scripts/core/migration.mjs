import { LEGACY_BRAND, LEGACY_BRAND_UPPER, sha256 } from '../constants.mjs'

export function mergeJson(current, template) {
  if (Array.isArray(current) && Array.isArray(template)) {
    const result = [...current]
    const known = new Set(result.map(value => JSON.stringify(value)))
    for (const value of template) {
      const key = JSON.stringify(value)
      if (!known.has(key))
        result.push(value)
    }
    return result
  }
  if (isObject(current) && isObject(template)) {
    const result = { ...current }
    for (const [key, value] of Object.entries(template))
      result[key] = key in current ? mergeJson(current[key], value) : value
    return result
  }
  return current
}

export function upgradeJson(current, previousTemplate, nextTemplate) {
  if (Array.isArray(current) && Array.isArray(nextTemplate))
    return mergeJson(current, nextTemplate)
  if (isObject(current) && isObject(nextTemplate)) {
    const previous = isObject(previousTemplate) ? previousTemplate : {}
    const result = { ...current }
    for (const [key, value] of Object.entries(nextTemplate)) {
      if (!(key in current)) {
        result[key] = value
        continue
      }
      result[key] = upgradeJson(current[key], previous[key], value)
    }
    return result
  }
  return previousTemplate !== undefined && jsonEqual(current, previousTemplate) ? nextTemplate : current
}

export function restoreJson(original, baseline, current) {
  const result = restoreJsonValue(original, true, baseline, true, current, true)
  return result.conflict ? { conflict: true } : { conflict: false, value: result.present ? result.value : undefined }
}

export function mergeConfig(current, template, owned, configSections) {
  if (owned && owned.baselineHash && sha256Text(current) === owned.baselineHash)
    return template
  let result = current.replace(/\r\n/gu, '\n')
  const available = extractConfigSections(template)
  const sections = Array.isArray(configSections)
    ? configSections.map((requested) => {
        const section = available.find(candidate => candidate.heading === `# ${requested.sectionHeading}`)
        return section ? { ...section, sentinel: requested.sentinel } : undefined
      }).filter(Boolean)
    : available
  for (const section of sections) {
    if (!result.includes(section.sentinel))
      result = `${result.replace(/\s*$/u, '')}\n\n${section.content.trim()}\n`
  }
  return result
}

export function migrateLegacyJson(current, template) {
  if (Array.isArray(current) && Array.isArray(template)) {
    const templateValues = new Map(template.map(value => [JSON.stringify(value), value]))
    return current.map((value) => {
      const migrated = migrateLegacyJsonValue(value)
      return templateValues.get(JSON.stringify(migrated)) ?? value
    })
  }
  if (isObject(current) && isObject(template)) {
    const result = {}
    for (const [key, value] of Object.entries(current)) {
      const migratedKey = replaceLegacyBrand(key)
      const targetKey = migratedKey in template ? migratedKey : key
      result[targetKey] = targetKey in template ? migrateLegacyJson(value, template[targetKey]) : value
    }
    return result
  }
  if (typeof current === 'string' && typeof template === 'string' && replaceLegacyBrand(current) === template)
    return template
  return current
}

export function upsertBlock(current, template, kind) {
  const effectiveKind = kind === 'block-hash' && !template.trimStart().startsWith('#') ? 'block-html' : kind
  const markers = blockMarkers(effectiveKind, 'MOLUOXIXI')
  current = migrateLegacyBlockMarkers(current, kind, template)
  const managed = kind === 'block-moluoxixi' ? template.trim() : `${markers[0]}\n${template.trim()}\n${markers[1]}`
  const start = current.indexOf(markers[0])
  const end = current.indexOf(markers[1])
  if ((start >= 0) !== (end >= 0) || (start >= 0 && current.includes(markers[0], start + markers[0].length)))
    throw new Error('Malformed or duplicate managed block')
  if (start < 0)
    return current.trim() ? `${current.replace(/\s*$/u, '')}\n\n${managed}\n` : `${managed}\n`
  if (end < start)
    throw new Error('Malformed managed block order')
  return `${current.slice(0, start)}${managed}${current.slice(end + markers[1].length)}`.replace(/\s*$/u, '\n')
}

export function removeManagedBlock(current, kind, baseline, force = false) {
  const currentRange = managedBlockRange(current, kind)
  if (!currentRange)
    return { conflict: !force, content: current }
  if (!force && baseline !== undefined) {
    const baselineRange = managedBlockRange(baseline, kind)
    if (!baselineRange || current.slice(currentRange.start, currentRange.end) !== baseline.slice(baselineRange.start, baselineRange.end))
      return { conflict: true, content: current }
  }
  const before = current.slice(0, currentRange.start).replace(/[ \t]+$/gmu, '').replace(/\n{3,}$/u, '\n\n')
  const after = current.slice(currentRange.end).replace(/^\s*\n/u, '')
  const content = `${before}${before && after ? '\n' : ''}${after}`.replace(/\s*$/u, before || after ? '\n' : '')
  return { conflict: false, content }
}

function blockMarkers(kind, brand) {
  if (kind === 'block-moluoxixi')
    return [`<!-- ${brand}:START -->`, `<!-- ${brand}:END -->`]
  if (kind === 'block-hash')
    return [`# AIRULES:${brand}:START`, `# AIRULES:${brand}:END`]
  return [`<!-- AIRULES:${brand}:START -->`, `<!-- AIRULES:${brand}:END -->`]
}

function managedBlockRange(content, kind) {
  const candidates = kind === 'block-hash' ? ['block-hash', 'block-html'] : [kind]
  const matches = candidates
    .map(candidate => blockMarkers(candidate, 'MOLUOXIXI'))
    .filter(markers => content.includes(markers[0]) || content.includes(markers[1]))
  if (matches.length === 0)
    return undefined
  if (matches.length > 1)
    throw new Error('Multiple managed block marker styles exist')
  const markers = matches[0]
  const start = content.indexOf(markers[0])
  const markerEnd = content.indexOf(markers[1])
  if (start < 0 && markerEnd < 0)
    return undefined
  if (start < 0 || markerEnd < start || content.includes(markers[0], start + markers[0].length))
    throw new Error('Malformed or duplicate managed block')
  return { start, end: markerEnd + markers[1].length }
}

function migrateLegacyBlockMarkers(current, kind, template) {
  const effectiveKind = kind === 'block-hash' && !template.trimStart().startsWith('#') ? 'block-html' : kind
  const currentMarkers = blockMarkers(effectiveKind, 'MOLUOXIXI')
  const legacyMarkers = blockMarkers(effectiveKind, LEGACY_BRAND_UPPER)
  const start = current.indexOf(legacyMarkers[0])
  const end = current.indexOf(legacyMarkers[1])
  if (start < 0 && end < 0)
    return current
  if ((start >= 0) !== (end >= 0) || end < start || current.includes(legacyMarkers[0], start + legacyMarkers[0].length))
    throw new Error('Malformed or duplicate legacy managed block')
  if (current.includes(currentMarkers[0]) || current.includes(currentMarkers[1]))
    throw new Error('Both legacy and current managed blocks exist')
  return `${current.slice(0, start)}${currentMarkers[0]}${current.slice(start + legacyMarkers[0].length, end)}${currentMarkers[1]}${current.slice(end + legacyMarkers[1].length)}`
}

function replaceLegacyBrand(value) {
  return value
    .replaceAll(LEGACY_BRAND_UPPER, 'MOLUOXIXI')
    .replaceAll(`${LEGACY_BRAND[0].toUpperCase()}${LEGACY_BRAND.slice(1)}`, 'Moluoxixi')
    .replaceAll(LEGACY_BRAND, 'moluoxixi')
}

function migrateLegacyJsonValue(value) {
  if (Array.isArray(value))
    return value.map(migrateLegacyJsonValue)
  if (isObject(value))
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [replaceLegacyBrand(key), migrateLegacyJsonValue(nested)]))
  return typeof value === 'string' ? replaceLegacyBrand(value) : value
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function extractConfigSections(content) {
  const lines = content.split('\n')
  const starts = []
  for (let index = 0; index < lines.length; index += 1) {
    if (/^#-+$/u.test(lines[index].trim()) && index + 1 < lines.length)
      starts.push(index)
  }
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? lines.length
    const content = lines.slice(start, end).join('\n')
    const heading = lines[start + 1]?.trim() ?? ''
    return { heading, sentinel: heading, content }
  })
}

function sha256Text(value) {
  return sha256(value)
}

function restoreJsonValue(original, originalPresent, baseline, baselinePresent, current, currentPresent) {
  if (originalPresent === baselinePresent && (!originalPresent || jsonEqual(original, baseline)))
    return { conflict: false, present: currentPresent, value: current }
  if (currentPresent === baselinePresent && (!currentPresent || jsonEqual(current, baseline)))
    return { conflict: false, present: originalPresent, value: original }
  if (isObject(original) && isObject(baseline) && isObject(current)) {
    const value = { ...current }
    let conflict = false
    const keys = new Set([...Object.keys(original), ...Object.keys(baseline)])
    for (const key of keys) {
      const restored = restoreJsonValue(original[key], key in original, baseline[key], key in baseline, current[key], key in current)
      conflict ||= restored.conflict
      if (restored.present)
        value[key] = restored.value
      else delete value[key]
    }
    return { conflict, present: true, value }
  }
  return { conflict: true, present: currentPresent, value: current }
}
