import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { testResults } = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const name of ['handbook-browser.test.mjs', 'story-withdrawal-browser.test.mjs']) {
  const filename = fileURLToPath(new URL(name, import.meta.url))
  const suite = testResults.find(result => path.resolve(result.name) === filename)
  const tests = suite?.assertionResults ?? []
  if (!tests.length || tests.some(test => test.status !== 'passed'))
    throw new Error(`${name} must execute and pass every browser test. Passed ${tests.filter(test => test.status === 'passed').length}/${tests.length}.`)
}
