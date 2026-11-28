import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('../skills/requirement-flow/reader/assets/reader.js', import.meta.url)), 'utf8')
const resolve = source.slice(source.indexOf('  function resolveLink('), source.indexOf('  function instrumentLinks('))
const taskQuery = source.slice(source.indexOf('  function taskQuery('), source.indexOf('  function routeUrl('))
const pageScopeStart = source.indexOf('  function readPageScope(')
const pageScope = pageScopeStart < 0 ? '' : source.slice(pageScopeStart, source.indexOf('  function toast('))
const linkAttributes = source.slice(source.indexOf('  function readLinkAttributes('), source.indexOf('  function sourceLink('))
const linkHelpers = source.slice(source.indexOf('  function readLinkAttributes('), source.indexOf('  function instrumentLinks('))
const clearSource = source.slice(source.indexOf('  function clearSourceContents('), source.indexOf('  function syncSourceFailure('))
const taskFileUrlStart = source.indexOf('  const taskFileUrl =')
const sourceAccess = [
  pageScope,
  source.slice(taskFileUrlStart, source.indexOf('\n', taskFileUrlStart)),
  source.slice(source.indexOf('  function originalTaskPage('), source.indexOf('  function taskQuery(')),
  source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks(')),
  source.slice(source.indexOf('  function readCheck('), source.indexOf('  function updateReadChecks(')),
].join('\n')

interface Link { kind: string, target: string, fragment: string, exists: boolean, query?: string, error?: string, status?: number, label?: string }
interface Document { path: string, links?: Link[] }

function sourceDialogState() {
  const closeListeners: (() => void)[] = []
  const fields = Object.fromEntries(['source-title', 'source-type', 'source-original', 'source-hash', 'source-content'].map(id => [id, {
    textContent: '',
    title: '',
    href: '',
    hidden: false,
    removeAttribute(name: string) {
      if (name === 'href')
        this.href = ''
    },
  }]))
  const dialog = {
    open: false,
    showModal() {
      this.open = true
    },
    close() {
      this.open = false
      this.dispatchClose()
    },
    dispatchClose() {
      for (const listener of closeListeners)
        listener()
    },
    addEventListener(type: string, listener: () => void) {
      if (type === 'close')
        closeListeners.push(listener)
    },
  }
  return { fields, dialog, ui: { ...fields, 'source-dialog': dialog } }
}

function sourceNavigationState() {
  const info = { path: 'proposal.md', view: 'page', query: '', taskQuery: '', phase: 'proposed', section: '' }
  const { fields, dialog, ui } = sourceDialogState()
  const article = { innerHTML: '', dataset: {} as Record<string, string> }
  const metadata = ['proposal.md', 'current.md'].map(path => ({ path, sha256: path }))
  const context = {
    ui: {
      ...ui,
      article,
      'diagram-dialog': { open: false },
      'search-input': { value: '' },
      'phase-filter': { replaceChildren: vi.fn() },
      'context': { replaceChildren: vi.fn(), hidden: false },
      'source-button': { hidden: false },
      'page-links': { hidden: false },
    },
    catalog: { documents: metadata },
    documents: new Map(metadata.map(doc => [doc.path, doc])),
    sources: new Map(),
    taskPages: new Map(),
    sourceVersion: 0,
    sourceRoute: undefined as typeof info | undefined,
    renderVersion: 0,
    readPageVersion: 0,
    readPageKey: undefined,
    currentPath: '',
    currentView: 'page',
    currentPhase: 'all',
    scrollPositions: new Map(),
    diagramDefinitions: new Map(),
    documentAnchors: new Map(),
    tocFrame: 0,
    tocItems: [],
    window: { scrollY: 0 },
    routeInfo: () => ({ ...info }),
    cancelAnimationFrame: vi.fn(),
    setMenu: vi.fn(),
    notice: vi.fn(),
    renderNavigation: vi.fn(),
    setTextTitles: vi.fn(),
    showReadFailure: vi.fn(),
    sourceUrl: (path: string, digest: string) => `/content/${path}?sha256=${digest}`,
    documentText: (doc: typeof metadata[number]) => Promise.resolve(`${doc.path} 原文`),
    sourceReadError: () => undefined,
    renderPage: async () => { article.innerHTML = `${info.path} ${info.phase}` },
    renderSearch: async () => { article.innerHTML = `search ${info.query}` },
    renderTasks: async () => { article.innerHTML = 'tasks' },
  }
  const routeCode = source.slice(source.indexOf('  async function renderRoute('), source.indexOf('  function showReadFailure('))
  const sourceCode = source.slice(source.indexOf('  async function openSource('), source.indexOf('\n  ui[\'search-input\'].addEventListener'))
  const closeCode = source.slice(source.indexOf('  ui[\'source-dialog\'].addEventListener(\'close\','), source.indexOf('  ui[\'source-dialog\'].addEventListener(\'click\','))
  const actions = runInNewContext(`${pageScope}\n${clearSource}\n${routeCode}\n${sourceCode}\n${closeCode}\n;({renderRoute,openSource})`, context) as { renderRoute: () => Promise<void>, openSource: (path: string) => Promise<void> }
  return { info, context, article, fields, dialog, actions }
}

function sourceAnchorState(kind: 'markdown' | 'task') {
  const state = sourceNavigationState()
  const context = Object.assign(state.context, {
    taskFrameRead: undefined,
    fetchResource: vi.fn(async () => 'accepted current source'),
    refreshReadLinks: vi.fn(),
  })
  if (kind === 'task') {
    const page: SingleMetadata = { path: 'task/handbook.html', model_path: 'task/model.json', sha256: 'html-v1', model_sha256: 'model-v1' }
    state.info.path = page.path
    state.info.section = 'node=first'
    state.info.taskQuery = 'view=detail'
    context.taskPages.set(page.path, page)
    context.sources.set(page.path, { path: page.path, sha256: page.sha256 })
    context.sources.set(page.model_path!, { path: page.model_path, sha256: page.model_sha256 })
  }
  else {
    state.info.section = 'first-section'
  }
  Object.assign(context.catalog, { entry: state.info.path, task_errors: {} })
  const documentCode = source.slice(source.indexOf('  async function documentText('), source.indexOf('  async function documentRecords('))
  runInNewContext(`${sourceAccess}\n${documentCode}`, context)
  return { ...state, context, target: kind === 'task' ? 'task/model.json' : state.info.path }
}

it.each(['markdown', 'task'] as const)('finishes or closes a pending %s source popup when only its section or node changes', async (kind) => {
  const state = sourceAnchorState(kind)
  await state.actions.renderRoute()
  let resolve!: (text: string) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((complete) => {
    resolve = complete
  }))
  const pending = state.actions.openSource(state.target)
  expect(state.dialog.open).toBe(true)
  state.info.section = kind === 'task' ? 'node=second' : 'second-section'
  await state.actions.renderRoute()
  const waiting = state.dialog.open && state.fields['source-content'].textContent === '正在读取来源…'
  resolve('late previous-anchor source')
  await pending
  expect(waiting).toBe(false)
  expect(state.fields['source-content'].textContent).not.toBe('正在读取来源…')
  expect(state.fields['source-hash'].textContent).toBe('')
  expect(state.fields['source-original'].href).toBe('')
  expect(state.fields['source-original'].hidden).toBe(true)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
})

it.each(['markdown', 'task'] as const)('preserves an already completed %s source popup when only its section or node changes', async (kind) => {
  const state = sourceAnchorState(kind)
  await state.actions.renderRoute()
  await state.actions.openSource(state.target)
  const original = state.fields['source-original'].href
  const hash = state.fields['source-hash'].title
  state.info.section = kind === 'task' ? 'node=second' : 'second-section'
  await state.actions.renderRoute()
  expect(state.dialog.open).toBe(true)
  expect(state.fields['source-content'].textContent).toBe('accepted current source')
  expect(state.fields['source-hash'].title).toBe(hash)
  expect(state.fields['source-original'].href).toBe(original)
  expect(state.fields['source-original'].hidden).toBe(false)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
})

interface SingleMetadata { path: string, sha256: string, model_path?: string, model_sha256?: string, readError?: string, readUnchecked?: boolean, readChanged?: boolean, readStatus?: number, readScopeLimited?: boolean, readVersion?: number }

function singleReadState() {
  const entry: SingleMetadata = { path: 'entry.md', sha256: 'entry-v1' }
  const other: SingleMetadata = { path: 'other.md', sha256: 'other-v1' }
  const file: SingleMetadata = { path: 'receipt.txt', sha256: 'receipt-v1' }
  const page: SingleMetadata = { path: 'task/handbook.html', model_path: 'task/model.json', sha256: 'html-v1', model_sha256: 'model-v1' }
  const html: SingleMetadata = { path: page.path, sha256: page.sha256 }
  const model: SingleMetadata = { path: page.model_path!, sha256: page.model_sha256! }
  const { fields, dialog, ui } = sourceDialogState()
  const context = {
    ui: { ...ui, context: { hidden: false, reading: undefined as unknown, replaceChildren: vi.fn() } },
    catalog: { entry: entry.path, readNavigation: [{ path: other.path, label: '独立规则' }], task_errors: {} },
    documents: new Map([[entry.path, entry], [other.path, other]]),
    sources: new Map([[file.path, file], [html.path, html], [model.path, model]]),
    taskPages: new Map([[page.path, page]]),
    sourceVersion: 0,
    sourceRoute: undefined,
    taskFrameRead: undefined as unknown,
    renderVersion: 1,
    readPageVersion: 0,
    readPageKey: undefined,
    currentPath: other.path,
    currentView: 'page',
    fetchResource: vi.fn((_url: string) => Promise.resolve('当前原文')),
    documentText: vi.fn(async () => '未使用的文档分支'),
    renderNavigation: vi.fn(),
    refreshReadLinks: vi.fn(),
    notice: vi.fn(),
    tocItems: [],
    showReadFailure: vi.fn(),
    toast: vi.fn(),
    routeInfo: () => ({ path: other.path, view: 'page', query: '', taskQuery: '', phase: 'all' }),
  }
  const code = source.slice(source.indexOf('  async function openSource('), source.indexOf('\n  ui[\'search-input\'].addEventListener'))
  const actions = runInNewContext(`${sourceAccess}\n${code}\n({readSource,applyReadCheck,openSource,sourceUrl,sourceReadError,unavailableReason})`, context) as {
    readSource: (path: string, url: string, isCurrent: () => boolean, requestOwner?: { current: () => boolean }) => Promise<string | undefined>
    applyReadCheck: (metadata: SingleMetadata, check: { error: string, changed?: boolean, unchecked?: boolean, status?: number }, resultVersion?: number) => void
    openSource: (path: string) => Promise<void>
    sourceUrl: (path: string) => string
    sourceReadError: (path: string) => unknown
    unavailableReason: (link: unknown) => string
  }
  return { context, actions, fields, dialog, entry, other, file, page, html, model }
}

function taskFrameState() {
  const state = singleReadState()
  let frame: { src: string, contentWindow: object, isConnected: boolean } | undefined
  let body = ''
  let serial = 0
  const article = {
    dataset: {} as Record<string, string>,
    get innerHTML() { return body },
    set innerHTML(value: string) {
      body = value
      if (frame)
        frame.isConnected = false
      const src = /<iframe\s[^>]*src="([^"]*)"/.exec(value)?.[1]
      frame = src ? { src, contentWindow: {}, isConnected: true } : undefined
    },
    querySelector: () => frame,
    querySelectorAll: () => [],
    contains: (node: unknown) => node === frame,
  }
  const info = { path: state.page.path, view: 'page', query: '', taskQuery: 'view=detail&q=甲', phase: 'all', section: 'node=recv' }
  const page = Object.assign(state.page, { title: '签收任务', synchronized: true })
  const context = Object.assign(state.context, {
    ui: {
      ...state.context.ui,
      article,
      'page-links': { innerHTML: '', hidden: true, replaceChildren() { this.innerHTML = '' } },
      'page-title': { textContent: '', title: '' },
      'document-kind': { textContent: '', hidden: false },
      'page-description': { textContent: '', title: '' },
      'breadcrumbs': { textContent: '', title: '' },
      'source-button': { hidden: false },
      'phase-filter': { replaceChildren: vi.fn() },
    },
    currentPath: page.path,
    currentView: 'page',
    renderVersion: 1,
    taskFrameRead: undefined as unknown,
    crypto: {
      randomUUID: vi.fn(() => {
        const value = (++serial).toString(16).padStart(32, '0')
        return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
      }),
    },
    URL,
    URLSearchParams,
    escape: (value: unknown) => String(value),
    setHeader: vi.fn(),
    updateHeaderOffset: vi.fn(),
    document: { title: '' },
    navLink: vi.fn(),
    window: { scrollTo: vi.fn() },
    routeInfo: () => ({ ...info }),
  })
  const code = source.slice(source.indexOf('  function renderOriginalTask('), source.indexOf('  function excerpt('))
  const headerCode = source.slice(source.indexOf('  function setHeader('), source.indexOf('  function updateHeaderOffset('))
  const failureCode = source.slice(source.indexOf('  function showReadFailure('), source.indexOf('  async function refresh('))
  const closeCode = source.slice(source.indexOf('  ui[\'source-dialog\'].addEventListener(\'close\','), source.indexOf('  ui[\'source-dialog\'].addEventListener(\'click\','))
  const actualFailure = runInNewContext(`(()=>{${failureCode}\nreturn showReadFailure})()`, context) as (path: string, message: string) => void
  context.showReadFailure.mockImplementation(actualFailure)
  const actions = runInNewContext(`${headerCode}\n${code}\n${closeCode}\n;({renderOriginalTask,openSource,sourceUrl,sourceReadError,unavailableReason,taskFrameError:typeof taskFrameError==='function'?taskFrameError:undefined})`, context) as {
    renderOriginalTask: (page: SingleMetadata, route: typeof info, version?: number) => void
    openSource: (path: string) => Promise<void>
    sourceUrl: (path: string) => string
    sourceReadError: (path: string) => { error: string, status?: number, changed?: boolean, unchecked?: boolean } | undefined
    unavailableReason: (link: unknown) => string
    taskFrameError: ((event: { origin: string, source: object, data: Record<string, unknown> }) => Promise<void>) | undefined
  }
  actions.renderOriginalTask(page, info, 1)
  const event = () => ({
    origin: 'null',
    source: frame!.contentWindow,
    data: {
      type: 'requirement-flow:task-page-error',
      request: new URL(frame!.src, 'http://reader.invalid').searchParams.get('embed_request'),
      path: page.path,
      sha256: page.sha256,
      model_sha256: page.model_sha256,
    } as Record<string, unknown>,
  })
  return { ...state, context, page, info, article, actions, event, frame: () => frame! }
}

it('binds an original task iframe to a unique error-report request without prefetching its source', () => {
  const state = taskFrameState()
  const first = new URL(state.frame().src, 'http://reader.invalid')
  expect(first.searchParams.get('embed')).toBe('1')
  expect(first.searchParams.get('embed_request')).toEqual(expect.stringMatching(/^[a-f\d]{32}$/))
  expect(first.searchParams.get('view')).toBe('detail')
  expect(first.hash).toBe('#node=recv')
  expect(state.context.fetchResource).not.toHaveBeenCalled()
  expect(state.context.ui['page-links'].innerHTML).not.toContain('embed_request')
  state.actions.renderOriginalTask(state.page, state.info, 1)
  const second = new URL(state.frame().src, 'http://reader.invalid')
  expect(second.searchParams.get('embed_request')).toMatch(/^[a-f\d]{32}$/)
  expect(second.searchParams.get('embed_request')).not.toBe(first.searchParams.get('embed_request'))
  expect(state.context.fetchResource).not.toHaveBeenCalled()
})

it.each([
  { status: 404, detail: 'missing original handbook', stage: '' },
  { status: 409, detail: 'actual pair revision changed', stage: '' },
  { status: 415, detail: 'actual catalog entry is not UTF-8', stage: 'catalog' },
])('rechecks the versioned task source after its frame reports an error and applies only actual HTTP $status', async ({ status, detail, stage }) => {
  const state = taskFrameState()
  const failure = Object.assign(new Error(detail), { status }, stage ? { error_stage: stage, error_source: state.entry.path } : {})
  state.context.fetchResource.mockRejectedValueOnce(failure)
  const event = state.event()
  Object.assign(event.data, { status: 200, error_stage: stage ? 'source' : 'catalog', error_source: 'forged.md', error: 'forged browser conclusion' })
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
  expect(state.context.fetchResource).toHaveBeenCalledWith('/task-page/html-v1/model-v1/task/handbook.html')
  expect(state.context.showReadFailure).toHaveBeenCalledOnce()
  expect(state.context.showReadFailure.mock.calls[0][0]).toBe(state.page.path)
  if (stage) {
    for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model]) {
      expect(metadata.readUnchecked).toBe(true)
      expect(metadata.readStatus).toBeUndefined()
      expect(metadata.readError).toContain(state.entry.path)
    }
    expect(state.context.catalog.readNavigation).toEqual([])
  }
  else {
    for (const metadata of [state.page, state.html, state.model]) {
      expect(metadata.readStatus).toBe(status)
      expect(metadata.readChanged).toBe(status === 409)
      expect(metadata.readError).toContain(detail)
    }
    for (const metadata of [state.entry, state.other, state.file])
      expect(metadata.readError).toBeUndefined()
  }
  expect(JSON.stringify(state.context.showReadFailure.mock.calls)).not.toContain('forged browser conclusion')
})

it('treats an authenticated frame report followed by HTTP 200 as an unloaded frame, without approving its canvas or trusting claimed failure fields', async () => {
  const state = taskFrameState()
  const event = state.event()
  Object.assign(event.data, { status: 404, error_stage: 'catalog', error_source: 'forged-entry.md', scope_limited: true })
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
  for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model])
    expect(metadata.readError).toBeUndefined()
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
  expect(state.context.notice).toHaveBeenCalled()
  const message = String(state.context.notice.mock.calls.at(-1)?.[0])
  expect(message).toMatch(/未.*加载|重新打开|重开/)
  expect(message).not.toMatch(/验收通过|画布.*成功|forged-entry/)
})

it.each(['origin', 'frame', 'request', 'path', 'html-sha', 'model-sha', 'type'])('ignores a task-frame error with an incorrect %s', async (field) => {
  const state = taskFrameState()
  const event = state.event()
  if (field === 'origin') {
    event.origin = 'http://reader.invalid'
  }
  else if (field === 'frame') {
    event.source = {}
  }
  else {
    const key = ({ 'request': 'request', 'path': 'path', 'html-sha': 'sha256', 'model-sha': 'model_sha256', 'type': 'type' } as Record<string, string>)[field]
    event.data[key] = 'incorrect'
  }
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).not.toHaveBeenCalled()
  expect(state.page.readError).toBeUndefined()
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
  expect(state.context.notice).not.toHaveBeenCalled()
})

it('allows only one source recheck per original task frame, including repeated reports while the request is pending', async () => {
  const state = taskFrameState()
  let resolve!: (text: string) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((complete) => {
    resolve = complete
  }))
  const event = state.event()
  const pending = state.actions.taskFrameError!(event)
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
  resolve('source now readable')
  await pending
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
})

it.each(['page', 'catalog'])('still rechecks the same visible task frame after an unrelated %s generation changes', async (generation) => {
  const state = taskFrameState()
  if (generation === 'page')
    state.page.readVersion = (state.page.readVersion || 0) + 1
  else
    Object.assign(state.context.catalog, { readVersion: 9 })
  await state.actions.taskFrameError!(state.event())
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
  expect(state.context.fetchResource).toHaveBeenCalledWith('/task-page/html-v1/model-v1/task/handbook.html')
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.notice).toHaveBeenCalled()
})

it.each([404, 409])('handles a visible task-frame error after its AI source was read and closed, using real HTTP %s', async (status) => {
  const state = taskFrameState()
  const event = state.event()
  state.context.fetchResource.mockResolvedValueOnce('{"revision":1}')
  await state.actions.openSource(state.model.path)
  expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
  state.dialog.close()
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('actual changed frame source'), { status }))
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.context.fetchResource).toHaveBeenLastCalledWith('/task-page/html-v1/model-v1/task/handbook.html')
  for (const metadata of [state.page, state.html, state.model])
    expect(metadata.readStatus).toBe(status)
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  expect(state.context.ui['page-links'].innerHTML).toBe('')
  expect(state.context.showReadFailure).toHaveBeenCalledOnce()
  expect(String(state.context.notice.mock.calls.at(-1)?.[0])).toMatch(/刷新|恢复/)
})

