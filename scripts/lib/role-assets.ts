const roleNamePattern = /^[a-z0-9][a-z0-9-]{0,62}$/u

export function requireRoleName(value: unknown): string {
  if (typeof value !== 'string' || !roleNamePattern.test(value)) {
    throw new TypeError('Invalid AIRules role name')
  }
  return value
}
