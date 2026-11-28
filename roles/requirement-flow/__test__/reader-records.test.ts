import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

interface Link { target: string, kind: string, exists: boolean, fragment?: string, query?: string }
interface Document { path: string, kind: string, sha256: string, title: string, links?: Link[], readError?: string, readUnchecked?: boolean, readChanged?: boolean, readStatus?: number, readScopeLimited?: boolean }
interface TaskPage { path: string, model_path: string, sha256: string, model_sha256: string, title: string, readError?: string, readUnchecked?: boolean, readChanged?: boolean, readStatus?: number, readScopeLimited?: boolean }
interface Row { path: string, kind?: string, sha256?: string, model_sha256?: string, text?: string, error?: string, status?: number, scope_limited?: boolean }
interface SourceCheck { path: string, sha256?: string, error?: string, status?: number }
interface Navigation { path: string, label: string, fragment?: string, query?: string }
interface Batch { records: Row[], warnings: string[], source_checks?: SourceCheck[], navigation?: Navigation[] }
interface Item { id: string, title: string, text: string }
interface Record { doc: Document, raw: string, error?: string, unchecked?: boolean, changed?: boolean }
interface Catalog { documents: Document[], task_pages: TaskPage[], entry?: string, warnings?: string[], navigation?: Navigation[], readNavigation?: Navigation[] }

const source = readFileSync(fileURLToPath(new URL('../skills/requirement-flow/reader/assets/reader.js', import.meta.url)), 'utf8')
const scopeCode = source.slice(source.indexOf('  function readPageScope('), source.indexOf('  function toast('))
const recordsCode = source.slice(source.indexOf('  async function documentRecords('), source.indexOf('  function related('))
const tasksCode = source.slice(source.indexOf('  async function renderTasks('), source.indexOf('  function renderOriginalTask('))
const searchCode = source.slice(source.indexOf('  async function renderSearch('), source.indexOf('  function headingFor('))
const sourceCode = source.slice(source.indexOf('  function originalTaskPage('), source.indexOf('  function taskQuery('))
const relatedCode = source.slice(source.indexOf('  function related('), source.indexOf('  function hideNavTooltip('))
const originalCode = source.slice(source.indexOf('  function originalTaskLinks('), source.indexOf('  function renderNavigation('))
const cardCode = source.slice(source.indexOf('  function cardRelated('), source.indexOf('  async function renderTasks('))
const reasonCode = source.slice(source.indexOf('  function unavailableReason('), source.indexOf('  function instrumentLinks('))
const contextCode = source.slice(source.indexOf('  function renderContext('), source.indexOf('  function syncToc('))
const pageCode = source.slice(source.indexOf('  async function renderPage('), source.indexOf('  async function renderRoute('))
const queryCode = source.slice(source.indexOf('  function taskQuery('), source.indexOf('  function routeUrl('))
const resolveCode = source.slice(source.indexOf('  function resolveLink('), source.indexOf('  function unavailableReason('))
const documentTextCode = source.slice(source.indexOf('  async function documentText('), source.indexOf('  async function documentRecords('))
const business = { path: 'guide.md', kind: 'document', sha256: 'business-v1', title: '业务手册' }
const change = { path: 'changes/old.md', kind: 'task', sha256: 'change-v1', title: '旧变更' }
const oldPage = { path: 'old/handbook.html', model_path: 'old/model.json', sha256: 'html-v1', model_sha256: 'model-v1', title: '旧原任务' }
const newPage = { path: 'new/handbook.html', model_path: 'new/model.json', sha256: 'html-v2', model_sha256: 'model-v2', title: 'NEWONLY 原任务' }
const newDocument = { path: 'changes/new.md', kind: 'task', sha256: 'new-md-v1', title: '新变更' }
const pairedRow = (page: TaskPage): Row => ({ kind: 'task-page', path: page.path, sha256: page.sha256, model_sha256: page.model_sha256 })

function reader(documentInputs: Document[], pageInputs: TaskPage[], rows: Row[], warnings: string[] = [], sourceChecks: SourceCheck[] = [], navigation?: Navigation[]) {
  const documents = documentInputs.map(doc => ({ ...doc }))
  const pages = pageInputs.map(page => ({ ...page }))
  const messages: string[] = []
  const searches: Item[][] = []
  const context = {
    URL,
    URLSearchParams,
    catalog: { documents, task_pages: pages } as Catalog,
    documents: new Map(documents.map(doc => [doc.path, doc])),
    taskPages: new Map(pages.map(page => [page.path, page])),
    sources: new Map<string, { sha256: string, readError?: string, readUnchecked?: boolean, readChanged?: boolean, readStatus?: number, readScopeLimited?: boolean }>(pages.flatMap(page => [page.path, page.model_path].map(path => [path, { sha256: page.model_sha256 }] as const))),
    currentPath: '',
    currentView: 'page',
    currentPhase: 'all',
    wideOutline: { matches: false },
    tocItems: [],
    documentAnchors: new Map(),
    scrollPositions: new Map(),
    searchTexts: new Map(),
    pendingTexts: undefined,
    renderVersion: 1,
    readPageVersion: 0,
    readPageKey: undefined,
    routeInfo: () => ({ path: context.currentPath || context.catalog.entry || context.catalog.documents[0]?.path, view: context.currentView === 'tasks' ? 'tasks' : 'page', query: '', taskQuery: '', phase: context.currentPhase, section: '' }),
    fetchResource: vi.fn((_url: string, _format: string): Promise<Batch | string> => Promise.resolve({ records: rows, warnings, source_checks: sourceChecks, navigation: navigation?.map(link => ({ ...link })) })),
    ui: {
      'phase-filter': { innerHTML: '' },
      'context': { hidden: false, innerHTML: '', querySelectorAll: () => [], replaceChildren() { this.innerHTML = '' } },
      'article': { innerHTML: 'before', dataset: {}, replaceChildren(...nodes: string[]) { this.innerHTML = nodes.join('') } },
    },
    window: {
      scrollTo: () => {},
      RequirementSearch: {
        search(items: Item[], query: string) {
          searches.push(items)
          return items.filter(item => `${item.title} ${item.text}`.includes(query)).map(item => ({ id: item.id, terms: [query] }))
        },
      },
    },
    setHeader: () => {},
    documentText: vi.fn((doc: Document) => Promise.resolve(rows.find(row => row.path === doc.path)?.text || '')),
    markdownSections: (raw: string) => ({ container: { childNodes: [raw] }, toc: [], anchors: new Map() }),
    renderPhaseFilter: vi.fn(),
    renderDiagrams: async () => {},
    updateNavigationSelection: vi.fn(),
    contextBlock: (title: string, html: string) => `<section><h2>${title}</h2>${html}</section>`,
    formatTime: () => '',
    setTextTitles: vi.fn(),
    syncToc: vi.fn(),
    notice: (message: string) => messages.push(message),
    firstParagraph: (raw: string) => raw,
    paragraphExcerpt: (raw: string) => raw,
    visibleText: (raw: string) => raw,
    cleanTitle: (title: string) => title,
    escape: (value: string) => value,
    excerpt: (value: string) => value,
    taskFileUrl: (page: TaskPage, path: string) => `/task-page/${page.sha256}/${page.model_sha256}/${path}`,
    routeUrl: (path: string, fragment = '') => `#page=${path}${fragment ? `&section=${fragment}` : ''}`,
    renderNavigation: vi.fn(),
    refreshReadLinks: vi.fn(),
  }
  const actions = runInNewContext(`${scopeCode}\n${recordsCode}\n${sourceCode}\n${queryCode}\n${resolveCode}\n${relatedCode}\n${originalCode}\n${cardCode}\n${reasonCode}\n${contextCode}\n${pageCode}\n${tasksCode}\n${searchCode}\n({ documentRecords, renderTasks, renderSearch,renderPage,sourceUrl,originalTaskRelated,cardRelated,navLink,resolveLink,unavailableReason })`, context) as {
    documentRecords: (list: Document[], scope: string) => Promise<{ records: Record[], taskPages: Row[], addedPaths: string[], warnings: string[] }>
    renderTasks: (version: number) => Promise<void>
    renderSearch: (query: string, version: number) => Promise<void>
    renderPage: (info: { path: string, section?: string }, version: number) => Promise<void>
    sourceUrl: (path: string) => string
    originalTaskRelated: (doc: Document) => string
    cardRelated: (doc: Document, label: string, kind: string) => string
    navLink: (doc: Document | TaskPage) => string
    resolveLink: (href: string, doc: Document) => Link & { error?: string, status?: number, changed?: boolean, unchecked?: boolean }
    unavailableReason: (link: unknown) => string
  }
  return { context, actions, messages, searches }
}

it.each(['all', 'tasks'])('detects new Markdown and paired task sources against the full captured catalog in %s scope', async (scope) => {
  const state = reader([business, change], [oldPage], [
    { path: business.path, sha256: business.sha256, text: '业务' },
    { path: change.path, sha256: change.sha256, text: '\uFEFF已有变更' },
    pairedRow(oldPage),
    { path: newDocument.path, sha256: newDocument.sha256, text: 'NEWONLY' },
    pairedRow(newPage),
  ])
  const list = scope === 'tasks' ? [change] : [business, change]
  const result = await state.actions.documentRecords(list, scope)
  expect(result.addedPaths).toEqual([newDocument.path, newPage.path])
  expect(result.warnings).toEqual([])
  expect(result.records.map(record => record.doc.path)).toEqual(list.map(doc => doc.path))
  expect(result.records.find(record => record.doc.path === change.path)?.raw).toBe('已有变更')
  expect(state.context.documents.size).toBe(2)
  expect(state.context.taskPages.size).toBe(1)
})

it('checks the current task batch even when the captured task list is empty', async () => {
  const state = reader([business], [], [
    { path: newDocument.path, sha256: newDocument.sha256, text: 'NEWONLY' },
    pairedRow(newPage),
  ])
  await state.actions.renderTasks(1)
  expect(state.context.fetchResource).toHaveBeenCalledWith('/api/document-texts?scope=tasks', 'json')
  expect(state.context.ui.article.innerHTML).toContain('本次目录读取未收录')
  expect(state.messages.join(' ')).toContain('新增来源')
  expect(state.context.ui.article.innerHTML).toContain(newDocument.path)
  expect(state.context.ui.article.innerHTML).toContain(newPage.path)
  expect(state.context.documents.size).toBe(1)
  expect(state.context.taskPages.size).toBe(0)
})

