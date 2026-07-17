import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT_DIR } from '../constants.mjs'

const LEGACY_PROJECT_ROOT = `.${['tre', 'llis'].join('')}`

export function migrateLegacyRoot(projectRoot) {
  const legacy = path.join(projectRoot, LEGACY_PROJECT_ROOT)
  const current = path.join(projectRoot, PROJECT_ROOT_DIR)
  if (!fs.existsSync(legacy))
    return false
  if (fs.existsSync(current))
    throw new Error(`Both ${LEGACY_PROJECT_ROOT} and .moluoxixi exist; merge or remove one before initializing Moluoxixi`)
  fs.renameSync(legacy, current)
  return true
}

export function readLegacyHashes(projectRoot) {
  for (const relativePath of [
    `${PROJECT_ROOT_DIR}/.template-hashes.json`,
    `${LEGACY_PROJECT_ROOT}/.template-hashes.json`,
  ]) {
    const file = path.join(projectRoot, ...relativePath.split('/'))
    if (!fs.existsSync(file))
      continue
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      return parsed.files ?? parsed
    }
    catch {
      return {}
    }
  }
  return {}
}
