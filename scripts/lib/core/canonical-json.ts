import { createHash } from 'node:crypto'

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function requireValidUnicode(value: string, location: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xDC00 || next > 0xDFFF) {
        throw new TypeError(`Invalid Unicode surrogate at ${location}`)
      }
      index += 1
      continue
    }
    if (code >= 0xDC00 && code <= 0xDFFF) {
      throw new TypeError(`Invalid Unicode surrogate at ${location}`)
    }
  }
}

function serialize(value: unknown, location: string): string {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'string') {
    requireValidUnicode(value, location)
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Non-finite number at ${location}`)
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value)
  }
  if (Array.isArray(value)) {
    const items: string[] = []
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new TypeError(`Sparse array at ${location}[${index}]`)
      }
      items.push(serialize(value[index], `${location}[${index}]`))
    }
    return `[${items.join(',')}]`
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Non-plain object at ${location}`)
    }

    const record = value as Record<string, unknown>
    const entries = Object.keys(record).sort().map((key) => {
      requireValidUnicode(key, `${location} key`)
      return `${JSON.stringify(key)}:${serialize(record[key], `${location}.${key}`)}`
    })
    return `{${entries.join(',')}}`
  }
  throw new TypeError(`Non-JSON value at ${location}`)
}

export function canonicalJson(value: unknown): string {
  return serialize(value, '$')
}

export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}
