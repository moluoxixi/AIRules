import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const modules = path.resolve(process.argv[2] || path.join(root, 'node_modules'))
const destination = path.resolve(root, '../skills/requirement-flow/reader/assets/vendor')
const inputs = [
  ['marked', 'lib/marked.umd.js', 'marked.umd.js'],
  ['dompurify', 'dist/purify.min.js', 'purify.min.js'],
  ['@mermaid-js/tiny', 'dist/mermaid.tiny.js', 'mermaid.tiny.js'],
]
async function build() {
  const declared = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).dependencies
  const versions = {}
  await mkdir(destination, { recursive: true })
  for (const [name, source, output] of inputs) {
    const directory = path.join(modules, name)
    const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
    if (metadata.version !== declared[name])
      throw new Error(`${name}: expected ${declared[name]}, received ${metadata.version}`)
    await copyFile(path.join(directory, source), path.join(destination, output))
    versions[name] = metadata.version
  }
  await writeFile(path.join(destination, 'versions.json'), `${JSON.stringify(versions, null, 2)}\n`)
  console.log(`Copied ${inputs.length} pinned browser assets to ${destination}`)
}

build().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