it('warns about new search sources without indexing them until the catalog is refreshed', async () => {
  const rows = [
    { path: business.path, sha256: business.sha256, text: '本季度规则' },
    { path: newDocument.path, sha256: newDocument.sha256, text: 'NEWONLY' },
    pairedRow(newPage),
  ]
  const state = reader([business], [], rows)
  await state.actions.renderSearch('NEWONLY', 1)
  expect(state.context.ui.article.innerHTML).toContain('本次目录读取中没有找到')
  expect(state.searches[0].map(item => item.id)).toEqual([business.path])
  expect(state.messages.join(' ')).toContain('新增来源尚未纳入本次目录读取')
  state.context.catalog = { documents: [business, newDocument], task_pages: [newPage] }
  state.context.documents.set(newDocument.path, { ...newDocument })
  state.context.taskPages.set(newPage.path, { ...newPage })
  state.messages.length = 0
  await state.actions.renderSearch('NEWONLY', 1)
  expect(state.context.ui.article.innerHTML).toContain('找到 2 项')
  expect(state.searches[1].map(item => item.id)).toEqual([business.path, newDocument.path, newPage.path])
  expect(state.messages).toEqual([''])
})

it('merges additions with changed and deleted source warnings while excluding stale search content', async () => {
  const deleted = { ...change, path: 'changes/deleted.md' }
  const state = reader([business, change, deleted], [oldPage], [
    { path: business.path, sha256: business.sha256, text: '本季度规则' },
    { path: change.path, sha256: 'changed', text: 'OLDONLY' },
    { path: oldPage.path, kind: 'task-page', error: '配对已更新' },
    { path: newDocument.path, sha256: newDocument.sha256, text: 'OLDONLY' },
  ])
  await state.actions.renderTasks(1)
  for (const path of [change.path, deleted.path, oldPage.path, newDocument.path])
    expect(state.context.ui.article.innerHTML).toContain(path)
  expect(state.messages.join(' ')).toContain('新增来源')
  state.messages.length = 0
  await state.actions.renderSearch('OLDONLY', 1)
  expect(state.searches[0].map(item => item.id)).toEqual([business.path])
  expect(state.context.ui.article.innerHTML).toContain('本次目录读取中没有找到')
  for (const path of [change.path, deleted.path, oldPage.path, newDocument.path])
    expect(state.context.ui.article.innerHTML).toContain(path)
})

it('compares late batches with their captured catalog without clearing a newer pending request', async () => {
  let finishFirst!: (batch: Batch) => void
  let finishSecond!: (batch: Batch) => void
  const firstRows = new Promise<Batch>((resolve) => {
    finishFirst = resolve
  })
  const secondRows = new Promise<Batch>((resolve) => {
    finishSecond = resolve
  })
  const state = reader([business], [], [])
  state.context.fetchResource.mockImplementationOnce(() => firstRows).mockImplementationOnce(() => secondRows)
  const first = state.actions.documentRecords([business], 'all')
  state.context.catalog = { documents: [business, newDocument], task_pages: [] }
  const second = state.actions.documentRecords([business, newDocument], 'all')
  const pendingSecond = state.context.pendingTexts
  const rows = [
    { path: business.path, sha256: business.sha256, text: '业务' },
    { path: newDocument.path, sha256: newDocument.sha256, text: '新变更' },
  ]
  finishFirst({ records: rows, warnings: ['first batch warning'] })
  const firstResult = await first
  expect(firstResult.addedPaths).toEqual([newDocument.path])
  expect(firstResult.warnings).toEqual(['first batch warning'])
  expect(state.context.pendingTexts).toBe(pendingSecond)
  finishSecond({ records: rows, warnings: [] })
  const secondResult = await second
  expect(secondResult.addedPaths).toEqual([])
  expect(secondResult.warnings).toEqual([])
  expect(state.context.pendingTexts).toBeUndefined()
})

it.each(['tasks', 'search'])('ignores a late %s render, including its new-source notice', async (view) => {
  let finish!: (batch: Batch) => void
  const rows = new Promise<Batch>((resolve) => {
    finish = resolve
  })
  const state = reader([business], [], [])
  state.context.fetchResource.mockImplementationOnce(() => rows)
  const render = view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('NEWONLY', 1)
  state.context.renderVersion = 2
  finish({ records: [{ path: newDocument.path, sha256: newDocument.sha256, text: 'NEWONLY' }, pairedRow(newPage)], warnings: ['late batch warning'] })
  await render
  expect(state.context.ui.article.innerHTML).toBe('before')
  expect(state.messages).toEqual([])
  expect(state.searches).toEqual([])
})

it.each(['tasks', 'search'])('updates navigation declarations from the current %s batch without changing healthy targets or the captured navigation', async (view) => {
  const terms = { ...business, path: 'terms.md', title: '门店条款', sha256: 'terms-v1' }
  const hub = { ...business, path: 'hub.md', title: '办理入口', sha256: 'hub-v1', links: [{ kind: 'document', target: terms.path, exists: true }] }
  const original: Navigation[] = [
    { path: business.path, label: '首页', fragment: '', query: '' },
    { path: terms.path, label: '本店即赔办理', fragment: 'fast', query: '' },
    { path: oldPage.path, label: '本店即赔流程', fragment: 'node=fast', query: 'view=detail' },
    { path: hub.path, label: hub.title, fragment: '', query: '' },
  ]
  const navigation = original.map(link => ({ ...link }))
  navigation[1] = { ...navigation[1], label: '本店核验办理', fragment: 'check' }
  navigation[2] = { ...navigation[2], label: '本店核验流程', fragment: 'node=check', query: 'q=check&view=detail' }
  const rows: Row[] = [
    { path: business.path, sha256: 'entry-v2', text: '本次入口已改为核验。' },
    ...[terms, hub, change].map(doc => ({ path: doc.path, sha256: doc.sha256, text: 'CURRENTONLY 仍有效的规则和记录。' })),
    pairedRow(oldPage),
  ]
  const state = reader([business, terms, hub, change], [oldPage], rows, [], [], navigation)
  state.context.catalog.navigation = original.map(link => ({ ...link }))
  const render = () => view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  await render()
  expect(state.context.catalog.readNavigation).toEqual(navigation)
  expect(state.context.catalog.navigation).toEqual(original)
  expect(state.context.documents.get(terms.path)?.readError).toBe('')
  expect(state.context.documents.get(hub.path)?.readError).toBe('')
  expect(state.context.taskPages.get(oldPage.path)?.readError).toBe('')
  expect(state.actions.sourceUrl(terms.path)).toBe(`/content/${terms.path}?sha256=${terms.sha256}`)
  navigation.splice(0, navigation.length, ...original.map(link => ({ ...link })))
  rows[0] = { path: business.path, sha256: business.sha256, text: 'CURRENTONLY 恢复后的入口。' }
  await render()
  expect(state.context.catalog.readNavigation).toEqual(original)
  expect(state.context.catalog.navigation).toEqual(original)
  expect(state.context.documents.get(business.path)?.readError).toBe('')
  expect(state.context.documentText).not.toHaveBeenCalled()
  expect(state.context.fetchResource).toHaveBeenCalledTimes(2)
})

it.each(['tasks', 'search'])('ignores navigation declarations in a late %s batch', async (view) => {
  let finish!: (batch: Batch) => void
  const pending = new Promise<Batch>((resolve) => {
    finish = resolve
  })
  const original = [{ path: business.path, label: '仍有效的首页', fragment: '', query: '' }]
  const state = reader([business], [], [])
  state.context.catalog.navigation = original.map(link => ({ ...link }))
  state.context.catalog.readNavigation = original.map(link => ({ ...link }))
  state.context.fetchResource.mockImplementationOnce(() => pending)
  const render = view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  state.context.renderVersion = 2
  finish({ records: [{ path: business.path, sha256: business.sha256, text: 'CURRENTONLY' }], warnings: [], navigation: [{ path: business.path, label: '迟到的旧入口', fragment: 'stale', query: '' }] })
  await render
  expect(state.context.catalog.navigation).toEqual(original)
  expect(state.context.catalog.readNavigation).toEqual(original)
  expect(state.context.renderNavigation).not.toHaveBeenCalled()
})

it.each([
  { view: 'tasks', status: 404 },
  { view: 'tasks', status: 415 },
  { view: 'search', status: 404 },
  { view: 'search', status: 415 },
])('invalidates unverified catalog metadata after a $view catalog-stage $status and restores checked sources', async ({ view, status }) => {
  const navigation = [{ path: business.path, label: '现行入口', fragment: '', query: '' }]
  const rows: Row[] = [
    { path: business.path, sha256: business.sha256, text: 'CURRENTONLY 业务规则。' },
    { path: change.path, sha256: change.sha256, text: 'CURRENTONLY 变更记录。' },
    pairedRow(oldPage),
  ]
  const state = reader([business, change], [oldPage], rows, [], [{ path: 'receipt.txt', sha256: 'receipt-v1' }], navigation)
  state.context.catalog.entry = business.path
  state.context.catalog.navigation = navigation.map(link => ({ ...link }))
  state.context.sources.set('receipt.txt', { sha256: 'receipt-v1' })
  state.context.ui.context.innerHTML = '<a href="old-recommendation">旧推荐</a>'
  Object.assign(state.context.ui.context, { reading: { doc: state.context.documents.get(business.path), toc: [] } })
  const error = Object.assign(new Error('业务目录来源无法读取'), { status, error_stage: 'catalog', error_source: business.path, readCurrent: undefined as (() => boolean) | undefined })
  state.context.fetchResource.mockRejectedValueOnce(error)
  const render = () => view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  await expect(render()).rejects.toBe(error)
  for (const metadata of [...state.context.documents.values(), ...state.context.sources.values(), ...state.context.taskPages.values()]) {
    expect(metadata.readUnchecked).toBe(true)
    expect(metadata.readChanged).toBe(false)
    expect(metadata.readStatus).toBeUndefined()
    expect(metadata.readScopeLimited).toBe(false)
    expect(metadata.readError).toContain(business.path)
    expect(metadata.readError).toContain('刷新')
  }
  expect(error.status).toBe(status)
  expect(error.readCurrent?.()).toBe(true)
  expect(state.context.catalog.readNavigation).toEqual([])
  expect(state.context.catalog.navigation).toEqual(navigation)
  expect(state.context.ui.context.innerHTML).toBe('')
  expect(state.context.ui.context.hidden).toBe(true)
  expect(state.context.refreshReadLinks).toHaveBeenCalledOnce()
  expect(state.messages.at(-1)).toContain(business.path)
  await render()
  for (const metadata of [...state.context.documents.values(), ...state.context.sources.values(), ...state.context.taskPages.values()]) {
    expect(metadata.readError).toBe('')
    expect(metadata.readUnchecked).toBe(false)
    expect(metadata.readStatus).toBeUndefined()
  }
  expect(state.context.catalog.readNavigation).toEqual(navigation)
  expect(error.readCurrent?.()).toBe(false)
  expect(state.actions.sourceUrl('receipt.txt')).toBe('/content/receipt.txt?sha256=receipt-v1')
})

