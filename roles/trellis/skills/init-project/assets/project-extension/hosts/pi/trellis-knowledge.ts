import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

function findRoot(start: string): string | undefined {
  let current = start
  while (true) {
    if (existsSync(join(current, '.trellis', 'scripts', 'knowledge.py')))
      return current
    const parent = dirname(current)
    if (parent === current)
      return undefined
    current = parent
  }
}

function readContext(root: string): string {
  const python = process.platform === 'win32' ? 'python' : 'python3'
  const result = spawnSync(
    python,
    ['-X', 'utf8', join(root, '.trellis', 'scripts', 'knowledge.py'), 'context'],
    { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024, timeout: 10000, windowsHide: true },
  )
  return result.status === 0 ? result.stdout.trim() : ''
}

export default function trellisKnowledge(pi: any) {
  pi.on?.('before_agent_start', (_event: unknown, ctx: { cwd?: string }) => {
    if (process.env.TRELLIS_HOOKS === '0' || process.env.TRELLIS_DISABLE_HOOKS === '1')
      return
    const root = findRoot(ctx?.cwd ?? process.cwd())
    if (!root)
      return
    const content = readContext(root)
    if (!content)
      return
    return {
      message: {
        customType: 'trellis-knowledge',
        content,
        display: false,
      },
    }
  })
}