it('closes a failed visible frame even when an overlapping AI request is cancelled and both actual requests return 409', async () => {
  const state = taskFrameState()
  const failures: ((error: Error) => void)[] = []
  state.context.fetchResource.mockImplementation(() => new Promise((_resolve, reject) => {
    failures.push(reject)
  }))
  const frameRead = state.actions.taskFrameError!(state.event())
  const aiRead = state.actions.openSource(state.model.path)
  expect(state.dialog.open).toBe(true)
  state.dialog.close()
  for (const reject of failures)
    reject(Object.assign(new Error('actual overlapping 409'), { status: 409 }))
  await Promise.all([frameRead, aiRead])
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.dialog.open).toBe(false)
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  expect(state.context.ui['page-links'].innerHTML).toBe('')
  for (const metadata of [state.page, state.html, state.model]) {
    expect(metadata.readError).toBeTruthy()
    expect(metadata.readStatus).toBe(409)
    expect(metadata.readChanged).toBe(true)
  }
  expect(state.article.innerHTML).toMatch(/未.*加载|未能核对/)
  const notice = String(state.context.notice.mock.calls.at(-1)?.[0])
  expect(notice).toMatch(/刷新|重开/)
  expect(notice).not.toMatch(/已可读取|已恢复|加载成功/)
})

it('records an actual catalog failure when both frame and cancelled AI requests fail without newer success', async () => {
  const state = taskFrameState()
  const failures: ((error: Error) => void)[] = []
  state.context.fetchResource.mockImplementation(() => new Promise((_resolve, reject) => {
    failures.push(reject)
  }))
  const frameRead = state.actions.taskFrameError!(state.event())
  const aiRead = state.actions.openSource(state.model.path)
  state.dialog.close()
  for (const reject of failures)
    reject(Object.assign(new Error('actual missing entry'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await Promise.all([frameRead, aiRead])
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual([])
  for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model]) {
    expect(metadata.readError).toContain(state.entry.path)
    expect(metadata.readUnchecked).toBe(true)
    expect(metadata.readStatus).toBeUndefined()
  }
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  expect(state.context.ui['page-links'].innerHTML).toBe('')
  expect(state.dialog.open).toBe(false)
  const message = String(state.context.notice.mock.calls.at(-1)?.[0])
  expect(message).toContain(state.entry.path)
  expect(message).not.toMatch(/已可读取|已恢复|加载成功/)
})

it.each(['success', 'source-failure', 'catalog-failure'])('accepts the later-issued pending AI %s after an earlier frame 409 has already been recorded', async (result) => {
  const state = taskFrameState()
  state.context.catalog.readNavigation = []
  const pending: { resolve: (text: string) => void, reject: (error: Error) => void }[] = []
  state.context.fetchResource.mockImplementation(() => new Promise((resolve, reject) => {
    pending.push({ resolve, reject })
  }))
  const frameRead = state.actions.taskFrameError!(state.event())
  const aiRead = state.actions.openSource(state.model.path)
  pending[0].reject(Object.assign(new Error('earlier frame pair changed'), { status: 409 }))
  await frameRead
  expect(state.page.readStatus).toBe(409)
  expect(state.dialog.open).toBe(true)
  expect(String(state.context.notice.mock.calls.at(-1)?.[0])).toContain('来源已更新')
  if (result === 'success') {
    pending[1].resolve('{"revision":1}')
  }
  else {
    pending[1].reject(Object.assign(new Error(`new AI ${result}`), result === 'catalog-failure'
      ? { status: 404, error_stage: 'catalog', error_source: state.entry.path }
      : { status: 404 }))
  }
  await aiRead
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.context.catalog.readNavigation).toEqual([])
  if (result === 'success') {
    expect(state.dialog.open).toBe(true)
    expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
    expect(state.fields['source-hash'].title).toBe('model-v1')
    expect(state.fields['source-original'].href).toBe('/task-page/html-v1/model-v1/task/model.json')
    expect(state.fields['source-original'].hidden).toBe(false)
    for (const metadata of [state.page, state.html, state.model]) {
      expect(metadata.readError).toBeFalsy()
      expect(metadata.readChanged).toBe(false)
      expect(metadata.readStatus).toBeUndefined()
    }
    expect(state.context.catalog).not.toHaveProperty('readFailure')
    state.dialog.close()
    const message = String(state.context.notice.mock.calls.at(-1)?.[0])
    expect(message).toMatch(/未.*加载/)
    expect(message).toContain('来源')
    expect(message).toMatch(/已.*核对|可读取/)
    expect(message).toMatch(/刷新.*重开|重开.*刷新/)
    expect(message).not.toMatch(/来源已更新|核对新版|修复|恢复/)
  }
  else if (result === 'catalog-failure') {
    expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
    for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model]) {
      expect(metadata.readError).toContain(state.entry.path)
      expect(metadata.readUnchecked).toBe(true)
      expect(metadata.readStatus).toBeUndefined()
    }
  }
  else {
    for (const metadata of [state.page, state.html, state.model]) {
      expect(metadata.readError).toContain('new AI source-failure')
      expect(metadata.readStatus).toBe(404)
      expect(metadata.readChanged).toBe(false)
    }
    for (const metadata of [state.entry, state.other, state.file])
      expect(metadata.readError).toBeUndefined()
  }
  if (result !== 'success') {
    expect(state.fields['source-hash'].textContent).toBe('')
    expect(state.fields['source-hash'].title).toBe('')
    expect(state.fields['source-original'].href).toBe('')
    expect(state.fields['source-original'].hidden).toBe(true)
  }
})

it.each(['source-failure', 'catalog-failure'])('invalidates an already displayed AI modal when a later current frame accepts %s', async (result) => {
  const state = taskFrameState()
  const event = state.event()
  state.context.fetchResource.mockResolvedValueOnce('{"revision":1}')
  await state.actions.openSource(state.model.path)
  expect(state.dialog.open).toBe(true)
  expect(state.fields['source-hash'].title).toBe('model-v1')
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error(`accepted frame ${result}`), result === 'catalog-failure'
    ? { status: 404, error_stage: 'catalog', error_source: state.entry.path }
    : { status: 409 }))
  await state.actions.taskFrameError!(event)
  expect(state.fields['source-content'].textContent).not.toBe('{"revision":1}')
  expect(state.fields['source-hash'].textContent).toBe('')
  expect(state.fields['source-hash'].title).toBe('')
  expect(state.fields['source-original'].href).toBe('')
  expect(state.fields['source-original'].hidden).toBe(true)
  if (state.dialog.open)
    expect(state.fields['source-content'].textContent).toMatch(/未能|未核对|已更新|无法读取/)
  expect(state.article.innerHTML).not.toContain('<iframe')
})

it('restores only the later AI pair fact after a catalog failure, while other directory sources stay unchecked', async () => {
  const state = taskFrameState()
  const pending: { resolve: (text: string) => void, reject: (error: Error) => void }[] = []
  state.context.fetchResource.mockImplementation(() => new Promise((resolve, reject) => {
    pending.push({ resolve, reject })
  }))
  const frameRead = state.actions.taskFrameError!(state.event())
  const aiRead = state.actions.openSource(state.model.path)
  pending[0].reject(Object.assign(new Error('earlier actual catalog failure'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await frameRead
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  pending[1].resolve('{"revision":1}')
  await aiRead
  expect(state.dialog.open).toBe(true)
  expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
  expect(state.fields['source-hash'].title).toBe('model-v1')
  expect(state.fields['source-original'].href).toBe('/task-page/html-v1/model-v1/task/model.json')
  expect(state.fields['source-original'].hidden).toBe(false)
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual([])
  for (const metadata of [state.page, state.html, state.model]) {
    expect(metadata.readError).toBeFalsy()
    expect(metadata.readUnchecked).toBe(false)
    expect(metadata.readStatus).toBeUndefined()
  }
  for (const metadata of [state.entry, state.other, state.file]) {
    expect(metadata.readError).toContain(state.entry.path)
    expect(metadata.readUnchecked).toBe(true)
    expect(() => state.actions.sourceUrl(metadata.path)).toThrow(state.entry.path)
  }
  expect(state.actions.sourceUrl(state.page.path)).toBe('/task-page/html-v1/model-v1/task/handbook.html')
  expect(state.actions.sourceUrl(state.model.path)).toBe('/task-page/html-v1/model-v1/task/model.json')
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.context.catalog).toMatchObject({ readFailure: { error: expect.stringContaining(state.entry.path) } })
  const message = String(state.context.notice.mock.calls.at(-1)?.[0])
  expect(message).toContain('来源')
  expect(message).toMatch(/已.*核对|可读取/)
  expect(message).toContain('目录')
  expect(message).toMatch(/其余|其他/)
  expect(message).toContain('刷新')
  expect(message).not.toContain(state.entry.path)
  expect(message).not.toContain('来源尚未核对：task/')
})

it.each([
  ['ai-first', 200],
  ['frame-first', 200],
  ['ai-first', 409],
  ['frame-first', 409],
  ['ai-first', 404],
  ['frame-first', 404],
] as const)('keeps the newer A pair fact and the unverified old directory separate for %s completion order with AI HTTP %s', async (order, status) => {
  const state = taskFrameState()
  const otherPage: SingleMetadata = { path: 'other-task/handbook.html', model_path: 'other-task/model.json', sha256: 'other-html-v1', model_sha256: 'other-model-v1' }
  const otherHtml: SingleMetadata = { path: otherPage.path, sha256: otherPage.sha256 }
  const otherModel: SingleMetadata = { path: otherPage.model_path!, sha256: otherPage.model_sha256! }
  state.context.taskPages.set(otherPage.path, otherPage)
  state.context.sources.set(otherHtml.path, otherHtml)
  state.context.sources.set(otherModel.path, otherModel)
  state.context.catalog.readNavigation = [
    { path: state.entry.path, label: '旧入口声明' },
    { path: state.page.path, label: '原任务A' },
    { path: otherPage.path, label: '原任务B' },
  ]
  const pending: { resolve: (text: string) => void, reject: (error: Error) => void }[] = []
  state.context.fetchResource.mockImplementation(() => new Promise((resolve, reject) => {
    pending.push({ resolve, reject })
  }))
  const frameRead = state.actions.taskFrameError!(state.event())
  // The later pair request only proves A, even when the live entry has already changed to R2.
  const aiRead = state.actions.openSource(state.model.path)
  const failure = Object.assign(new Error('old entry was missing during the earlier frame request'), { status: 404, error_stage: 'catalog', error_source: state.entry.path })
  const finishAI = async () => {
    if (status === 200)
      pending[1].resolve('{"revision":1}')
    else
      pending[1].reject(Object.assign(new Error(`current A source ${status}`), { status }))
    await aiRead
  }
  if (order === 'ai-first') {
    await finishAI()
    pending[0].reject(failure)
    await frameRead
  }
  else {
    pending[0].reject(failure)
    await frameRead
    await finishAI()
  }
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.dialog.open).toBe(true)
  if (status === 200) {
    expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
    expect(state.fields['source-hash'].title).toBe('model-v1')
    expect(state.fields['source-original'].href).toBe('/task-page/html-v1/model-v1/task/model.json')
    expect(state.fields['source-original'].hidden).toBe(false)
    for (const metadata of [state.page, state.html, state.model]) {
      expect(metadata.readError).toBeFalsy()
      expect(metadata.readUnchecked).toBeFalsy()
      expect(metadata.readStatus).toBeUndefined()
    }
    expect(state.actions.sourceUrl(state.page.path)).toBe('/task-page/html-v1/model-v1/task/handbook.html')
    expect(state.actions.sourceUrl(state.model.path)).toBe('/task-page/html-v1/model-v1/task/model.json')
  }
  else {
    for (const metadata of [state.page, state.html, state.model]) {
      expect(metadata.readError).toContain(`current A source ${status}`)
      expect(metadata.readStatus).toBe(status)
      expect(metadata.readChanged).toBe(status === 409)
      expect(metadata.readUnchecked).toBe(false)
    }
    const diagnostic = state.actions.sourceReadError(state.model.path)
    expect(diagnostic).toMatchObject({ status, changed: status === 409 })
    const reason = state.actions.unavailableReason({ target: state.model.path, ...diagnostic })
    expect(state.fields['source-content'].textContent).toBe(reason)
    expect(() => state.actions.sourceUrl(state.model.path)).toThrow(reason)
    expect(state.fields['source-hash'].textContent).toBe('')
    expect(state.fields['source-hash'].title).toBe('')
    expect(state.fields['source-original'].href).toBe('')
    expect(state.fields['source-original'].hidden).toBe(true)
  }
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual([])
  for (const metadata of [state.entry, state.other, state.file, otherPage, otherHtml, otherModel]) {
    expect(metadata.readError).toBeTruthy()
    expect(metadata.readUnchecked).toBe(true)
    expect(metadata.readStatus).toBeUndefined()
    expect(() => state.actions.sourceUrl(metadata.path)).toThrow()
  }
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  expect(state.context.ui['page-links'].innerHTML).toBe('')
  const message = String(state.context.notice.mock.calls.at(-1)?.[0])
  if (status === 200) {
    for (const text of [state.context.ui['page-description'].textContent, state.article.innerHTML]) {
      expect(text).toContain('来源')
      expect(text).toContain('已重新核对')
      expect(text).toContain('其余目录')
      expect(text).toContain('刷新')
    }
    expect(state.context.ui['document-kind'].textContent).not.toBe('来源未读取')
    expect(message).toContain('来源')
    expect(message).toMatch(/已.*核对|可读取/)
    expect(message).toContain('目录')
    expect(message).toMatch(/其余|其他/)
    expect(message).toContain('刷新')
    expect(message).not.toContain('来源已更新：task/')
  }
  else {
    for (const text of [state.context.ui['page-description'].textContent, state.article.innerHTML, message])
      expect(text).not.toContain(state.entry.path)
    if (status === 409)
      expect(message).toContain('task/')
    expect(message).toContain(status === 409 ? '来源已更新' : 'current A source 404')
    expect(message).not.toContain('已重新核对')
  }
})

it.each([
  ['ordinary', false],
  ['ordinary', true],
  ['markdown', false],
  ['markdown', true],
  ['frame-ai', false],
  ['frame-ai', true],
] as const)('keeps directory failure attribution after closing a %s source popup with newer ticket=%s', async (kind, newerTicket) => {
  const state = taskFrameState()
  if (kind !== 'frame-ai') {
    state.context.currentPath = state.other.path
    state.info.path = state.other.path
    state.context.taskFrameRead = undefined
    state.article.innerHTML = '<p>当前 Markdown 正文</p>'
    state.context.ui['page-links'].replaceChildren()
    state.context.ui['page-links'].hidden = true
  }
  const documentCode = source.slice(source.indexOf('  async function documentText('), source.indexOf('  async function documentRecords('))
  runInNewContext(documentCode, state.context)
  const target = kind === 'ordinary' ? state.file.path : kind === 'markdown' ? state.other.path : state.model.path
  const otherPage: SingleMetadata = { path: 'other-task/handbook.html', model_path: 'other-task/model.json', sha256: 'other-html-v1', model_sha256: 'other-model-v1' }
  const ticket: SingleMetadata = { path: 'new-ticket.txt', sha256: 'ticket-v1' }
  state.context.taskPages.set(otherPage.path, otherPage)
  state.context.sources.set(ticket.path, ticket)
  const unverified = [state.entry, state.other, state.file, state.page, state.html, state.model, otherPage]
  state.context.catalog.readNavigation = [{ path: state.entry.path, label: '旧目录入口' }, { path: otherPage.path, label: '旧任务B' }]
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  })).mockResolvedValueOnce('new accepted ticket')
  const oldRead = state.actions.openSource(target)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
  state.dialog.close()
  if (newerTicket)
    await state.actions.openSource(ticket.path)
  reject(Object.assign(new Error('actual earlier catalog failure'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await oldRead
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual([])
  for (const metadata of unverified) {
    expect(metadata.readError).toBeTruthy()
    expect(metadata.readUnchecked).toBe(true)
    expect(metadata.readStatus).toBeUndefined()
  }
  if (newerTicket) {
    expect(state.dialog.open).toBe(true)
    expect(state.fields['source-content'].textContent).toBe('new accepted ticket')
    expect(state.fields['source-hash'].title).toBe(ticket.sha256)
    expect(state.fields['source-original'].href).toBe('/content/new-ticket.txt?sha256=ticket-v1')
    expect(state.fields['source-original'].hidden).toBe(false)
    expect(ticket.readError).toBeFalsy()
    expect(state.actions.sourceUrl(ticket.path)).toBe('/content/new-ticket.txt?sha256=ticket-v1')
  }
  else {
    expect(state.dialog.open).toBe(false)
    expect(state.fields['source-hash'].textContent).toBe('')
    expect(state.fields['source-original'].hidden).toBe(true)
  }
  if (kind === 'frame-ai') {
    expect(state.article.innerHTML).not.toContain('<iframe')
    expect(state.context.ui['page-links'].hidden).toBe(true)
    expect(state.context.ui['page-links'].innerHTML).toBe('')
  }
})

it.each(['batch', 'route', 'refresh'])('ignores a closed popup catalog failure after a newer %s owner takes over', async (owner) => {
  const state = taskFrameState()
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  }))
  const oldRead = state.actions.openSource(state.file.path)
  state.dialog.close()
  const nextNavigation = [{ path: state.other.path, label: '已核对的新目录' }]
  if (owner === 'batch') {
    const code = source.slice(source.indexOf('  function updateReadChecks('), source.indexOf('  function related('))
    const update = runInNewContext(`${code}\nupdateReadChecks`, state.context) as (...args: unknown[]) => void
    update(
      [...state.context.documents.values()].map(doc => ({ doc, error: '' })),
      [...state.context.taskPages.values()].map(page => ({ path: page.path, sha256: page.sha256, model_sha256: page.model_sha256 })),
      [{ path: state.file.path, sha256: state.file.sha256 }],
      [],
      nextNavigation,
      new Map(),
      [],
    )
  }
  else if (owner === 'route') {
    state.context.renderVersion++
    state.context.currentPath = state.other.path
    state.info.path = state.other.path
    state.context.catalog.readNavigation = nextNavigation
  }
  else {
    state.context.catalog = { ...state.context.catalog, readNavigation: nextNavigation }
  }
  reject(Object.assign(new Error('obsolete directory failure'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await oldRead
  expect(state.context.catalog).not.toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual(nextNavigation)
  for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model])
    expect(metadata.readError).toBeFalsy()
  expect(state.dialog.open).toBe(false)
  expect(state.context.fetchResource).toHaveBeenCalledOnce()
})

