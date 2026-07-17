import process from 'node:process'
import { PLATFORM_ORDER } from './hosts/catalog.mjs'

export function parseArgs(argv) {
  const result = { createNew: false, dryRun: false, force: false, packages: [], platforms: [], project: '.', python: process.platform === 'win32' ? 'python' : 'python3', skipAll: false, withStatusline: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--force')
      result.force = true
    else if (arg === '--create-new')
      result.createNew = true
    else if (arg === '--skip-all')
      result.skipAll = true
    else if (arg === '--dry-run')
      result.dryRun = true
    else if (arg === '--with-statusline')
      result.withStatusline = true
    else if (arg === '--project')
      result.project = requireValue(argv, ++index, arg)
    else if (arg === '--package')
      result.packages.push(parsePackage(requireValue(argv, ++index, arg)))
    else if (arg === '--default-package')
      result.defaultPackage = requireValue(argv, ++index, arg)
    else if (arg === '--platform')
      result.platforms.push(...requireValue(argv, ++index, arg).split(','))
    else if (arg === '--python')
      result.python = requireValue(argv, ++index, arg)
    else if (arg === '--developer')
      result.developer = requireValue(argv, ++index, arg)
    else if (arg === '--help' || arg === '-h')
      result.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (result.force && result.createNew)
    throw new Error('--force and --create-new cannot be combined')
  return result
}

export function printHelp() {
  process.stdout.write(`Usage: node init-project.mjs --project <path> --platform <id[,id...]> [options]\n\nPlatforms: ${PLATFORM_ORDER.join(', ')}, all\nOptions:\n  --developer <name>       Initialize local developer identity\n  --package <name=path[:type]>  Add a reviewed monorepo package (type: frontend, backend, fullstack, unknown)\n  --default-package <name> Set the default reviewed package\n  --python <command>       Python 3.9+ command\n  --with-statusline        Add the optional Claude Code status line\n  --create-new             Write .new sidecars for conflicting managed files\n  --skip-all               Preserve every conflict (the default non-force behavior)\n  --force                  Replace conflicting managed files\n  --dry-run                Print the plan without writing\n`)
}

function parsePackage(value) {
  const match = /^([A-Za-z0-9][\w.-]{0,63})=([^:]+)(?::(frontend|backend|fullstack|unknown))?$/u.exec(value)
  if (!match)
    throw new Error('--package must use name=relative/path[:frontend|backend|fullstack|unknown]')
  const normalizedPath = match[2].replace(/\\/gu, '/').replace(/^\.\//u, '')
  if (!normalizedPath || pathIsUnsafe(normalizedPath))
    throw new Error(`Unsafe package path: ${match[2]}`)
  return { name: match[1], path: normalizedPath, type: match[3] ?? 'unknown' }
}

function pathIsUnsafe(value) {
  return value.startsWith('/') || value === '..' || value.startsWith('../') || value.includes('/../') || value.includes('\0')
}

function requireValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--'))
    throw new Error(`${flag} requires a value`)
  return value
}
