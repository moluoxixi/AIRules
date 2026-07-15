import { lstatSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.resolve(packageRoot, 'dist')

if (path.dirname(distRoot) !== packageRoot || path.basename(distRoot) !== 'dist') {
  throw new Error(`Refusing to clean an unsafe build output path: ${distRoot}`)
}

const stats = lstatSync(distRoot, { throwIfNoEntry: false })
if (stats?.isSymbolicLink()) {
  throw new Error(`Refusing to clean a symbolic-link build output: ${distRoot}`)
}

rmSync(distRoot, { recursive: true, force: true })
