import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'vitest'

const assetDir = path.join(
  process.cwd(),
  'roles',
  'product',
  'skills',
  'init-project',
  'assets',
  'product-pm-bridge',
)

function readAsset(...parts: string[]) {
  return fs.readFileSync(path.join(assetDir, ...parts), 'utf8')
}

describe('product-pm-bridge assets', () => {
  it('schema uses BMAD for heavy PRD validation, document sharding and epic story split', () => {
    const schema = readAsset('schema.yaml')

    assert.match(schema, /bmad-shard-doc/)
    assert.match(schema, /bmad-prd/)
    assert.match(schema, /bmad-create-epics-and-stories/)
    assert.match(schema, /bmad-generate-project-context/)
    assert.match(schema, /id: document-shards/)
    assert.match(schema, /id: project-context/)
    assert.match(schema, /id: epics-and-stories/)
    assert.doesNotMatch(schema, /id: user-stories/)
  })

  it('templates expose BMAD product document artifacts', () => {
    const documentShards = readAsset('templates', 'document-shards.md')
    const projectContext = readAsset('templates', 'project-context.md')
    const epicsAndStories = readAsset('templates', 'epics-and-stories.md')

    assert.match(documentShards, /# Document Shards/)
    assert.match(projectContext, /# Project Context/)
    assert.match(projectContext, /knowledge\/index\.md/)
    assert.match(epicsAndStories, /# Epics and Stories/)
    assert.match(epicsAndStories, /Epic ID/)
    assert.match(epicsAndStories, /Acceptance Coverage/)
  })
})
