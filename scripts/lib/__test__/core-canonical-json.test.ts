import { describe, expect, it } from 'vitest'
import { canonicalJson, hashCanonicalJson } from '../core/canonical-json.js'

describe('canonical JSON', () => {
  it('sorts object keys by UTF-16 code units while preserving array order', () => {
    expect(canonicalJson({ z: 1, a: { y: true, x: null }, list: [3, 2, 1] }))
      .toBe('{"a":{"x":null,"y":true},"list":[3,2,1],"z":1}')
  })

  it('normalizes negative zero and produces stable hashes', () => {
    const left = { amount: -0, nested: { b: 2, a: 1 } }
    const right = { nested: { a: 1, b: 2 }, amount: 0 }

    expect(canonicalJson(left)).toBe('{"amount":0,"nested":{"a":1,"b":2}}')
    expect(hashCanonicalJson(left)).toBe(hashCanonicalJson(right))
    expect(hashCanonicalJson(left)).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('rejects values that cannot participate in the canonical hash contract', () => {
    const sparse: unknown[] = []
    sparse.length = 2

    expect(() => canonicalJson({ missing: undefined })).toThrow(/non-json value/i)
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(/non-finite/i)
    expect(() => canonicalJson(sparse)).toThrow(/sparse array/i)
    expect(() => canonicalJson(new Date())).toThrow(/non-plain object/i)
    expect(() => canonicalJson('\uD800')).toThrow(/unicode surrogate/i)
    expect(() => canonicalJson('\uDC00')).toThrow(/unicode surrogate/i)
  })

  it('accepts a complete Unicode surrogate pair', () => {
    const value = '\uD83D\uDE00'

    expect(canonicalJson(value)).toBe(JSON.stringify(value))
  })
})
