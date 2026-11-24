import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const requirePeer = createRequire(import.meta.resolve('@mermaid-js/mermaid-cli'))
const { default: puppeteer } = await import(pathToFileURL(requirePeer.resolve('puppeteer')).href)
const tests = fileURLToPath(new URL('.', import.meta.url))
const skill = fileURLToPath(new URL('../skills/requirement-flow', import.meta.url))
let executablePath
for (const channel of [undefined, 'chrome']) {
  try {
    const binary = puppeteer.executablePath(channel)
    if (existsSync(binary)) {
      executablePath = binary
      break
    }
  }
  catch { /* Use only an already installed headless browser. */ }
}

// The optional finish schema is supplied only to the render model, so this
// fixture works both before and after core adds validation for implementation.
function fixture(directory) {
  execFileSync('python3', ['-B', '-c', `
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, sys.argv[2])
from test_graph_clarity import GraphClarityTest
from test_story_withdrawal import ScopeProject
from runtime import graph_view, sync
case = GraphClarityTest()
case.setUp()
try:
    states = case.finish()
    model = sync.load()
    work = model['work']
    work['stories']['S-one']['goal'] = '用户保存后能回读结果，超时仍保留选择'
    work['contracts']['C-shared']['endpoints'] = [{'method': 'POST', 'path': '/test', 'purpose': '保存结果',
        'request': [], 'response': [], 'source': 'src/save.js:1'}]
    # Re-finish against the test-only inputs, rather than treating an old output as effective.
    work = case.write(lambda w: sync.apply_plan(w, {'stories': {'S-one': work['stories']['S-one']},
        'contracts': {'C-shared': work['contracts']['C-shared']},
        'actions': {'A-reference': {'title': '参考独立开发', 'kind': '开发', 'stories': ['S-reference'],
            'read_stories': ['S-reference'], 'contracts': [], 'decisions': [],
            'depends_on': [{'id': 'A-intake'}], 'done': '参考实现可追溯'}}}, '测试', '更新测试目标与接口'))
    work = case.write(lambda w: sync.progress(w, 'finish', 'A-shared', '测试', output='旧 output 仍可读取', evidence='src/save.js:1'))
    model = sync.load()
    work = model['work']
    work['events'][-1]['implementation'] = {
        'summary': '已接入保存服务并保留超时选择',
        'steps': [{'title': '发送保存请求', 'detail': '收集当前选择调用保存接口', 'source': 'src/save.js:1'},
                  {'title': '回读结果', 'detail': '成功后重新查询结果'}],
        'branches': [{'condition': '请求超时', 'behavior': '保留选择供重试', 'source': 'src/save.js:1'}]
    }
    work['decisions']['D-test'] = {'title': '测试范围决定', 'owner': '测试', 'why': '仅测试草稿保留', 'stories': ['S-one'],
        'options': {'yes': {'label': '保留', 'consequence': '继续当前范围'}, 'no': {'label': '调整', 'consequence': '重新核对'}}}
    for name, token, read_only in [('online', 'fixture-token', False), ('offline', '', True), ('stale', 'fixture-token', False)]:
        if name == 'stale':
            work['stories']['S-reference']['goal'] = '参考输入已变更'
        states = sync.evaluate(work)
        queue = sync.dispatch(work, for_map=True, include_story_queues=True)
        queue['knowledge_warnings'] = [{'task': 'broken-ledger', 'reason': '测试经验账本暂不可读取'}]
        page = graph_view.render(model, states, {'D-test': {'yes': [], 'no': []}}, token, 'fixture',
            Path(sys.argv[2]) / 'runtime/layout.html', queue=queue, read_only=read_only)
        Path(sys.argv[3], name + '.html').write_text(page, encoding='utf-8')
    empty_task = Path(sys.argv[3]) / 'unplanned-project/.requirements/active/unplanned'
    sync.initialize_task(empty_task, '尚未梳理的需求', key='unplanned')
    sync.bind_workspace(empty_task)
    empty_model = sync.load()
    empty_work = empty_model['work']
    empty_queue = sync.dispatch(empty_work, for_map=True, include_story_queues=True)
    assert empty_work['stories'] == {} and empty_queue['progress']['withdrawn_stories'] == []
    empty_page = graph_view.render(empty_model, sync.evaluate(empty_work), {}, 'fixture-token', 'fixture',
        Path(sys.argv[2]) / 'runtime/layout.html', queue=empty_queue)
    Path(sys.argv[3], 'unplanned.html').write_text(empty_page, encoding='utf-8')
finally:
    case.doCleanups()

# Independently recreate the read-only lane5 construct through the public CLI.
# No queue/state/withdrawal fields are fabricated and no recheck evidence is reused.
p = ScopeProject(Path(sys.argv[3]) / 'scope-project')
save = {'title': '保存本期记录', 'actor': '操作员', 'goal': '保存后可回读', 'examples': [
    {'id': 'AC-save', 'given': '合法输入', 'when': '保存', 'then': '记录可回读'}]}
shared = {'title': '复核共用保存导出实现', 'kind': '开发', 'stories': ['S-save', 'S-export'],
    'read_stories': ['S-save', 'S-export'], 'contracts': [], 'decisions': [],
    'depends_on': [{'id': 'A-intake'}], 'done': '共用实现可追溯'}
check = {**p.action, 'title': '验证本期保存', 'stories': ['S-save'], 'read_stories': ['S-save'],
    'covers': ['AC-save'], 'depends_on': [{'id': 'A-shared'}]}
p.plan({'stories': {'S-save': save}, 'actions': {'A-shared': shared,
    'A-export-dev': {**shared, 'title': '仅导出开发', 'stories': ['S-export'], 'read_stories': ['S-export']},
    'V-save': check}, 'decisions': {'D-save-scope': {
        'title': '保存是否本期交付', 'owner': '产品', 'why': '控制本期范围', 'stories': ['S-save'],
        'options': {'keep': {'label': '保留', 'consequence': '本期保存'},
                    'defer': {'label': '延期', 'consequence': '本期撤出保存'}}}}})
p.write('decision', 'D-save-scope', 'keep', '--why', '本期保留保存')
p.write('finish', 'A-shared', '--output', '两功能原实现已登记', '--evidence', '合成输入，非业务后端')
p.withdraw()

def snapshot(project, name):
    payload = project.embedded()
    page = project.root / '.requirements/active/scope/handbook.html'
    Path(sys.argv[3], name + '.html').write_text(page.read_text(encoding='utf-8'), encoding='utf-8')
    return payload

partial = snapshot(p, 'partial')
assert partial['queue']['progress']['withdrawn_stories'] == ['S-export']
assert partial['states']['A-shared']['state'] == 'stale'
assert 'A-shared' in partial['queue']['ready']
assert partial['states']['A-export-dev']['state'] == 'skipped'
assert partial['states']['A-export']['state'] == 'skipped'
assert [ex['story'] for ex in partial['queue']['scenarios']] == ['S-save']
# A separate shared pending decision must not take priority over withdrawal either.
p.plan({'decisions': {'D-format': {'title': '共用格式决定', 'owner': '产品', 'why': '核对格式',
    'stories': ['S-export', 'S-save'], 'options': {
        'csv': {'label': 'CSV', 'consequence': '逗号分隔'}, 'xls': {'label': 'XLS', 'consequence': '表格'}}}},
    'actions': {'A-format': {**shared, 'title': '处理共用格式', 'decisions': ['D-format']}}})
pending = snapshot(p, 'partial-decision')
assert 'A-shared' in pending['queue']['ready']
assert 'D-format' in [d['id'] for d in pending['queue']['pending_decisions']]
assert 'D-format' in pending['graph']['features']['S-export']['nodes']
p.write('decision', 'D-save-scope', 'defer', '--why', '合成反证：全部范围撤出')
p.plan({'stories': {'S-save': {**save, 'examples': []}}, 'actions': {'V-save': {**check, 'covers': []}},
    'retire_scenarios': {'AC-save': {'decision': 'D-save-scope', 'is': 'defer'}}})
all_withdrawn = snapshot(p, 'allwithdraw')
assert set(all_withdrawn['queue']['progress']['withdrawn_stories']) == {'S-export', 'S-save'}
assert all_withdrawn['states']['A-shared']['state'] == 'skipped'
assert all_withdrawn['queue']['ready'] == []
assert all_withdrawn['queue']['state'] == 'complete'

# The selected save story has passing evidence independent of the format decision.
# Only its optional import experiment consumes that decision; the other story needs it.
q = ScopeProject(Path(sys.argv[3]) / 'decision-scope-project')
(q.root / 'check.py').write_text('''from pathlib import Path
from tempfile import TemporaryDirectory
with TemporaryDirectory() as directory:
    record = Path(directory, "saved.txt")
    record.write_text("note 47")
    assert record.read_text() == "note 47"
    print("record reread: note 47")
''', encoding='utf-8')
q.decide('keep')
choices = {
    'basic': {'label': '仅保存', 'consequence': '不试验额外导入'},
    'extra': {'label': '试验导入', 'consequence': '核对额外格式'},
}
q.plan({'stories': {'S-save': save}, 'decisions': {
    'D-mode': {'title': '是否试验额外导入', 'owner': '产品', 'why': '限定试验范围', 'stories': ['S-save'], 'options': choices},
    'D-format': {'title': '导出及试验采用哪种格式', 'owner': '产品', 'why': '给消费者统一口径',
        'stories': ['S-save', 'S-export'], 'options': {
            'plain': {'label': '纯文本', 'consequence': '按纯文本处理'},
            'table': {'label': '表格', 'consequence': '按表格处理'}}},
}, 'actions': {
    'V-save': {**check, 'depends_on': [{'id': 'A-intake'}]},
    'A-export': {**q.action, 'decisions': ['D-format']},
    'A-import-trial': {'title': '试验额外导入', 'kind': '调研', 'stories': ['S-save'], 'read_stories': ['S-save'],
        'contracts': [], 'decisions': ['D-format'], 'depends_on': [{'id': 'A-intake'}], 'done': '记录试验结果',
        'when': {'decision': 'D-mode', 'is': 'extra'}},
}})

def decide(project, key, choice):
    project.write('decision', key, choice, '--why', '本地合成故事对照')

def next_story(project, story):
    return json.loads(project.cli('task', 'scope', 'next', '--story', story).stdout)

def pending_uses(queue):
    return {item['id']: item['actions'] for item in queue['pending_decisions']}

def save_receipt(queue):
    scenario = next(row for row in queue['scenarios'] if row['id'] == 'AC-save')
    assert scenario['status'] == 'passed', scenario
    return scenario['receipts'][0]['id']

decide(q, 'D-mode', 'basic')
q.verify('V-save', 'AC-save')
scoped = next_story(q, 'S-save')
assert scoped['state'] == 'complete' and pending_uses(scoped) == {}, scoped
receipt = save_receipt(scoped)
for queue in (q.queue(), next_story(q, 'S-export')):
    assert queue['state'] == 'waiting' and pending_uses(queue) == {'D-format': ['A-export']}, queue
skipped = snapshot(q, 'scope-skipped')
assert skipped['states']['A-import-trial']['state'] == 'skipped'
assert 'D-format' in skipped['graph']['features']['S-save']['nodes']

decide(q, 'D-mode', 'extra')
scoped = next_story(q, 'S-save')
assert scoped['state'] == 'waiting' and pending_uses(scoped) == {'D-format': ['A-import-trial']}, scoped
assert save_receipt(scoped) == receipt
snapshot(q, 'scope-active')

decide(q, 'D-mode', 'basic')
decide(q, 'D-format', 'plain')
scoped = next_story(q, 'S-save')
assert scoped['state'] == 'complete' and pending_uses(scoped) == {} and save_receipt(scoped) == receipt, scoped
assert 'A-export' in q.queue()['ready'] and pending_uses(q.queue()) == {}
snapshot(q, 'scope-answered')

q.plan({'decisions': {'D-declared': {'title': '是否登记本期说明', 'owner': '产品', 'why': '独立业务决定，无动作消费',
    'stories': ['S-save'], 'options': {
        'keep': {'label': '登记', 'consequence': '保留业务说明'},
        'omit': {'label': '不登记', 'consequence': '无额外说明'}}}}})
scoped = next_story(q, 'S-save')
assert scoped['state'] == 'waiting' and pending_uses(scoped) == {'D-declared': []}, scoped
assert pending_uses(q.queue()) == {'D-declared': []} and save_receipt(scoped) == receipt
snapshot(q, 'scope-declared')

decide(q, 'D-declared', 'keep')
q.plan({'decisions': {'D-export-only': {'title': '导出是否加盖确认章', 'owner': '产品', 'why': '导出组单独核对',
    'stories': ['S-export'], 'options': choices}}, 'actions': {
    'A-export': {**q.action, 'decisions': ['D-export-only']},
    'A-summary': {**shared, 'title': '核对保存结果', 'stories': ['S-save'], 'read_stories': ['S-save'],
        'depends_on': [{'id': 'A-intake'}, {'id': 'A-export', 'when': {'decision': 'D-mode', 'is': 'extra'}}]},
}})
q.write('finish', 'A-summary', '--output', '回读保存结果正确', '--evidence', '同一合成输入')
scoped = next_story(q, 'S-save')
assert scoped['state'] == 'complete' and not (scoped['ready'] or scoped['waiting'] or scoped['pending_decisions']), scoped
assert pending_uses(q.queue()) == {'D-export-only': ['A-export']}
inactive = snapshot(q, 'scope-inactive-edge')
assert 'A-export' in inactive['graph']['features']['S-save']['actions']
`, tests, skill, directory], { encoding: 'utf8' })
  const names = [
    'online',
    'offline',
    'stale',
    'partial',
    'partial-decision',
    'allwithdraw',
    'unplanned',
    'scope-skipped',
    'scope-active',
    'scope-answered',
    'scope-declared',
    'scope-inactive-edge',
  ]
  const pages = Object.fromEntries(names.map(name => [name, readFileSync(path.join(directory, `${name}.html`), 'utf8')]))
  const versions = Object.fromEntries(Object.entries(pages).map(([name, page]) => {
    const data = JSON.parse(page.match(/<script type="application\/json" id="data">(.+?)<\/script>/u)[1])
    return [name, { revision: data.model.work.revision, lesson_version: data.lesson_version, case_states: data.queue.scenarios.map(ex => [ex.id, ex.status]) }]
  }))
  return { pages, versions }
}

