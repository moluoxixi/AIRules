import { describe, expect, it } from 'vitest'
import { requireRoleName } from '../role-assets.js'

describe('requireRoleName', () => {
  it('accepts only safe role names', () => {
    expect(requireRoleName('alpha-2')).toBe('alpha-2')
    expect(() => requireRoleName('Alpha')).toThrow(/role name/i)
    expect(() => requireRoleName('alpha_role')).toThrow(/role name/i)
    expect(() => requireRoleName('a'.repeat(64))).toThrow(/role name/i)
  })
})
