import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Workflow {
  jobs: Record<string, unknown>
  on: {
    push: {
      branches: string[]
      paths: string[]
      tags?: string[]
    }
    workflow_dispatch?: unknown
  }
}

function readWorkflow(name: string): { raw: string, workflow: Workflow } {
  const raw = fs.readFileSync(path.resolve('.github', 'workflows', name), 'utf8')
  return { raw, workflow: parse(raw) as Workflow }
}

describe('package publication workflows', () => {
  it('publishes the root package from relevant main changes only', () => {
    const { raw, workflow } = readWorkflow('publish.yml')

    expect(workflow.on.push.branches).toEqual(['main'])
    expect(workflow.on.push.paths).toContain('package.json')
    expect(workflow.on.push.paths).toContain('roles/*/constants/**')
    expect(workflow.on.push.tags).toBeUndefined()
    expect(workflow.on.workflow_dispatch).toBeUndefined()
    expect(raw).toContain('npm publish --provenance --access public --tag latest')
    expect(raw).not.toContain('git push')
    expect(raw).not.toContain('refs/tags')
  })

  it('publishes changed role workspaces from main without tag inputs', () => {
    const { raw, workflow } = readWorkflow('publish-role-packages.yml')

    expect(workflow.on.push.branches).toEqual(['main'])
    expect(workflow.on.push.paths).toContain('roles/*/packages/**')
    expect(workflow.on.push.tags).toBeUndefined()
    expect(workflow.on.workflow_dispatch).toBeUndefined()
    expect(raw).toContain('prepare-latest --role')
    expect(raw).toContain('publish --role')
    expect(raw).not.toContain('RELEASE_TAG')
    expect(raw).not.toContain('refs/tags')
  })
})