it.each([
  { view: 'tasks', owner: 'route' },
  { view: 'search', owner: 'route' },
  { view: 'tasks', owner: 'catalog' },
  { view: 'search', owner: 'catalog' },
])('ignores an obsolete $view catalog failure after its $owner owner changes', async ({ view, owner }) => {
  let reject!: (error: Error) => void
  const pending = new Promise<Batch>((_resolve, fail) => {
    reject = fail
  })
  const state = reader([business, change], [oldPage], [])
  const navigation = [{ path: business.path, label: '有效目录', fragment: '', query: '' }]
  state.context.catalog.navigation = navigation
  state.context.catalog.readNavigation = navigation
  state.context.fetchResource.mockImplementationOnce(() => pending)
  const rendering = view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  if (owner === 'route') {
    state.context.currentPath = 'another.md'
    state.context.renderVersion++
    runInNewContext('readPageScope()', state.context)
  }
  else {
    state.context.catalog = { ...state.context.catalog }
  }
  const error = Object.assign(new Error('迟到的目录失败'), { status: 404, error_stage: 'catalog', error_source: business.path })
  reject(error)
  await expect(rendering).rejects.toBe(error)
  expect(state.context.catalog.readNavigation).toBe(navigation)
  expect(state.context.documents.get(business.path)?.readError).toBeUndefined()
  expect(state.context.taskPages.get(oldPage.path)?.readError).toBeUndefined()
  expect(state.context.renderNavigation).not.toHaveBeenCalled()
  expect(state.context.refreshReadLinks).not.toHaveBeenCalled()
  expect(state.messages).toEqual([])
})

it.each(['tasks', 'search'])('does not let an older successful %s batch clear a newer single-read catalog failure', async (view) => {
  let finish!: (batch: Batch) => void
  const pending = new Promise<Batch>((resolve) => {
    finish = resolve
  })
  const navigation = [{ path: business.path, label: '旧目录', fragment: '', query: '' }]
  const rows: Row[] = [
    { path: business.path, sha256: business.sha256, text: 'CURRENTONLY 业务。' },
    { path: change.path, sha256: change.sha256, text: 'CURRENTONLY 记录。' },
    pairedRow(oldPage),
  ]
  const checks = [{ path: 'receipt.txt', sha256: 'receipt-v1' }]
  const state = reader([business, change], [oldPage], rows, [], checks, navigation)
  state.context.catalog.entry = business.path
  state.context.catalog.navigation = navigation
  state.context.sources.set('receipt.txt', { sha256: 'receipt-v1' })
  state.context.fetchResource.mockImplementationOnce(() => pending)
  const oldBatch = view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  const error = Object.assign(new Error('新读取发现目录入口缺失'), { status: 404, error_stage: 'catalog', error_source: business.path })
  state.context.fetchResource.mockRejectedValueOnce(error)
  const readSource = runInNewContext('readSource', state.context) as (path: string, url: string, current: () => boolean) => Promise<string | undefined>
  await expect(readSource('receipt.txt', '/content/receipt.txt?sha256=receipt-v1', () => true)).rejects.toBe(error)
  expect(state.context.sources.get('receipt.txt')?.readUnchecked).toBe(true)
  finish({ records: rows, source_checks: checks, warnings: [], navigation })
  await oldBatch
  expect(state.context.sources.get('receipt.txt')?.readUnchecked).toBe(true)
  expect(state.context.catalog.readNavigation).toEqual([])
  expect(() => state.actions.sourceUrl('receipt.txt')).toThrow(business.path)
  await (view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1))
  expect(state.context.sources.get('receipt.txt')?.readError).toBe('')
  expect(state.context.catalog.readNavigation).toEqual(navigation)
})

it.each(['tasks', 'search'])('accepts a %s catalog failure without treating one later paired-source success as a directory check', async (view) => {
  const navigation = [{ path: business.path, label: '旧入口', fragment: '', query: '' }]
  const state = reader([business, change], [oldPage, newPage], [], [], [], navigation)
  state.context.catalog.entry = business.path
  state.context.catalog.navigation = navigation
  state.context.catalog.readNavigation = navigation
  let fail!: (error: Error) => void
  state.context.fetchResource.mockImplementationOnce(() => new Promise<Batch>((_resolve, reject) => {
    fail = reject
  }))
  const batch = view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  state.context.fetchResource.mockResolvedValueOnce('verified paired source')
  const readSource = runInNewContext('readSource', state.context) as (path: string, url: string, current: () => boolean) => Promise<string | undefined>
  await expect(readSource(oldPage.model_path, '/paired/model', () => true)).resolves.toBe('verified paired source')
  const error = Object.assign(new Error('旧批次读取时入口缺失'), { status: 404, error_stage: 'catalog', error_source: business.path, readCurrent: undefined as (() => boolean) | undefined })
  fail(error)
  await expect(batch).rejects.toBe(error)
  expect(error.readCurrent?.()).toBe(true)
  expect(state.context.catalog.readNavigation).toEqual([])
  expect(state.context.documents.get(business.path)?.readUnchecked).toBe(true)
  expect(state.context.taskPages.get(newPage.path)?.readUnchecked).toBe(true)
  expect(state.context.taskPages.get(oldPage.path)?.readError).toBeUndefined()
  expect(state.actions.sourceUrl(oldPage.model_path)).toContain('/task-page/html-v1/model-v1/')
  expect(() => state.actions.sourceUrl(newPage.model_path)).toThrow(business.path)
})

it.each([
  { view: 'tasks', failure: 'before' },
  { view: 'tasks', failure: 'after' },
  { view: 'search', failure: 'before' },
  { view: 'search', failure: 'after' },
])('keeps the later-issued $view batch current when an older catalog failure arrives $failure its acceptance', async ({ view, failure }) => {
  const navigation = [{ path: business.path, label: '当前入口', fragment: '', query: '' }]
  const rows: Row[] = [
    { path: business.path, sha256: business.sha256, text: 'CURRENTONLY 业务。' },
    { path: change.path, sha256: change.sha256, text: 'CURRENTONLY 记录。' },
    pairedRow(oldPage),
  ]
  const checks = [{ path: 'receipt.txt', sha256: 'receipt-v1' }]
  const state = reader([business, change], [oldPage], rows, [], checks, navigation)
  state.context.catalog.entry = business.path
  state.context.catalog.navigation = navigation
  state.context.sources.set('receipt.txt', { sha256: 'receipt-v1' })
  let fail!: (error: Error) => void
  let finish!: (batch: Batch) => void
  const oldResult = new Promise<Batch>((_resolve, reject) => {
    fail = reject
  })
  const laterResult = new Promise<Batch>((resolve) => {
    finish = resolve
  })
  state.context.fetchResource.mockReturnValueOnce(oldResult).mockReturnValueOnce(laterResult)
  const readSource = runInNewContext('readSource', state.context) as (path: string, url: string, current: () => boolean) => Promise<string | undefined>
  const oldRead = readSource('receipt.txt', '/content/receipt.txt?sha256=receipt-v1', () => true)
  const laterBatch = view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  const error = Object.assign(new Error('早先读取时目录入口缺失'), { status: 404, error_stage: 'catalog', error_source: business.path })
  if (failure === 'before') {
    fail(error)
    await expect(oldRead).rejects.toBe(error)
    expect(state.context.sources.get('receipt.txt')?.readUnchecked).toBe(true)
    expect(state.context.catalog.readNavigation).toEqual([])
  }
  finish({ records: rows, source_checks: checks, warnings: [], navigation })
  await laterBatch
  if (failure === 'after') {
    fail(error)
    await expect(oldRead).resolves.toBeUndefined()
  }
  expect(state.context.sources.get('receipt.txt')?.readError).toBe('')
  expect(state.context.documents.get(business.path)?.readError).toBe('')
  expect(state.context.taskPages.get(oldPage.path)?.readError).toBe('')
  expect(state.context.catalog.readNavigation).toEqual(navigation)
  expect(state.actions.sourceUrl('receipt.txt')).toBe('/content/receipt.txt?sha256=receipt-v1')
})