describe.skipIf(!executablePath)('requirement clarity in the existing headless browser', { timeout: 15_000 }, () => {
  let directory, browser, server, address, data
  let pageName = 'online'
  let sourceText = '第一版保存实现'
  let sourceStatus = 200
  let versionStatus = 200
  let hangVersion = false
  let sourceMode = 'normal'
  let hangingSources = []
  let decisionMode = 200
  let decisionPosts = []
  let documentReads = 0
  const sourceResult = content => ({ path: 'src/save.js', line: 1, preview: { startLine: 1, lines: [content] }, editors: {} })
  function resolveDecision(post, status = 200) {
    if (post.closed)
      return
    const { response, location } = post
    if (!response.headersSent)
      response.writeHead(status, { 'Content-Type': status === 200 ? 'application/json' : 'text/plain' })
    response.end(status !== 200
      ? `HTTP ${status}`
      : post.mode === 'body'
        ? `${JSON.stringify(location)}}`
        : JSON.stringify({ location }))
  }
  let reads = 0
  let polls = 0
  beforeAll(async () => {
    directory = mkdtempSync(path.join(tmpdir(), 'airules-clarity-'))
    data = fixture(directory)
    server = createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname.endsWith('/decision') && request.method === 'POST') {
        const post = { response, mode: decisionMode, closed: false, startedAt: performance.now() }
        const base = url.pathname.replace(/decision$/u, '')
        post.location = `${base}?features=${url.searchParams.get('features')}#work`
        response.on('close', () => {
          post.closed = true
        })
        request.setEncoding('utf8')
        let body = ''
        request.on('data', (chunk) => {
          body += chunk
        })
        request.on('end', () => {
          post.fields = Object.fromEntries(new URLSearchParams(body))
          decisionPosts.push(post)
          if (post.mode === 'body') {
            response.writeHead(200, { 'Content-Type': 'application/json' })
            response.flushHeaders()
            response.write('{"location":')
          }
          else if (post.mode !== 'headers') {
            resolveDecision(post, post.mode)
          }
        })
      }
      else if (url.pathname.endsWith('/source-location')) {
        reads++
        if (sourceMode !== 'normal') {
          const pending = { response, closed: false, mode: sourceMode }
          hangingSources.push(pending)
          response.on('close', () => {
            pending.closed = true
          })
          if (sourceMode === 'body') {
            response.writeHead(200, { 'Content-Type': 'application/json' })
            response.flushHeaders()
            response.write('{"path":"src/save.js",')
          }
          // Keep the real TCP connection open, before headers or mid-JSON body.
          return
        }
        response.writeHead(sourceStatus, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(sourceResult(sourceText)))
      }
      else if (url.pathname.endsWith('/version')) {
        polls++
        if (hangVersion)
          return
        response.writeHead(versionStatus, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(data.versions[pageName]))
      }
      else {
        if (url.pathname === '/tasks/clarity/')
          documentReads++
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(data.pages[pageName])
      }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    address = `http://127.0.0.1:${server.address().port}/tasks/clarity/`
    browser = await puppeteer.launch({ executablePath, headless: true, args: process.platform === 'linux' && (process.env.CI || process.getuid() === 0) ? ['--no-sandbox'] : [] })
  }, 60_000)
  afterAll(async () => {
    await browser?.close()
    server?.closeAllConnections()
    if (server)
      await new Promise(resolve => server.close(resolve))
    if (directory)
      rmSync(directory, { recursive: true, force: true })
  })
  async function open(route = '?view=detail&features=S-one#node=S-one', name = 'online', mode = 'normal', { deadlineMs = 600 } = {}) {
    pageName = name
    sourceText = '第一版保存实现'
    sourceStatus = versionStatus = decisionMode = 200
    hangVersion = false
    sourceMode = mode
    hangingSources = []
    decisionPosts = []
    reads = polls = documentReads = 0
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 760 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    if (deadlineMs !== null) {
      await page.evaluateOnNewDocument((deadline) => {
        const interval = window.setInterval.bind(window)
        const timeout = window.setTimeout.bind(window)
        const clear = window.clearTimeout.bind(window)
        window.__boundedTimers = new Set()
        window.setInterval = (fn, ms, ...args) => interval(fn, ms === 3500 ? 60000 : ms, ...args)
        // Accelerate the 15-second deadline only; fetch, AbortController and TCP stay real.
        window.setTimeout = (fn, ms, ...args) => {
          const id = timeout(fn, ms === 15000 ? deadline : ms, ...args)
          if (ms === 15000)
            window.__boundedTimers.add(id)
          return id
        }
        window.clearTimeout = (id) => {
          window.__boundedTimers.delete(id)
          clear(id)
        }
      }, deadlineMs)
    }
    await page.goto(address + route, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#stations [data-node]')
    if (route.includes('#node='))
      await page.waitForSelector('#drawer-layer.is-open')
    return page
  }
  const text = page => page.$eval('#detail', el => el.textContent)
  const canvas = page => page.$$eval('#stations [data-node]', nodes => nodes.map(node => node.dataset.node))
  const poll = page => page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
  async function waitTitle(page, title) {
    await page.waitForFunction(value => document.querySelector('#panel-title').textContent === value, {}, title)
  }

  const sourceRoute = '?view=detail&features=S-one#node=A-shared&source=src%2Fsave.js%3A1'
  async function reopenSource(page, hash) {
    await page.evaluate((value) => {
      location.hash = value
    }, hash)
    await page.waitForSelector('#source-drawer[open]')
  }
  const sourceBodyText = page => page.$eval('#source-body', el => el.textContent)
  async function laterReadClock(page) {
    // Simulate a later reread so second-resolution read-time text cannot hide
    // a fabricated timestamp. Parsing the previous readAt still uses real dates.
    await page.evaluate(() => {
      const RealDate = window.Date
      window.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [RealDate.now() + 60_000]))
        }
      }
    })
  }
  async function waitSourceIdle(page) {
    await page.waitForSelector('.source-reread[aria-disabled="false"]', { timeout: 2500 })
    await page.waitForFunction(() => window.__boundedTimers.size === 0, { timeout: 2500 })
  }
  const scopes = ['overview', 'detail'].flatMap(view => ['S-export', 'S-export,S-save'].map(features => ({ view, features })))
  const withdrawnNext = '本期已撤出 · 保留原范围与依据'

  it.each(scopes)('prioritizes partial withdrawal on the $view / $features story, card and tooltip', async ({ view, features }) => {
    const page = await open(`?view=${view}&features=${features}#node=S-export`, 'partial')
    try {
      expect(await page.$eval('#detail .current-status', el => el.textContent)).toBe(withdrawnNext)
      expect(await page.$eval('[data-node="S-export"]', el => el.getAttribute('aria-label'))).toContain(withdrawnNext)
      expect(await page.$eval('[data-node="S-export"]', el => el.getAttribute('aria-label'))).not.toContain('下一步')
      const captions = await page.$$eval('[data-node="S-export"] .n-caption', nodes => nodes.map(node => node.textContent))
      expect(captions[1]).toMatch(/^本期已撤出/u)
      await page.click('#close-panel')
      await page.waitForSelector('#drawer-layer.is-open', { hidden: true })
      await page.$eval('[data-node="@request"]', node => node.focus())
      await page.$eval('[data-node="S-export"]', node => node.focus())
      await page.waitForSelector('#card-tooltip:not([hidden])')
      expect(await page.$eval('#card-tooltip', el => el.textContent)).toContain(withdrawnNext)
      expect(await page.$eval('#card-tooltip', el => el.textContent)).not.toContain('下一步')
      expect(new URL(page.url()).searchParams.get('features')).toBe(features)
    }
    finally { await page.close() }
  })

  it.each(scopes)('suppresses only the withdrawn story queue in $view / $features, preserving history and shared links', async ({ view, features }) => {
    const page = await open(`?view=${view}&features=${features}#node=S-export`, 'partial')
    try {
      expect(await page.$$('#detail .queue-item')).toHaveLength(0)
      expect(await text(page)).not.toContain('可以开始')
      expect(await text(page)).toContain('历史产出（非当前有效实现）')
      expect(await text(page)).toContain('两功能原实现已登记')
      expect(await text(page)).toContain('验收范围调整')
      expect(await text(page)).toContain('AC-export')
      expect(await text(page)).toContain('产品负责人')
      expect(await text(page)).toContain('产品确认本期范围')
      expect(await page.$('#detail [data-dest="A-shared"]')).not.toBeNull()
      await page.click('#detail [data-dest="A-shared"]')
      await waitTitle(page, '复核共用保存导出实现')
      expect(await text(page)).toContain('两功能原实现已登记')
      expect(await page.$('#detail .story-links [data-dest="S-save"]')).not.toBeNull()
      expect(await page.$('#detail .story-links [data-dest="S-export"]')).not.toBeNull()
      await page.click('#panel-back')
      await waitTitle(page, '导出记录')
      expect(await page.$$('#detail .queue-item')).toHaveLength(0)
      expect(new URL(page.url()).searchParams.get('features')).toBe(features)
    }
    finally { await page.close() }
  })

  it('puts withdrawal before a legitimate pending decision without hiding the global decision or ready shared work', async () => {
    const page = await open('?view=detail&features=S-export,S-save#node=S-export', 'partial-decision')
    try {
      const payload = await page.$eval('#data', el => JSON.parse(el.textContent))
      expect(payload.queue.ready).toContain('A-shared')
      expect(payload.queue.pending_decisions.map(item => item.id)).toContain('D-format')
      expect(await page.$eval('#detail .current-status', el => el.textContent)).toBe(withdrawnNext)
      expect(await page.$$('#detail .queue-item')).toHaveLength(0)
      await page.evaluate(() => {
        location.hash = '#node=S-save'
      })
      await waitTitle(page, '保存本期记录')
      expect(await page.$eval('#detail .current-status', el => el.textContent)).toContain('待决定 · 共用格式决定')
      expect(await page.$('#detail .queue-item [data-dest="D-format"]')).not.toBeNull()
      await page.evaluate(() => {
        location.hash = '#node=%40request'
      })
      await waitTitle(page, payload.graph.nodes.find(node => node.id === '@request').title)
      expect(await page.$('#detail .queue-item [data-dest="D-format"]')).not.toBeNull()
      expect(await page.$('#detail .queue-item [data-dest="A-shared"]')).not.toBeNull()
    }
    finally { await page.close() }
  })

  it.each(scopes)('keeps all-withdrawn control honest in $view / $features', async ({ view, features }) => {
    const page = await open(`?view=${view}&features=${features}#node=S-export`, 'allwithdraw')
    try {
      const payload = await page.$eval('#data', el => JSON.parse(el.textContent))
      expect(payload.queue.state).toBe('complete')
      expect(payload.queue.progress.withdrawn_stories.sort()).toEqual(['S-export', 'S-save'])
      expect(payload.queue.progress.verified_stories).toEqual([])
      expect(payload.queue.ready).toEqual([])
      expect(payload.states['A-shared'].state).toBe('skipped')
      expect(await page.$eval('#detail .current-status', el => el.textContent)).toContain(withdrawnNext)
      expect(await page.$eval('#detail .current-status', el => el.textContent)).not.toContain('下一步')
      expect(await page.$$('#detail .queue-item')).toHaveLength(0)
      expect(await text(page)).toContain('两功能原实现已登记')
      expect(await text(page)).toContain('验收范围调整')
    }
    finally { await page.close() }
  })

  it.each(['overview', 'detail'])('preserves remaining-story single/multi selection and the unfiltered global queue in %s', async (view) => {
    for (const features of ['S-save', 'S-export,S-save', '']) {
      const key = features ? 'S-save' : '@request'
      const page = await open(`?view=${view}&features=${features}#node=${encodeURIComponent(key)}`, 'partial')
      try {
        const payload = await page.$eval('#data', el => JSON.parse(el.textContent))
        expect(payload.queue.state).not.toBe('complete')
        expect(payload.queue.progress.unverified_stories).toContain('S-save')
        expect(payload.queue.ready).toContain('A-shared')
        expect(payload.queue.scenarios.map(item => item.story)).toEqual(['S-save'])
        expect(await page.$('#detail .queue-item [data-dest="A-shared"]')).not.toBeNull()
        expect(await page.$eval('#detail .queue-item', el => el.textContent)).toContain('可以开始')
        if (features) {
          expect(await page.$eval('#detail .current-status', el => el.textContent)).toContain('下一步 · 复核共用保存导出实现')
          expect(await page.$eval('[data-node="S-save"]', el => el.getAttribute('aria-label'))).toContain('下一步 · 复核共用保存导出实现')
        }
      }
      finally { await page.close() }
    }
  })

  const formatDecision = '待决定 · 导出及试验采用哪种格式'
  const acceptedStory = '本故事验收通过 · 不代表需求已交付'
  const storyStatus = page => page.$eval('#detail .current-status', el => el.textContent)
  const storyCard = (page, key) => page.$eval(`[data-node="${key}"]`, el => el.getAttribute('aria-label'))
  const queuedDecision = (page, key) => page.$eval('#detail', (el, id) =>
    el.querySelector(`.queue-item [data-dest="${id}"]`)?.closest('.queue-item').textContent ?? null, key)
  const storyScope = (view, key, name) => open(`?view=${view}&features=S-save,S-export#node=${encodeURIComponent(key)}`, name)

  it.each(['overview', 'detail'])('matches CLI story decision scope for a skipped local consumer in %s', async (view) => {
    const page = await storyScope(view, 'S-save', 'scope-skipped')
    try {
      const payload = await page.$eval('#data', el => JSON.parse(el.textContent))
      expect(payload.queue.scenarios.filter(row => row.story === 'S-save').map(row => row.status)).toEqual(['passed'])
      expect(payload.queue.pending_decisions.map(({ id, actions }) => ({ id, actions }))).toEqual([{ id: 'D-format', actions: ['A-export'] }])
      expect.soft(await storyStatus(page), 'the story detail should honor its passing evidence').toContain(acceptedStory)
      expect.soft(await storyCard(page, 'S-save'), 'the story card should not take work from another story').toContain(acceptedStory)
      expect.soft(await queuedDecision(page, 'D-format'), 'the story queue should omit the skipped local decision').toBeNull()
      // Leave the decision available as reading context, just not as local pending work.
      await page.evaluate(() => {
        location.hash = '#node=D-format'
      })
      await waitTitle(page, '导出及试验采用哪种格式')
    }
    finally { await page.close() }
  })

  it.each(['overview', 'detail'])('preserves CLI story decision scope controls in %s', async (view) => {
    for (const [name, story, decision, status] of [
      ['scope-skipped', 'S-export', 'D-format', formatDecision],
      ['scope-active', 'S-save', 'D-format', formatDecision],
      ['scope-answered', 'S-save', 'D-format', acceptedStory],
      ['scope-declared', 'S-save', 'D-declared', '待决定 · 是否登记本期说明'],
    ]) {
      const page = await storyScope(view, story, name)
      try {
        expect(await storyStatus(page)).toContain(status)
        expect(await storyCard(page, story)).toContain(status)
        if (name === 'scope-answered')
          expect(await queuedDecision(page, decision)).toBeNull()
        else
          expect(await queuedDecision(page, decision)).toContain('待决定')
      }
      finally { await page.close() }
    }
    for (const [filter, pending] of [['', true], ['&features=S-save', false], ['&features=S-save,S-export', true]]) {
      const request = await open(`?view=${view}${filter}#node=%40request`, 'scope-skipped')
      try {
        const row = await queuedDecision(request, 'D-format')
        if (pending)
          expect(row).toContain('待决定')
        else
          expect(row).toBeNull()
      }
      finally { await request.close() }
    }
  })

  it('keeps an inactive cross-story dependency readable but out of both scoped work queues', async () => {
    const page = await open('?view=detail&features=S-save#node=S-save', 'scope-inactive-edge')
    try {
      expect.soft(await storyStatus(page)).toContain(acceptedStory)
      expect.soft(await storyCard(page, 'S-save')).toContain(acceptedStory)
      expect.soft(await page.$$('#detail .queue-item')).toHaveLength(0)
      await page.evaluate(() => {
        location.hash = '#node=%40request'
      })
      await page.waitForFunction(() => document.querySelector('[data-node="@request"]')?.getAttribute('aria-label')
        && document.querySelector('#panel-type').textContent.includes('需求'))
      expect.soft(await page.$$('#detail .queue-item')).toHaveLength(0)
      await page.evaluate(() => {
        location.hash = '#node=A-summary'
      })
      await waitTitle(page, '核对保存结果')
      expect(await page.$eval('#detail', el => el.textContent)).toContain('试验导入时')
    }
    finally { await page.close() }
  })

  it('scans outcome, acceptance and next work without substituting business flow for code', async () => {
    const page = await open()
    try {
      const headings = await page.$$eval('#detail > section > h3', nodes => nodes.map(node => node.textContent))
      expect(headings.slice(0, 3)).toEqual(['需求约定', '实际实现', '验收结果'])
      expect(await page.$eval('#detail .current-status', el => el.textContent)).toContain('待决定 · 测试范围决定')
      expect(await text(page)).toContain('用户保存后能回读结果')
      expect(await text(page)).toContain('发送保存请求')
      expect(await text(page)).toContain('请求超时')
      expect(await text(page)).toContain('保留选择供重试')
      expect(await text(page)).toContain('开发完成不等于业务验收')
      const captions = await page.$$eval('[data-node="S-one"] .n-caption', nodes => nodes.map(node => node.textContent))
      expect(captions[0]).toMatch(/^用户保存后能/u)
      expect(captions[1]).toMatch(/^待决定/u)
      expect(await page.$eval('[data-node="A-shared"]', el => el.getAttribute('aria-label'))).toContain('实际产出 · 已接入保存服务并保留超时选择')
      expect(await page.$eval('[data-node="A-shared"]', el => el.getAttribute('aria-label'))).not.toContain('业务期望回读结果')
      expect(await page.$eval('[data-node="A-shared"]', el => el.getAttribute('aria-label'))).toContain('S-two')
      expect(await page.$eval('[data-node="A-shared"] .outline', el => el.getBBox().height)).toBeLessThanOrEqual(100)
    }
    finally { await page.close() }
  })

  it.each(['overview', 'detail'])('renders referenced stories read-only with no out-of-scope queue in %s', async (view) => {
    const page = await open(`?view=${view}&features=S-one#node=A-shared`)
    try {
      const before = await canvas(page)
      expect(before).not.toContain('S-reference')
      expect(await text(page)).toContain('交付功能')
      expect(await text(page)).toContain('参考输入（非本次交付）')
      await page.click('#detail .story-links [data-dest="S-reference"]')
      await waitTitle(page, 'S-reference')
      expect(await text(page)).toContain('参考输入 · 只读查阅')
      expect(await text(page)).toContain('用户选择条目')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one')
      expect(await canvas(page)).toEqual(before)
      expect(await page.$('#detail form')).toBeNull()
      expect(await page.$$('#detail .queue-item')).toHaveLength(0)
      expect(await text(page)).not.toContain('可以开始')
      const payload = await page.$eval('#data', el => JSON.parse(el.textContent))
      expect(payload.queue.ready).toContain('A-reference')
      await page.click('#panel-back')
      await waitTitle(page, '实现保存')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one')
      expect(await canvas(page)).toEqual(before)
    }
    finally { await page.close() }
  })

  it.each(['S-export', 'S-export,S-save', ''])('describes withdrawn delivery scope without implying acceptance: %s', async (features) => {
    const page = await open(`?view=detail&features=${features}#node=%40delivery`, 'allwithdraw')
    try {
      expect(await text(page)).toContain('当前范围已全部撤出')
      expect(await text(page)).toContain('不代表业务验收通过')
      expect(await text(page)).not.toContain('待梳理可验收的业务场景')
      expect(await text(page)).toContain('验收范围调整')
      const payload = await page.$eval('#data', el => JSON.parse(el.textContent))
      expect(payload.queue.progress.verified_stories).toEqual([])
    }
    finally { await page.close() }
  })

  it('does not mislabel remaining or genuinely unplanned delivery scope as withdrawn', async () => {
    for (const [name, features, expected] of [
      ['partial', 'S-export,S-save', 'AC-save'],
      ['unplanned', '', '待梳理可验收的业务场景'],
    ]) {
      const page = await open(`?view=detail&features=${features}#node=%40delivery`, name)
      try {
        expect(await text(page)).toContain(expected)
        expect(await text(page)).not.toContain('当前范围已全部撤出')
      }
      finally { await page.close() }
    }
  })

  it('keeps all shared verification covers, identifies owners and explicitly expands then returns', async () => {
    const page = await open('?view=detail&features=S-one#node=V-shared')
    try {
      const before = await canvas(page)
      const reports = await page.$$eval('.acceptance-report', groups => groups.map(group => ({ title: group.querySelector('h3').textContent, owners: [...group.querySelectorAll('.case-owner')].map(el => el.textContent) })))
      expect(reports).toEqual([
        { title: '验收结果 · 当前功能', owners: ['所属功能 · S-one'] },
        { title: '验收结果 · 其它共用功能', owners: ['所属功能 · S-two'] },
      ])
      expect(await text(page)).toContain('当前筛选不会缩减验收范围')
      await page.click('#detail .story-links [data-dest="S-two"]')
      await waitTitle(page, 'S-two')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one,S-two')
      expect(await canvas(page)).toContain('S-two')
      await page.click('#panel-back')
      await waitTitle(page, '验证保存')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one')
      expect(await canvas(page)).toEqual(before)
    }
    finally { await page.close() }
  })

  it('offers the same explicit scope expansion for shared contracts', async () => {
    const page = await open('?view=detail&features=S-one#node=C-shared')
    try {
      expect(await text(page)).toContain('其它共用功能')
      await page.click('#detail .story-links [data-dest="S-two"]')
      await waitTitle(page, 'S-two')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one,S-two')
      await page.click('#panel-back')
      await waitTitle(page, '共享接口')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one')
    }
    finally { await page.close() }
  })

  it('keeps stale output historical and knowledge warnings separate from development', async () => {
    const page = await open('?view=detail&features=S-one#node=A-shared', 'stale')
    try {
      expect(await page.$eval('.implementation-summary', el => el.textContent)).toContain('实际实现待登记 · 需复核')
      expect(await text(page)).toContain('历史产出（非当前有效实现）')
      expect(await page.$eval('[data-node="A-shared"]', el => el.getAttribute('aria-label'))).toContain('历史产出（需复核）')
      const warning = await page.$eval('.knowledge-warning', el => el.textContent)
      expect(warning).toContain('不影响开发推进')
      expect(warning).toContain('broken-ledger · 测试经验账本暂不可读取')
      expect(await page.$('.implementation-summary .knowledge-warning')).toBeNull()
    }
    finally { await page.close() }
  })

  it.each(['headers', 'body'])('bounds the first source %s wait, survives same-entry back/reopen and retries without inventing a snippet or read time', async (mode) => {
    const page = await open(sourceRoute, 'online', mode)
    try {
      await page.waitForSelector('.source-reread[aria-disabled="true"]')
      expect(hangingSources).toHaveLength(1)
      const pending = hangingSources[0]
      const hash = new URL(page.url()).hash
      await page.click('.source-reread')
      expect(reads).toBe(1)
      await page.click('#source-back')
      await page.waitForSelector('#source-drawer', { hidden: true })
      await reopenSource(page, hash)
      await waitSourceIdle(page)
      expect(reads).toBe(1)
      expect(await sourceBodyText(page)).toContain('读取原文超时')
      expect(await page.$('.source-read-time')).toBeNull()
      expect(await page.$('#source-body .source-code-line')).toBeNull()
      expect(await page.$('#source-body .source-reader-status .link-button')).not.toBeNull()
      await page.waitForFunction(() => !document.querySelector('.source-reread[aria-disabled="true"]'))
      expect(pending.closed).toBe(true)
      sourceMode = 'normal'
      sourceText = '首次超时后重试读取的原文'
      await page.click('#source-body .source-reader-status .link-button')
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('首次超时后重试读取的原文'))
      await waitSourceIdle(page)
      expect(reads).toBe(2)
      expect(new URL(page.url()).hash).toBe(hash)
      expect(await page.$('.source-read-time')).not.toBeNull()
    }
    finally { await page.close() }
  })

  it.each(['headers', 'body'])('bounds a source reread %s wait, keeps old snippet/readAt and recovers through close/reopen and same-entry retry', async (mode) => {
    const page = await open(sourceRoute)
    try {
      await page.waitForSelector('#source-drawer[open] .source-code-line')
      await waitSourceIdle(page)
      const readTime = await page.$eval('.source-read-time', el => el.textContent)
      await laterReadClock(page)
      const hash = new URL(page.url()).hash
      const before = reads
      sourceMode = mode
      await page.click('.source-reread')
      await page.waitForSelector('.source-reread[aria-disabled="true"]')
      expect(await sourceBodyText(page)).toContain('第一版保存实现')
      expect(await page.$eval('.source-read-time', el => el.textContent)).toBe(readTime)
      await page.click('.source-reread')
      expect(reads).toBe(before + 1)
      await waitSourceIdle(page)
      expect(await sourceBodyText(page)).toContain('读取原文超时')
      expect(await sourceBodyText(page)).toContain('原文未更新')
      expect(await sourceBodyText(page)).toContain('第一版保存实现')
      expect(await page.$eval('.source-read-time', el => el.textContent)).toBe(readTime)
      expect(hangingSources[0].closed).toBe(true)
      await page.click('#source-close')
      await page.waitForSelector('#source-drawer', { hidden: true })
      await reopenSource(page, hash)
      expect(await page.$eval('.source-read-time', el => el.textContent)).toBe(readTime)
      expect(await sourceBodyText(page)).toContain('第一版保存实现')
      expect(reads).toBe(before + 1)
      sourceMode = 'normal'
      sourceText = '原入口恢复后的当前实现'
      await page.click('.source-reread')
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('原入口恢复后的当前实现'))
      await waitSourceIdle(page)
      expect(reads).toBe(before + 2)
      expect(new URL(page.url()).hash).toBe(hash)
      expect(await page.$eval('.source-read-time', el => el.textContent)).not.toBe(readTime)
      expect(await sourceBodyText(page)).not.toContain('第一版保存实现')
      expect(await sourceBodyText(page)).not.toContain('读取原文超时')
    }
    finally { await page.close() }
  })

  it('does not let a late old-entry response or deadline replace a new entry for the same citation', async () => {
    const page = await open(sourceRoute, 'online', 'headers')
    try {
      await page.waitForSelector('.source-reread[aria-disabled="true"]')
      const pending = hangingSources[0]
      sourceMode = 'normal'
      sourceText = '新故事入口读取的原文'
      await page.evaluate(() => {
        location.hash = '#node=S-one&source=src%2Fsave.js%3A1'
      })
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('新故事入口读取的原文'))
      const readTime = await page.$eval('.source-read-time', el => el.textContent)
      pending.response.writeHead(200, { 'Content-Type': 'application/json' })
      pending.response.end(JSON.stringify(sourceResult('晚返回的旧入口原文')))
      await waitSourceIdle(page)
      expect(await sourceBodyText(page)).toContain('新故事入口读取的原文')
      expect(await sourceBodyText(page)).not.toContain('晚返回的旧入口原文')
      expect(await page.$eval('.source-read-time', el => el.textContent)).toBe(readTime)
      // A second abandoned entry times out while the new entry remains usable.
      sourceMode = 'body'
      await page.click('.source-reread')
      await page.waitForSelector('.source-reread[aria-disabled="true"]')
      sourceMode = 'normal'
      sourceText = '再次切换入口后的原文'
      await page.evaluate(() => {
        location.hash = '#node=A-shared&source=src%2Fsave.js%3A1'
      })
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('再次切换入口后的原文'))
      await waitSourceIdle(page)
      expect(await sourceBodyText(page)).not.toContain('读取原文超时')
      expect(await sourceBodyText(page)).not.toContain('新故事入口读取的原文')
    }
    finally { await page.close() }
  })

  it.each([403, 404, 503])('preserves HTTP %s behavior for initial reads and rereads, including successful recovery where allowed', async (status) => {
    for (const reread of [false, true]) {
      const page = await open(reread ? sourceRoute : '?view=detail&features=S-one#node=A-shared')
      try {
        let readTime
        if (reread) {
          await page.waitForSelector('#source-drawer[open] .source-code-line')
          await waitSourceIdle(page)
          readTime = await page.$eval('.source-read-time', el => el.textContent)
          await laterReadClock(page)
        }
        sourceStatus = status
        const before = reads
        if (reread)
          await page.click('.source-reread')
        else
          await reopenSource(page, new URL(address + sourceRoute).hash)
        await page.waitForFunction(code => document.querySelector('#source-body').textContent.includes(code === 403 ? '无权读取' : code === 404 ? '无法定位' : '暂时无法连接'), {}, status)
        await page.waitForFunction(() => window.__boundedTimers.size === 0)
        expect(reads).toBe(before + 1)
        expect(await sourceBodyText(page)).not.toContain('超时')
        if (reread) {
          expect(await sourceBodyText(page)).toContain('第一版保存实现')
          expect(await sourceBodyText(page)).toContain('原文未更新')
          expect(await page.$eval('.source-read-time', el => el.textContent)).toBe(readTime)
        }
        else {
          expect(await page.$('.source-read-time')).toBeNull()
        }
        if (status === 403) {
          expect(await page.$eval('.source-reread', el => el.disabled)).toBe(true)
          expect(await page.$('#source-body .link-button')).toBeNull()
          await page.click('.source-reread')
          expect(reads).toBe(before + 1)
        }
        else {
          sourceStatus = 200
          sourceText = 'HTTP错误恢复后的原文'
          await page.click('.source-reread')
          await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('HTTP错误恢复后的原文'))
          await waitSourceIdle(page)
          expect(reads).toBe(before + 2)
        }
      }
      finally { await page.close() }
    }
  })

  it('rereads changed source content without leaving the source drawer or fabricating read time', async () => {
    const page = await open('?view=detail&features=S-one#node=A-shared&source=src%2Fsave.js%3A1')
    try {
      await page.waitForSelector('#source-drawer[open] .source-code-line')
      expect(await page.$eval('#source-body', el => el.textContent)).toContain('第一版保存实现')
      expect(await page.$eval('.source-read-time', el => el.textContent)).toContain('片段读取时间')
      const hash = new URL(page.url()).hash
      const before = reads
      sourceText = '第二版当前保存实现'
      await page.click('.source-reread')
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('第二版当前保存实现'))
      expect(reads).toBe(before + 1)
      expect(new URL(page.url()).hash).toBe(hash)
      expect(await page.$('#source-drawer[open]')).not.toBeNull()
      expect(await page.$eval('#source-body', el => el.textContent)).not.toContain('第一版保存实现')
      sourceStatus = 503
      await page.click('.source-reread')
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('原文未更新'))
      expect(await page.$eval('#source-body', el => el.textContent)).toContain('第二版当前保存实现')
      sourceStatus = 200
      sourceText = '恢复连接后的当前实现'
      await page.click('.source-reread')
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('恢复连接后的当前实现'))
      await page.click('#source-back')
      await page.waitForSelector('#source-drawer', { hidden: true })
      await waitTitle(page, '实现保存')
    }
    finally { await page.close() }
  })

  it('prevents duplicate rereads while loading and retains keyboard focus and last successful read time', async () => {
    const page = await open('?view=detail&features=S-one#node=A-shared&source=src%2Fsave.js%3A1')
    try {
      await page.waitForSelector('#source-drawer[open] .source-code-line')
      const readTime = await page.$eval('.source-read-time', el => el.textContent)
      let pending, resolveRequest
      let attempts = 0
      const requested = new Promise(resolve => resolveRequest = resolve)
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        if (request.url().includes('/source-location?')) {
          attempts++
          pending = request
          resolveRequest()
        }
        else {
          request.continue()
        }
      })
      await page.click('.source-reread')
      await requested
      await page.waitForSelector('.source-reread[aria-disabled="true"]')
      await page.click('.source-reread')
      expect(attempts).toBe(1)
      expect(await page.$eval('.source-read-time', el => el.textContent)).toBe(readTime)
      expect(await page.$eval('#source-body', el => el.textContent)).toContain('第一版保存实现')
      await pending.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ path: 'src/save.js', line: 1, preview: { startLine: 1, lines: ['等待后读取的原文'] }, editors: {} }) })
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('等待后读取的原文'))
      expect(await page.$eval('.source-reread', el => el === document.activeElement)).toBe(true)
    }
    finally { await page.close() }
  })

  it('rereads endpoint citations while preserving endpoint direction and the return chain', async () => {
    const page = await open('?view=detail&features=S-one#node=C-shared&endpoint=POST%20%2Ftest&side=response&source=src%2Fsave.js%3A1')
    try {
      await page.waitForSelector('#source-drawer[open] .source-code-line')
      const hash = new URL(page.url()).hash
      sourceText = '接口当前原文'
      await page.click('.source-reread')
      await page.waitForFunction(() => document.querySelector('#source-body').textContent.includes('接口当前原文'))
      expect(new URL(page.url()).hash).toBe(hash)
      await page.click('#source-back')
      await page.waitForSelector('#source-drawer', { hidden: true })
      expect(await page.$('#endpoint-drawer[open]')).not.toBeNull()
      expect(await page.$eval('.endpoint-tabs [aria-pressed="true"]', el => el.dataset.side)).toBe('response')
      await page.click('#endpoint-close')
      await page.waitForSelector('#endpoint-drawer', { hidden: true })
      await waitTitle(page, '共享接口')
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-one')
    }
    finally { await page.close() }
  })

  it('keeps archived offline references honest with no refresh, read time or decision writes', async () => {
    const page = await open('?view=detail&features=S-one#node=A-shared&source=src%2Fsave.js%3A1', 'offline')
    try {
      expect(await page.$eval('#source-body', el => el.textContent)).toContain('离线页不可获取当前原文')
      expect(await page.$('.source-reread')).toBeNull()
      expect(await page.$('.source-read-time')).toBeNull()
      expect(reads).toBe(0)
      await page.goto(`${address}?view=detail&features=S-one#node=D-test`)
      expect(await page.$('#detail form')).toBeNull()
      expect(await text(page)).toContain('这个需求已归档')
    }
    finally { await page.close() }
  })

  const decisionRoute = '?view=detail&features=S-one#node=D-test'
  const decisionField = '#detail input[name="reason"]'
  const chooseYes = '#detail button.choose[value="yes"]'
  const chooseNo = '#detail button.choose[value="no"]'
  const decisionDraft = '保留这个决定理由以便核对'
  const decisionReason = page => page.$eval(decisionField, el => el.value)
  const updateNotice = page => page.$eval('#notice', el => el.hidden ? null : el.textContent)
  const buttonState = page => page.$$eval('#detail form button[type="submit"]', buttons => buttons.map(el => ({
    text: el.getAttribute('aria-label') || el.textContent,
    disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
  })))
  function expectDecisionWaiting(buttons, stage) {
    expect.soft(buttons, `${stage}: every decision option must be inactive while submitting`).toEqual([
      expect.objectContaining({ disabled: true }),
      expect.objectContaining({ disabled: true }),
    ])
    expect.soft(buttons.map(button => button.text).join(' '), `${stage}: the button should explain the wait`)
      .toMatch(/提交中|正在提交|正在保存|等待(?:确认|响应)|保存中/u)
  }
  function readLatestDecision(page) {
    return Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }),
      page.click('#notice:not([hidden]) #refresh'),
    ])
  }

  it.each(['headers', 'body'])('bounds the decision POST %s stall without replay or late navigation', async (mode) => {
    const nativeClock = mode === 'headers'
    // Headers uses the real production 15 seconds (and normal version polling).
    // Body uses a 1.5-second clock for the same deadline, with a real partial JSON response.
    const page = await open(decisionRoute, 'online', 'normal', { deadlineMs: nativeClock ? null : 1500 })
    try {
      const route = page.url()
      const before = documentReads
      decisionMode = mode
      await page.type(decisionField, decisionDraft)
      const headers = mode === 'body' ? page.waitForResponse(res => res.url().includes('/decision?'), { timeout: 3000 }) : null
      await page.click(chooseYes)
      if (headers)
        expect((await headers).status()).toBe(200)
      await expect.poll(() => decisionPosts.length).toBe(1)
      const post = decisionPosts[0]
      expect(post.fields).toEqual({
        csrf: 'fixture-token',
        revision: String(data.versions.online.revision),
        decision: 'D-test',
        choice: 'yes',
        reason: decisionDraft,
      })
      expect(post.response.headersSent).toBe(mode === 'body')
      expect(post.response.writableEnded).toBe(false)
      const pollsWhileWaiting = polls
      expectDecisionWaiting(await buttonState(page), 'first open')
      await page.click(chooseNo)

      await page.click('#close-panel')
      await page.waitForSelector('#drawer-layer.is-open', { hidden: true })
      await page.$eval('[data-node="D-test"]', el => el.focus())
      await page.keyboard.press('Enter')
      await page.waitForSelector('#drawer-layer.is-open')
      await waitTitle(page, '测试范围决定')
      expect(await decisionReason(page)).toBe(decisionDraft)
      expectDecisionWaiting(await buttonState(page), 'reopened same decision')
      await page.click(chooseNo)

      const upperBound = nativeClock ? 16_750 : 3000
      const remaining = Math.max(1, upperBound - (performance.now() - post.startedAt))
      await page.waitForFunction(() => !document.querySelector('#notice').hidden, { timeout: remaining }).catch((error) => {
        if (error.name !== 'TimeoutError')
          throw error
      })
      const elapsed = performance.now() - post.startedAt
      const notice = await updateNotice(page)
      expect.soft(elapsed, 'do not expire prematurely').toBeGreaterThanOrEqual(nativeClock ? 14_500 : 1000)
      expect.soft(notice ?? '(notice hidden)', `unconfirmed decision after ${Math.round(elapsed)}ms (${mode})`).toMatch(/未确认|无法确认|不能确认/u)
      if (nativeClock)
        expect(polls).toBeGreaterThan(pollsWhileWaiting)
      expect.soft(decisionPosts.map(request => request.fields.choice), 'no retry even after reopening').toEqual(['yes'])
      expect(await decisionReason(page)).toBe(decisionDraft)

      // Try to send the original 200 after the deadline. If the client already
      // aborted the connection, the response cannot be delivered at all.
      resolveDecision(post)
      await expect.poll(() => post.closed).toBe(true)
      await page.waitForNavigation({ timeout: 400 }).catch((error) => {
        if (error.name !== 'TimeoutError')
          throw error
      })
      expect.soft(page.url(), 'late successful POST must not navigate').toBe(route)
      expect.soft(documentReads, 'no reload before the user asks to read again').toBe(before)
      if (!notice || page.url() !== route)
        return // Earlier assertions already describe the failure; no nonexistent button to click.

      expect(await page.$eval('#notice #refresh', el => el.textContent)).toContain('读取最新版')
      await readLatestDecision(page)
      expect(page.url()).toBe(route)
      expect(documentReads).toBe(before + 1)
      expect(await decisionReason(page)).toBe(decisionDraft)
      expect(decisionPosts).toHaveLength(1)
    }
    finally { await page.close() }
  }, 25_000)

  it('reads a new document when a successful decision returns the same page with a different hash', async () => {
    const page = await open('?features=S-one#node=D-test', 'online', 'normal', { deadlineMs: null })
    try {
      const before = documentReads
      await page.evaluate(() => {
        window.__documentBeforeDecision = true
      })
      await page.click(chooseYes)
      // Wait on a real HTTP read and a new document, not a hash-change event.
      await expect.poll(() => documentReads, { timeout: 5000 }).toBe(before + 1)
      await page.waitForFunction(() => !window.__documentBeforeDecision && location.hash === '#work'
        && document.querySelector('#stations [data-node]'), { timeout: 3000 })
      expect(decisionPosts).toHaveLength(1)
    }
    finally { await page.close() }
  })

  it.each([200, 409, 403, 503])('preserves the decision POST HTTP %s control without automatic resubmission', async (status) => {
    const page = await open(decisionRoute)
    try {
      const route = page.url()
      const before = documentReads
      decisionMode = status
      await page.type(decisionField, decisionDraft)
      if (status === 503) {
        await page.click(chooseYes)
        await page.waitForSelector('#notice:not([hidden])')
        expect(await updateNotice(page)).toContain('决定提交结果未确认')
        expect(await decisionReason(page)).toBe(decisionDraft)
        await readLatestDecision(page)
      }
      else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }),
          page.click(chooseYes),
        ])
      }
      if (status === 200) {
        expect(new URL(page.url()).hash).toBe('#work')
        expect(new URL(page.url()).searchParams.get('features')).toBe('S-one')
      }
      else {
        if (status === 409 || status === 403) {
          await page.waitForFunction(() => Array.from(document.querySelectorAll('#detail form [role="status"]'))
            .some(el => el.textContent.includes('再次确认')), { timeout: 3000 })
        }
        expect(page.url()).toBe(route)
        expect(await decisionReason(page)).toBe(decisionDraft)
      }
      expect(decisionPosts).toHaveLength(1)
      expect(decisionPosts[0].fields.reason).toBe(decisionDraft)
      expect(documentReads).toBe(before + 1)
    }
    finally { await page.close() }
  })

  it.each(['http', 'timeout'])('reports %s polling failure nonblockingly, keeps drafts, and clears on unchanged success', async (mode) => {
    const page = await open('?view=detail&features=S-one#node=D-test')
    try {
      await page.waitForFunction(() => !document.querySelector('#notice:not([hidden])'))
      const before = await canvas(page)
      await page.type('#detail input[name="reason"]', '尚未提交的范围理由')
      if (mode === 'http')
        versionStatus = 503
      else hangVersion = true
      const oldPolls = polls
      await poll(page)
      await page.waitForSelector('#update-health:not([hidden])')
      expect(polls).toBeGreaterThan(oldPolls)
      expect(await page.$eval('#update-health', el => el.textContent)).toContain('暂时无法更新，显示上次读取状态')
      expect(await page.$eval('#update-health', el => el.textContent)).toMatch(/核对时间|页面读取时间/u)
      expect(await page.$eval('input[name="reason"]', el => el.value)).toBe('尚未提交的范围理由')
      expect(await page.$('#notice:not([hidden])')).toBeNull()
      expect(await canvas(page)).toEqual(before)
      versionStatus = 200
      hangVersion = false
      await page.click('#update-health button')
      await page.waitForSelector('#update-health', { hidden: true })
      expect(await page.$eval('input[name="reason"]', el => el.value)).toBe('尚未提交的范围理由')
      expect(await canvas(page)).toEqual(before)
    }
    finally { await page.close() }
  })

  it('does not report deliberately cancelled hidden-page polling as failure', async () => {
    const page = await open('?view=detail&features=S-one#node=D-test')
    try {
      hangVersion = true
      await page.evaluate(() => {
        window.dispatchEvent(new Event('pageshow'))
        Object.defineProperty(document, 'hidden', { configurable: true, value: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)))
      expect(await page.$('#update-health:not([hidden])')).toBeNull()
      expect(await page.$('#detail input[name="reason"]')).not.toBeNull()
    }
    finally { await page.close() }
  })
})
