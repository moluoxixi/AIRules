import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function withCommitMessage(message: string, run: (messagePath: string) => void) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-commitlint-'))
  const messagePath = path.join(tempDir, 'commit-message.txt')

  fs.writeFileSync(messagePath, `${message}\n`)

  try {
    run(messagePath)
  }
  finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function runCommitlint(messagePath: string) {
  execSync(`npm exec commitlint -- --edit ${JSON.stringify(messagePath)}`, {
    cwd: rootDir,
    stdio: 'pipe',
  })
}

it('commitlint - accepts scoped conventional commits', () => {
  withCommitMessage('feat(husky): add hook guards', (messagePath) => {
    assert.doesNotThrow(() => runCommitlint(messagePath))
  })
})

it('commitlint - rejects messages without a scope', () => {
  withCommitMessage('feat: add hook guards', (messagePath) => {
    assert.throws(() => runCommitlint(messagePath))
  })
})