it.each(['markdown', 'source', 'task-page', 'model'])('uses the current batch diagnosis for a cold %s reference instead of its captured error', async (kind) => {
  const paired = kind === 'task-page' || kind === 'model'
  const target = kind === 'markdown' ? 'cold.md' : kind === 'source' ? 'evidence.txt' : kind === 'model' ? 'cold/model.json' : 'cold/handbook.html'
  const link = { target, kind: kind === 'markdown' ? 'document' : kind === 'task-page' ? 'task-page' : 'source', exists: false, error: 'OLD404 原错误', status: 404 }
  const parent = { ...business, links: [link, { target: 'valid.txt', kind: 'source', exists: true }] }
  const rows: Row[] = [{ path: parent.path, sha256: parent.sha256, text: 'CURRENTONLY 健康父页业务正文。' }]
  const checks: SourceCheck[] = [{ path: 'valid.txt', sha256: 'valid-v1' }]
  const state = reader([parent], [], rows, [], checks, [{ path: target, label: '原作者仍声明' }])
  state.context.sources.set('valid.txt', { sha256: 'valid-v1' })
  if (paired) {
    Object.assign(state.context.catalog, {
      task_errors: { 'cold/handbook.html': link.error, 'cold/model.json': link.error },
      task_error_statuses: { 'cold/handbook.html': 404, 'cold/model.json': 404 },
      task_scope_limited: [],
    })
    rows.push({ kind: 'task-page', path: 'cold/handbook.html', error: 'CURRENT415 本批配对不可读', status: 415 })
  }
  else if (kind === 'markdown') {
    Object.assign(state.context.catalog, { document_errors: { [target]: { error: link.error, status: 404 } } })
    rows.push({ path: target, error: 'CURRENT415 本批 Markdown 不可读', status: 415 })
  }
  else {
    checks.push({ path: target, error: 'CURRENT415 本批来源不可读', status: 415 })
  }
  const inspect = async () => {
    await state.actions.renderSearch('CURRENTONLY', 1)
    await state.actions.renderPage({ path: parent.path }, 1)
    expect(state.context.ui.article.innerHTML).toContain('健康父页业务正文')
    expect(state.context.ui.context.innerHTML).toContain('data-source="valid.txt"')
    expect(state.context.documents.size).toBe(1)
    expect(state.context.sources.size).toBe(1)
    expect(state.context.taskPages.size).toBe(0)
    const resolved = state.actions.resolveLink(target, parent)
    const reason = state.actions.unavailableReason(resolved)
    expect(state.context.ui.context.innerHTML).toContain(`data-reason="${reason}"`)
    expect(state.context.ui.context.innerHTML).not.toContain('OLD404')
    expect(() => state.actions.sourceUrl(target)).toThrow(reason)
    return { resolved, reason }
  }
  const failed = await inspect()
  expect(failed.resolved.status).toBe(415)
  expect(failed.reason).toContain('CURRENT415')
  if (paired)
    rows[1] = { kind: 'task-page', path: 'cold/handbook.html', sha256: 'html-v2', model_sha256: 'model-v2' }
  else if (kind === 'markdown')
    rows[1] = { path: target, sha256: 'cold-v2', text: '已读到的新规则。' }
  else
    checks[1] = { path: target, sha256: 'evidence-v2' }
  const pending = await inspect()
  expect(pending.resolved.unchecked).toBe(true)
  expect(pending.reason).toContain('本批已读到')
  expect(pending.reason).toContain('刷新')
  expect(pending.reason).not.toContain('CURRENT415')
  rows.splice(1)
  checks.splice(1)
  const absent = await inspect()
  expect(absent.resolved.unchecked).toBe(true)
  expect(absent.reason).toContain('本批未读到')
  expect(absent.reason).not.toContain('修复或恢复')
})

it('does not suggest switching to unverified documents on a catalog failure page', () => {
  const state = reader([business], [], [])
  const header = vi.fn()
  state.context.setHeader = header
  Object.assign(state.context.ui['phase-filter'], { replaceChildren: vi.fn() })
  const code = source.slice(source.indexOf('  function showReadFailure('), source.indexOf('  async function refresh('))
  const showReadFailure = runInNewContext(`${code}\nshowReadFailure`, state.context) as (path: string, message: string) => void
  Object.assign(state.context.catalog, { readFailure: { error: '目录入口丢失', unchecked: true } })
  showReadFailure(business.path, '请恢复目录入口。')
  expect(header.mock.calls.at(-1)?.[0].description).toContain('目录来源')
  expect(header.mock.calls.at(-1)?.[0].description).not.toMatch(/选择|切换/)
  expect(state.context.ui.article.innerHTML).not.toMatch(/选择其他|选择可用|从左侧/)
  expect(state.context.ui.article.innerHTML).toContain('刷新内容')
  Object.assign(state.context.catalog, { readFailure: undefined })
  showReadFailure(business.path, '仅本文件丢失。')
  expect(header.mock.calls.at(-1)?.[0].description).toContain('从目录选择可用文档')
  expect(state.context.ui.article.innerHTML).toContain('从左侧选择其他文档')
})

it.each(['tasks', 'search'])('shows only the current %s batch warnings in a reopened business context and honors an empty batch', async (view) => {
  const warnings = ['CURRENT415 本次来源不是 UTF-8 文本']
  const rows = [business, change].map(doc => ({ path: doc.path, sha256: doc.sha256, text: 'CURRENTONLY 健康正文。' }))
  const state = reader([business, change], [], rows, warnings)
  state.context.catalog.warnings = ['OLD404 初次目录中文件不存在']
  const render = () => view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  await render()
  await state.actions.renderPage({ path: business.path }, 1)
  expect(state.context.ui.context.innerHTML).toContain('CURRENT415')
  expect(state.context.ui.context.innerHTML).not.toContain('OLD404')
  warnings.splice(0)
  await render()
  await state.actions.renderPage({ path: business.path }, 1)
  expect(state.context.ui.context.innerHTML).not.toContain('CURRENT415')
  expect(state.context.ui.context.innerHTML).not.toContain('OLD404')
  expect(state.context.ui.context.innerHTML).not.toContain('条需要留意的来源')
  expect(state.context.catalog.warnings).toEqual(['OLD404 初次目录中文件不存在'])
})

it.each([
  { entry: true, status: 409 },
  { entry: true, status: 404 },
  { entry: true, status: undefined },
  { entry: false, status: 409 },
  { entry: false, status: 404 },
  { entry: false, status: undefined },
])('records a single document failure and recovers only through checked metadata entry=$entry status=$status', async ({ entry, status }) => {
  const terms = { ...business, path: 'terms.md', title: '门店条款', sha256: 'terms-v1', links: [{ target: oldPage.path, kind: 'task-page', exists: true }] }
  const hub = { ...business, path: 'hub.md', title: '独立入口', sha256: 'hub-v1' }
  const task = { ...change, links: [{ target: terms.path, kind: 'document', exists: true }] }
  const navigation = [
    { path: business.path, label: business.title, fragment: '', query: '' },
    { path: terms.path, label: '本店即赔', fragment: 'fast', query: '' },
    { path: oldPage.path, label: '办理流程', fragment: 'node=fast', query: 'view=detail' },
    { path: hub.path, label: hub.title, fragment: '', query: '' },
  ]
  const rows: Row[] = [
    ...[business, terms, hub, task].map(doc => ({ path: doc.path, sha256: doc.sha256, text: 'CURRENTONLY 仍有效的正文。' })),
    pairedRow(oldPage),
  ]
  const state = reader([business, terms, hub, task], [oldPage], rows, [], [], navigation)
  state.context.catalog.entry = business.path
  state.context.catalog.navigation = navigation.map(link => ({ ...link }))
  state.context.sources.set('valid.txt', { sha256: 'valid-v1' })
  state.context.documentText = runInNewContext(`${documentTextCode}\ndocumentText`, state.context)
  const path = entry ? business.path : terms.path
  const error = Object.assign(new Error('单次读取发现来源不可确认'), { status })
  state.context.fetchResource.mockRejectedValueOnce(error)
  await expect(state.actions.renderPage({ path }, 1)).rejects.toBe(error)
  const metadata = state.context.documents.get(path)!
  expect(metadata.readError).toBeTruthy()
  expect(metadata.readStatus).toBe(status)
  expect(metadata.readChanged).toBe(status === 409)
  expect(metadata.readUnchecked).toBe(status === undefined)
  expect(state.context.catalog.readNavigation).toEqual(entry ? [] : undefined)
  expect(state.context.documents.get(hub.path)?.readError).not.toBeTruthy()
  expect(state.context.taskPages.get(oldPage.path)?.readError).not.toBeTruthy()
  expect(state.actions.sourceUrl('valid.txt')).toBe('/content/valid.txt?sha256=valid-v1')
  const disabled = state.actions.navLink(metadata)
  expect(disabled).toContain('unavailable-link')
  expect(disabled).not.toContain('href=')
  if (!entry) {
    expect(state.actions.cardRelated(task, '相关文档', 'document')).not.toContain(terms.path)
    expect(state.actions.originalTaskRelated(metadata)).toBe('')
  }
  const previous = { ...metadata }
  await expect(state.actions.renderPage({ path }, 1)).rejects.toThrow()
  expect(metadata).toEqual(previous)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(1)
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(metadata.readError).toBe('')
  expect(metadata.readStatus).toBeUndefined()
  expect(metadata.readChanged).toBe(false)
  expect(metadata.readUnchecked).toBe(false)
  expect(state.context.catalog.readNavigation).toEqual(navigation)
  expect(state.actions.sourceUrl(path)).toBe(`/content/${path}?sha256=${metadata.sha256}`)
})