it('preserves a normally displayed task frame when a newer AI fact proves A before an old closed popup catalog failure', async () => {
  const state = taskFrameState()
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  })).mockResolvedValueOnce('{"revision":1}')
  const oldRead = state.actions.openSource(state.model.path)
  state.dialog.close()
  await state.actions.openSource(state.model.path)
  const currentFrame = state.frame()
  reject(Object.assign(new Error('earlier catalog failure unrelated to the newer pair fact'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await oldRead
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual([])
  for (const metadata of [state.entry, state.other, state.file])
    expect(metadata.readUnchecked).toBe(true)
  for (const metadata of [state.page, state.html, state.model])
    expect(metadata.readError).toBeFalsy()
  expect(state.dialog.open).toBe(true)
  expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
  expect(state.fields['source-hash'].title).toBe('model-v1')
  expect(state.fields['source-original'].hidden).toBe(false)
  expect(state.frame()).toBe(currentFrame)
  expect(state.article.innerHTML).toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(false)
  expect(state.context.ui['page-links'].innerHTML).toContain('/task-page/html-v1/model-v1/task/handbook.html')
  const message = String(state.context.notice.mock.calls.at(-1)?.[0])
  expect(message).toMatch(/已.*核对|可读取/)
  expect(message).toContain('目录')
  expect(message).toMatch(/其余|其他/)
  expect(message).not.toContain(state.entry.path)
})

it.each(['markdown', 'task'])('preserves checked-page and pending-directory guidance after a real same-route %s redraw', async (kind) => {
  const state = taskFrameState()
  const target = kind === 'task' ? state.model.path : state.other.path
  const sourceText = kind === 'task' ? '{"revision":1}' : '# R1 业务正文'
  if (kind === 'markdown') {
    state.info.path = state.other.path
    state.info.section = ''
    state.context.currentPath = state.other.path
    state.context.taskFrameRead = undefined
    state.article.innerHTML = '<p>R1 业务正文</p>'
    state.context.setHeader({ title: '当前业务规则', description: 'R1 业务正文', path: state.other.path })
  }
  const documentCode = source.slice(source.indexOf('  async function documentText('), source.indexOf('  async function documentRecords('))
  runInNewContext(documentCode, state.context)
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  })).mockResolvedValueOnce(sourceText)
  const oldRead = state.actions.openSource(state.file.path)
  state.dialog.close()
  await state.actions.openSource(target)
  reject(Object.assign(new Error('old catalog failure before the checked page fact'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await oldRead
  const description = state.context.ui['page-description'].textContent
  const notice = String(state.context.notice.mock.calls.at(-1)?.[0])
  for (const text of [description, notice]) {
    expect(text).toContain('重新核对')
    expect(text).toContain('其余目录')
    expect(text).toContain('刷新')
  }
  const failure = (state.context.catalog as { readFailure?: unknown }).readFailure
  expect(failure).toBeTruthy()
  Object.assign(state.article, { replaceChildren: (...nodes: string[]) => {
    state.article.innerHTML = nodes.join('')
  } })
  Object.assign(state.context, {
    currentPhase: 'all',
    scrollPositions: new Map(),
    diagramDefinitions: new Map(),
    documentAnchors: new Map(),
    tocFrame: 0,
    tocItems: [],
    cancelAnimationFrame: vi.fn(),
    setMenu: vi.fn(),
    setTextTitles: vi.fn(),
    markdownSections: (raw: string) => ({ container: { childNodes: [`<p>${raw}</p>`] }, toc: [], anchors: new Map() }),
    renderPhaseFilter: vi.fn(),
    renderContext: vi.fn(),
    renderDiagrams: async () => {},
    syncToc: vi.fn(),
    updateNavigationSelection: vi.fn(),
  })
  Object.assign(state.context.ui, { 'diagram-dialog': { open: false }, 'search-input': { value: '' } })
  Object.assign(state.context.window, { scrollY: 0 })
  if (kind === 'markdown')
    state.context.fetchResource.mockResolvedValueOnce(sourceText)
  const pageCode = source.slice(source.indexOf('  async function renderPage('), source.indexOf('  async function renderRoute('))
  const routeCode = source.slice(source.indexOf('  async function renderRoute('), source.indexOf('  function showReadFailure('))
  const renderRoute = runInNewContext(`${pageCode}\n${routeCode}\n;renderRoute`, state.context) as () => Promise<void>
  await renderRoute()
  expect(state.context.ui['page-description'].textContent).toBe(description)
  expect(String(state.context.notice.mock.calls.at(-1)?.[0])).toBe(notice)
  expect((state.context.catalog as { readFailure?: unknown }).readFailure).toBe(failure)
  expect(state.context.catalog.readNavigation).toEqual([])
  expect(state.dialog.open).toBe(true)
  expect(state.fields['source-content'].textContent).toBe(sourceText)
  expect(state.fields['source-original'].hidden).toBe(false)
  if (kind === 'task')
    expect(state.article.innerHTML).toContain('<iframe')
  else
    expect(state.article.innerHTML).toContain('R1 业务正文')
  expect(state.context.fetchResource).toHaveBeenCalledTimes(kind === 'task' ? 2 : 3)
})

it('does not reopen a closed AI modal when the visible frame later accepts a real failure', async () => {
  const state = taskFrameState()
  const event = state.event()
  state.context.fetchResource.mockResolvedValueOnce('{"revision":1}')
  await state.actions.openSource(state.model.path)
  state.dialog.close()
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('later frame changed'), { status: 409 }))
  await state.actions.taskFrameError!(event)
  expect(state.dialog.open).toBe(false)
  expect(state.page.readStatus).toBe(409)
  expect(state.article.innerHTML).not.toContain('<iframe')
})

it('keeps a successful AI source fact while independently closing a previously unloaded task frame', async () => {
  const state = taskFrameState()
  const event = state.event()
  state.context.fetchResource.mockResolvedValueOnce('{"revision":1}').mockResolvedValueOnce('<html>restored R1</html>')
  await state.actions.openSource(state.model.path)
  await state.actions.taskFrameError!(event)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
  expect(state.fields['source-hash'].title).toBe('model-v1')
  expect(state.dialog.open).toBe(true)
  for (const metadata of [state.page, state.html, state.model])
    expect(metadata.readError).toBeUndefined()
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  expect(String(state.context.notice.mock.calls.at(-1)?.[0])).toMatch(/未.*加载/)
  expect(String(state.context.notice.mock.calls.at(-1)?.[0])).not.toMatch(/画布.*成功|验收通过/)
})

it.each(['success', 'failure', 'catalog-failure'])('preserves newer AI HTTP 200 when an older frame verification later returns %s', async (result) => {
  const state = taskFrameState()
  let resolve!: (text: string) => void
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((complete, fail) => {
    resolve = complete
    reject = fail
  })).mockResolvedValueOnce('{"revision":1}')
  const frameRead = state.actions.taskFrameError!(state.event())
  await state.actions.openSource(state.model.path)
  if (result === 'success') {
    resolve('<html>obsolete frame success</html>')
  }
  else {
    reject(Object.assign(new Error('obsolete frame failure'), result === 'catalog-failure'
      ? { status: 404, error_stage: 'catalog', error_source: state.entry.path }
      : { status: 409 }))
  }
  await frameRead
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
  expect(state.fields['source-content'].textContent).toBe('{"revision":1}')
  expect(state.fields['source-hash'].title).toBe('model-v1')
  expect(state.fields['source-original'].hidden).toBe(false)
  expect(state.dialog.open).toBe(true)
  for (const metadata of [state.page, state.html, state.model])
    expect(metadata.readError).toBeUndefined()
  if (result === 'catalog-failure') {
    expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
    expect(state.context.catalog.readNavigation).toEqual([])
    for (const metadata of [state.entry, state.other, state.file])
      expect(metadata.readUnchecked).toBe(true)
  }
  else {
    expect(state.context.catalog).not.toHaveProperty('readFailure')
  }
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  const notice = String(state.context.notice.mock.calls.at(-1)?.[0])
  expect(notice).toMatch(/未.*加载|未能核对/)
  expect(notice).toMatch(/刷新|重开/)
  expect(notice).not.toMatch(/已可读取|已恢复|加载成功/)
})

it.each([
  ['route', 'success'],
  ['route', 'failure'],
  ['refresh', 'success'],
  ['refresh', 'failure'],
] as const)('ignores a frame recheck %s owner after a late %s', async (owner, result) => {
  const state = taskFrameState()
  let resolve!: (text: string) => void
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((complete, fail) => {
    resolve = complete
    reject = fail
  }))
  const pending = state.actions.taskFrameError!(state.event())
  if (owner === 'route') {
    state.context.currentPath = state.other.path
    state.info.path = state.other.path
    state.context.renderVersion++
  }
  else {
    state.context.catalog = { ...state.context.catalog }
  }
  if (result === 'success')
    resolve('obsolete success')
  else
    reject(Object.assign(new Error('obsolete frame failure'), { status: 404 }))
  await pending
  for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model])
    expect(metadata.readError).toBeUndefined()
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
  expect(state.context.notice).not.toHaveBeenCalled()
})

interface LiveReplacement { className: string, dataset: Record<string, string>, title: string, childNodes: unknown[], tabIndex: number }

function liveReadLinksState() {
  const state = singleReadState()
  const links = [
    { target: state.file.path, kind: 'source', exists: true, fragment: '', label: '签收依据' },
    { target: state.page.path, kind: 'task-page', exists: true, fragment: 'node=recv', label: '原任务画布' },
    { target: state.model.path, kind: 'source', exists: true, fragment: '', label: 'AI 记录' },
    { target: state.other.path, kind: 'document', exists: true, fragment: '', label: '门店规则' },
  ]
  const doc = Object.assign(state.entry, { kind: 'document', links, backlinks: [] })
  const anchors = links.map((link) => {
    const anchor = {
      tagName: 'A',
      href: link.target,
      dataset: {} as Record<string, string>,
      childNodes: [{ tagName: 'EM', textContent: link.label }, { tagName: 'BR', textContent: '' }, { tagName: 'STRONG', textContent: '原文' }],
      replacement: undefined as LiveReplacement | undefined,
      getAttribute() { return this.href },
      replaceChildren(...nodes: typeof this.childNodes) { this.childNodes = nodes },
      removeAttribute: vi.fn(),
      replaceWith(node: LiveReplacement) { this.replacement = node },
    }
    return anchor
  })
  const documentAnchors = new Map(anchors.map((anchor, index) => [`author-${index}`, anchor]))
  const article = {
    dataset: { documentPath: doc.path },
    querySelectorAll: () => anchors.filter(anchor => !anchor.replacement),
  }
  let html = ''
  let details = [{ open: false }, { open: false }]
  const contextPanel = {
    hidden: false,
    reading: undefined as undefined | { doc: SingleMetadata, toc: unknown[] },
    get innerHTML() { return html },
    set innerHTML(value: string) {
      html = value
      details = [{ open: false }, { open: false }]
    },
    querySelectorAll: (selector: string) => selector.includes('details') ? details : [],
    replaceChildren() {
      this.innerHTML = ''
    },
  }
  const context = Object.assign(state.context, {
    URL,
    URLSearchParams,
    ui: { ...state.context.ui, article, context: contextPanel },
    currentPath: doc.path,
    currentView: 'page',
    readLinkBindings: new WeakMap(),
    routeInfo: () => ({ path: doc.path, view: 'page', query: '', taskQuery: '', phase: 'all', section: '' }),
    documentAnchors,
    document: {
      createElement: (tag = 'span') => ({
        tagName: tag.toUpperCase(),
        className: '',
        dataset: {} as Record<string, string>,
        title: '',
        tabIndex: -1,
        childNodes: [] as unknown[],
        append(...nodes: unknown[]) { this.childNodes.push(...nodes) },
        replaceChildren(...nodes: unknown[]) { this.childNodes = nodes },
        removeAttribute: vi.fn(),
      }),
    },
    related: () => [],
    originalTaskLinks: () => [],
    contextBlock: (title: string, body: string) => `<section>${title}${body}</section>`,
    escape: (value: unknown) => String(value),
    routeUrl: (path: string, fragment = '') => `#page=${encodeURIComponent(path)}&section=${encodeURIComponent(fragment)}`,
    wideOutline: { matches: false },
    formatTime: () => '',
    setTextTitles: vi.fn(),
    setHeader: vi.fn(),
    syncToc: vi.fn(),
    tocItems: [],
  })
  const instrumentCode = source.slice(source.indexOf('  function instrumentLinks('), source.indexOf('  const markdown ='))
  const contextCode = source.slice(source.indexOf('  function renderContext('), source.indexOf('  function syncToc('))
  const closeCode = source.slice(source.indexOf('  ui[\'source-dialog\'].addEventListener(\'close\','), source.indexOf('  ui[\'source-dialog\'].addEventListener(\'click\','))
  const actions = runInNewContext(`${taskQuery}\n${resolve}\n${instrumentCode}\n${contextCode}\n${closeCode}\n;({readSource,instrumentLinks,renderContext,sourceUrl,openSource})`, context) as {
    readSource: (path: string, url: string) => Promise<string | undefined>
    instrumentLinks: (parent: unknown, doc: unknown, authorAnchors: unknown) => void
    renderContext: (doc: unknown, toc: unknown[]) => void
    sourceUrl: (path: string) => string
    openSource: (path: string) => Promise<void>
  }
  actions.instrumentLinks(article, doc, documentAnchors)
  actions.renderContext(doc, [])
  contextPanel.querySelectorAll('details')[1].open = true
  return { ...state, context, doc, article, anchors, documentAnchors, contextPanel, actions }
}

interface TrackedReadNode { tagName: string, childNodes: unknown[], dataset: Record<string, string>, href?: string, replacement?: unknown, replaceWith: (node: TrackedReadNode) => void }

function trackReadNodes(state: ReturnType<typeof liveReadLinksState>, nodes: unknown[] = state.anchors) {
  const rendered = [...nodes] as TrackedReadNode[]
  const createElement = state.context.document.createElement
  const track = (node: TrackedReadNode) => {
    const previous = node.replaceWith
    node.replaceWith = (next) => {
      previous?.call(node, next)
      const index = rendered.indexOf(node)
      if (index >= 0)
        rendered[index] = next
      if (next.tagName === 'A')
        next.replacement = undefined
    }
    return node
  }
  for (const node of rendered)
    track(node)
  Object.assign(state.context.document, { createElement: (tag = 'span') => track(createElement(tag) as unknown as TrackedReadNode) })
  Object.assign(state.article, { querySelectorAll: (selector: string) => selector === 'a[href]'
    ? rendered.filter(node => node.tagName === 'A' && node.href)
    : rendered.filter(node => node.dataset.readerTarget || node.dataset.source) })
  return rendered
}

it('restores a proven body link with its original inline nodes and refreshes later failure reasons without reviving unknown neighbours', async () => {
  const state = liveReadLinksState()
  const rendered = trackReadNodes(state)
  const inline = [...state.anchors[0].childNodes]
  const fileUrl = state.actions.sourceUrl(state.file.path)
  const parentUrl = state.actions.sourceUrl(state.doc.path)
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('initial directory unavailable'), { status: 404, error_stage: 'catalog', error_source: state.doc.path }))
  await expect(state.actions.readSource(state.file.path, fileUrl)).rejects.toThrow('initial directory unavailable')
  expect(rendered[0].tagName).toBe('SPAN')
  state.context.fetchResource.mockResolvedValueOnce('# 已核对的当前业务入口')
  await state.actions.readSource(state.doc.path, parentUrl)
  expect(rendered[0].tagName).toBe('SPAN')
  state.context.fetchResource.mockResolvedValueOnce('new accepted receipt')
  await state.actions.readSource(state.file.path, fileUrl)
  expect(rendered[0].tagName).toBe('A')
  expect(rendered[0].href).toBe(fileUrl)
  expect(rendered[0].childNodes).toEqual(inline)
  expect(rendered[0].childNodes[1]).toBe(inline[1])
  expect(rendered[3].tagName).toBe('SPAN')
  expect(state.other.readUnchecked).toBe(true)
  for (const status of [404, 409]) {
    state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error(`latest receipt ${status}`), { status }))
    await expect(state.actions.readSource(state.file.path, fileUrl)).rejects.toThrow(`latest receipt ${status}`)
    expect(rendered[0].tagName).toBe('SPAN')
    expect(rendered[0].dataset.reason).toContain(status === 409 ? '已更新' : 'latest receipt 404')
    expect(rendered[3].tagName).toBe('SPAN')
  }
  expect(state.context.fetchResource).toHaveBeenCalledTimes(5)
})

it.each(['合同例外：到期后可延三十天', ''])('retains author title %j alongside only the latest unavailable-link reason and restores it unchanged', async (authorTitle) => {
  const state = liveReadLinksState()
  const anchor = state.anchors[0]
  Object.assign(anchor, { title: authorTitle, href: state.file.path })
  state.actions.instrumentLinks({ querySelectorAll: () => [anchor] }, state.doc, state.documentAnchors)
  const rendered = trackReadNodes(state)
  const inline = [...anchor.childNodes]
  const parentUrl = state.actions.sourceUrl(state.doc.path)
  const fileUrl = state.actions.sourceUrl(state.file.path)
  state.context.fetchResource.mockResolvedValueOnce('# 当前已核对业务')
  await state.actions.readSource(state.doc.path, parentUrl)
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('latest contract 404'), { status: 404 }))
  await expect(state.actions.readSource(state.file.path, fileUrl)).rejects.toThrow('latest contract 404')
  const first = rendered[0] as TrackedReadNode & { title: string, tabIndex: number }
  expect(first.tagName).toBe('SPAN')
  expect(first.title).toBe(first.dataset.reason)
  expect(first.dataset.reason).toContain('latest contract 404')
  expect(first.dataset.reason.split('latest contract 404')).toHaveLength(2)
  expect(first.tabIndex).toBe(0)
  if (authorTitle) {
    expect(first.dataset.reason).toContain(authorTitle)
    expect(first.dataset.reason.split(authorTitle)).toHaveLength(2)
  }
  else {
    expect(first.dataset.reason).not.toMatch(/^；|；；/)
  }
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('later contract 409'), { status: 409 }))
  await expect(state.actions.readSource(state.file.path, fileUrl)).rejects.toThrow('later contract 409')
  const latest = rendered[0] as TrackedReadNode & { title: string, tabIndex: number }
  expect(latest.title).toBe(latest.dataset.reason)
  expect(latest.dataset.reason).toContain('来源已更新')
  expect(latest.dataset.reason.split('来源已更新')).toHaveLength(2)
  expect(latest.dataset.reason).not.toContain('latest contract 404')
  if (authorTitle) {
    expect(latest.dataset.reason).toContain(authorTitle)
    expect(latest.dataset.reason.split(authorTitle)).toHaveLength(2)
  }
  else {
    expect(latest.dataset.reason).not.toMatch(/^；|；；/)
  }
  state.context.fetchResource.mockResolvedValueOnce('current accepted contract')
  await state.actions.readSource(state.file.path, fileUrl)
  const restored = rendered[0] as TrackedReadNode & { title: string }
  expect(restored.tagName).toBe('A')
  expect(restored.title).toBe(authorTitle)
  expect(restored.href).toBe(fileUrl)
  expect(restored.childNodes).toEqual(inline)
  expect(restored.childNodes[1]).toBe(inline[1])
  expect(state.context.fetchResource).toHaveBeenCalledTimes(4)
})

it.each([
  { kind: 'source', target: 'freight.csv', status: 404, error: '来源不存在：freight.csv' },
  { kind: 'document', target: 'rules/freight.md', status: 404, error: '文档不存在：rules/freight.md' },
  { kind: 'task-page', target: 'freight/handbook.html', status: 404, error: '缺少任务模型：freight/model.json' },
  { kind: 'source', target: 'freight-large.csv', status: 413, error: '来源超过 2 MiB：freight-large.csv' },
])('preserves a known cold $kind HTTP $status diagnosis when an unrelated ticket read fails', async ({ kind, target, status, error }) => {
  const state = liveReadLinksState()
  const rendered = trackReadNodes(state)
  const title = '合同例外：到期后可延三十天'
  const link = { kind, target, fragment: '', label: '运费依据', exists: false, error, status, scope_limited: false }
  const ticketUrl = state.actions.sourceUrl(state.file.path)
  state.doc.links = [link]
  Object.assign(state.anchors[0], { href: target, title })
  state.actions.instrumentLinks({ querySelectorAll: () => [state.anchors[0]] }, state.doc, state.documentAnchors)
  state.actions.renderContext(state.doc, [])
  const reason = runInNewContext('unavailableReason', state.context) as (link: unknown) => string
  const expected = reason(link)
  const initial = rendered[0] as TrackedReadNode & { title: string }
  expect(initial.dataset.reason).toBe(`${title}；${expected}`)
  expect(initial.title).toBe(initial.dataset.reason)
  expect(state.contextPanel.innerHTML).toContain(`data-reason="${expected}"`)
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('unrelated ticket not found'), { status: 404 }))
  await expect(state.actions.readSource(state.file.path, ticketUrl)).rejects.toThrow('unrelated ticket not found')
  const current = rendered[0] as TrackedReadNode & { title: string }
  expect(current.dataset.reason).toBe(`${title}；${expected}`)
  expect(current.title).toBe(current.dataset.reason)
  expect(current.dataset.reason).not.toContain('尚未纳入')
  expect(state.contextPanel.innerHTML).toContain(`data-reason="${expected}"`)
  const refresh = runInNewContext('refreshReadLinks', state.context) as () => void
  const latest = { error: 'newer explicit conflict', status: 409, changed: true }
  Object.assign(state.context.catalog, { readChecks: new Map([[target, latest]]) })
  refresh()
  const latestReason = reason({ target, ...latest })
  expect(rendered[0].dataset.reason).toBe(`${title}；${latestReason}`)
  expect(rendered[0].dataset.reason).not.toContain(error)
  const recovered: SingleMetadata = { path: target, sha256: 'accepted-current' }
  if (kind === 'document') {
    state.context.documents.set(target, recovered)
  }
  else if (kind === 'task-page') {
    Object.assign(recovered, { model_path: 'freight/model.json', model_sha256: 'accepted-model' })
    state.context.taskPages.set(target, recovered)
    state.context.sources.set(target, { path: target, sha256: recovered.sha256 })
    state.context.sources.set('freight/model.json', { path: 'freight/model.json', sha256: 'accepted-model' })
  }
  else {
    state.context.sources.set(target, recovered)
  }
  const url = state.actions.sourceUrl(target)
  state.context.fetchResource.mockResolvedValueOnce('actual recovered source')
  await state.actions.readSource(target, url)
  refresh()
  expect(rendered[0].tagName).toBe('A')
  expect(rendered[0].href).toBe(kind === 'source' ? url : `#page=${encodeURIComponent(target)}&section=`)
  expect((rendered[0] as TrackedReadNode & { title: string }).title).toBe(title)
})

