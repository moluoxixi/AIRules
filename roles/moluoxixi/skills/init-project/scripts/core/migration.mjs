import { LEGACY_BRAND, LEGACY_BRAND_UPPER } from '../constants.mjs'

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

function blockMarkers(kind, brand) {
  if (kind === 'block-moluoxixi')
    return [`<!-- ${brand}:START -->`, `<!-- ${brand}:END -->`]
  if (kind === 'block-hash')
    return [`# AIRULES:${brand}:START`, `# AIRULES:${brand}:END`]
  return [`<!-- AIRULES:${brand}:START -->`, `<!-- AIRULES:${brand}:END -->`]
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