it.each(['tasks', 'search'])('shows catalog source failures in %s and clears them after source recovery and refresh', async (view) => {
  const documents = view === 'tasks' ? [business] : [business, change]
  const rows: Row[] = documents.map(doc => ({
    path: doc.path,
    sha256: doc.sha256,
    text: doc.kind === 'document' ? 'CURRENTONLY 本季度规则' : '可读的变更记录',
  }))
  const warnings = [`${oldPage.path} → 原任务的 model.json 不存在：${oldPage.model_path}`]
  const state = reader(documents, [], rows, warnings)
  state.context.catalog.warnings = [...warnings]
  if (view === 'tasks') {
    await state.actions.renderTasks(1)
    expect(state.context.ui.article.innerHTML).toContain('本次目录读取未收录')
    expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${oldPage.path}`)
  }
  else {
    await state.actions.renderSearch(oldPage.title, 1)
    expect(state.context.ui.article.innerHTML).toContain('本次目录读取中没有找到')
    expect(state.searches[0].map(item => item.id)).toEqual([business.path, change.path])
    await state.actions.renderSearch('CURRENTONLY', 1)
    expect(state.context.ui.article.innerHTML).toContain('找到 1 项')
  }
  expect(state.context.ui.article.innerHTML).toContain(oldPage.model_path)
  expect(state.context.ui.article.innerHTML).toContain('不存在')
  expect(state.messages.join(' ')).toContain('按具体原因处理后重新读取')
  state.context.catalog = { ...state.context.catalog, task_pages: [oldPage], warnings: [] }
  state.context.taskPages.set(oldPage.path, { ...oldPage })
  rows.push(pairedRow(oldPage))
  warnings.length = 0
  state.messages.length = 0
  if (view === 'tasks') {
    await state.actions.renderTasks(1)
    expect(state.context.ui.article.innerHTML).toContain(oldPage.path)
  }
  else {
    await state.actions.renderSearch(oldPage.title, 1)
    expect(state.context.ui.article.innerHTML).toContain('找到 1 项')
    expect(state.searches.at(-1)?.map(item => item.id)).toEqual([business.path, change.path, oldPage.path])
  }
  expect(state.messages).toEqual([''])
})

it.each(['tasks', 'search'])('uses current batch warnings for a newly broken pair in %s without a catalog refresh', async (view) => {
  const rows: Row[] = [{ path: business.path, sha256: business.sha256, text: '本季度规则' }]
  const warnings = [`${newPage.path} → 缺少模型：${newPage.model_path}`]
  const state = reader([business], [], rows, warnings)
  state.context.catalog.warnings = ['obsolete catalog failure']
  const render = () => view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch(newPage.title, 1)
  await render()
  expect(state.context.ui.article.innerHTML).toContain(newPage.model_path)
  expect(state.context.ui.article.innerHTML).toContain('缺少模型')
  expect(state.context.ui.article.innerHTML).not.toContain('obsolete catalog failure')
  expect(state.context.taskPages.size).toBe(0)
  warnings.length = 0
  await render()
  expect(state.messages.at(-1)).toBe('')
  rows.push(pairedRow(newPage))
  await render()
  expect(state.messages.at(-1)).toContain('新增来源尚未纳入本次目录读取')
  expect(state.context.ui.article.innerHTML).not.toContain(newPage.model_path)
  expect(state.context.ui.article.innerHTML).not.toContain('缺少模型')
  expect(state.context.ui.article.innerHTML).not.toContain('obsolete catalog failure')
  state.context.catalog = { documents: [...state.context.documents.values()], task_pages: [newPage], warnings: [] }
  state.context.taskPages.set(newPage.path, { ...newPage })
  await render()
  expect(state.messages.at(-1)).toBe('')
  if (view === 'search')
    expect(state.context.ui.article.innerHTML).toContain('找到 1 项')
  else
    expect(state.context.ui.article.innerHTML).toContain(newPage.path)
})

it.each([
  ['model', 'deleted'],
  ['model', 'changed-model'],
  ['model', 'changed-html'],
  ['page', 'deleted'],
  ['page', 'changed-model'],
  ['page', 'changed-html'],
  ['markdown', 'deleted'],
  ['markdown', 'changed'],
])('removes already-invalid %s associations after a %s batch result and restores only the verified version', async (reference, failure) => {
  const link: Link = reference === 'markdown'
    ? { target: change.path, kind: 'document', exists: true }
    : { target: reference === 'model' ? oldPage.model_path : oldPage.path, kind: reference === 'model' ? 'source' : 'task-page', exists: true }
  const guide = { ...business, links: [link] }
  const rows: Row[] = [
    { path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY 保修凭单' },
    { path: change.path, sha256: change.sha256, text: '可读记录' },
    pairedRow(oldPage),
  ]
  const state = reader([guide, change], [oldPage], rows)
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.context.ui.article.innerHTML).toContain('找到 1 项')
  expect(state.context.ui.article.innerHTML).toContain(`href="#page=${reference === 'markdown' ? change.path : oldPage.path}`)
  const invalidPath = reference === 'markdown' ? change.path : oldPage.path
  const index = rows.findIndex(row => row.path === invalidPath)
  if (failure === 'deleted')
    rows.splice(index, 1)
  else if (reference === 'markdown')
    rows[index] = { ...rows[index], sha256: 'different-md' }
  else
    rows[index] = { ...rows[index], [failure === 'changed-model' ? 'model_sha256' : 'sha256']: 'different-pair' }
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.context.ui.article.innerHTML).toContain('找到 1 项')
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${invalidPath}`)
  expect(state.context.ui.article.innerHTML).toContain(invalidPath)
  await state.actions.renderTasks(1)
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${invalidPath}`)
  expect(state.context.ui.article.innerHTML).toContain('unavailable-link')
  if (reference !== 'markdown') {
    expect(state.context.ui.article.innerHTML).not.toContain(`data-source="${oldPage.model_path}"`)
    expect(() => state.actions.sourceUrl(oldPage.model_path)).toThrow(failure === 'deleted' ? '本批未读到' : '来源已更新')
  }
  const invalidIndex = rows.findIndex(row => row.path === invalidPath)
  if (invalidIndex >= 0)
    rows.splice(invalidIndex, 1)
  rows.push(reference === 'markdown' ? { path: change.path, sha256: change.sha256, text: '可读记录' } : pairedRow(oldPage))
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.context.ui.article.innerHTML).toContain(`href="#page=${invalidPath}`)
  if (reference !== 'markdown')
    expect(state.actions.sourceUrl(oldPage.model_path)).toContain('/task-page/html-v1/model-v1/')
})

it('marks missing business metadata in a complete tasks batch as unchecked without claiming a file failure', async () => {
  const record = { ...change, links: [{ target: business.path, kind: 'document', exists: true }] }
  const rows = [{ path: record.path, sha256: record.sha256, text: '可读记录' }]
  const state = reader([business, record], [], rows)
  await state.actions.renderTasks(1)
  expect(state.context.documents.get(business.path)?.readError).toContain('本批未读到')
  expect(state.context.documents.get(business.path)?.readUnchecked).toBe(true)
  expect(state.context.documents.get(business.path)?.readChanged).toBe(false)
  expect(state.context.documents.get(business.path)?.readStatus).toBeUndefined()
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${business.path}`)
  expect(() => state.actions.sourceUrl(business.path)).toThrow('本批未读到')
  expect(state.messages.at(-1)).toBe('')
})

it.each(['missing', 'changed'])('distinguishes a %s batch row from a confirmed file failure', async (result) => {
  const rows: Row[] = [{ path: business.path, sha256: business.sha256, text: 'CURRENTONLY' }]
  if (result === 'changed') {
    rows.push({ path: change.path, sha256: 'change-v2', text: '新版变更' })
    rows.push({ ...pairedRow(oldPage), model_sha256: 'model-v2' })
  }
  const state = reader([business, change], [oldPage], rows)
  await state.actions.renderSearch('CURRENTONLY', 1)
  for (const target of [change.path, oldPage.path]) {
    const metadata = state.context.documents.get(target) || state.context.taskPages.get(target)
    const error = metadata?.readError || ''
    expect(error).toContain(result === 'missing' ? '本批未读到' : '已更新')
    expect(error).not.toMatch(/已移除|已删除/)
    expect(metadata?.readUnchecked).toBe(result === 'missing')
    let message = ''
    try {
      await state.actions.renderPage({ path: target }, 1)
    }
    catch (failure) {
      message = (failure as Error).message
    }
    if (result === 'missing') {
      expect(message).toContain(error)
      expect(message).toContain('刷新内容')
      expect(message).not.toContain('修复或恢复')
    }
    else {
      expect(message).toContain(`来源已更新：${target}`)
      expect(message).toContain('刷新内容后核对新版')
      expect(message).not.toContain('修复或恢复')
    }
  }
  expect(state.context.sources.get(oldPage.model_path)?.readUnchecked).toBe(result === 'missing')
  rows.push({ path: change.path, sha256: change.sha256, text: '可读记录' }, pairedRow(oldPage))
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.context.documents.get(change.path)?.readUnchecked).toBe(false)
  expect(state.context.taskPages.get(oldPage.path)?.readUnchecked).toBe(false)
  expect(state.context.sources.get(oldPage.model_path)?.readUnchecked).toBe(false)
})

it.each(['tasks', 'search'])('summarizes a shifted 500-document batch in %s while retaining every detail behind a closed disclosure', async (view) => {
  const docs = Array.from({ length: 500 }, (_, index) => ({ ...change, path: `changes/old-${String(index).padStart(3, '0')}.md` }))
  const additions = Array.from({ length: 152 }, (_, index) => ({ ...newDocument, path: `changes/early-${String(index).padStart(3, '0')}.md` }))
  const current = [...additions, ...docs.slice(0, 348)]
  const rows: Row[] = current.map(doc => ({ path: doc.path, sha256: doc.sha256, text: '现行依据' }))
  const warning = '文档收录上限为 500 份，本次 304 个 Markdown 来源目标未收录；请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器'
  const warnings = [warning]
  const state = reader(docs, [], rows, warnings)
  const render = () => view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('NO_MATCH', 1)
  await render()
  const message = state.messages.at(-1)!
  expect(message.length).toBeLessThan(240)
  expect(message).toContain('本批未读到 152 项')
  expect(message).toContain('新增来源尚未纳入本次目录读取：152 项')
  expect(message).toContain('1 条来源提示')
  expect(message).not.toContain('old-')
  expect(message).not.toContain('early-')
  expect(message).not.toMatch(/已变化|已移除|已删除/)
  const details = state.context.ui.article.innerHTML.match(/<details[^>]*>[\s\S]*?<\/details>/)?.[0] || ''
  expect(details).toContain('读取明细')
  expect(details.match(/^<details[^>]*>/)?.[0]).not.toContain(' open')
  expect(details).toContain(warning)
  for (const doc of [...docs.slice(348), ...additions])
    expect(details).toContain(doc.path)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(1)
  rows.splice(0, rows.length, ...docs.map(doc => ({ path: doc.path, sha256: doc.sha256, text: '现行依据' })))
  warnings.length = 0
  await render()
  expect(state.messages.at(-1)).toBe('')
  expect(state.context.ui.article.innerHTML).not.toContain('读取明细')
})

it('escapes warning details rather than rendering source text as controls', async () => {
  const warning = '<img src=x onerror=alert(1)> → 来源无法读取'
  const state = reader([business], [], [], [warning])
  state.context.escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  await state.actions.renderTasks(1)
  expect(state.messages.at(-1)).toContain('1 条来源提示')
  expect(state.context.ui.article.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;')
  expect(state.context.ui.article.innerHTML).not.toContain('<img')
})

it.each(['tasks', 'search'])('keeps global capacity recovery neutral in %s without guessing warning text', async (view) => {
  const capacity = '文档收录上限为 500 份，本次 152 个 Markdown 来源目标未收录；请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器'
  const warnings = [capacity, 'manual/report.txt → 来源不是 UTF-8 文本']
  const rows = [{ path: business.path, sha256: business.sha256, text: 'CURRENTONLY' }]
  const state = reader([business], [], rows, warnings)
  const render = () => view === 'tasks' ? state.actions.renderTasks(1) : state.actions.renderSearch('CURRENTONLY', 1)
  await render()
  expect(state.context.ui.article.innerHTML).toContain(capacity)
  expect(state.context.ui.article.innerHTML).toContain('manual/report.txt')
  expect(state.messages.at(-1)).not.toContain('修复或恢复来源')
  warnings.pop()
  await render()
  expect(state.context.ui.article.innerHTML).toContain(capacity)
  expect(state.context.ui.article.innerHTML).not.toContain('manual/report.txt')
})

it.each([
  ['model', 'deleted'],
  ['model', 'changed'],
  ['page', 'deleted'],
  ['page', 'changed'],
  ['markdown', 'deleted'],
  ['markdown', 'changed'],
])('keeps the healthy parent and attachment readable when its %s reference was %s, including restoration', async (reference, failure) => {
  const peer = { ...change, kind: 'document' }
  const target = reference === 'markdown' ? peer.path : reference === 'model' ? oldPage.model_path : oldPage.path
  const guide = { ...business, links: [
    { target, kind: reference === 'markdown' ? 'document' : reference === 'model' ? 'source' : 'task-page', exists: true },
    { target: 'rule.txt', kind: 'source', exists: true },
  ] }
  const body = { path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY 现行七天，依据仍有效。' }
  const healthy: Row = reference === 'markdown' ? { path: peer.path, sha256: peer.sha256, text: '依据正文' } : pairedRow(oldPage)
  const rows = [body, healthy]
  const state = reader([guide, peer], [oldPage], rows)
  state.context.sources.set('rule.txt', { sha256: 'rule-v1' })
  if (failure === 'deleted')
    rows.pop()
  else
    rows[1] = { ...healthy, [reference === 'model' ? 'model_sha256' : 'sha256']: 'changed' }
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.context.ui.article.innerHTML).toContain('找到 1 项')
  await expect(state.actions.renderPage({ path: guide.path }, 1)).resolves.toBeUndefined()
  expect(state.context.ui.article.innerHTML).toContain('现行七天')
  expect(state.context.ui.context.innerHTML).toContain('unavailable-link')
  expect(state.context.ui.context.innerHTML).not.toContain(`href="#page=${target}`)
  expect(state.context.ui.context.innerHTML).not.toContain(`data-source="${target}"`)
  expect(state.context.ui.context.innerHTML).toContain('/content/rule.txt?sha256=rule-v1')
  expect(state.context.ui.context.innerHTML).not.toContain('修复或恢复')
  expect(state.context.ui.context.innerHTML).not.toContain('。。')
  expect(state.context.documentText).toHaveBeenCalledTimes(1)
  expect(state.context.documentText.mock.calls[0][0].path).toBe(guide.path)
  expect(state.context.fetchResource).toHaveBeenCalledTimes(1)
  rows.splice(1, rows.length - 1, healthy)
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.article.innerHTML).toContain('现行七天')
  expect(state.context.ui.context.innerHTML).toContain(reference === 'model' ? `data-source="${target}"` : `href="#page=${target}`)
  expect(state.context.ui.context.innerHTML).toContain('/content/rule.txt?sha256=rule-v1')
})