it('keeps an unrecorded cold target unchecked instead of inventing a remembered read failure', async () => {
  const state = liveReadLinksState()
  const rendered = trackReadNodes(state)
  const link = { kind: 'document', target: 'unknown.md', fragment: '', label: '尚未核对的资料', exists: false }
  const ticketUrl = state.actions.sourceUrl(state.file.path)
  state.doc.links = [link]
  state.anchors[0].href = link.target
  state.actions.instrumentLinks({ querySelectorAll: () => [state.anchors[0]] }, state.doc, state.documentAnchors)
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('unrelated ticket failure'), { status: 404 }))
  await expect(state.actions.readSource(state.file.path, ticketUrl)).rejects.toThrow('unrelated ticket failure')
  expect(rendered[0].tagName).toBe('SPAN')
  expect(rendered[0].dataset.reason).toContain('尚未核对')
  expect(rendered[0].dataset.reason).toContain('尚未纳入')
  expect(rendered[0].dataset.reason).not.toContain('来源无法读取')
  expect(state.context.documents.has(link.target)).toBe(false)
})

it('registers actual generated task-title and AI spans and restores only their proven pair', async () => {
  const state = liveReadLinksState()
  const modelUrl = state.actions.sourceUrl(state.model.path)
  const otherUrl = state.actions.sourceUrl(state.other.path)
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('initial task unavailable'), { status: 404 }))
  await expect(state.actions.readSource(state.model.path, modelUrl)).rejects.toThrow('initial task unavailable')
  state.context.fetchResource.mockRejectedValueOnce(new TypeError('business basis not checked'))
  await expect(state.actions.readSource(state.other.path, otherUrl)).rejects.toThrow('business basis not checked')
  const navCode = source.slice(source.indexOf('  function navLink('), source.indexOf('  function hideNavTooltip('))
  const actions = runInNewContext(`${navCode}\n({navLink,sourceLink,registerReadLinks,refreshReadLinks})`, state.context) as {
    navLink: (doc: SingleMetadata & { title: string }) => string
    sourceLink: (path: string, label: string, from?: string) => string
    registerReadLinks: (parent: unknown) => void
    refreshReadLinks: () => void
  }
  const cold = { path: 'cold/handbook.html', sha256: 'cold-html', title: '未知任务', readError: 'not in current maps', readUnchecked: true }
  Object.assign(state.context.catalog.task_errors, { [cold.path]: 'cold task not checked' })
  const markup = [actions.navLink({ ...state.page, title: '原任务标题' }), actions.sourceLink(state.model.path, 'AI 记录', state.page.path), actions.navLink(cold), actions.sourceLink(state.file.path, '旧业务依据', state.other.path)]
  const nodes = markup.map((html) => {
    const node = state.context.document.createElement(html.startsWith('<a ') ? 'a' : 'span')
    for (const [, key, value] of html.matchAll(/([\w-]+)="([^"]*)"/g)) {
      if (key.startsWith('data-'))
        node.dataset[key.slice(5).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())] = value
      else if (key === 'class')
        node.className = value
      else if (key === 'title')
        node.title = value
    }
    node.append({ textContent: html.replace(/<[^>]+>/g, '') })
    return node
  })
  const rendered = trackReadNodes(state, nodes)
  expect(rendered.slice(0, 3).map(node => node.tagName)).toEqual(['SPAN', 'SPAN', 'SPAN'])
  actions.registerReadLinks(state.article)
  actions.refreshReadLinks()
  expect(rendered[3].tagName).toBe('SPAN')
  state.context.fetchResource.mockResolvedValueOnce('{"revision":1}')
  await state.actions.readSource(state.model.path, modelUrl)
  expect(rendered[0].tagName).toBe('A')
  expect(rendered[0].href).toBe('#page=task%2Fhandbook.html&section=')
  expect(rendered[1].tagName).toBe('A')
  expect(rendered[1].href).toBe(modelUrl)
  expect(rendered[2].tagName).toBe('SPAN')
  expect(rendered[3].tagName).toBe('SPAN')
})

it.each(['same-route', 'leave-back'])('retains directory attribution only for the same logical page across an actual %s renderRoute sequence', async (sequence) => {
  const state = sourceNavigationState()
  const file: SingleMetadata = { path: 'receipt.txt', sha256: 'receipt-v1' }
  state.context.sources.set(file.path, file)
  const catalog = Object.assign(state.context.catalog, { entry: state.info.path, readNavigation: [{ path: state.info.path, label: '旧业务入口' }] })
  let reject!: (error: Error) => void
  const context = Object.assign(state.context, {
    taskFrameRead: undefined,
    refreshReadLinks: vi.fn(),
    fetchResource: vi.fn(() => new Promise<string>((_resolve, fail) => {
      reject = fail
    })),
  })
  runInNewContext(sourceAccess, context)
  await state.actions.renderRoute()
  const oldRead = state.actions.openSource(file.path)
  state.dialog.close()
  if (sequence === 'leave-back') {
    state.info.path = 'current.md'
    await state.actions.renderRoute()
    state.info.path = catalog.entry
  }
  await state.actions.renderRoute()
  reject(Object.assign(new Error('actual directory failure across redraw'), { status: 404, error_stage: 'catalog', error_source: state.info.path }))
  await oldRead
  if (sequence === 'same-route') {
    expect(catalog).toMatchObject({ readFailure: { unchecked: true } })
    expect(catalog.readNavigation).toEqual([])
    expect(file.readUnchecked).toBe(true)
  }
  else {
    expect(catalog).not.toMatchObject({ readFailure: { unchecked: true } })
    expect(catalog.readNavigation).toHaveLength(1)
    expect(file.readError).toBeFalsy()
  }
  expect(state.dialog.open).toBe(false)
  expect(context.fetchResource).toHaveBeenCalledOnce()
})

it.each([[404, false], [409, false], [404, true], [409, true]] as const)('records an actual ordinary source HTTP %s after closing its popup with newer ticket=%s and disables its displayed dependencies', async (status, newerTicket) => {
  const state = liveReadLinksState()
  const ticket: SingleMetadata = { path: 'unrelated-ticket.txt', sha256: 'ticket-v1' }
  state.context.sources.set(ticket.path, ticket)
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  })).mockResolvedValueOnce('new unrelated ticket')
  const pending = state.actions.openSource(state.file.path)
  state.dialog.close()
  if (newerTicket)
    await state.actions.openSource(ticket.path)
  reject(Object.assign(new Error(`actual receipt ${status}`), { status }))
  await pending
  expect(state.file.readStatus).toBe(status)
  expect(state.file.readChanged).toBe(status === 409)
  expect(state.anchors[0].replacement).toBeDefined()
  expect(state.anchors[0].replacement?.title).toContain(status === 409 ? '已更新' : `actual receipt ${status}`)
  expect(state.contextPanel.innerHTML).not.toContain('data-source="receipt.txt"')
  for (const metadata of [state.entry, state.other, state.page, state.html, state.model])
    expect(metadata.readError).toBeFalsy()
  if (newerTicket) {
    expect(state.dialog.open).toBe(true)
    expect(state.fields['source-content'].textContent).toBe('new unrelated ticket')
    expect(state.fields['source-hash'].title).toBe(ticket.sha256)
    expect(state.fields['source-original'].hidden).toBe(false)
  }
  else {
    expect(state.dialog.open).toBe(false)
  }
  expect(ticket.readError).toBeFalsy()
  expect(state.context.fetchResource).toHaveBeenCalledTimes(newerTicket ? 2 : 1)
})

it.each([[404, false], [409, false], [404, true], [409, true]] as const)('records a normal task AI HTTP %s after popup close with unrelated ticket=%s without invalidating B', async (status, newerTicket) => {
  const state = taskFrameState()
  const otherPage: SingleMetadata = { path: 'other-task/handbook.html', model_path: 'other-task/model.json', sha256: 'other-html-v1', model_sha256: 'other-model-v1' }
  const otherHtml: SingleMetadata = { path: otherPage.path, sha256: otherPage.sha256 }
  const otherModel: SingleMetadata = { path: otherPage.model_path!, sha256: otherPage.model_sha256! }
  const ticket: SingleMetadata = { path: 'unrelated-ticket.txt', sha256: 'ticket-v1' }
  state.context.taskPages.set(otherPage.path, otherPage)
  for (const metadata of [otherHtml, otherModel, ticket])
    state.context.sources.set(metadata.path, metadata)
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  })).mockResolvedValueOnce('new unrelated ticket')
  const pending = state.actions.openSource(state.model.path)
  state.dialog.close()
  if (newerTicket)
    await state.actions.openSource(ticket.path)
  reject(Object.assign(new Error(`actual A source ${status}`), { status }))
  await pending
  for (const metadata of [state.page, state.html, state.model]) {
    expect(metadata.readStatus).toBe(status)
    expect(metadata.readChanged).toBe(status === 409)
  }
  for (const metadata of [state.entry, state.other, state.file, otherPage, otherHtml, otherModel, ticket])
    expect(metadata.readError).toBeFalsy()
  expect(state.article.innerHTML).not.toContain('<iframe')
  expect(state.context.ui['page-links'].hidden).toBe(true)
  expect(state.context.ui['page-links'].innerHTML).toBe('')
  if (newerTicket) {
    expect(state.dialog.open).toBe(true)
    expect(state.fields['source-content'].textContent).toBe('new unrelated ticket')
    expect(state.fields['source-hash'].title).toBe(ticket.sha256)
    expect(state.fields['source-original'].hidden).toBe(false)
  }
  else {
    expect(state.dialog.open).toBe(false)
  }
  expect(state.context.fetchResource).toHaveBeenCalledTimes(newerTicket ? 2 : 1)
})

it('keeps a later accepted source 200 and its active dependency links when a closed older local 409 returns', async () => {
  const state = liveReadLinksState()
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  })).mockResolvedValueOnce('new accepted receipt')
  const pending = state.actions.openSource(state.file.path)
  state.dialog.close()
  await state.actions.openSource(state.file.path)
  reject(Object.assign(new Error('obsolete local receipt 409'), { status: 409 }))
  await pending
  expect(state.file.readError).toBeFalsy()
  expect(state.anchors[0].replacement).toBeUndefined()
  expect(state.contextPanel.innerHTML).toContain('data-source="receipt.txt"')
  expect(state.dialog.open).toBe(true)
  expect(state.fields['source-content'].textContent).toBe('new accepted receipt')
  expect(state.fields['source-hash'].title).toBe(state.file.sha256)
  expect(state.fields['source-original'].hidden).toBe(false)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
})

it.each([
  ['csv', 404],
  ['csv', 409],
  ['task', 404],
  ['task', 409],
] as const)('keeps an earlier actual %s HTTP %s fact while a newer same-source read has no accepted result', async (kind, status) => {
  const state = kind === 'csv' ? liveReadLinksState() : taskFrameState()
  if ('anchors' in state) {
    const previousPath = state.file.path
    state.context.sources.delete(previousPath)
    state.file.path = 'receipt.csv'
    state.context.sources.set(state.file.path, state.file)
    state.doc.links[0].target = state.file.path
    state.anchors[0].href = state.file.path
    state.actions.instrumentLinks({ querySelectorAll: () => [state.anchors[0]] }, state.doc, state.documentAnchors)
    state.actions.renderContext(state.doc, [])
  }
  const target = 'anchors' in state ? state.file.path : state.model.path
  const metadata = 'anchors' in state ? [state.file] : [state.page, state.html, state.model]
  const pending: { resolve: (text: string) => void, reject: (error: Error) => void }[] = []
  state.context.fetchResource.mockImplementation(() => new Promise((resolve, reject) => {
    pending.push({ resolve, reject })
  }))
  const older = state.actions.openSource(target)
  state.dialog.close()
  const newer = state.actions.openSource(target)
  pending[0].reject(Object.assign(new Error(`confirmed earlier ${kind} ${status}`), { status }))
  await older
  for (const value of metadata) {
    expect(value.readStatus).toBe(status)
    expect(value.readChanged).toBe(status === 409)
    expect(value.readError).toContain(`confirmed earlier ${kind} ${status}`)
  }
  expect(() => state.actions.sourceUrl(target)).toThrow()
  if ('anchors' in state) {
    expect(state.anchors[0].replacement).toBeDefined()
    expect(state.anchors[0].replacement?.title).toContain(status === 409 ? '已更新' : `confirmed earlier csv ${status}`)
    expect(state.contextPanel.innerHTML).not.toContain('data-source="receipt.csv"')
  }
  else {
    expect(state.article.innerHTML).not.toContain('<iframe')
    expect(state.context.ui['page-links'].hidden).toBe(true)
    expect(state.context.ui['page-links'].innerHTML).toBe('')
  }
  state.dialog.close()
  for (const value of metadata)
    expect(value.readStatus).toBe(status)
  pending[1].resolve(kind === 'csv' ? 'id,name\n1,accepted' : '{"revision":1}')
  await newer
  expect(state.dialog.open).toBe(false)
  for (const value of metadata) {
    expect(value.readError).toBeFalsy()
    expect(value.readStatus).toBeUndefined()
  }
  expect(state.actions.sourceUrl(target)).toContain(kind === 'csv' ? '/content/receipt.csv?sha256=' : '/task-page/html-v1/model-v1/task/model.json')
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
})

it.each([200, 409])('keeps the current Markdown HTTP %s fact distinct from an older directory 404 in all background guidance', async (status) => {
  const state = taskFrameState()
  state.context.currentPath = state.other.path
  state.info.path = state.other.path
  state.context.taskFrameRead = undefined
  state.article.innerHTML = '<p>R1 业务正文</p>'
  state.context.setHeader({ title: '当前业务规则', description: 'R1 业务正文', path: state.other.path })
  const documentCode = source.slice(source.indexOf('  async function documentText('), source.indexOf('  async function documentRecords('))
  runInNewContext(documentCode, state.context)
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, fail) => {
    reject = fail
  }))
  if (status === 200)
    state.context.fetchResource.mockResolvedValueOnce('# R1 业务正文')
  else
    state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('current Markdown changed'), { status: 409 }))
  const oldRead = state.actions.openSource(state.file.path)
  state.dialog.close()
  await state.actions.openSource(state.other.path)
  reject(Object.assign(new Error('earlier entry failure'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await oldRead
  expect(state.context.catalog).toMatchObject({ readFailure: { unchecked: true } })
  expect(state.context.catalog.readNavigation).toEqual([])
  expect(state.dialog.open).toBe(true)
  const message = String(state.context.notice.mock.calls.at(-1)?.[0])
  if (status === 200) {
    expect(state.other.readError).toBeFalsy()
    expect(state.fields['source-content'].textContent).toBe('# R1 业务正文')
    expect(state.fields['source-hash'].title).toBe(state.other.sha256)
    expect(state.fields['source-original'].hidden).toBe(false)
    expect(state.article.innerHTML).toContain('R1 业务正文')
    expect(message).toMatch(/已.*核对|可读取/)
    expect(message).toContain('目录')
    expect(message).toMatch(/其余|其他/)
  }
  else {
    expect(state.other.readStatus).toBe(409)
    expect(state.fields['source-content'].textContent).toContain('来源已更新')
    expect(message).toContain('来源已更新')
    for (const text of [state.context.ui['page-description'].textContent, state.article.innerHTML])
      expect(text).not.toMatch(/从目录选择|左侧选择其他文档/)
  }
  expect(message).not.toContain(state.entry.path)
  expect(message).toContain('刷新')
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
})

it.each([
  { target: 'receipt.txt', status: 415, scope: false, bad: [0], reason: '修复或恢复来源' },
  { target: 'task/handbook.html', status: 413, scope: true, bad: [1, 2], reason: '收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器' },
  { target: 'task/model.json', status: 409, scope: false, bad: [1, 2], reason: '刷新内容后核对新版' },
  { target: 'other.md', status: 404, scope: false, bad: [3], reason: '修复或恢复来源' },
])('invalidates already displayed body and evidence links after a single read fails for $target', async ({ target, status, scope, bad, reason }) => {
  const state = liveReadLinksState()
  const originalChildren = state.anchors.map(anchor => [...anchor.childNodes])
  const healthyHrefs = state.anchors.map(anchor => anchor.href)
  for (const [index, anchor] of state.anchors.entries()) {
    expect(anchor.dataset.readerTarget).toBe(state.doc.links[index].target)
    anchor.href = `#unrelated-rewritten-url-${index}`
  }
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('opaque source failure'), { status, scope_limited: scope }))
  await expect(state.actions.readSource(target, '/already-versioned-url')).rejects.toThrow('opaque source failure')
  for (const [index, anchor] of state.anchors.entries()) {
    if (bad.includes(index)) {
      const replacement = anchor.replacement!
      expect(replacement).toBeDefined()
      expect(replacement.className).toBe('unavailable-link')
      expect(replacement.title).toContain(reason)
      expect(replacement.dataset.reason).toBe(replacement.title)
      expect(replacement.tabIndex).toBe(0)
      expect(replacement.childNodes).toEqual(originalChildren[index])
      expect(replacement.childNodes[1]).toBe(originalChildren[index][1])
      expect(state.documentAnchors.get(`author-${index}`)).toBe(replacement)
      expect(state.contextPanel.innerHTML).not.toContain(`data-source="${state.doc.links[index].target}"`)
    }
    else {
      expect(anchor.replacement).toBeUndefined()
      expect(anchor.href).toBe(`#unrelated-rewritten-url-${index}`)
      expect(healthyHrefs[index]).toBeTruthy()
    }
  }
  expect(state.contextPanel.innerHTML).toContain(reason)
  expect(state.contextPanel.querySelectorAll('details')[1].open).toBe(true)
  expect(state.doc.readError).toBeUndefined()
  expect(state.context.fetchResource).toHaveBeenCalledTimes(1)
  expect(state.contextPanel.reading?.doc).toBe(state.doc)
})

it.each(['other-view', 'hidden-context', 'failed-parent', 'replaced-parent'])('does not redraw an unrelated or unavailable context after a single failure: %s', async (condition) => {
  const state = liveReadLinksState()
  const before = state.contextPanel.innerHTML
  if (condition === 'other-view')
    state.context.currentView = 'tasks'
  else if (condition === 'hidden-context')
    state.contextPanel.hidden = true
  else if (condition === 'failed-parent')
    state.doc.readError = '当前父文档尚未核对'
  else
    state.context.documents.set(state.doc.path, { ...state.doc })
  state.context.fetchResource.mockRejectedValueOnce(Object.assign(new Error('opaque source failure'), { status: 404 }))
  await expect(state.actions.readSource(state.file.path, '/versioned-source')).rejects.toThrow('opaque source failure')
  expect(state.anchors[0].replacement?.title).toContain('修复或恢复来源')
  expect(state.contextPanel.innerHTML).toBe(before)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(1)
})

it.each([
  { target: 'receipt.txt', status: 404 },
  { target: 'task/model.json', status: 415 },
])('attributes a single-read catalog failure to its entry rather than the requested $target', async ({ target, status }) => {
  const state = liveReadLinksState()
  const failure = Object.assign(new Error('opaque entry failure'), { status, error_stage: 'catalog', error_source: state.entry.path })
  state.context.fetchResource.mockRejectedValueOnce(failure)
  await expect(state.actions.readSource(target, '/versioned-target')).rejects.toMatchObject({ status, error_stage: 'catalog', error_source: state.entry.path })
  expect(state.context.catalog.readNavigation).toEqual([])
  for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model]) {
    expect(metadata.readUnchecked).toBe(true)
    expect(metadata.readChanged).toBe(false)
    expect(metadata.readStatus).toBeUndefined()
    expect(metadata.readScopeLimited).toBe(false)
    expect(metadata.readError).toContain(state.entry.path)
    expect(() => state.actions.sourceUrl(metadata.path)).toThrow(state.entry.path)
  }
  for (const anchor of state.anchors) {
    expect(anchor.replacement?.title).toContain(state.entry.path)
    expect(anchor.replacement?.title).toContain('刷新')
    expect(anchor.replacement?.title).not.toContain('修复或恢复来源')
  }
  expect(state.contextPanel.hidden).toBe(true)
  expect(state.contextPanel.reading).toBeUndefined()
  expect(state.contextPanel.innerHTML).toBe('')
  expect(state.context.fetchResource).toHaveBeenCalledTimes(1)
})

