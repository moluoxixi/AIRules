import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PART_ID_PATTERN = /^prt_([0-9a-f]{12})[0-9A-Za-z]{14}$/

function findRoot(start) {
  let current = start
  while (true) {
    if (existsSync(join(current, '.moluoxixi', 'scripts', 'knowledge.py')))
      return current
    const parent = dirname(current)
    if (parent === current)
      return undefined
    current = parent
  }
}

function readContext(root) {
  const python = process.platform === 'win32' ? 'python' : 'python3'
  const result = spawnSync(
    python,
    ['-X', 'utf8', join(root, '.moluoxixi', 'scripts', 'knowledge.py'), 'context'],
    { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024, timeout: 10000, windowsHide: true },
  )
  return result.status === 0 ? result.stdout.trim() : ''
}

function insertContext(parts, text) {
  const source = parts
    .filter(part => part?.synthetic !== true && typeof part?.id === 'string' && PART_ID_PATTERN.test(part.id))
    .sort((left, right) => left.id.localeCompare(right.id))[0]
  if (!source)
    return
  const match = PART_ID_PATTERN.exec(source.id)
  const ordinal = BigInt(`0x${match[1]}`)
  if (ordinal <= 3n)
    return
  const suffix = createHash('sha256').update(`${source.messageID}\0knowledge`).digest('hex').slice(0, 13)
  const id = `prt_${(ordinal - 3n).toString(16).padStart(12, '0')}K${suffix}`
  if (parts.some(part => part?.id === id))
    return
  const part = {
    id,
    sessionID: source.sessionID,
    messageID: source.messageID,
    type: 'text',
    text,
    synthetic: true,
  }
  const index = parts.findIndex(existing => typeof existing?.id !== 'string' || id < existing.id)
  if (index < 0)
    parts.push(part)
  else parts.splice(index, 0, part)
}

export default async ({ directory }) => {
  const root = findRoot(directory)
  return {
    'chat.message': async (_input, output) => {
      if (!root || process.env.MOLUOXIXI_HOOKS === '0' || process.env.MOLUOXIXI_DISABLE_HOOKS === '1')
        return
      try {
        const context = readContext(root)
        if (context)
          insertContext(output?.parts ?? [], context)
      }
      catch {}
    },
  }
}