it('clears confirmed-change recovery when the next batch is unknown, actually failed or healthy', async () => {
  const rows: Row[] = [
    { path: business.path, sha256: business.sha256, text: 'CURRENTONLY' },
    { path: change.path, sha256: 'change-v2', text: '新版' },
    { ...pairedRow(oldPage), model_sha256: 'model-v2' },
  ]
  const state = reader([business, change], [oldPage], rows)
  const metadata = () => [state.context.documents.get(change.path)!, state.context.taskPages.get(oldPage.path)!, state.context.sources.get(oldPage.path)!, state.context.sources.get(oldPage.model_path)!]
  const sourceError = () => {
    try {
      state.actions.sourceUrl(oldPage.model_path)
    }
    catch (error) {
      return (error as Error).message
    }
    return ''
  }
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(metadata().every(item => item.readChanged && !item.readUnchecked)).toBe(true)
  expect(sourceError()).toContain('刷新内容后核对新版')
  expect(sourceError()).not.toContain('修复或恢复')
  rows.splice(1)
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(metadata().every(item => !item.readChanged && item.readUnchecked)).toBe(true)
  expect(sourceError()).toContain('本批未读到')
  expect(sourceError()).not.toContain('修复或恢复')
  rows.push({ path: change.path, error: '来源不是 UTF-8 文本' }, { kind: 'task-page', path: oldPage.path, error: '来源不存在或不是文件：old/model.json' })
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(metadata().every(item => !item.readChanged && !item.readUnchecked)).toBe(true)
  expect(sourceError()).toContain('来源不存在或不是文件')
  expect(sourceError()).toContain('修复或恢复')
  rows.splice(1, 2, { path: change.path, sha256: change.sha256, text: '可读记录' }, pairedRow(oldPage))
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(metadata().every(item => !item.readChanged && !item.readUnchecked && !item.readError)).toBe(true)
  expect(state.actions.sourceUrl(oldPage.model_path)).toContain('/task-page/html-v1/model-v1/')
})

it('does not claim a confirmed update when a batch row has no digest to compare', async () => {
  const rows: Row[] = [{ path: change.path, text: '无摘要' }, { path: oldPage.path, kind: 'task-page' }]
  const state = reader([change], [oldPage], rows)
  await state.actions.renderTasks(1)
  expect(state.context.documents.get(change.path)?.readChanged).toBe(false)
  expect(state.context.documents.get(change.path)?.readUnchecked).toBe(true)
  expect(state.context.taskPages.get(oldPage.path)?.readChanged).toBe(false)
  expect(state.context.taskPages.get(oldPage.path)?.readUnchecked).toBe(true)
})

it.each([
  ['manual/fee.csv', 'deleted'],
  ['manual/fee.csv', 'changed'],
  ['manual/rule.txt', 'deleted'],
  ['manual/rule.txt', 'changed'],
  ['ordinary/model.json', 'deleted'],
  ['ordinary/model.json', 'changed'],
])('uses current ordinary source metadata for %s when %s without breaking the healthy parent', async (path, failure) => {
  const guide = { ...business, links: [{ target: path, kind: 'source', exists: true }, { target: 'valid.txt', kind: 'source', exists: true }] }
  const rows = [{ path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY 现行七天' }]
  const checks: SourceCheck[] = [{ path, sha256: 'fee-v1' }, { path: 'valid.txt', sha256: 'valid-v1' }]
  const state = reader([guide], [], rows, [], checks)
  state.context.sources.set(path, { sha256: 'fee-v1' })
  state.context.sources.set('valid.txt', { sha256: 'valid-v1' })
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.context.innerHTML).toContain(`/content/${path}?sha256=fee-v1`)
  checks[0] = failure === 'deleted' ? { path, error: `来源不存在或不是文件：${path}`, status: 404 } : { path, sha256: 'fee-v2' }
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.article.innerHTML).toContain('现行七天')
  expect(state.context.ui.context.innerHTML).not.toContain(`data-source="${path}"`)
  expect(state.context.ui.context.innerHTML).toContain('unavailable-link')
  expect(state.context.ui.context.innerHTML).toContain('/content/valid.txt?sha256=valid-v1')
  const resolved = state.actions.resolveLink(path, guide)
  expect(resolved.exists).toBe(false)
  expect(state.context.sources.get(path)?.readChanged).toBe(failure === 'changed')
  expect(state.context.sources.get(path)?.readStatus).toBe(failure === 'deleted' ? 404 : undefined)
  const reason = state.actions.unavailableReason(resolved)
  expect(() => state.actions.sourceUrl(path)).toThrow(reason)
  expect(reason).toContain(failure === 'changed' ? '刷新内容后核对新版' : '修复或恢复')
  checks[0] = { path, sha256: 'fee-v1' }
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.context.innerHTML).toContain(`/content/${path}?sha256=fee-v1`)
  expect(state.context.sources.get(path)?.readChanged).toBe(false)
  expect(state.context.sources.get(path)?.readError).toBe('')
  expect(state.context.documentText.mock.calls.every(([doc]) => doc.path === guide.path)).toBe(true)
})

it('does not infer an ordinary source failure from an absent check or let a weaker source check replace a paired task check', async () => {
  const state = reader([business], [oldPage], [{ path: business.path, sha256: business.sha256, text: 'CURRENTONLY' }, pairedRow(oldPage)], [], [
    { path: oldPage.model_path, error: 'weaker ordinary check', status: 404 },
  ])
  state.context.sources.set('unexamined.txt', { sha256: 'unchanged' })
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.context.sources.get('unexamined.txt')?.readError).toBeUndefined()
  expect(state.actions.sourceUrl('unexamined.txt')).toBe('/content/unexamined.txt?sha256=unchanged')
  expect(state.actions.sourceUrl(oldPage.model_path)).toContain('/task-page/html-v1/model-v1/')
})

it('preserves an ordinary source size-limit status and its content-size recovery', async () => {
  const path = 'manual/large.csv'
  const state = reader([business], [], [{ path: business.path, sha256: business.sha256, text: 'CURRENTONLY' }], [], [
    { path, error: `来源超过 2 MiB，请缩小内容或使用外部链接：${path}`, status: 413 },
  ])
  state.context.sources.set(path, { sha256: 'old' })
  await state.actions.renderSearch('CURRENTONLY', 1)
  const link = state.actions.resolveLink(path, { ...business, path: 'index.md' })
  expect(link.status).toBe(413)
  const reason = state.actions.unavailableReason(link)
  expect(reason).toContain('缩小内容或使用外部链接')
  expect(reason).not.toContain('重新启动')
})