it.each(['catalog', 'owner'])('ignores a late catalog-stage failure after its %s changes', async (change) => {
  const state = singleReadState()
  let reject!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => {
    reject = rejectRequest
  }))
  let current = true
  const pending = state.actions.readSource(state.file.path, '/old-source', () => current)
  if (change === 'catalog')
    state.context.catalog = { ...state.context.catalog, readNavigation: [{ path: state.entry.path, label: '新目录' }] }
  else
    current = false
  reject(Object.assign(new Error('late fatal entry'), { status: 404, error_stage: 'catalog', error_source: state.entry.path }))
  await expect(pending).resolves.toBeUndefined()
  expect(state.context.catalog.readNavigation).toHaveLength(1)
  for (const metadata of [state.entry, state.other, state.file, state.page, state.html, state.model])
    expect(metadata.readError).toBeUndefined()
  expect(state.context.refreshReadLinks).not.toHaveBeenCalled()
  expect(state.context.notice).not.toHaveBeenCalled()
})

function resolver(documentPaths: string[], sourcePaths: string[], taskPaths: string[] = [], taskErrors: Record<string, string> = {}) {
  const context = {
    URL,
    URLSearchParams,
    documents: new Map(documentPaths.map(path => [path, {}])),
    sources: new Map(sourcePaths.map(path => [path, {}])),
    taskPages: new Map(taskPaths.map(path => [path, {}])),
    catalog: { task_errors: taskErrors },
  }
  const readCode = source.slice(source.indexOf('  function sourceReadError('), source.indexOf('  function sourceUrl('))
  return runInNewContext(`${readCode}\n${taskQuery}\n${resolve}\nresolveLink`, context) as (href: string, doc: Document) => Link | null
}

it.each([
  { status: 409, detail: 'opaque comparison conflict', brokenJson: false },
  { status: 415, detail: 'HTTP 415', brokenJson: true },
])('preserves HTTP $status on a single resource failure even when its JSON error is unavailable', async ({ status, detail, brokenJson }) => {
  const fetch = vi.fn(async () => ({
    ok: false,
    status,
    json: async () => {
      if (brokenJson)
        throw new Error('intermediary returned HTML')
      return { error: detail }
    },
  }))
  const code = source.slice(source.indexOf('  async function fetchResource('), source.indexOf('  async function documentText('))
  const fetchResource = runInNewContext(`${code}\nfetchResource`, { fetch }) as (url: string) => Promise<string>
  await expect(fetchResource('/content/terms.md?sha256=old')).rejects.toMatchObject({ status, message: expect.stringContaining(detail) })
})

it.each([404, 415])('preserves explicit catalog-stage attribution on HTTP %s without moving the status to the target', async (status) => {
  const fetch = vi.fn(async () => ({ ok: false, status, json: async () => ({ error: 'opaque entry failure', error_stage: 'catalog', error_source: 'entry.md' }) }))
  const code = source.slice(source.indexOf('  async function fetchResource('), source.indexOf('  async function documentText('))
  const fetchResource = runInNewContext(`${code}\nfetchResource`, { fetch }) as (url: string) => Promise<string>
  await expect(fetchResource('/content/receipt.txt')).rejects.toMatchObject({ status, error_stage: 'catalog', error_source: 'entry.md', message: 'opaque entry failure' })
})

it.each([true, false])('preserves a structured quota flag on HTTP 413 without guessing from its error text: %s', async (limited) => {
  const fetch = vi.fn(async () => ({
    ok: false,
    status: 413,
    json: async () => ({ error: 'opaque limit token', ...(limited ? { scope_limited: true } : {}) }),
  }))
  const code = source.slice(source.indexOf('  async function fetchResource('), source.indexOf('  async function documentText('))
  const fetchResource = runInNewContext(`${code}\nfetchResource`, { fetch }) as (url: string) => Promise<string>
  let error: unknown
  try {
    await fetchResource('/single')
  }
  catch (failure) {
    error = failure
  }
  expect(error).toMatchObject({ status: 413, message: 'opaque limit token' })
  expect(Boolean((error as { scope_limited?: boolean }).scope_limited)).toBe(limited)
})

it.each([
  ['html', true],
  ['model', true],
  ['file', false],
] as const)('shows the structured recovery for a single-read %s 413 with quota=%s', async (member, limited) => {
  const state = singleReadState()
  const error = Object.assign(new Error('opaque limit token'), { status: 413 }, limited ? { scope_limited: true } : {})
  state.context.fetchResource.mockRejectedValue(error)
  await state.actions.openSource(state[member].path)
  const checked = limited ? [state.page, state.html, state.model] : [state.file]
  for (const metadata of checked) {
    expect(metadata.readStatus).toBe(413)
    expect(metadata.readScopeLimited).toBe(limited)
    expect(metadata.readUnchecked).toBe(false)
    expect(metadata.readChanged).toBe(false)
  }
  const message = state.fields['source-content'].textContent
  expect(message).toContain('opaque limit token')
  if (limited) {
    expect(message).toContain('收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
    expect(message).not.toContain('缩小内容')
  }
  else {
    expect(message).toContain('缩小内容或使用外部链接')
    expect(message).not.toContain('重新启动')
  }
  expect(state.other.readError).toBeUndefined()
})

it('shows structured recovery in the source popup after an opaque single-read 409', async () => {
  const state = singleReadState()
  state.context.fetchResource.mockRejectedValue(Object.assign(new Error('opaque conflict token'), { status: 409 }))
  await state.actions.openSource(state.file.path)
  expect(state.file.readChanged).toBe(true)
  expect(state.fields['source-content'].textContent).toContain('刷新内容后核对新版')
  expect(state.fields['source-content'].textContent).not.toContain('修复或恢复')
  expect(state.fields['source-hash'].textContent).toBe('')
  expect(state.fields['source-original'].href).toBe('')
  expect(state.fields['source-original'].hidden).toBe(true)
  expect(state.other.readError).toBeUndefined()
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
})

it('returns a current single-read success without inventing a source failure', async () => {
  const state = singleReadState()
  await expect(state.actions.readSource(state.file.path, '/single', () => true)).resolves.toBe('当前原文')
  expect(state.file.readError).toBeUndefined()
  expect(state.context.renderNavigation).not.toHaveBeenCalled()
})

it.each(['html', 'model'] as const)('propagates a single-read conflict from the %s member to the whole known pair', async (member) => {
  const state = singleReadState()
  const error = Object.assign(new Error('opaque pair conflict'), { status: 409 })
  state.context.fetchResource.mockRejectedValue(error)
  await expect(state.actions.readSource(state[member].path, '/single', () => true)).rejects.toBe(error)
  for (const metadata of [state.page, state.html, state.model]) {
    expect(metadata.readChanged).toBe(true)
    expect(metadata.readUnchecked).toBe(false)
    expect(metadata.readStatus).toBe(409)
    expect(metadata.readError).toBe(error.message)
  }
  expect(() => state.actions.sourceUrl(state.html.path)).toThrow('刷新内容后核对新版')
  expect(() => state.actions.sourceUrl(state.model.path)).toThrow('刷新内容后核对新版')
  expect(state.entry.readError).toBeUndefined()
  expect(state.other.readError).toBeUndefined()
  expect(state.context.catalog.readNavigation).toHaveLength(1)
})

it('marks a single-read transport failure without HTTP status as unchecked rather than a broken file', async () => {
  const state = singleReadState()
  state.context.fetchResource.mockRejectedValue(new TypeError('network unavailable'))
  await expect(state.actions.readSource(state.file.path, '/single', () => true)).rejects.toThrow('network unavailable')
  expect(state.file.readUnchecked).toBe(true)
  expect(state.file.readChanged).toBe(false)
  expect(state.file.readStatus).toBeUndefined()
  let reason = ''
  try {
    state.actions.sourceUrl(state.file.path)
  }
  catch (error) {
    reason = (error as Error).message
  }
  expect(reason).toContain('刷新内容')
  expect(reason).not.toContain('修复或恢复')
})

it.each([
  ['catalog', 'success'],
  ['catalog', 'error'],
  ['batch', 'success'],
  ['batch', 'error'],
  ['owner', 'success'],
  ['owner', 'error'],
] as const)('keeps %s ownership isolated from a late single-read %s', async (binding, outcome) => {
  const state = singleReadState()
  let finish!: (text: string) => void
  let reject!: (error: Error) => void
  const pending = new Promise<string>((resolve, fail) => {
    finish = resolve
    reject = fail
  })
  state.context.fetchResource.mockReturnValue(pending)
  let active = true
  const reading = state.actions.readSource(state.file.path, '/single', () => active)
  if (binding === 'catalog') {
    state.context.catalog = { ...state.context.catalog }
  }
  else if (binding === 'batch') {
    const order = ((state.context.catalog as { readVersion?: number }).readVersion || 0) + 1
    Object.assign(state.context.catalog, { readVersion: order, readResultVersion: order, readDirectoryVersion: order })
    state.actions.applyReadCheck(state.file, { error: '', changed: false, unchecked: false }, order)
  }
  else {
    active = false
  }
  const expected = { ...state.file }
  if (outcome === 'success')
    finish('迟到旧正文')
  else
    reject(Object.assign(new Error('迟到旧错误'), { status: 404 }))
  await expect(reading).resolves.toBeUndefined()
  expect(state.file).toEqual(expected)
  expect(state.context.catalog.readNavigation).toHaveLength(1)
  expect(state.context.renderNavigation).not.toHaveBeenCalled()
})

it.each(['success', 'error'])('shows current popup diagnostics when a newer batch supersedes a single-read %s', async (outcome) => {
  const state = singleReadState()
  let finish!: (text: string) => void
  let reject!: (error: Error) => void
  state.context.fetchResource.mockReturnValue(new Promise<string>((resolve, fail) => {
    finish = resolve
    reject = fail
  }))
  const reading = state.actions.openSource(state.file.path)
  const order = ((state.context.catalog as { readVersion?: number }).readVersion || 0) + 1
  Object.assign(state.context.catalog, { readVersion: order, readResultVersion: order, readDirectoryVersion: order })
  state.actions.applyReadCheck(state.file, { error: 'newer opaque conflict', changed: true, status: 409 }, order)
  if (outcome === 'success')
    finish('迟到旧正文')
  else
    reject(Object.assign(new Error('迟到旧错误'), { status: 404 }))
  await reading
  expect(state.dialog.open).toBe(true)
  expect(state.file.readChanged).toBe(true)
  expect(state.file.readStatus).toBe(409)
  expect(state.fields['source-content'].textContent).toMatch(/核对新版|重新打开/)
  expect(state.fields['source-content'].textContent).not.toMatch(/迟到旧正文|迟到旧错误|undefined/)
  expect(state.fields['source-hash'].textContent).toBe('')
  expect(state.fields['source-original'].href).toBe('')
  expect(state.fields['source-original'].hidden).toBe(true)
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
})

it('ignores a single-read rejection when a healthy batch wins before the outer popup catch', async () => {
  const state = singleReadState()
  state.context.currentPath = state.page.path
  state.context.routeInfo = () => ({ path: state.page.path, view: 'page', query: '', taskQuery: '', phase: 'all' })
  state.context.fetchResource.mockRejectedValue(Object.assign(new Error('superseded conflict'), { status: 409 }))
  let checked = false
  state.context.renderNavigation.mockImplementationOnce(() => {
    queueMicrotask(() => {
      const order = ((state.context.catalog as { readVersion?: number }).readVersion || 0) + 1
      Object.assign(state.context.catalog, { readVersion: order, readResultVersion: order, readDirectoryVersion: order })
      for (const metadata of [state.page, state.html, state.model])
        state.actions.applyReadCheck(metadata, { error: '', unchecked: false, changed: false }, order)
      checked = true
    })
  })
  await state.actions.openSource(state.model.path)
  expect(checked).toBe(true)
  expect(state.context.renderNavigation).toHaveBeenCalledTimes(1)
  expect(state.page.readError).toBe('')
  expect(state.model.readError).toBe('')
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
  expect(state.fields['source-content'].textContent).toContain('重新打开')
  expect(state.fields['source-content'].textContent).not.toContain('superseded conflict')
  expect(state.fields['source-hash'].textContent).toBe('')
  expect(state.fields['source-original'].hidden).toBe(true)
})

it('does not show an obsolete page failure after matching metadata wins between the helper rejection and route catch', async () => {
  const state = sourceNavigationState()
  const context = {
    ...state.context,
    refreshReadLinks: vi.fn(),
    fetchResource: vi.fn(async () => {
      throw Object.assign(new Error('obsolete page conflict'), { status: 409 })
    }),
  }
  const metadata = context.documents.get(state.info.path)! as SingleMetadata
  const documentCode = source.slice(source.indexOf('  async function documentText('), source.indexOf('  async function documentRecords('))
  const pageCode = source.slice(source.indexOf('  async function renderPage('), source.indexOf('  async function renderRoute('))
  const routeCode = source.slice(source.indexOf('  async function renderRoute('), source.indexOf('  function showReadFailure('))
  const actions = runInNewContext(`${sourceAccess}\n${documentCode}\n${pageCode}\n${routeCode}\n({renderRoute,applyReadCheck})`, context) as {
    renderRoute: () => Promise<void>
    applyReadCheck: (metadata: unknown, check: { error: string, changed: boolean, unchecked: boolean }, resultVersion?: number) => void
  }
  let checked = false
  context.renderNavigation.mockImplementation(() => {
    if (metadata.readChanged) {
      queueMicrotask(() => {
        const order = ((context.catalog as { readVersion?: number }).readVersion || 0) + 1
        Object.assign(context.catalog, { readVersion: order, readResultVersion: order, readDirectoryVersion: order })
        actions.applyReadCheck(metadata, { error: '', changed: false, unchecked: false }, order)
        checked = true
      })
    }
  })
  await actions.renderRoute()
  expect(checked).toBe(true)
  expect(context.renderNavigation).toHaveBeenCalledTimes(2)
  expect(metadata.readError).toBe('')
  expect(context.showReadFailure).not.toHaveBeenCalled()
})

it('does not restore old popup bytes or success links when a matching batch wins after readSource returns', async () => {
  const state = singleReadState()
  const readSource = state.actions.readSource
  let returned: string | undefined
  Object.assign(state.context, {
    readSource: async (path: string, url: string, isCurrent: () => boolean, owner?: { current: () => boolean }) => {
      returned = await readSource(path, url, isCurrent, owner)
      const order = ((state.context.catalog as { readVersion?: number }).readVersion || 0) + 1
      Object.assign(state.context.catalog, { readVersion: order, readResultVersion: order, readDirectoryVersion: order })
      state.actions.applyReadCheck(state.file, { error: '', changed: false, unchecked: false }, order)
      return returned
    },
  })
  await state.actions.openSource(state.file.path)
  expect(returned).toBe('当前原文')
  expect(state.file.readError).toBe('')
  expect(state.fields['source-content'].textContent).toContain('重新打开')
  expect(state.fields['source-content'].textContent).not.toContain('当前原文')
  expect(state.fields['source-hash'].textContent).toBe('')
  expect(state.fields['source-original'].href).toBe('')
  expect(state.fields['source-original'].hidden).toBe(true)
  expect(state.context.showReadFailure).not.toHaveBeenCalled()
})

it('keeps navigation destinations free of the current phase without changing other route links', () => {
  const context = {
    URLSearchParams,
    taskPages: new Map(),
    catalog: {},
    currentPath: 'rules.md',
    currentView: 'page',
    currentPhase: 'proposed',
    cleanTitle: (value: string) => value,
    escape: (value: string) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
  }
  const route = source.slice(source.indexOf('  function routeUrl('), source.indexOf('  function routeInfo('))
  const code = source.slice(source.indexOf('  function navLink('), source.indexOf('  function hideNavTooltip('))
  const navLink = runInNewContext(`${linkAttributes}\n${taskQuery}\n${route}\n${code}\nnavLink`, context) as (doc: { path: string, title: string }, className: string, label: string, section: string, query?: string) => string
  function destination(html: string) {
    const href = html.match(/href="([^"]+)"/)![1].replaceAll('&amp;', '&')
    return new URLSearchParams(href.slice(1))
  }
  for (const path of ['rules.md', '第#1%批/任务?资料.md']) {
    context.currentPath = path
    const doc = { path, title: '七日规则' }
    const section = '现状-七日退货&节点/一'
    const query = 'view=detail&q=甲%26乙&features=copy,edit'
    const navigation = destination(navLink(doc, 'nav-link', doc.title, section, query))
    expect(navigation.has('phase')).toBe(false)
    expect(navigation.get('page')).toBe(path)
    expect(navigation.get('section')).toBe(section)
    expect(navigation.get('task_query')).toBe('features=copy%2Cedit&q=%E7%94%B2%26%E4%B9%99&view=detail')
    expect(destination(navLink(doc, 'toc-link', doc.title, section, query)).get('phase')).toBe('proposed')
  }
})

it('preserves author phase labels in navigation, title tooltips and related cards', () => {
  const records = [
    { path: 'current.md', title: '[现状] 退款期限' },
    { path: 'proposal.md', title: '[拟议变更] 退款期限' },
  ]
  const context = {
    taskPages: new Map(),
    catalog: {},
    URLSearchParams,
    currentPath: '',
    currentView: 'page',
    escape: (value: string) => value,
    routeUrl: (path: string) => `#page=${path}`,
    related: () => records,
  }
  const navCode = source.slice(source.indexOf('  function navLink('), source.indexOf('  function hideNavTooltip('))
  const relatedCode = source.slice(source.indexOf('  function cardRelated('), source.indexOf('  async function renderTasks('))
  const { navLink, cardRelated } = runInNewContext(`${linkAttributes}\n${navCode}\n${relatedCode}\n({navLink,cardRelated})`, context) as {
    navLink: (doc: typeof records[number], className: string) => string
    cardRelated: (doc: unknown, label: string, kind: string) => string
  }
  for (const record of records) {
    expect(navLink(record, 'nav-link')).toContain(`>${record.title}</a>`)
    expect(navLink(record, 'source-link')).toContain(`title="${record.title}"`)
    expect(cardRelated({}, '依据', 'document')).toContain(record.title)
  }
})

it.each([
  ['markdown', 'label'],
  ['markdown', 'fragment'],
  ['markdown', 'query'],
  ['task', 'label'],
  ['task', 'fragment'],
  ['task', 'query'],
] as const)('filters only withdrawn %s navigation declarations when their %s changes, without mutating source state', (kind, field) => {
  const markdown = { path: 'terms.md', title: '业务条款', kind: 'document', readError: undefined as string | undefined }
  const task = { path: 'task/handbook.html', title: '签收任务', model_path: 'task/model.json', readError: undefined as string | undefined }
  const hub = { path: 'hub.md', title: '业务枢纽', kind: 'document', readError: undefined as string | undefined }
  const mdFast = { path: markdown.path, label: '业务快捷入口', fragment: 'accepted', query: '' }
  const taskFast = { path: task.path, label: '任务快捷入口', fragment: 'node=accepted', query: 'view=detail' }
  const focused = kind === 'markdown' ? mdFast : taskFast
  const initial = [mdFast, taskFast, { path: hub.path, label: hub.title, fragment: '', query: '' }, { path: focused.path, label: '同页通用入口', fragment: '', query: '' }]
  const captured = initial.map(link => ({ ...link }))
  const catalog: { entry: string, navigation: typeof initial, readNavigation?: typeof initial } = { entry: hub.path, navigation: initial }
  const menu = { hidden: false }
  const control = () => ({ href: '', closest: () => menu, toggleAttribute: vi.fn(), setAttribute: vi.fn() })
  const ui = {
    'navigation': { innerHTML: '', classList: { toggle: vi.fn() } },
    'business-count': { textContent: '' },
    'task-count': { textContent: '' },
    'business-view': control(),
    'task-view': control(),
    'home-link': control(),
    'sidebar': { setAttribute: vi.fn() },
  }
  const context = {
    ui,
    catalog,
    documents: new Map([[markdown.path, markdown], [hub.path, hub]]),
    taskPages: new Map([[task.path, task]]),
    currentPath: hub.path,
    currentView: 'page',
    URLSearchParams,
    routeInfo: () => ({ view: 'page' }),
    routeUrl: (path: string, fragment = '', query = '') => `#${new URLSearchParams({ page: path, section: fragment, task_query: query })}`,
    escape: (value: unknown) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
    unavailableReason: (link: { error: string }) => link.error,
    dismissNavTooltip: vi.fn(),
    updateNavigationSelection: vi.fn(),
  }
  const navCode = source.slice(source.indexOf('  function navLink('), source.indexOf('  function hideNavTooltip('))
  const renderCode = source.slice(source.indexOf('  function renderNavigation('), source.indexOf('  function updateNavigationSelection('))
  const render = runInNewContext(`${linkAttributes}\n${navCode}\n${renderCode}\nrenderNavigation`, context) as () => void
  const labels = () => [...ui.navigation.innerHTML.matchAll(/<a\b[^>]*>([^<]*)<\/a>/g)].map(match => match[1])
  render()
  expect(labels()).toEqual(initial.map(link => link.label))
  const replacement = { label: '修改后的快捷入口', fragment: 'node=expired', query: 'view=overview' }
  context.catalog.readNavigation = initial.map(link => link === focused ? { ...link, [field]: replacement[field] } : { ...link })
  render()
  expect(labels()).toEqual(initial.filter(link => link !== focused).map(link => link.label))
  expect(String(ui['business-count'].textContent)).toBe('3')
  expect(context.catalog.navigation).toBe(initial)
  expect(context.catalog.navigation).toEqual(captured)
  expect(markdown.readError).toBeUndefined()
  expect(task.readError).toBeUndefined()
  context.catalog.readNavigation = captured.map(link => ({ ...link }))
  render()
  expect(labels()).toEqual(initial.map(link => link.label))
  const target = kind === 'markdown' ? markdown : task
  target.readError = '已确认目标暂时不可读取'
  context.catalog.readNavigation = initial.map(link => ({ ...link, exists: link.path !== target.path, error: target.readError }))
  render()
  expect(ui.navigation.innerHTML).toContain(`>${focused.label}</span>`)
  expect(ui.navigation.innerHTML).toContain('>同页通用入口</span>')
  expect(String(ui['business-count'].textContent)).toBe('4')
  expect(ui.navigation.innerHTML).toContain('unavailable-link')
  if (kind === 'markdown')
    context.documents.delete(markdown.path)
  else
    context.taskPages.delete(task.path)
  render()
  expect(ui.navigation.innerHTML).not.toContain(focused.label)
  expect(ui.navigation.innerHTML).not.toContain('同页通用入口')
  expect(String(ui['business-count'].textContent)).toBe('2')
  if (kind === 'markdown')
    context.documents.set(markdown.path, markdown)
  else
    context.taskPages.set(task.path, task)
  target.readError = undefined
  context.catalog.readNavigation = []
  render()
  expect(labels()).toEqual([])
  context.catalog = { entry: hub.path, navigation: captured.map(link => ({ ...link })) }
  render()
  expect(labels()).toEqual(initial.map(link => link.label))
  expect(markdown.readError).toBeUndefined()
  expect(task.readError).toBeUndefined()
})

