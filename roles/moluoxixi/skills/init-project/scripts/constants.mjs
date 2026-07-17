import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))

export const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..')
export const ASSET_ROOT = path.join(SKILL_ROOT, 'assets')
export const HOST_ASSET_ROOT = path.join(ASSET_ROOT, 'hosts')
export const PROJECT_ASSET_ROOT = path.join(ASSET_ROOT, 'project')
export const RUNTIME_ROOT = path.join(ASSET_ROOT, 'runtime')
export const SHARED_ASSET_ROOT = path.join(ASSET_ROOT, 'shared')
export const LOCAL_SKILLS_ROOT = path.join(SHARED_ASSET_ROOT, 'skills')

export const PROJECT_ROOT_DIR = '.moluoxixi'
export const MANIFEST_PATH = projectPath('airules-init-manifest.json')
export const GENERATOR_VERSION = '1.1.0'
export const UPSTREAM_REVISION = 'e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a'
export const LEGACY_BRAND = ['tre', 'llis'].join('')
export const LEGACY_BRAND_UPPER = LEGACY_BRAND.toUpperCase()

export const NAMESPACED_SKILL_RENAMES = {
  'moluoxixi-before-dev': 'before-dev',
  'moluoxixi-brainstorm': 'brainstorm',
  'moluoxixi-break-loop': 'break-loop',
  'channel': 'channel',
  'moluoxixi-continue': 'continue',
  'moluoxixi-finish-work': 'finish-work',
  'meta': 'meta',
  'session-insight': 'session-insight',
  'spec-bootstrap': 'spec-bootstrap',
  'moluoxixi-start': 'start',
  'moluoxixi-update-spec': 'update-spec',
}

export function canonicalSkillName(name) {
  return name.replace(/^moluoxixi-/u, '')
}

export function projectPath(...segments) {
  return path.posix.join(PROJECT_ROOT_DIR, ...segments)
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

export function toPosix(value) {
  return value.split(path.sep).join('/')
}
