import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractTarGzip,
  parseRegistrySource,
  RegistryError,
  resolveSpecTemplate,
  resolveWorkflowTemplate,
} from '../skills/init-project/scripts/core/registry.mjs'

const temporaryRoots = []

afterEach(() => {
  vi.unstubAllGlobals()
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers })
}

function tarGzip(entries) {
  const blocks = []
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? '')
    const header = Buffer.alloc(512)
    writeTarField(header, 0, 100, entry.path)
    writeTarField(header, 100, 8, '0000644')
    writeTarField(header, 108, 8, '0000000')
    writeTarField(header, 116, 8, '0000000')
    writeTarField(header, 124, 12, content.byteLength.toString(8).padStart(11, '0'))
    writeTarField(header, 136, 12, '00000000000')
    header.fill(0x20, 148, 156)
    header[156] = (entry.type ?? '0').charCodeAt(0)
    writeTarField(header, 257, 6, 'ustar')
    writeTarField(header, 263, 2, '00')
    let checksum = 0
    for (const byte of header)
      checksum += byte
    writeTarField(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `)
    blocks.push(header, content)
    const remainder = content.byteLength % 512
    if (remainder)
      blocks.push(Buffer.alloc(512 - remainder))
  }
  blocks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(blocks))
}

function writeTarField(header, offset, length, value) {
  Buffer.from(value).copy(header, offset, 0, length)
}

function registryIndex(templates) {
  return JSON.stringify({ templates, version: 1 })
}

describe('moluoxixi registry backends', () => {
  it('downloads an indexed public spec without Git', async () => {
    const archive = tarGzip([
      { path: 'registry-v1/specs/templates/basic/backend/index.md', content: '# Backend\n' },
    ])
    const fetchMock = vi.fn(async (input) => {
      const url = String(input)
      if (url.includes('raw.githubusercontent.com')) {
        return response(registryIndex([
          { id: 'basic', type: 'spec', name: 'Basic', path: 'templates/basic' },
        ]))
      }
      if (url.includes('codeload.github.com'))
        return response(archive, 200, { 'content-length': String(archive.byteLength) })
      return response('', 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    const resolved = await resolveSpecTemplate('basic', 'gh:acme/registry/specs#v1')

    expect(resolved.template).toBe('basic')
    expect(resolved.files.get('backend/index.md').toString('utf8')).toBe('# Backend\n')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://raw.githubusercontent.com/acme/registry/v1/specs/index.json',
      'https://codeload.github.com/acme/registry/tar.gz/v1',
    ])
  })

  it('uses direct mode only after an explicit missing index result', async () => {
    const archive = tarGzip([
      { path: 'registry-v1/specs/frontend/index.md', content: '# Frontend\n' },
    ])
    vi.stubGlobal('fetch', vi.fn(async input => String(input).includes('index.json') ? response('', 404) : response(archive)))

    const resolved = await resolveSpecTemplate(undefined, 'gh:acme/registry/specs#v1')

    expect(resolved.template).toBeUndefined()
    expect(resolved.files.get('frontend/index.md').toString('utf8')).toBe('# Frontend\n')
    await expect(resolveSpecTemplate('named', 'gh:acme/registry/specs#v1')).rejects.toThrow('remove --template')
  })

  it('keeps workflow file downloads on the probed HTTP backend', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = String(input)
      if (url.endsWith('/index.json')) {
        return response(registryIndex([
          { id: 'tdd', type: 'workflow', name: 'TDD', path: 'workflows/tdd.md' },
        ]))
      }
      if (url.endsWith('/workflows/tdd.md'))
        return response('# TDD\n')
      return response('', 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    const workflow = await resolveWorkflowTemplate('tdd', 'gh:acme/registry#v1', '# Native\n')

    expect(workflow.content).toBe('# TDD\n')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(([input]) => !String(input).includes('codeload'))).toBe(true)
  })

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [500, 'network'],
  ])('classifies HTTP %s failures as %s', async (status, kind) => {
    vi.stubGlobal('fetch', vi.fn(async () => response('', status)))

    await expect(resolveSpecTemplate('basic', 'gh:acme/registry#v1')).rejects.toMatchObject({ kind })
  })

  it('classifies invalid index JSON without falling into direct mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('{invalid')))

    await expect(resolveSpecTemplate(undefined, 'gh:acme/registry#v1')).rejects.toMatchObject({ kind: 'invalid-json' })
  })

  it('parses self-hosted and SSH sources without leaking subdirs into clone URLs', () => {
    expect(parseRegistrySource('https://git.corp.test/org/repo/-/tree/v2/specs')).toMatchObject({
      gitUrl: 'https://git.corp.test/org/repo.git',
      host: 'git.corp.test',
      preferGit: true,
      ref: 'v2',
      repo: 'org/repo',
      subdir: 'specs',
    })
    expect(parseRegistrySource('ssh://git@git.corp.test:2222/org/repo/specs#v2')).toMatchObject({
      gitUrl: 'ssh://git@git.corp.test:2222/org/repo.git',
      preferGit: true,
      ref: 'v2',
      repo: 'org/repo',
      subdir: 'specs',
    })
  })

  it('rejects traversal and non-regular TAR entries', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'airules-registry-tar-'))
    temporaryRoots.push(root)

    expect(() => extractTarGzip(tarGzip([{ path: '../escape', content: 'bad' }]), root)).toThrow(RegistryError)
    expect(() => extractTarGzip(tarGzip([{ path: 'registry/link', type: '2' }]), root)).toThrow('unsupported entry type')
    expect(fs.existsSync(path.join(root, '..', 'escape'))).toBe(false)
  })
})