it.each([
  { kind: 'document', target: 'terms.md', status: 404, limited: false },
  { kind: 'document', target: 'overflow.md', status: 413, limited: true },
  { kind: 'task-page', target: 'task/handbook.html', status: 404, limited: false },
  { kind: 'task-page', target: 'quota/handbook.html', status: 413, limited: true },
])('keeps explicitly declared cold $kind navigation failures local to their disabled presentation', ({ kind, target, status, limited }) => {
  const error = `opaque ${target} failure`
  const first = { path: target, label: '验收业务入口', fragment: 'accepted', query: 'view=detail' }
  const second = { path: target, label: '例外业务入口', fragment: 'expired', query: 'view=overview' }
  const hub = { path: 'hub.md', sha256: 'hub-v1', kind: 'document', title: '业务枢纽' }
  const initial = [
    first,
    second,
    { path: hub.path, label: hub.title, fragment: '', query: '' },
    { path: 'receipt.csv', label: '普通附件不作目录', fragment: '', query: '' },
    { path: 'https://example.invalid/manual', label: '外链不作目录', fragment: '', query: '' },
    { path: 'unknown.md', label: '未知来源不作目录', fragment: '', query: '' },
  ]
  const catalog = {
    entry: hub.path,
    navigation: initial,
    readNavigation: initial.map(link => ({ ...link })),
    document_errors: kind === 'document' ? { [target]: { error, status, scope_limited: limited } } : {},
    task_errors: kind === 'task-page' ? { [target]: error } : {},
    task_error_statuses: kind === 'task-page' ? { [target]: status } : {},
    task_scope_limited: kind === 'task-page' && limited ? [target] : [],
  }
  const control = () => ({ href: '', closest: () => ({ hidden: false }), toggleAttribute: vi.fn(), setAttribute: vi.fn() })
  const ui = {
    'navigation': { innerHTML: '', classList: { toggle: vi.fn() } },
    'business-count': { textContent: '' },
    'task-count': { textContent: '' },
    'business-view': control(),
    'task-view': control(),
    'home-link': control(),
    'sidebar': { setAttribute: vi.fn() },
  }
  const context = {
    ui,
    catalog,
    documents: new Map<string, SingleMetadata & { title?: string, kind?: string }>([[hub.path, hub]]),
    taskPages: new Map<string, SingleMetadata>(),
    sources: new Map([['receipt.csv', { path: 'receipt.csv', sha256: 'file-v1', readError: 'ordinary source error' }]]),
    currentPath: hub.path,
    currentView: 'page',
    URLSearchParams,
    routeInfo: () => ({ view: 'page' }),
    routeUrl: (path: string, fragment = '', query = '') => `#${new URLSearchParams({ page: path, section: fragment, task_query: query })}`,
    escape: (value: unknown) => String(value),
    dismissNavTooltip: vi.fn(),
    updateNavigationSelection: vi.fn(),
  }
  const navCode = source.slice(source.indexOf('  function navLink('), source.indexOf('  function hideNavTooltip('))
  const renderCode = source.slice(source.indexOf('  function renderNavigation('), source.indexOf('  function updateNavigationSelection('))
  const reasonCode = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks('))
  const sourceReadCode = source.slice(source.indexOf('  function sourceReadError('), source.indexOf('  function sourceUrl('))
  const render = runInNewContext(`${sourceReadCode}\n${reasonCode}\n${navCode}\n${renderCode}\nrenderNavigation`, context) as () => void
  render()
  const cold = ui.navigation.innerHTML
  expect(cold).toContain('>验收业务入口</span>')
  expect(cold).toContain('>例外业务入口</span>')
  expect(cold).toContain('unavailable-link')
  expect(cold).toContain(error)
  expect(cold).toContain(limited ? '收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器' : '刷新内容')
  expect(cold).not.toContain('普通附件不作目录')
  expect(cold).not.toContain('外链不作目录')
  expect(cold).not.toContain('未知来源不作目录')
  expect(context.documents.size).toBe(1)
  expect(context.taskPages.size).toBe(0)
  expect(context.sources.size).toBe(1)
  expect(catalog.navigation).toBe(initial)
  const metadata = { path: target, sha256: 'old-v1', readError: error, readStatus: status, readScopeLimited: limited }
  if (kind === 'document')
    context.documents.set(target, metadata)
  else
    context.taskPages.set(target, metadata)
  render()
  expect(ui.navigation.innerHTML).toBe(cold)
  context.documents.delete(target)
  context.taskPages.delete(target)
  const currentError = `CURRENT-UTF8-CHECK ${target}`
  Object.assign(catalog, { readChecks: new Map([[target, { error: currentError, status: 415 }]]) })
  render()
  expect(ui.navigation.innerHTML).toContain(currentError)
  expect(ui.navigation.innerHTML).not.toContain(error)
  expect(ui.navigation.innerHTML).not.toContain('重新启动阅读器')
  Object.assign(catalog, { readChecks: new Map([[target, { error: `本批已读到 ${target}，请刷新内容后核对新版。`, unchecked: true }]]) })
  render()
  expect(ui.navigation.innerHTML).toContain('本批已读到')
  expect(ui.navigation.innerHTML).toContain('刷新内容')
  expect(ui.navigation.innerHTML).not.toContain(error)
  expect(ui.navigation.innerHTML).not.toContain('修复或恢复')
  catalog.readNavigation = initial.filter(link => link !== first).map(link => ({ ...link }))
  render()
  expect(ui.navigation.innerHTML).not.toContain('验收业务入口')
  expect(ui.navigation.innerHTML).toContain('>例外业务入口</span>')
  catalog.readNavigation = initial.filter(link => link.path !== target).map(link => ({ ...link }))
  render()
  expect(ui.navigation.innerHTML).not.toContain('例外业务入口')
  expect(context.documents.size).toBe(1)
  expect(context.taskPages.size).toBe(0)
})

it('keeps author phase labels in the search index and document header', async () => {
  const records = [
    { path: 'current.md', title: '[现状] 退款期限', sha256: 'r1', kind: 'document' },
    { path: 'proposal.md', title: '[拟议变更] 退款期限', sha256: 'r2', kind: 'document' },
  ]
  let indexed: { title: string }[] = []
  let header = ''
  let currentDocument = records[0].path
  const context = {
    ui: { 'phase-filter': { innerHTML: '' }, 'context': { hidden: false }, 'article': { innerHTML: '', dataset: {} } },
    documents: new Map(records.map(doc => [doc.path, doc])),
    taskPages: new Map(),
    catalog: { entry: 'index.md' },
    renderVersion: 1,
    readPageVersion: 0,
    readPageKey: undefined,
    routeInfo: () => ({ path: currentDocument }),
    searchTexts: new Map(),
    notice: () => {},
    setHeader: ({ title }: { title: string }) => { header = title },
    documentRecords: async () => ({ records: records.map(doc => ({ doc, raw: '正文' })), taskPages: [], addedPaths: [], warnings: [] }),
    updateReadChecks: vi.fn(),
    renderReadNotice: vi.fn(),
    sourceReadError: () => undefined,
    documentText: async () => '正文',
    visibleText: (raw: string) => raw,
    markdownSections: () => { throw new Error('stop after document title') },
    window: {
      scrollTo: () => {},
      RequirementSearch: {
        search: (items: { title: string }[]) => {
          indexed = items
          return []
        },
      },
    },
  }
  const searchCode = source.slice(source.indexOf('  async function renderSearch('), source.indexOf('  function headingFor('))
  const pageCode = source.slice(source.indexOf('  async function renderPage('), source.indexOf('  async function renderRoute('))
  const { renderSearch, renderPage } = runInNewContext(`${pageScope}\n${linkHelpers}\n${searchCode}\n${pageCode}\n({renderSearch,renderPage})`, context) as {
    renderSearch: (query: string, version: number) => Promise<void>
    renderPage: (info: { path: string }, version: number) => Promise<void>
  }
  await renderSearch('退款', 1)
  expect(indexed.map(item => item.title)).toEqual(records.map(item => item.title))
  for (const record of records) {
    currentDocument = record.path
    await expect(renderPage({ path: record.path }, 1)).rejects.toThrow('stop after document title')
    expect(header).toBe(record.title)
  }
})

it.each(['第#1批', '第%批', '第?批'])('resolves sources and same-page anchors from the literal project directory %s', (directory) => {
  const path = `${directory}/说明.md`
  const local = `${directory}/时限.txt`
  const doc = { path, links: [{ kind: 'source', target: local, fragment: '', exists: true }] }
  for (const sourcePaths of [[local], ['时限.txt', local]]) {
    const resolveLink = resolver([path], sourcePaths)
    expect(resolveLink('时限.txt', doc)).toEqual(doc.links[0])
    expect(resolveLink('#退款', doc)).toEqual({ kind: 'document', target: path, fragment: '退款', exists: true })
  }
})

it('preserves encoded destination paths, task view queries and node fragments', () => {
  const path = '第#1批/说明.md'
  const target = '第#1批/task/handbook.html'
  const link = { kind: 'task-page', target, fragment: 'node=%E9%80%80%E6%AC%BE', query: 'q=%E7%94%B2&view=detail', exists: true }
  const resolveLink = resolver([path], [], [target])
  expect(resolveLink('task/handbook.html?view=detail&notices=1&q=甲#node=退款', { path, links: [link] })).toEqual(link)
  expect(resolveLink('../第%231批/%E8%AF%B4%E6%98%8E.md#退款', { path })).toEqual({ kind: 'document', target: path, fragment: '退款', exists: true })
})

it.each([
  ['.%2Fguide.md', 'docs/business/guide.md', 'document'],
  ['..%2Ftax5%25.json', 'docs/tax5%.json', 'source'],
  ['section%2F..%2Fguide.md', 'docs/business/guide.md', 'document'],
  ['literal%252Fguide.md', 'docs/business/literal%2Fguide.md', 'document'],
  ['\t.%2Fguide.md\n', 'docs/business/guide.md', 'document'],
])('normalizes path segments after one decode for %s', (href, target, kind) => {
  const path = 'docs/business/index.md'
  const link = { kind, target, fragment: '', exists: true }
  const resolveLink = resolver(kind === 'document' ? [target] : [], kind === 'source' ? [target] : [])
  expect(resolveLink(href, { path, links: [link] })).toEqual(link)
})

it.each(['..%2F..%2F..%2Fguide.md', '../../../guide.md', '%2Fguide.md', '..%5Cguide.md'])('rejects decoded paths outside the project for %s', (href) => {
  const resolveLink = resolver(['guide.md'], [])
  expect(resolveLink(href, { path: 'docs/business/index.md' })).toBeNull()
})

it.each(['%', '%25'])('resolves literal percent paths and ordinary fragments written as %s without losing source errors', (percent) => {
  const path = 'docs/business/index.md'
  const tax = { kind: 'source', target: 'manual/tax5%.json', fragment: '', exists: true }
  const handbook = { kind: 'source', target: 'manual/handbook.html', fragment: '折扣50%', exists: true }
  const resolveLink = resolver([path], [tax.target, handbook.target])
  for (const exists of [true, false]) {
    const links = [tax, handbook].map(link => exists ? link : { ...link, exists, error: `来源不是 UTF-8 文本：${link.target}`, status: 415 })
    const doc = { path, links }
    expect(resolveLink(`../../manual/tax5${percent}.json`, doc)).toEqual(links[0])
    expect(resolveLink(`../../manual/handbook.html#折扣50${percent}`, doc)).toEqual(links[1])
  }
})

it('decodes local URL components once with forgiving percent and UTF-8 handling while preserving form delimiters', () => {
  for (const [encoded, decoded] of [
    ['%2', '%2'],
    ['%FF', '�'],
    ['%EF%BB%BF', '\uFEFF'],
    ['+&=', '+&='],
    ['%2B%26%3D', '+&='],
    ['%252F', '%2F'],
    ['%2F', '/'],
  ]) {
    const link = { kind: 'source', target: `manual/tax${decoded}.json`, fragment: `折扣${decoded}`, exists: true }
    const resolveLink = resolver([], [link.target])
    expect(resolveLink(`manual/tax${encoded}.json#折扣${encoded}`, { path: 'index.md', links: [link] })).toEqual(link)
  }
})

it('retains encoded task separators and literal percent fragments for healthy and failed task pages', () => {
  const target = 'task/handbook.html'
  const fragment = 'node=refund%26branch%2F50%'
  for (const exists of [true, false]) {
    const link = { kind: 'task-page', target, fragment, query: 'view=detail', exists }
    const errors: Record<string, string> = exists ? {} : { [target]: '来源不存在或不是文件：task/model.json' }
    const resolveLink = resolver([], [], exists ? [target] : [], errors)
    expect(resolveLink(`${target}?view=detail#${fragment}`, { path: 'index.md', links: [link] })).toEqual(link)
  }
})

it('keeps a failed task destination and encoded node distinct from an ordinary HTML source', () => {
  const path = 'task/handbook.html'
  const modelPath = 'task/model.json'
  const link = { kind: 'task-page', target: path, fragment: 'node=%E9%80%80%E6%AC%BE', query: 'q=%E7%94%B2&view=detail', exists: false }
  const error = '来源不存在或不是文件：task/handbook.html'
  const resolveLink = resolver([], ['reference/handbook.html', 'data/model.json', modelPath], [], { [path]: error, [modelPath]: error })
  for (const fragment of ['node=退款', 'node=%E9%80%80%E6%AC%BE'])
    expect(resolveLink(`${path}?view=detail&q=甲#${fragment}`, { path: 'index.md', links: [link] })).toEqual(link)
  expect(resolveLink('reference/handbook.html', { path: 'index.md' })).toEqual({ kind: 'source', target: 'reference/handbook.html', fragment: '', exists: true })
  expect(resolveLink('data/model.json', { path: 'index.md' })).toEqual({ kind: 'source', target: 'data/model.json', fragment: '', exists: true })
  const model = { target: modelPath, kind: 'source', fragment: '', exists: true }
  expect(resolveLink(modelPath, { path: 'index.md', links: [model] })).toEqual({ ...model, exists: false })
})

it('rejects both known faulty pair URLs while preserving healthy pairs and ordinary JSON revisions', () => {
  const error = '来源不存在或不是文件：task/handbook.html'
  const context = {
    catalog: { task_errors: { 'task/handbook.html': error, 'task/model.json': error } },
    documents: new Map(),
    sources: new Map([['data/model.json', { sha256: 'ordinary' }], ['task/model.json', { sha256: 'residual' }]]),
    taskPages: new Map([['healthy/handbook.html', { sha256: 'html', model_sha256: 'model', model_path: 'healthy/model.json' }]]),
  }
  const sourceUrl = runInNewContext(`${sourceAccess}\nsourceUrl`, context) as (path: string) => string
  for (const path of ['task/handbook.html', 'task/model.json'])
    expect(() => sourceUrl(path)).toThrow(error)
  expect(sourceUrl('healthy/model.json')).toBe('/task-page/html/model/healthy/model.json')
  expect(sourceUrl('data/model.json')).toBe('/content/data/model.json?sha256=ordinary')
})

it.each(['model-only', 'model-first', 'page-first', 'duplicate-page', 'query-variants'])('preserves each confirmed task destination for %s references without changing its model source URL', (order) => {
  const page = { path: 'task/handbook.html', model_path: 'task/model.json', title: '签收任务', sha256: 'html', model_sha256: 'model' }
  const modelLink = { kind: 'source', target: page.model_path, fragment: 'model-proof', exists: true }
  const pageLink = { kind: 'task-page', target: page.path, fragment: 'node=accepted', query: 'q=%E7%94%B2&view=detail', exists: true, label: '已受理' }
  const expiredPage = { ...pageLink, fragment: 'node=expired', label: '已过期' }
  const alternateQuery = { ...pageLink, query: 'features=copy&q=%E4%B9%99&view=overview', label: '另一方案' }
  const plainPage = { ...pageLink, fragment: '', query: '', label: '任务总览' }
  const orders: Record<string, Link[]> = {
    'model-only': [modelLink],
    'model-first': [modelLink, pageLink, expiredPage, pageLink],
    'page-first': [pageLink, expiredPage, pageLink, modelLink],
    'duplicate-page': [modelLink, plainPage, pageLink, modelLink, plainPage],
    'query-variants': [modelLink, pageLink, alternateQuery, pageLink, modelLink],
  }
  const destinations: Record<string, { fragment: string, query?: string, label?: string }[]> = {
    'model-only': [{ fragment: '', query: '' }],
    'model-first': [pageLink, expiredPage],
    'page-first': [pageLink, expiredPage],
    'duplicate-page': [plainPage, pageLink],
    'query-variants': [pageLink, alternateQuery],
  }
  const context = {
    catalog: {},
    documents: new Map(),
    sources: new Map([[page.model_path, { sha256: 'model' }]]),
    taskPages: new Map([[page.path, page]]),
    navLink: vi.fn((target: typeof page, _class: string, _label: unknown, fragment: string, query: string) => `${target.path}?${query}#${fragment}`),
  }
  const code = source.slice(source.indexOf('  function originalTaskLinks('), source.indexOf('  function renderNavigation('))
  const actions = runInNewContext(`${sourceAccess}\n${code}\n({originalTaskLinks,originalTaskRelated,sourceUrl})`, context) as {
    originalTaskLinks: (doc: Document) => (typeof page & { linkFragment: string, linkQuery: string, linkLabel: string })[]
    originalTaskRelated: (doc: Document) => string
    sourceUrl: (path: string) => string
  }
  const doc = { path: 'business.md', links: orders[order] }
  const related = actions.originalTaskLinks(doc)
  expect(related).toEqual(destinations[order].map(link => ({ ...page, linkFragment: link.fragment, linkQuery: link.query, linkLabel: link.label || page.title })))
  expect(actions.originalTaskRelated(doc)).toContain(page.path)
  expect(context.navLink).toHaveBeenCalledTimes(related.length)
  for (const [index, target] of related.entries())
    expect(context.navLink).toHaveBeenNthCalledWith(index + 1, target, '', target.linkLabel, target.linkFragment, target.linkQuery, doc.path)
  expect(actions.sourceUrl(page.model_path)).toBe('/task-page/html/model/task/model.json')
})

it('does not associate ordinary same-named JSON, other pair files or a failed task', () => {
  const page = { path: 'task/handbook.html', model_path: 'task/model.json', sha256: 'html', model_sha256: 'model' }
  const broken = { ...page, path: 'broken/handbook.html', model_path: 'broken/model.json' }
  const links = ['ordinary/model.json', 'task/terms.json', broken.model_path].map(target => ({ kind: 'source', target, fragment: '', exists: true }))
  links.push({ kind: 'source', target: page.model_path, fragment: '', exists: false })
  const context = {
    catalog: { task_errors: { [broken.model_path]: '任务模型已损坏' } },
    documents: new Map(),
    sources: new Map(links.map(link => [link.target, { sha256: 'ordinary' }])),
    taskPages: new Map([[page.path, page], [broken.path, broken]]),
  }
  const code = source.slice(source.indexOf('  function originalTaskLinks('), source.indexOf('  function originalTaskRelated('))
  const actions = runInNewContext(`${sourceAccess}\n${code}\n({originalTaskLinks,sourceUrl})`, context) as { originalTaskLinks: (doc: Document) => unknown[], sourceUrl: (path: string) => string }
  expect(actions.originalTaskLinks({ path: 'business.md', links })).toEqual([])
  expect(actions.sourceUrl('ordinary/model.json')).toBe('/content/ordinary/model.json?sha256=ordinary')
  expect(actions.sourceUrl('task/terms.json')).toBe('/content/task/terms.json?sha256=ordinary')
})

it('resolves an exact heading id before an earlier alias, with aliases retained as fallback', () => {
  const earlier = { dataset: { anchor: '现状-退款时限', alias: '退款时限' } }
  const exact = { dataset: { anchor: '退款时限', alias: '退款时限' } }
  const headings = [earlier, exact]
  const code = source.slice(source.indexOf('  function headingFor('), source.indexOf('  async function renderPage('))
  const authorAnchor = { dataset: {} }
  const context = { ui: { article: { querySelectorAll: () => headings } }, documentAnchors: new Map([['policy-r17', authorAnchor]]) }
  const headingFor = runInNewContext(`${code}\nheadingFor`, context) as (section: string) => typeof earlier | undefined
  expect(headingFor('退款时限')).toBe(exact)
  expect(headingFor('现状-退款时限')).toBe(earlier)
  expect(headingFor('不存在的章节')).toBeUndefined()
  expect(headingFor('policy-r17')).toBe(authorAnchor)
  headings.pop()
  expect(headingFor('退款时限')).toBe(earlier)
})

it('keeps first-H1 anchors stable and heading ids collision-free', () => {
  function renderFirst(unavailable: boolean) {
    const toc: { id: string }[] = []
    const context = {
      firstHeading: true,
      ids: new Map(),
      usedIds: new Set(),
      anchors: new Map(),
      ui: { 'page-title': { tagName: 'H1' } },
      toc,
      doc: { path: 'guide.md' },
      phaseMarker: /^\[(现状|拟议变更|实测结果)\]\s*/u,
      phaseKeys: {},
      phases: {},
      cleanTitle: (value: string) => value,
      visibleNodeText: () => 'Store Approval',
      slug: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
      routeUrl: () => '#guide',
      NodeFilter: { SHOW_TEXT: 4 },
      document: {
        createTreeWalker: () => ({ nextNode: () => false }),
        createElement: () => ({ setAttribute: () => {} }),
      },
    }
    const code = source.slice(source.indexOf('    function heading('), source.indexOf('    function split('))
    const heading = runInNewContext(`${code}\nheading`, context) as (node: unknown, stack: unknown[]) => unknown
    const node = (tagName: string) => ({
      tagName,
      textContent: 'StoreApproval',
      dataset: {} as Record<string, string>,
      id: '',
      closest: () => null,
      contains: () => false,
      querySelector: (selector: string) => unavailable && tagName === 'H1' && selector.split(',').includes('.unavailable-link') ? {} : null,
      append: () => {},
    })
    const first = node('H1')
    const second = node('H2')
    const stack: unknown[] = []
    const result = heading(first, stack)
    heading(second, stack)
    return { result, first, second, toc, context, heading, stack, node }
  }
  const linked = renderFirst(true)
  expect(linked.first.dataset.anchor).toBe('store-approval')
  expect(linked.second.dataset.anchor).toBe('store-approval-1')
  expect(linked.toc.map(heading => heading.id)).toEqual(['store-approval', 'store-approval-1'])
  const plain = renderFirst(false)
  expect(plain.result).toBeNull()
  expect(plain.context.anchors.get('store-approval')).toBe(plain.context.ui['page-title'])
  expect(plain.second.dataset.anchor).toBe('store-approval-1')
  const collision = renderFirst(false)
  const anchors = ['Rule', 'Rule', 'Rule-1', 'Rule'].map((title) => {
    collision.context.visibleNodeText = () => title
    const node = collision.node('H2')
    collision.heading(node, collision.stack)
    return node.dataset.anchor
  })
  expect(anchors).toEqual(['rule', 'rule-1', 'rule-1-1', 'rule-2'])
  expect(new Set(collision.toc.map(heading => heading.id)).size).toBe(collision.toc.length)
  for (const tagName of ['H2', 'H1']) {
    const author = { target: 'later author id=pickup' }
    const reserved = renderFirst(false)
    reserved.context.firstHeading = tagName === 'H1'
    reserved.context.visibleNodeText = () => 'Pickup'
    reserved.context.anchors.set('pickup', author)
    reserved.context.usedIds.add('pickup')
    const node = reserved.node(tagName)
    const result = reserved.heading(node, reserved.stack)
    expect(reserved.context.anchors.get('pickup')).toBe(author)
    if (tagName === 'H1') {
      expect(result).toBeNull()
      expect(reserved.context.anchors.get('pickup-1')).toBe(reserved.context.ui['page-title'])
    }
    else {
      expect(node.dataset.anchor).toBe('pickup-1')
    }
  }
})

it('displays the validated byte digest for BOM text and clears it when a later read fails', async () => {
  const bytes = Buffer.from('\uFEFFid,name\r\n1,甲\r\n')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const decoded = bytes.toString('utf8').replace(/^\uFEFF/u, '')
  expect(createHash('sha256').update(decoded).digest('hex')).not.toBe(sha256)
  const { fields: ui, ui: dialogUi } = sourceDialogState()
  let fail = false
  const context = {
    ui: dialogUi,
    catalog: {},
    sourceVersion: 0,
    renderVersion: 0,
    readPageVersion: 0,
    readPageKey: undefined,
    documents: new Map(),
    sources: new Map([['result.csv', { sha256 }]]),
    currentView: 'search',
    routeInfo: () => ({ query: 'csv' }),
    sourceUrl: (_path: string, digest: string) => `/content/result.csv?sha256=${digest}`,
    fetchResource: () => fail ? Promise.reject(new Error('Source changed')) : Promise.resolve(decoded),
    readSource: (): Promise<string> => context.fetchResource(),
    sourceReadError: () => undefined,
  }
  const code = source.slice(source.indexOf('  async function openSource('), source.indexOf('\n  ui[\'search-input\'].addEventListener'))
  const openSource = runInNewContext(`${pageScope}\n${code}\nopenSource`, context) as (path: string) => Promise<void>
  await openSource('result.csv')
  expect(ui['source-content'].textContent).toBe(decoded)
  expect(ui['source-hash'].textContent).toBe(`原文字节摘要 ${sha256.slice(0, 16)}`)
  expect(ui['source-hash'].title).toBe(sha256)
  expect(ui['source-original'].href).toContain(sha256)
  expect(ui['source-original'].hidden).toBe(false)
  fail = true
  await openSource('result.csv')
  expect(ui['source-content'].textContent).toBe('Source changed')
  expect(ui['source-hash'].textContent).toBe('')
  expect(ui['source-hash'].title).toBe('')
  expect(ui['source-original'].href).toBe('')
  expect(ui['source-original'].hidden).toBe(true)
})

it('clears old success and ignores a late healthy response after its pair becomes known faulty', async () => {
  const path = 'task/model.json'
  const error = '来源不存在或不是文件：task/handbook.html'
  const { fields, dialog, ui } = sourceDialogState()
  let finish: (text: string) => void = () => {}
  let fetches = 0
  let pending = false
  const context = {
    ui,
    sourceVersion: 0,
    renderVersion: 0,
    readPageVersion: 0,
    readPageKey: undefined,
    currentView: 'search',
    routeInfo: () => ({ query: 'task' }),
    documents: new Map(),
    sources: new Map([[path, { sha256: 'model' }]]),
    taskPages: new Map([['task/handbook.html', { sha256: 'html', model_sha256: 'model', model_path: path }]]),
    catalog: { task_errors: {} as Record<string, string> },
    fetchResource: () => {
      fetches++
      return pending
        ? new Promise<string>((resolve) => {
            finish = resolve
          })
        : Promise.resolve('{"revision":1}')
    },
  }
  const code = source.slice(source.indexOf('  async function openSource('), source.indexOf('\n  ui[\'search-input\'].addEventListener'))
  const openSource = runInNewContext(`${sourceAccess}\n${code}\nopenSource`, context) as (path: string) => Promise<void>
  await openSource(path)
  expect(fields['source-hash'].title).toBe('model')
  expect(fields['source-original'].href).toBe('/task-page/html/model/task/model.json')
  pending = true
  const late = openSource(path)
  context.catalog.task_errors = { [path]: error, 'task/handbook.html': error }
  context.sources.clear()
  context.taskPages.clear()
  await openSource(path)
  expect(dialog.open).toBe(true)
  expect(fields['source-content'].textContent).toContain(error)
  expect(fields['source-content'].textContent).toContain('原任务图页和对应 AI 记录')
  expect(fetches).toBe(2)
  finish('{"revision":99}')
  await late
  expect(fields['source-content'].textContent).toContain(error)
  expect(fields['source-hash'].textContent).toBe('')
  expect(fields['source-hash'].title).toBe('')
  expect(fields['source-original'].href).toBe('')
  expect(fields['source-original'].hidden).toBe(true)
})

it.each(['success', 'error'])('invalidates an old source %s when the pending refresh activates a new catalog', async (result) => {
  const path = 'docs/business/rates.md'
  const previous = { path, title: '配送费', kind: 'document', sha256: 'R1' }
  const next = { project: 'Business', documents: [{ ...previous, sha256: 'R2' }], sources: [], task_pages: [] }
  let finishCatalog!: (catalog: typeof next) => void
  const catalogResponse = new Promise<typeof next>((resolve) => {
    finishCatalog = resolve
  })
  let finishSource!: (text: string) => void
  let rejectSource!: (error: Error) => void
  const sourceResponse = new Promise<string>((resolve, reject) => {
    finishSource = resolve
    rejectSource = reject
  })
  const { fields, dialog, ui } = sourceDialogState()
  const article = { textContent: 'R1 每单12元' }
  const showReadFailure = vi.fn(() => {
    article.textContent = '文档读取失败'
  })
  const context = {
    ui: {
      ...ui,
      article,
      'refresh-button': { title: '', setAttribute: vi.fn(), removeAttribute: vi.fn() },
      'project-name': { textContent: '', title: '' },
    },
    catalog: { ...next, documents: [previous] },
    documents: new Map([[path, previous]]),
    sources: new Map(),
    taskPages: new Map(),
    searchTexts: new Map(),
    refreshing: false,
    sourceVersion: 0,
    renderVersion: 0,
    readPageVersion: 0,
    readPageKey: undefined,
    currentPath: path,
    currentView: 'page',
    routeInfo: () => ({ path }),
    fetchResource: () => catalogResponse,
    documentText: (doc: typeof previous) => doc.sha256 === 'R1' ? sourceResponse : Promise.resolve('R2 每单15元'),
    sourceUrl: (_path: string, digest: string) => `/content/${path}?sha256=${digest}`,
    renderRoute: async () => { article.textContent = 'R2 每单15元' },
    showReadFailure,
  }
  const code = source.slice(source.indexOf('  async function refresh('), source.indexOf('\n  ui[\'search-input\'].addEventListener'))
  const actions = runInNewContext(`${pageScope}\n${code}\n({refresh, openSource})`, context) as { refresh: () => Promise<void>, openSource: (path: string) => Promise<void> }
  const refresh = actions.refresh()
  const late = actions.openSource(path)
  expect(dialog.open).toBe(true)
  finishCatalog(next)
  await refresh
  expect(context.catalog).toBe(next)
  expect(article.textContent).toBe('R2 每单15元')
  expect(dialog.open).toBe(false)
  if (result === 'success')
    finishSource('R1 每单12元')
  else
    rejectSource(new Error('R1 来源已更新（409）'))
  await late
  expect(showReadFailure).not.toHaveBeenCalled()
  expect(article.textContent).toBe('R2 每单15元')
  expect(fields['source-hash'].textContent).toBe('')
  expect(fields['source-original'].href).toBe('')
  expect(fields['source-original'].hidden).toBe(true)
  await actions.openSource(path)
  expect(fields['source-content'].textContent).toBe('R2 每单15元')
  expect(fields['source-hash'].title).toBe('R2')
  expect(fields['source-original'].href).toContain('sha256=R2')
})

it('closes a fully loaded source when back navigation returns to the previous document', async () => {
  const { info, fields, dialog, context, actions } = sourceNavigationState()
  info.path = 'current.md'
  info.phase = 'current'
  await actions.renderRoute()
  info.path = 'proposal.md'
  info.phase = 'proposed'
  await actions.renderRoute()
  await actions.openSource('proposal.md')
  expect(fields['source-hash'].title).toBe('proposal.md')
  expect(dialog.open).toBe(true)
  info.path = 'current.md'
  info.phase = 'current'
  await actions.renderRoute()
  expect(dialog.open).toBe(false)
  expect(context.sourceRoute).toBeUndefined()
  await actions.openSource('current.md')
  expect(fields['source-content'].textContent).toBe('current.md 原文')
  expect(fields['source-original'].href).toContain('current.md')
})

it.each(['success', 'error'])('ignores a source %s after leaving its document and returning before it completes', async (result) => {
  const { info, context, actions, fields, dialog, article } = sourceNavigationState()
  let finish!: (text: string) => void
  let reject!: (error: Error) => void
  context.documentText = () => new Promise<string>((resolve, fail) => {
    finish = resolve
    reject = fail
  })
  await actions.renderRoute()
  const late = actions.openSource('proposal.md')
  info.path = 'current.md'
  info.phase = 'current'
  await actions.renderRoute()
  expect(dialog.open).toBe(false)
  expect(article.innerHTML).toBe('current.md current')
  info.path = 'proposal.md'
  info.phase = 'proposed'
  await actions.renderRoute()
  if (result === 'success')
    finish('旧拟议14天')
  else
    reject(new Error('旧来源已更新（409）'))
  await late
  expect(dialog.open).toBe(false)
  expect(fields['source-hash'].textContent).toBe('')
  expect(fields['source-original'].href).toBe('')
  expect(fields['source-original'].hidden).toBe(true)
  expect(context.showReadFailure).not.toHaveBeenCalled()
  expect(article.innerHTML).toBe('proposal.md proposed')
})

it('keeps an opened source for same-page anchors and theme redraws, then clears its owner on native close', async () => {
  const { info, context, actions, dialog, fields } = sourceNavigationState()
  await actions.renderRoute()
  await actions.openSource('proposal.md')
  const version = context.sourceVersion
  info.section = '退款期限'
  await actions.renderRoute()
  await actions.renderRoute()
  expect(dialog.open).toBe(true)
  expect(context.sourceVersion).toBe(version)
  expect(fields['source-hash'].title).toBe('proposal.md')
  expect(context.sourceRoute?.path).toBe('proposal.md')
  dialog.close()
  expect(context.sourceRoute).toBeUndefined()
  expect(context.sourceVersion).toBeGreaterThan(version)
})

it.each([
  [{ query: '退货' }, { query: '退款' }],
  [{ taskQuery: 'view=overview' }, { taskQuery: 'view=detail' }],
  [{ phase: 'proposed' }, { phase: 'current' }],
  [{ view: 'page' }, { view: 'tasks' }],
])('closes source ownership when the reading view changes from %j to %j', async (previous, next) => {
  const { info, actions, dialog } = sourceNavigationState()
  Object.assign(info, previous)
  await actions.renderRoute()
  await actions.openSource('proposal.md')
  Object.assign(info, next)
  await actions.renderRoute()
  expect(dialog.open).toBe(false)
})

it('ignores a source error after native close even before its close event is delivered', async () => {
  const { context, actions, dialog } = sourceNavigationState()
  let reject!: (error: Error) => void
  context.documentText = () => new Promise<string>((_resolve, fail) => {
    reject = fail
  })
  await actions.renderRoute()
  const late = actions.openSource('proposal.md')
  dialog.open = false
  reject(new Error('迟到来源错误'))
  await late
  expect(context.showReadFailure).not.toHaveBeenCalled()
})

it.each(['success', 'error'])('keeps the new source %s active when an earlier native close event arrives after reopening', async (result) => {
  const { info, context, actions, fields, dialog } = sourceNavigationState()
  await actions.renderRoute()
  await actions.openSource('proposal.md')
  // The dialog is closed now; its native close event is still queued.
  dialog.open = false
  info.path = 'current.md'
  info.phase = 'current'
  await actions.renderRoute()
  let finish!: (text: string) => void
  let reject!: (error: Error) => void
  context.documentText = () => new Promise<string>((resolve, fail) => {
    finish = resolve
    reject = fail
  })
  const reading = actions.openSource('current.md')
  const version = context.sourceVersion
  const owner = context.sourceRoute
  dialog.dispatchClose()
  expect(dialog.open).toBe(true)
  expect(context.sourceVersion).toBe(version)
  expect(context.sourceRoute).toBe(owner)
  if (result === 'success')
    finish('现行七天')
  else
    reject(new Error('当前来源读取失败（409）'))
  await reading
  if (result === 'success') {
    expect(fields['source-content'].textContent).toBe('现行七天')
    expect(fields['source-hash'].title).toBe('current.md')
    expect(fields['source-original'].href).toContain('current.md')
    expect(fields['source-original'].hidden).toBe(false)
    expect(context.showReadFailure).not.toHaveBeenCalled()
  }
  else {
    expect(fields['source-content'].textContent).toBe('当前来源读取失败（409）')
    expect(fields['source-hash'].textContent).toBe('')
    expect(fields['source-original'].href).toBe('')
    expect(fields['source-original'].hidden).toBe(true)
    expect(context.showReadFailure).toHaveBeenCalledExactlyOnceWith('current.md', '当前来源读取失败（409）')
  }
})

it('takes the first readable paragraph through the shared sanitized text path', () => {
  const calls: string[] = []
  let paragraphs = [{ tagName: 'P', visible: '' }, { tagName: 'P', visible: '现行方案七天。 Refund Deadline可复核。' }, { tagName: 'P', visible: '后续说明。' }]
  const context = {
    markdownFragment: (body: string) => {
      calls.push(body)
      return {
        children: paragraphs,
      }
    },
    visibleNodeText: (paragraph: { visible: string }) => paragraph.visible,
  }
  const code = source.slice(source.indexOf('  function firstParagraph('), source.indexOf('  function paragraphExcerpt('))
  const firstParagraph = runInNewContext(`${code}\nfirstParagraph`, context) as (raw: string) => string
  const body = '# 业务手册\n\n现行方案七天。<span hidden>撤案HIDDENCARD</span> Refund<br>Deadline可复核。\n'
  expect(firstParagraph(`---\ntitle: 资料\n---\n${body}`)).toBe('现行方案七天。 Refund Deadline可复核。')
  expect(calls).toEqual([body])
  paragraphs = [{ tagName: 'DETAILS', visible: '可以交付。' }, { tagName: 'BLOCKQUOTE', visible: '旧记录：可以交付。' }, { tagName: 'P', visible: '本轮已退回，必须补实测。' }]
  expect(firstParagraph('<details><p>可以交付。</p></details>\n\n> 旧记录：可以交付。\n\n本轮已退回，必须补实测。')).toBe('本轮已退回，必须补实测。')
  paragraphs = paragraphs.slice(0, 2)
  expect(firstParagraph('<details><p>可以交付。</p></details>\n\n> 旧记录：可以交付。')).toBe('')
  paragraphs = []
  expect(firstParagraph('# 仅有标题\n')).toBe('')
})

it('selects one canonical navigation destination and only falls back to a sole overview entry', () => {
  function link(path: string, section = '', query = '') {
    const values = new Map([['href', `#${new URLSearchParams({ page: path, section, task_query: query })}`]])
    return {
      getAttribute: (name: string) => values.get(name),
      setAttribute: (name: string, value: string) => values.set(name, value),
      removeAttribute: (name: string) => values.delete(name),
    }
  }
  let links = [link('rules.md'), link('rules.md', '七日退货'), link('rules.md', '十四日试点')]
  let info = { section: '现状-七日退货', taskQuery: '' }
  const article = { dataset: { documentPath: 'rules.md' } }
  const context = {
    URL,
    URLSearchParams,
    ui: { article, navigation: { querySelectorAll: () => links } },
    currentView: 'page',
    currentPath: 'rules.md',
    taskPages: new Map(),
    routeInfo: () => info,
    headingFor: (section: string) => ({ dataset: { anchor: section === '七日退货' ? '现状-七日退货' : section } }),
  }
  const code = source.slice(source.indexOf('  function updateNavigationSelection('), source.indexOf('  function setHeader('))
  const update = runInNewContext(`${taskQuery}\n${code}\nupdateNavigationSelection`, context) as () => void
  const selected = () => links.map(item => item.getAttribute('aria-current'))
  update()
  expect(selected()).toEqual([undefined, 'page', undefined])
  info = { section: '未列章节', taskQuery: '' }
  update()
  expect(selected()).toEqual([undefined, undefined, undefined])
  links = [links[0]]
  update()
  expect(selected()).toEqual(['page'])
  links = [link('task/handbook.html'), link('task/handbook.html', 'node=%E9%80%80%E6%AC%BE', 'view=detail&q=甲')]
  context.currentPath = 'task/handbook.html'
  context.taskPages.set('task/handbook.html', {})
  info = { section: 'node=退款', taskQuery: 'q=甲&view=detail&ignored=1' }
  update()
  expect(selected()).toEqual([undefined, 'page'])
  context.currentView = 'search'
  update()
  expect(selected()).toEqual([undefined, undefined])
})

it('keeps a tooltip open across its pointer gap and internal interactions, but dismisses it on Escape', () => {
  vi.useFakeTimers()
  try {
    const handlers = { nav: new Map<string, (event?: any) => void>(), tooltip: new Map<string, (event?: any) => void>(), document: new Map<string, (event?: any) => void>(), window: new Map<string, (event?: any) => void>() }
    const attributes = new Map()
    const target = { scrollWidth: 900, clientWidth: 180, textContent: '完整任务标题', getBoundingClientRect: () => ({ left: 16, right: 224, top: 100, bottom: 128, height: 28 }), setAttribute: (key: string, value: string) => attributes.set(key, value), removeAttribute: (key: string) => attributes.delete(key), contains: (node: unknown) => node === target, closest: () => target }
    const tooltip = { hidden: true, textContent: '', style: {}, getBoundingClientRect: () => ({ width: 240, height: 80 }), contains: (node: unknown) => node === tooltip, matches: () => true, addEventListener: (type: string, callback: (event?: any) => void) => handlers.tooltip.set(type, callback) }
    const nav = { getBoundingClientRect: () => ({ left: 0, right: 240, top: 80, bottom: 420 }), addEventListener: (type: string, callback: (event?: any) => void) => handlers.nav.set(type, callback) }
    const document = { activeElement: {}, documentElement: { clientWidth: 1000, clientHeight: 700 }, addEventListener: (type: string, callback: (event?: any) => void) => handlers.document.set(type, callback) }
    const functions = source.slice(source.indexOf('  function hideNavTooltip('), source.indexOf('  function originalTaskLinks('))
    const endpoint = '  window.addEventListener(\'hashchange\', dismissNavTooltip)'
    const listeners = source.slice(source.indexOf('  ui.navigation.addEventListener(\'pointerover\''), source.indexOf(endpoint) + endpoint.length)
    runInNewContext(`${functions}\n${listeners}`, {
      ui: { 'navigation': nav, 'nav-tooltip': tooltip },
      navTooltipTarget: undefined,
      navTooltipFocusTarget: undefined,
      navTooltipTimer: undefined,
      document,
      window: { addEventListener: (type: string, callback: (event?: any) => void) => handlers.window.set(type, callback) },
      setTimeout,
      clearTimeout,
    })
    handlers.nav.get('pointerover')!({ target, relatedTarget: null })
    handlers.nav.get('pointerout')!({ relatedTarget: null })
    vi.advanceTimersByTime(80)
    handlers.tooltip.get('pointerenter')!()
    vi.advanceTimersByTime(300)
    expect(tooltip.hidden).toBe(false)
    handlers.document.get('pointerdown')!({ target: tooltip })
    handlers.document.get('wheel')!({ target: tooltip })
    handlers.nav.get('focusout')!({ relatedTarget: null })
    expect(tooltip.hidden).toBe(false)
    handlers.document.get('keydown')!({ key: 'Escape' })
    expect(tooltip.hidden).toBe(true)
    expect(attributes.has('aria-describedby')).toBe(false)
    vi.advanceTimersByTime(300)
    expect(tooltip.hidden).toBe(true)
  }
  finally {
    vi.useRealTimers()
  }
})

it.each([
  { target: 'terms.md', kind: 'source', error: '', sourceError: '' },
  { target: 'task/handbook.html', kind: 'task-page', error: '来源不存在或不是文件：task/model.json', sourceError: '' },
  { target: 'task/model.json', kind: 'source', error: '任务模型无法读取：task/model.json', sourceError: '' },
  { target: 'manual/handbook.html', kind: 'source', error: '', sourceError: '来源超过 2 MiB：manual/handbook.html' },
])('retains inline nodes and explains an unavailable $kind source', ({ target, kind, error, sourceError }) => {
  const children = [{ tagName: 'STRONG', textContent: 'Store' }, { tagName: 'BR', textContent: '' }, { tagName: 'CODE', textContent: 'Approval' }]
  const span = {
    className: '',
    childNodes: [] as typeof children,
    dataset: { reason: '' },
    tabIndex: -1,
    title: '',
    append(...nodes: typeof children) {
      this.childNodes.push(...nodes)
    },
  }
  let replacement: unknown
  const anchor = {
    childNodes: children,
    textContent: 'StoreApproval',
    getAttribute: () => target,
    replaceWith: (node: unknown) => { replacement = node },
  }
  const context = {
    document: { createElement: () => span },
    readLinkBindings: new WeakMap(),
    resolveLink: () => ({ target, kind, exists: false, error: sourceError }),
    catalog: { task_errors: { [target]: error } },
  }
  const code = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  const markdown ='))
  const instrumentLinks = runInNewContext(`${code}\ninstrumentLinks`, context) as (parent: unknown, doc: Document) => void
  instrumentLinks({ querySelectorAll: () => [anchor] }, { path: 'guide.md' })
  expect(replacement).toBe(span)
  expect(span.childNodes).toEqual(children)
  expect(span.childNodes[1]).toBe(children[1])
  expect(span.className).toBe('unavailable-link')
  expect(span.tabIndex).toBe(0)
  expect(span.title).toBe(span.dataset.reason)
  expect(span.title).toContain(error || sourceError || target)
  expect(span.title).toContain('刷新内容')
  if (error)
    expect(span.title).toContain('原任务图页和对应 AI 记录')
  if (sourceError)
    expect(span.title).not.toContain('任务')
})

it('retains the local identity and original read error for an unavailable ordinary handbook', () => {
  const link = { kind: 'source', target: 'manual/handbook.html', fragment: 'cutoff', exists: false, error: '来源不是 UTF-8 文本：manual/handbook.html', status: 415 }
  const resolveLink = resolver(['docs/business/index.md'], [])
  expect(resolveLink('../../manual/handbook.html#cutoff', { path: 'docs/business/index.md', links: [link] })).toEqual(link)
})

it.each([
  ['../../manual/sign.txt#签收', 'manual/sign.txt', '签收'],
  ['..%2F..%2Fmanual/sign%25.txt#签收50%25', 'manual/sign%.txt', '签收50%'],
])('retains a rejected local source diagnosis in fresh body and context links for %s', (href, target, fragment) => {
  const link = { kind: 'source', target, fragment, exists: false, error: `不读取符号链接：${target}`, status: 403 }
  const doc = { path: 'docs/business/index.md', kind: 'document', links: [link] }
  const ui = { context: { innerHTML: '', hidden: true, querySelectorAll: () => [] } }
  const span = { append: vi.fn(), dataset: { reason: '' }, title: '' }
  const anchor = { getAttribute: () => href, childNodes: [], replaceWith: vi.fn() }
  const context = {
    URL,
    URLSearchParams,
    ui,
    readLinkBindings: new WeakMap(),
    catalog: { task_errors: {}, warnings: [] },
    documents: new Map([[doc.path, doc]]),
    sources: new Map(),
    taskPages: new Map(),
    document: { createElement: () => span },
    wideOutline: { matches: false },
    related: () => [],
    originalTaskLinks: () => [],
    contextBlock: (title: string, html: string) => `<section>${title}${html}</section>`,
    escape: (value: unknown) => String(value),
    formatTime: () => '',
    setTextTitles: vi.fn(),
    syncToc: vi.fn(),
    tocItems: [],
  }
  const instrumentCode = source.slice(source.indexOf('  function instrumentLinks('), source.indexOf('  const markdown ='))
  const contextCode = source.slice(source.indexOf('  function renderContext('), source.indexOf('  function syncToc('))
  const { resolveLink, instrumentLinks, renderContext } = runInNewContext(`${sourceAccess}\n${taskQuery}\n${resolve}\n${instrumentCode}\n${contextCode}\n({resolveLink,instrumentLinks,renderContext})`, context) as {
    resolveLink: (href: string, doc: Document) => Link | null
    instrumentLinks: (parent: unknown, doc: unknown) => void
    renderContext: (doc: unknown, toc: unknown[]) => void
  }
  expect(resolveLink(href, doc)).toEqual(link)
  instrumentLinks({ querySelectorAll: () => [anchor] }, doc)
  expect(anchor.replaceWith).toHaveBeenCalledWith(span)
  expect(span.title).toContain(link.error)
  expect(span.title).toContain('修复或恢复来源')
  expect(span.title).not.toContain('未收录')
  renderContext(doc, [])
  expect(ui.context.innerHTML).toContain(`data-reason="${span.title}"`)
  expect(ui.context.innerHTML).not.toContain('href=')
})

it.each([false, true])('shares the batched target diagnosis across body and source URLs without guessing unknown state=%s', (unchecked) => {
  const target = 'rules/departed.md'
  const error = unchecked ? '本批未读到原文，请刷新目录后重试。' : '来源不存在或不是文件：rules/departed.md'
  const link = { target, kind: 'document', fragment: '', exists: true }
  const context = {
    URL,
    URLSearchParams,
    catalog: {},
    documents: new Map([[target, { sha256: 'old', readError: error, readUnchecked: unchecked }]]),
    sources: new Map(),
    taskPages: new Map(),
  }
  const actions = runInNewContext(`${sourceAccess}\n${taskQuery}\n${resolve}\n({resolveLink,sourceUrl,unavailableReason})`, context) as {
    resolveLink: (href: string, doc: Document) => Link & { unchecked: boolean }
    sourceUrl: (path: string) => string
    unavailableReason: (link: unknown) => string
  }
  const resolved = actions.resolveLink(target, { path: 'index.md', links: [link] })
  expect(resolved.exists).toBe(false)
  expect(resolved.error).toBe(error)
  expect(resolved.unchecked).toBe(unchecked)
  const reason = actions.unavailableReason(resolved)
  expect(() => actions.sourceUrl(target)).toThrow(reason)
  if (unchecked)
    expect(reason).not.toContain('修复或恢复')
})

it('explains how to recover an over-capacity task without asking to restore intact files', () => {
  const target = 'task/model.json'
  const code = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks('))
  const reason = runInNewContext(`${code}\nunavailableReason`, {
    catalog: { task_errors: { [target]: '任务原页超过 500 份，请选择更具体的任务目录。' }, task_error_statuses: { [target]: 413 }, task_scope_limited: [target] },
  }) as (link: { target: string }) => string
  const text = reason({ target })
  expect(text).toContain('500')
  expect(text).toContain('收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
  expect(text).not.toContain('恢复原任务')
  expect(text).not.toContain('。。')
})

it.each([true, false])('distinguishes catalog task 413 recovery from its explicit scope metadata: %s', (limited) => {
  const target = 'task/model.json'
  const error = 'opaque size or scope token'
  const catalog = {
    task_errors: { [target]: error },
    task_error_statuses: { [target]: 413 },
    ...(limited ? { task_scope_limited: ['task/handbook.html', target] } : {}),
  }
  const code = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks('))
  const reason = runInNewContext(`${code}\nunavailableReason`, { catalog }) as (link: { target: string }) => string
  const text = reason({ target })
  expect(text).toContain(error)
  if (limited) {
    expect(text).toContain('收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
    expect(text).not.toContain('缩小内容')
  }
  else {
    expect(text).toContain('缩小内容或使用外部链接')
    expect(text).not.toContain('重新启动')
  }
})

it.each([
  '文档读取超过 500 份，请缩小业务入口或任务目录后重新读取',
  '本次未检查：已达文档读取上限 500 份，请缩小业务入口或任务目录后重新读取',
])('keeps capacity recovery consistent in body links, context and saved page routes for %s', async (error) => {
  const target = 'rules/overflow.md'
  const link = { target, kind: 'document', exists: false, error: `${error}：${target}`, status: 413, scope_limited: true }
  const doc = { path: 'index.md', kind: 'document', links: [link] }
  const ui = { context: { innerHTML: '', hidden: true, querySelectorAll: () => [] } }
  const span = { append: vi.fn(), dataset: { reason: '' }, title: '' }
  const anchor = { getAttribute: () => target, childNodes: [], replaceWith: vi.fn() }
  const context = {
    ui,
    catalog: { documents: [doc], document_errors: { [target]: { error: link.error, status: 413, scope_limited: true } }, task_errors: {}, read_at: '', warnings: [] },
    readLinkBindings: new WeakMap(),
    documents: new Map([[doc.path, doc]]),
    taskPages: new Map(),
    wideOutline: { matches: false },
    tocItems: [],
    document: { createElement: () => span },
    resolveLink: () => link,
    sourceReadError: () => undefined,
    related: () => [],
    originalTaskLinks: () => [],
    contextBlock: (title: string, html: string) => `<section>${title}${html}</section>`,
    escape: (value: unknown) => String(value),
    formatTime: () => '',
    setTextTitles: vi.fn(),
    syncToc: vi.fn(),
  }
  const reasonCode = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  const markdown ='))
  const contextCode = source.slice(source.indexOf('  function renderContext('), source.indexOf('  function syncToc('))
  const pageCode = source.slice(source.indexOf('  async function renderPage('), source.indexOf('  async function renderRoute('))
  const { unavailableReason, instrumentLinks, renderContext, renderPage } = runInNewContext(`${reasonCode}\n${contextCode}\n${pageCode}\n({unavailableReason,instrumentLinks,renderContext,renderPage})`, context) as {
    unavailableReason: (link: unknown) => string
    instrumentLinks: (parent: unknown, doc: unknown) => void
    renderContext: (doc: unknown, toc: unknown[]) => void
    renderPage: (info: { path: string }, version: number) => Promise<void>
  }
  const reason = unavailableReason(link)
  expect(reason).toContain(link.error)
  expect(reason).toContain('收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
  expect(reason).not.toContain('修复或恢复')
  instrumentLinks({ querySelectorAll: () => [anchor] }, doc)
  expect(span.title).toBe(reason)
  expect(span.dataset.reason).toBe(reason)
  renderContext(doc, [])
  expect(ui.context.innerHTML).toContain(`data-reason="${reason}"`)
  doc.links = []
  await expect(renderPage({ path: target }, 1)).rejects.toThrow(reason)
})

it('asks to shrink ordinary oversized content without treating it as a document-count limit', () => {
  const link = { target: 'manual/handbook.html', kind: 'source', exists: false, error: '来源超过 2 MiB，请缩小内容或使用外部链接：manual/handbook.html', status: 413 }
  const code = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks('))
  const reason = runInNewContext(`${code}\nunavailableReason`, { catalog: {} }) as (link: unknown) => string
  const text = reason(link)
  expect(text).toContain(link.error)
  expect(text).toContain('请缩小内容或使用外部链接后点击“刷新内容”重试')
  expect(text).not.toContain('重新启动')
  expect(text).not.toContain('修复或恢复')
})

it('shows a failed task pair in source context without opening its HTML as a raw source', () => {
  const ui = { context: { innerHTML: '', hidden: true, querySelectorAll: () => [] } }
  const context = {
    ui,
    catalog: { task_errors: { 'task/handbook.html': '来源不存在或不是文件：task/model.json', 'task/model.json': '来源不存在或不是文件：task/model.json' }, read_at: '', warnings: [] },
    sourceReadError: () => undefined,
    documents: new Map(),
    wideOutline: { matches: false },
    tocItems: [],
    related: () => [],
    originalTaskLinks: () => [],
    contextBlock: (title: string, html: string) => `<section>${title}${html}</section>`,
    escape: (value: unknown) => String(value),
    routeUrl: (path: string) => `#page=${path}`,
    sourceUrl: (path: string) => `/content/${path}`,
    formatTime: () => '',
    setTextTitles: () => {},
    syncToc: () => {},
  }
  const reason = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks('))
  const code = source.slice(source.indexOf('  function renderContext('), source.indexOf('  function syncToc('))
  const renderContext = runInNewContext(`${reason}\n${code}\nrenderContext`, context) as (doc: unknown, toc: unknown[]) => void
  renderContext({ path: 'index.md', kind: 'document', links: [
    { target: 'task/model.json', kind: 'source', exists: true, label: '残留 AI 记录' },
    { target: 'task/handbook.html', kind: 'task-page', exists: false, label: '任务图页' },
    { target: 'reference/handbook.html', kind: 'source', exists: true, label: 'HTML 参考原文' },
  ] }, [])
  expect(ui.context.innerHTML).toContain('task/model.json')
  expect(ui.context.innerHTML).toContain('原任务图页和对应 AI 记录')
  expect(ui.context.innerHTML).toContain('tabindex="0"')
  expect(ui.context.innerHTML).not.toContain('data-source="task/handbook.html"')
  expect(ui.context.innerHTML).not.toContain('data-source="task/model.json"')
  expect(ui.context.innerHTML).toContain('data-source="reference/handbook.html"')
})

it.each([
  { sectionTitle: 'Diagram Review', heading: 'DiagramReview#', visible: 'Fallback Review #', expected: 'Diagram Review' },
  { sectionTitle: '', heading: 'FallbackReview#', visible: 'Fallback Review #', expected: 'Fallback Review' },
  { sectionTitle: '', heading: '', visible: '', expected: '放大图表' },
])('keeps the rendered and enlarged diagram name aligned with $expected', async ({ sectionTitle, heading, visible, expected }) => {
  const attributes = new Map<string, string>()
  const drawing = { setAttribute: (key: string, value: string) => attributes.set(key, value) }
  const section = {
    dataset: { phase: 'current', sectionTitle },
    querySelector: () => heading ? { textContent: heading } : null,
  }
  const createElement = () => ({
    append: () => {},
    closest: () => section,
    querySelector: () => drawing,
    isConnected: true,
    dataset: {},
  })
  let replacement: ReturnType<typeof createElement> | undefined
  const original = {
    isConnected: true,
    contains: (target: { parentElement?: unknown }) => target.parentElement === original,
    replaceWith: (figure: ReturnType<typeof createElement>) => {
      replacement = figure
      original.isConnected = false
    },
  }
  const mermaidCode = {
    textContent: 'flowchart LR\nA --> B',
    parentElement: original,
    get isConnected() {
      return original.isConnected
    },
  }
  const authorAnchors = new Map<string, { isConnected: boolean }>([['diagram-pre', original], ['diagram-code', mermaidCode]])
  const definitions = new Map<string, { title: string, source: string, phase: string }>()
  const context = {
    ui: { article: { querySelectorAll: () => [mermaidCode] } },
    document: { createElement },
    mermaid: { render: async () => ({ svg: '<svg></svg>' }) },
    safeDiagram: (svg: string) => svg,
    visibleNodeText: () => visible,
    renderVersion: 1,
    diagramNumber: 0,
    diagramDefinitions: definitions,
    documentAnchors: authorAnchors,
  }
  const code = source.slice(source.indexOf('  async function renderDiagrams('), source.indexOf('  function cardRelated('))
  const renderDiagrams = runInNewContext(`${code}\nrenderDiagrams`, context) as (version: number) => Promise<void>
  await renderDiagrams(1)
  expect(definitions.size).toBe(1)
  expect([...definitions.values()][0].title).toBe(expected)
  expect(attributes.get('aria-label')).toBe(`${expected}，由 Markdown Mermaid 代码渲染`)
  expect(authorAnchors.get('diagram-pre')).toBe(replacement)
  expect(authorAnchors.get('diagram-code')).toBe(replacement)
  expect(replacement?.isConnected).toBe(true)
  expect(original.isConnected).toBe(false)
  expect(mermaidCode.isConnected).toBe(false)
})