it('propagates known task quota metadata to both members while distinguishing a source size limit', async () => {
  const guide = { ...business, links: [{ target: oldPage.model_path, kind: 'source', exists: true }] }
  const rows: Row[] = [{ path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY 七天' }, {
    kind: 'task-page',
    path: oldPage.path,
    error: '本次任务数量已达上限',
    status: 413,
    scope_limited: true,
  }]
  const state = reader([guide], [oldPage], rows)
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.sources.get(oldPage.model_path)?.readScopeLimited).toBe(true)
  expect(state.context.sources.get(oldPage.path)?.readScopeLimited).toBe(true)
  expect(state.context.ui.context.innerHTML).toContain('收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
  expect(state.context.ui.context.innerHTML).not.toContain('缩小内容')
  rows[1] = { kind: 'task-page', path: oldPage.path, error: '模型超过 2 MiB', status: 413 }
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.sources.get(oldPage.model_path)?.readScopeLimited).toBe(false)
  expect(state.context.ui.context.innerHTML).toContain('缩小内容或使用外部链接')
  expect(state.context.ui.context.innerHTML).not.toContain('重新启动')
  rows[1] = { kind: 'task-page', path: oldPage.path, error: `缺少对应 AI 记录：${oldPage.model_path}`, status: 404 }
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  for (const metadata of [state.context.taskPages.get(oldPage.path)!, state.context.sources.get(oldPage.path)!, state.context.sources.get(oldPage.model_path)!]) {
    expect(metadata.readScopeLimited).toBe(false)
    expect(metadata.readStatus).toBe(404)
    expect(metadata.readUnchecked).toBe(false)
    expect(metadata.readChanged).toBe(false)
  }
  for (const target of [oldPage.path, oldPage.model_path]) {
    const reason = state.actions.unavailableReason(state.actions.resolveLink(target, guide))
    expect(reason).toContain(rows[1].error)
    expect(reason).toContain('修复或恢复')
    expect(reason).toContain('刷新内容')
    expect(reason).not.toContain('缩小')
    expect(reason).not.toContain('重新启动')
    expect(() => state.actions.sourceUrl(target)).toThrow(reason)
  }
  rows[1] = pairedRow(oldPage)
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.context.innerHTML).toContain(`data-source="${oldPage.model_path}"`)
  expect(state.context.sources.get(oldPage.model_path)?.readStatus).toBeUndefined()
  expect(state.context.sources.get(oldPage.model_path)?.readScopeLimited).toBe(false)
})

it('does not announce a new faulty pair as healthy or leave an old ordinary alias clickable', async () => {
  const guide = { ...business, links: [{ target: newPage.model_path, kind: 'source', exists: true }] }
  const warnings = [`缺失任务原网页：${newPage.path}`]
  const rows: Row[] = [{ path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY' }, {
    kind: 'task-page',
    path: newPage.path,
    error: warnings[0],
    status: 404,
  }]
  const state = reader([guide], [], rows, warnings)
  state.context.sources.set(newPage.model_path, { sha256: 'ordinary-v1' })
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.messages.at(-1)).not.toContain('新增来源尚未纳入')
  expect(state.context.taskPages.size).toBe(0)
  expect(() => state.actions.sourceUrl(newPage.model_path)).toThrow(warnings[0])
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.context.innerHTML).not.toContain(`data-source="${newPage.model_path}"`)
  expect(state.context.ui.context.innerHTML).toContain(warnings[0])
  rows[1] = pairedRow(newPage)
  warnings.length = 0
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(state.messages.at(-1)).toContain('新增来源尚未纳入')
  expect(state.context.sources.get(newPage.model_path)?.readUnchecked).toBe(true)
  expect(() => state.actions.sourceUrl(newPage.model_path)).toThrow('刷新内容后核对')
})

it.each(['markdown', 'model'])('propagates structured 409 recovery for %s through every entry and clears it for later outcomes', async (reference) => {
  const terms = { ...change, path: 'terms.md', kind: 'document' }
  const target = reference === 'markdown' ? terms.path : oldPage.model_path
  const savedPath = reference === 'markdown' ? terms.path : oldPage.path
  const guide = { ...business, links: [{ target, kind: reference === 'markdown' ? 'document' : 'source', exists: true }] }
  const body = { path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY 现行规则保持可读。' }
  const healthy: Row = reference === 'markdown' ? { path: terms.path, sha256: terms.sha256, text: '依据原文' } : pairedRow(oldPage)
  const rows: Row[] = [body]
  const state = reader([guide, terms], reference === 'model' ? [oldPage] : [], rows)
  const metadata = () => reference === 'markdown'
    ? [state.context.documents.get(terms.path)!]
    : [state.context.taskPages.get(oldPage.path)!, state.context.sources.get(oldPage.path)!, state.context.sources.get(oldPage.model_path)!]
  const batches: (Row | undefined)[] = [
    { path: savedPath, kind: healthy.kind, error: 'Comparison conflict token K29', status: 409 },
    { path: savedPath, kind: healthy.kind, error: '已更新：实际路径不存在 F04', status: 404 },
    { path: savedPath, kind: healthy.kind, error: '已更新：实际编码不可读取 F15', status: 415 },
    undefined,
    healthy,
  ]
  for (const row of batches) {
    rows.splice(1, rows.length - 1, ...(row ? [row] : []))
    await state.actions.renderSearch('CURRENTONLY', 1)
    expect(metadata().every(item => Boolean(item.readChanged) === (row?.status === 409))).toBe(true)
    expect(metadata().every(item => Boolean(item.readUnchecked) === !row)).toBe(true)
    if (row?.error) {
      expect(metadata().every(item => item.readError === row.error)).toBe(true)
      expect(state.context.ui.article.innerHTML).toContain(row.error)
    }
    await expect(state.actions.renderPage({ path: guide.path }, 1)).resolves.toBeUndefined()
    expect(state.context.ui.article.innerHTML).toContain('现行规则保持可读')
    const resolved = state.actions.resolveLink(target, guide)
    if (row === healthy) {
      expect(metadata().every(item => !item.readError && !item.readChanged && !item.readUnchecked)).toBe(true)
      expect(resolved?.exists).toBe(true)
      expect(state.context.ui.context.innerHTML).toContain(reference === 'markdown' ? `href="#page=${terms.path}` : `data-source="${target}"`)
      expect(state.actions.sourceUrl(target)).toBe(reference === 'markdown'
        ? `/content/${terms.path}?sha256=${terms.sha256}`
        : '/task-page/html-v1/model-v1/old/model.json')
      continue
    }
    expect(resolved?.exists).toBe(false)
    const reason = state.actions.unavailableReason(resolved)
    expect(state.context.ui.context.innerHTML).toContain(reason)
    expect(state.context.ui.context.innerHTML).not.toContain(`href="#page=${savedPath}`)
    expect(state.context.ui.context.innerHTML).not.toContain(`data-source="${target}"`)
    expect(() => state.actions.sourceUrl(target)).toThrow(reason)
    let savedMessage = ''
    try {
      await state.actions.renderPage({ path: savedPath }, 1)
    }
    catch (failure) {
      savedMessage = (failure as Error).message
    }
    for (const message of [reason, savedMessage]) {
      if (row?.status === 409) {
        expect(message).toContain('刷新内容后核对新版')
        expect(message).not.toContain('修复或恢复')
      }
      else if (row) {
        expect(message).toContain(row.error)
        expect(message).toContain('修复或恢复')
        expect(message).not.toContain('核对新版')
      }
      else {
        expect(message).toContain('本批未读到')
        expect(message).toContain('刷新内容')
        expect(message).not.toContain('修复或恢复')
        expect(message).not.toContain('核对新版')
      }
    }
  }
})

it('disables a denied ordinary text source in place and restores it without breaking the parent', async () => {
  const path = 'sign.txt'
  const error = '不允许读取符号链接'
  const guide = { ...business, links: [{ target: path, kind: 'source', exists: true }] }
  const rows = [{ path: guide.path, sha256: guide.sha256, text: 'CURRENTONLY 现行签收规则。' }]
  const checks: SourceCheck[] = [{ path, error, status: 403 }]
  const state = reader([guide], [], rows, [], checks)
  state.context.sources.set(path, { sha256: 'sign-v1' })
  await state.actions.renderSearch('CURRENTONLY', 1)
  await expect(state.actions.renderPage({ path: guide.path }, 1)).resolves.toBeUndefined()
  expect(state.context.ui.article.innerHTML).toContain('现行签收规则')
  const resolved = state.actions.resolveLink(path, guide)
  expect(resolved.exists).toBe(false)
  expect(resolved.status).toBe(403)
  const reason = state.actions.unavailableReason(resolved)
  expect(reason).toContain(error)
  expect(state.context.ui.context.innerHTML).toContain(`data-reason="${reason}"`)
  expect(state.context.ui.context.innerHTML).not.toContain(`data-source="${path}"`)
  expect(state.context.sources.get(path)?.readUnchecked).toBe(false)
  expect(state.context.sources.get(path)?.readChanged).toBe(false)
  expect(() => state.actions.sourceUrl(path)).toThrow(reason)
  checks[0] = { path, sha256: 'sign-v1' }
  await state.actions.renderSearch('CURRENTONLY', 1)
  await state.actions.renderPage({ path: guide.path }, 1)
  expect(state.context.ui.context.innerHTML).toContain(`data-source="${path}"`)
  expect(state.actions.sourceUrl(path)).toBe('/content/sign.txt?sha256=sign-v1')
  expect(state.context.sources.get(path)?.readError).toBe('')
  expect(state.context.sources.get(path)?.readStatus).toBeUndefined()
  expect(state.context.documentText.mock.calls.every(([doc]) => doc.path === guide.path)).toBe(true)
})

it.each([
  { status: 404, error: '本次目录已确认业务条款缺失', scope_limited: false },
  { status: 415, error: '本次目录已确认业务条款不是 UTF-8 文本', scope_limited: false },
  { status: 413, error: '本次目录未能检查超出容量的业务条款', scope_limited: true },
])('consumes confirmed business $status metadata in task scope and marks absent business metadata unchecked without adding body cards', async (failure) => {
  const untouched = { ...business, path: 'unexamined.md', title: '未检查的业务条款' }
  const task = { ...change, links: [{ target: business.path, kind: 'document', exists: true }, { target: untouched.path, kind: 'document', exists: true }] }
  const rows: Row[] = [
    { path: task.path, sha256: task.sha256, text: '本轮变更可读。' },
    { path: business.path, ...failure },
    { path: 'untracked.md', ...failure },
  ]
  const state = reader([business, untouched, task], [], rows)
  await state.actions.renderTasks(1)
  const metadata = state.context.documents.get(business.path)!
  expect(metadata.readError).toBe(failure.error)
  expect(metadata.readStatus).toBe(failure.status)
  expect(metadata.readScopeLimited).toBe(failure.scope_limited)
  expect(metadata.readUnchecked).toBe(false)
  expect(state.context.documents.get(untouched.path)?.readError).toContain('本批未读到')
  expect(state.context.documents.get(untouched.path)?.readUnchecked).toBe(true)
  expect(state.context.documents.get(untouched.path)?.readChanged).toBe(false)
  expect(state.context.documents.get(untouched.path)?.readStatus).toBeUndefined()
  expect(state.context.documents.has('untracked.md')).toBe(false)
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${business.path}"`)
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${untouched.path}"`)
  expect(state.context.ui.article.innerHTML).not.toContain(`<div class="card-source">${business.path}</div>`)
  expect(state.messages.at(-1)).not.toContain('新增来源尚未纳入')
  expect(state.context.documentText).not.toHaveBeenCalled()
  const reason = state.actions.unavailableReason(state.actions.resolveLink(business.path, { ...task, path: 'index.md' }))
  expect(reason).toContain(failure.error)
  expect(() => state.actions.sourceUrl(business.path)).toThrow(reason)
  rows.splice(0, rows.length, ...[business, untouched, task].map(doc => ({ path: doc.path, sha256: doc.sha256, text: 'CURRENTONLY 恢复后的现行规则。' })))
  await state.actions.renderSearch('CURRENTONLY', 1)
  expect(metadata.readError).toBe('')
  expect(metadata.readStatus).toBeUndefined()
  expect(metadata.readScopeLimited).toBe(false)
  expect(state.actions.sourceUrl(business.path)).toBe(`/content/${business.path}?sha256=${business.sha256}`)
  expect(state.actions.cardRelated(task, '业务规则', 'document')).toContain(`href="#page=${business.path}"`)
})

it.each([
  { status: 404, error: '确切缺失的业务条款', scope_limited: false },
  { status: 415, error: '确切不可解码的业务条款', scope_limited: false },
  { status: 413, error: '业务入口已达本次读取范围上限', scope_limited: true },
])('preserves Markdown $status diagnostics in task scope while unreturned business metadata remains unchecked', async (failure) => {
  const rows: Row[] = [{ path: change.path, ...failure }, { path: 'changes/new-error.md', ...failure }]
  const state = reader([business, change], [], rows)
  await state.actions.renderTasks(1)
  const metadata = state.context.documents.get(change.path)!
  expect(metadata.readStatus).toBe(failure.status)
  expect(metadata.readScopeLimited).toBe(failure.scope_limited)
  expect(metadata.readUnchecked).toBe(false)
  expect(metadata.readChanged).toBe(false)
  expect(state.context.documents.get(business.path)?.readError).toContain('本批未读到')
  expect(state.context.documents.get(business.path)?.readUnchecked).toBe(true)
  expect(state.context.documents.get(business.path)?.readChanged).toBe(false)
  expect(state.context.documents.get(business.path)?.readStatus).toBeUndefined()
  expect(() => state.actions.sourceUrl(business.path)).toThrow('本批未读到')
  expect(state.messages.at(-1)).not.toContain('新增来源尚未纳入')
  expect(state.context.ui.article.innerHTML).not.toContain('changes/new-error.md')
  const link = state.actions.resolveLink(change.path, { ...business, path: 'index.md' })
  expect(link.status).toBe(failure.status)
  const reason = state.actions.unavailableReason(link)
  expect(reason).toContain(failure.error)
  expect(() => state.actions.sourceUrl(change.path)).toThrow(reason)
  await expect(state.actions.renderPage({ path: change.path }, 1)).rejects.toThrow(reason)
  if (failure.scope_limited) {
    expect(reason).toContain('收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器')
    expect(reason).not.toContain('修复或恢复')
  }
  else {
    expect(reason).toContain('修复或恢复')
    expect(reason).not.toContain('重新启动')
  }
})

it('accepts metadata-only business checks in task scope without reading or adding business body cards', async () => {
  const task = { ...change, links: [{ target: business.path, kind: 'document', exists: true }] }
  const rows: Row[] = [
    { path: task.path, sha256: task.sha256, text: '本轮变更可读。' },
    { path: business.path, error: '已确认业务条款暂时缺失', status: 404 },
  ]
  const state = reader([business, task], [], rows)
  const metadata = state.context.documents.get(business.path)!
  await state.actions.renderTasks(1)
  expect(metadata.readStatus).toBe(404)
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${business.path}"`)
  rows[1] = { path: business.path, sha256: business.sha256 }
  await state.actions.renderTasks(1)
  expect(metadata.readError).toBe('')
  expect(metadata.readStatus).toBeUndefined()
  expect(metadata.readScopeLimited).toBe(false)
  expect(metadata.readChanged).toBe(false)
  expect(metadata.readUnchecked).toBe(false)
  expect(state.context.ui.article.innerHTML).toContain(`href="#page=${business.path}"`)
  expect(state.context.ui.article.innerHTML).not.toContain(`<div class="card-source">${business.path}</div>`)
  expect(state.actions.sourceUrl(business.path)).toBe(`/content/${business.path}?sha256=${business.sha256}`)
  rows[1] = { path: business.path, sha256: 'business-v2' }
  await state.actions.renderTasks(1)
  expect(metadata.readChanged).toBe(true)
  expect(metadata.readUnchecked).toBe(false)
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${business.path}"`)
  expect(() => state.actions.sourceUrl(business.path)).toThrow('刷新内容后核对新版')
  rows.pop()
  await state.actions.renderTasks(1)
  expect(metadata.readError).toContain('本批未读到')
  expect(metadata.readUnchecked).toBe(true)
  expect(metadata.readChanged).toBe(false)
  expect(metadata.readStatus).toBeUndefined()
  expect(metadata.readScopeLimited).toBe(false)
  expect(state.context.ui.article.innerHTML).not.toContain(`<div class="card-source">${business.path}</div>`)
  expect(state.context.documentText).not.toHaveBeenCalled()
})

it('requires body text for a requested document but accepts an explicitly empty body', async () => {
  const rows: Row[] = [{ path: business.path, sha256: business.sha256 }]
  const state = reader([business], [], rows)
  await expect(state.actions.documentRecords([business], 'all')).resolves.toMatchObject({
    records: [{ raw: '', error: expect.stringMatching(/\S/), unchecked: true }],
  })
  await expect(state.actions.renderSearch(business.title, 1)).resolves.toBeUndefined()
  expect(state.searches.at(-1)).toEqual([])
  expect(state.context.documents.get(business.path)?.readUnchecked).toBe(true)
  rows[0].text = ''
  const empty = await state.actions.documentRecords([business], 'all')
  expect(empty.records[0].raw).toBe('')
  expect(empty.records[0].error).toBeUndefined()
  await state.actions.renderSearch(business.title, 1)
  expect(state.searches.at(-1)?.map(item => item.id)).toEqual([business.path])
  expect(state.context.documents.get(business.path)?.readError).toBe('')
  expect(state.context.documents.get(business.path)?.readUnchecked).toBe(false)
})

it('stops recommending missing business metadata in task scope and restores its reverse association from metadata alone', async () => {
  const index = { ...business, path: 'index.md', links: [{ target: 'terms.md', kind: 'document', exists: true }] }
  const terms = { ...business, path: 'terms.md', title: '现行业务条款', links: [{ target: change.path, kind: 'document', exists: true }] }
  const task = { ...change, links: [{ target: 'receipt.txt', kind: 'source', exists: true }], backlinks: [{ path: terms.path, kind: 'document', title: terms.title }] }
  const rows: Row[] = [
    { path: index.path, sha256: index.sha256 },
    { path: terms.path, sha256: terms.sha256 },
    { path: task.path, sha256: task.sha256, text: '本次改单及签收附件仍可用。' },
  ]
  const state = reader([index, terms, task], [], rows, [], [{ path: 'receipt.txt', sha256: 'receipt-v1' }])
  state.context.sources.set('receipt.txt', { sha256: 'receipt-v1' })
  const metadata = state.context.documents.get(terms.path)!
  await state.actions.renderTasks(1)
  expect(state.context.ui.article.innerHTML).toContain(`href="#page=${terms.path}"`)
  expect(state.actions.navLink(metadata)).toContain(`href="#page=${terms.path}"`)
  rows.splice(1, 1)
  await state.actions.renderTasks(1)
  expect(metadata.readUnchecked).toBe(true)
  expect(metadata.readChanged).toBe(false)
  expect(metadata.readStatus).toBeUndefined()
  expect(state.context.documents.get(task.path)?.readError).toBe('')
  expect(state.context.ui.article.innerHTML).toContain('本次改单及签收附件仍可用')
  expect(state.context.ui.article.innerHTML).not.toContain(`href="#page=${terms.path}"`)
  expect(state.actions.cardRelated(task, '相关业务', 'document')).toBe('')
  const navigation = state.actions.navLink(metadata)
  expect(navigation).toContain('unavailable-link')
  expect(navigation).toContain('本批未读到')
  expect(navigation).not.toMatch(/已删除|已移除|修复或恢复/)
  expect(navigation).not.toContain('href=')
  expect(() => state.actions.sourceUrl(terms.path)).toThrow('本批未读到')
  expect(state.actions.sourceUrl('receipt.txt')).toBe('/content/receipt.txt?sha256=receipt-v1')
  rows.splice(1, 0, { path: terms.path, sha256: terms.sha256 })
  await state.actions.renderTasks(1)
  expect(metadata.readError).toBe('')
  expect(metadata.readUnchecked).toBe(false)
  expect(metadata.readStatus).toBeUndefined()
  expect(metadata.readScopeLimited).toBe(false)
  expect(state.context.ui.article.innerHTML).toContain(`href="#page=${terms.path}"`)
  expect(state.actions.navLink(metadata)).toContain(`href="#page=${terms.path}"`)
  expect(state.context.ui.article.innerHTML).not.toContain(`<div class="card-source">${terms.path}</div>`)
  expect(state.context.ui.article.innerHTML).not.toContain(`<div class="card-source">${index.path}</div>`)
  expect(state.context.documentText).not.toHaveBeenCalled()
  expect(state.context.fetchResource).toHaveBeenCalledTimes(3)
})
