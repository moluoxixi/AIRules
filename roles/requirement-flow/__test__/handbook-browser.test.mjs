import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Use the browser driver already supplied for Mermaid rendering in development.
const requireMermaidPeer = createRequire(import.meta.resolve('@mermaid-js/mermaid-cli'))
const { default: puppeteer } = await import(pathToFileURL(requireMermaidPeer.resolve('puppeteer')).href)
const featureTitles = ['新建方案', '配置模板', '刷新门店资源', '单个确认', '批量确认', '维护位置图片', '详情', '方案状态', '门店指引']
const batchSource = 'merchandising-spec/产品真源/陈列方案升级/批量确认规则.md:340'
const flowCli = fileURLToPath(new URL('../skills/requirement-flow/flow.py', import.meta.url))
const python = process.platform === 'win32' ? 'py' : 'python3'
const pythonArgs = [...(process.platform === 'win32' ? ['-3'] : []), '-B', flowCli]

async function localChrome() {
  for (const channel of [undefined, 'chrome']) {
    try {
      const binary = await puppeteer.executablePath(channel)
      if (binary && existsSync(binary))
        return binary
    }
    catch {
      // The system channel is optional when a Puppeteer browser is installed.
    }
  }
}

function runFlow(project, ...args) {
  return execFileSync(python, [...pythonArgs, '--project', project, ...args], { encoding: 'utf8' })
}

function createHandbook(project) {
  const flow = (...args) => runFlow(project, ...args)
  const { handbook } = JSON.parse(flow('new', 'plan', '--request', '陈列模板生成、确认及门店查阅'))
  const patch = { stories: {}, contracts: {}, actions: {} }
  featureTitles.forEach((name, i) => {
    const story = `S-${i}`
    const scenario = `SC-${i}`
    const contract = `C-${i}`
    patch.stories[story] = {
      title: name,
      actor: '运营',
      goal: name,
      examples: [{ id: scenario, given: '已选择门店类型', when: name, then: '结果可回读' }],
    }
    patch.contracts[contract] = {
      title: name,
      state: 'confirmed',
      status: '已核对',
      operation: `POST /display/${i}`,
      source: '测试契约',
      fields: [],
    }
    const action = { stories: [story], read_stories: [story], contracts: [contract], decisions: [], done: '场景有可回读的结果' }
    patch.actions[`A-${i}`] = { ...action, title: name, kind: '开发', depends_on: i === 3 || i === 4 ? [{ id: 'A-1' }] : [] }
    patch.actions[`V-${i}`] = { ...action, title: `核对${name}`, kind: '验证', depends_on: [{ id: `A-${i}` }], covers: [scenario] }
  })
  const batch = patch.stories['S-4']
  const savePath = '/api/orders/bulk/confirmation/selection/save-confirm'
  const undoPath = '/api/orders/bulk/confirmation/selection/undo-confirm'
  patch.contracts['C-4'].operation = `调用与职责\nPOST ${savePath}\nPOST ${undoPath}\n确认后重新查询列表。`
  patch.contracts['C-4'].endpoints = [{
    method: 'POST',
    path: savePath,
    purpose: '保存批量确认',
    request: [{ name: 'operations', type: 'BatchOperation[]', constraint: '本期传 []', use: '保留已有配置' }],
    response: [{ name: 'confirmedCount', type: 'number', constraint: '允许为 0', use: '显示确认数量' }],
    source: '.moluoxixi/tasks/plan-batch/prd.md:6',
  }, {
    method: 'POST',
    path: undoPath,
    purpose: '撤销批量确认',
    request: [{ name: 'typeIds', type: 'number[]', constraint: '必填', use: '标识需要撤销的条目' }],
    response: [],
    responseNote: '调用方仅检查业务成功状态。',
    source: '撤销接口类型定义',
  }]
  patch.contracts['C-5'].fields = [{ name: 'sharedKey', type: 'string', constraint: '沿用原记录', use: '旧契约的共用字段' }]
  patch.contracts['C-5'].operation += '\nGET /display/5/view\n共享数据需按门店核对。'
  batch.basis = [batchSource, '.moluoxixi/tasks/plan-batch/prd.md:6', '.moluoxixi/tasks/plan-batch/prd.md:12', '沿用运营确认的门店范围'].join('\n')
  batch.goal = '跨页选择门店类型后统一确认，保留已有位置方案。'
  batch.examples = [
    { id: 'AC-pages', given: '两页各有选中类型', when: '跨页确认门店类型', then: '只提交选中的门店类型' },
    { id: 'AC-timeout', given: '提交请求超时', when: '重试批量提交', then: '超时后保留原选择' },
    { id: 'AC-write', given: '测试门户中有可编辑方案', when: '在门户回读批量写入结果', then: '重新进入方案后仍能看到已确认状态' },
  ]
  const verifyBatch = patch.actions['V-4']
  verifyBatch.covers = ['AC-pages', 'AC-timeout']
  verifyBatch.accepts = ['自动化']
  patch.actions['V-portal'] = { ...verifyBatch, title: '验证门户写入', covers: ['AC-write'], accepts: ['真实环境'] }
  patch.decisions = {
    'D-scope': {
      title: '门店查看哪份方案',
      owner: '运营',
      why: '请求范围不同',
      stories: ['S-8'],
      options: { local: { label: '本店', consequence: '取门店方案' }, national: { label: '全国', consequence: '按位置查阅' } },
    },
  }
  patch.contract_routes = [
    { decision: 'D-scope', option: 'local', contract: 'C-8' },
    { decision: 'D-scope', option: 'national', contract: 'C-6' },
  ]
  const patchFile = path.join(project, 'plan.json')
  writeFileSync(patchFile, JSON.stringify(patch))
  flow('task', 'plan', 'plan', patchFile, '--rev', '1', '--why', '覆盖带有共享前置动作的九功能需求图')
  function record(command, action, ...args) {
    const { revision } = JSON.parse(flow('task', 'plan', 'next'))
    return flow('task', 'plan', command, action, '--rev', String(revision), '--actor', '测试人员', ...args)
  }
  for (const action of ['A-1', 'A-3', 'A-4'])
    record('finish', action, '--output', '提交门店类型确认处理', '--evidence', batchSource)
  function capture(action, scenario, environment, assertion) {
    const script = `const assert = require('node:assert/strict'); ${assertion}; console.log('raw-check-${scenario}')`
    return JSON.parse(record('verify-run', action, '--scenario', scenario, '--environment', environment, '--share-output', '--', process.execPath, '-e', script))
  }
  const oldProof = capture('V-3', 'SC-3', '本机单选测试', 'assert.equal([1].length, 1)')
  record('finish', 'V-3', '--output', '单选通过')
  // Corrupt this once-valid artifact before subsequent commands regenerate the shared handbook.
  writeFileSync(path.resolve(path.dirname(handbook), oldProof.artifact.path), 'changed after review')
  const batchProof = capture('V-4', 'AC-pages', '本机跨页组件测试', 'assert.deepEqual([...new Set([1, 3, 1])], [1, 3])')
  capture('V-4', 'AC-timeout', '本机超时恢复测试', 'const selected = [2]; assert.throws(() => { throw Error("timeout") }); assert.deepEqual(selected, [2])')
  record('finish', 'V-4', '--output', '跨页与超时场景均已完成本机验证')
  const relocated = path.join(project, '.requirements/history/tasks/plan-batch')
  mkdirSync(relocated, { recursive: true })
  writeFileSync(path.join(relocated, 'prd.md'), ['批量确认与撤销', '范围', '', '流程', '', '保留原有位置方案'].join('\n'))
  writeFileSync(path.join(project, '.requirements/source-paths.json'), JSON.stringify({
    version: 1,
    directories: { '.moluoxixi/tasks/': '.requirements/history/tasks/' },
  }))
  flow('task', 'plan')
  return { url: pathToFileURL(handbook).href, batchArtifact: path.resolve(path.dirname(handbook), batchProof.artifact.path) }
}

async function startServer(project, ...args) {
  const child = spawn(python, [...pythonArgs, '--project', project, ...args])
  const address = await new Promise((resolve, reject) => {
    let stderr = ''
    child.stderr.on('data', chunk => stderr += chunk)
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`viewer exited with ${code}: ${stderr.trim()}`)))
    child.stdout.once('data', chunk => resolve(chunk.toString().trim()))
  })
  return {
    address,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null)
        return
      const exited = once(child, 'exit')
      child.kill()
      await exited
    },
  }
}

function startViewer(project, port = '0') {
  return startServer(project, 'task', 'plan', 'serve', '--port', port)
}

const executablePath = await localChrome()
describe.skipIf(!executablePath)('generated handbook interactions in Chromium', { timeout: 15_000 }, () => {
  let project, lightProject, browser, url, batchArtifact
  beforeAll(async () => {
    project = mkdtempSync(path.join(tmpdir(), 'airules-handbook-'))
    const fixture = createHandbook(project)
    url = fixture.url
    batchArtifact = fixture.batchArtifact
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: process.platform === 'linux' && (process.env.CI || process.getuid() === 0) ? ['--no-sandbox'] : [],
    })
  }, 60_000)
  afterAll(async () => {
    await browser?.close()
    if (project)
      rmSync(project, { recursive: true, force: true })
    if (lightProject)
      rmSync(lightProject, { recursive: true, force: true })
  }, 30_000)
  function drawerReady(page) {
    return page.waitForFunction(() => {
      const layer = document.querySelector('#drawer-layer')
      return layer?.classList.contains('is-open') && !layer.hidden
        && layer.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished')
    }, { timeout: 4_000 })
  }
  function drawerClosed(page) {
    return page.waitForFunction(() => document.querySelector('#drawer-layer').hidden && !document.querySelector('.app').inert, { timeout: 4_000 })
  }
  const canvasState = page => page.$eval('#map', (el) => {
    const { x, y, width, height } = el.getBoundingClientRect()
    return { x, y, width, height, viewBox: el.getAttribute('viewBox') }
  })
  const previewTrigger = 'button.source-preview-trigger'
  const themeToggle = 'button[data-theme-toggle]'
  const preferTheme = (page, value) => page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value }])
  const waitForTheme = (page, theme) => page.waitForFunction((value) => {
    const root = document.documentElement
    return root.dataset.theme === value && getComputedStyle(root).colorScheme === value
  }, { timeout: 4_000 }, theme)
  async function open(width, height, route = '', theme) {
    const page = await browser.newPage()
    await page.setViewport({ width, height, hasTouch: true })
    const failed = new Promise((_, reject) => page.once('pageerror', reject))
    try {
      if (theme)
        await preferTheme(page, theme)
      await Promise.race([
        failed,
        page.goto(url + route, { waitUntil: 'domcontentloaded' })
          .then(() => page.waitForSelector('#stations [data-node]', { timeout: 4_000 })),
      ])
      if (route.includes('#node='))
        await drawerReady(page)
      return page
    }
    catch (error) {
      await page.close()
      throw error
    }
  }
  // textContent also includes evidence and paths behind closed disclosures.
  // eslint-disable-next-line unicorn/prefer-dom-node-text-content
  const visibleDetail = page => page.$eval('#detail', el => el.innerText)
  it('separates lightweight implementation, planned checks and actual evidence', async () => {
    // A fixture nested in the legacy project would invalidate its default code scope.
    lightProject = mkdtempSync(path.join(tmpdir(), 'airules-light-handbook-'))
    const flow = (...args) => runFlow(lightProject, ...args)
    const { handbook, revision } = JSON.parse(flow('new', 'stock', '--light', '--request', '保存后重开回显'))
    const edit = path.join(lightProject, 'cards.json')
    writeFileSync(path.join(lightProject, 'save.py'), 'saved = 3\n')
    writeFileSync(path.join(lightProject, 'observed.txt'), '重开后显示 3\n')
    writeFileSync(edit, JSON.stringify({
      stories: { 'S-save': { title: '保存后重开', actor: '门店员', goal: '重开后显示保存值', basis: '需求原话', examples: [{ id: 'SC-reopen', given: '原数量为 2', when: '保存 3 后重新打开', then: '显示 3' }] } },
      checks: { 'SC-reopen': { level: '人工核对', environment: '本机验收', expected: '回读数量等于保存值', steps: ['关闭详情', '重新打开详情'] } },
      code_paths: { 'SC-reopen': ['save.py'] },
    }))
    const card = JSON.parse(flow('task', 'stock', 'cards', edit, '--rev', String(revision), '--why', '明确验收'))
    const dev = JSON.parse(flow('task', 'stock', 'implement', 'S-save', '--rev', String(card.revision), '--output', '已接入回读', '--evidence', 'save.py:1'))
    const page = await browser.newPage()
    try {
      const route = `${pathToFileURL(handbook).href}?view=detail&features=S-save#node=S-save`
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await drawerReady(page)
      expect(await page.$eval('#detail .scope-caption', element => element.textContent)).toContain('实现已登记 · 验收 0/1')
      await page.click('#detail .case-proof summary')
      expect(await visibleDetail(page)).toContain('回读数量等于保存值')
      expect(await visibleDetail(page)).not.toContain('已用于本项验收')
      flow('task', 'stock', 'verify-observe', 'SC-reopen', '--rev', String(dev.revision), '--environment', '本机验收', '--actual', '重开后显示 3', '--artifact', 'observed.txt')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await drawerReady(page)
      expect(await page.$eval('#detail .scope-caption', element => element.textContent)).toContain('实现已登记 · 验收 1/1')
      await page.click('#detail .case-proof summary')
      expect(await visibleDetail(page)).toContain('已用于本项验收')
    }
    finally {
      await page.close()
    }
  })
  const scale = page => page.$eval('#scale', el => Number.parseInt(el.textContent))
  // replaceState updates the document before Puppeteer necessarily receives its same-document navigation event.
  function waitForFilterLink(page, key, value) {
    return page.waitForFunction((key, value) => new URLSearchParams(location.search).get(key) === value, { timeout: 5_000 }, key, value)
  }
  async function gestures(page) {
    const session = await page.createCDPSession()
    const { x, y, width, height } = await (await page.$('#map')).boundingBox()
    const cx = Math.round(x + width / 2)
    const cy = Math.round(y + height / 2)
    const nextFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return {
      async wheel(modifiers = 0) {
        await session.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: -120, modifiers })
        await nextFrame()
      },
      async pinch() {
        for (const radius of [24, 32, 48]) {
          await session.send('Input.dispatchTouchEvent', {
            type: radius === 24 ? 'touchStart' : 'touchMove',
            touchPoints: [{ x: cx - radius, y: cy, id: 1 }, { x: cx + radius, y: cy, id: 2 }],
          })
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await nextFrame()
      },
    }
  }

  it.each(['dark', 'light'])('embeds readable %s colors in standalone SVG exports', async (theme) => {
    const page = await open(390, 700, '?view=detail', theme)
    try {
      await waitForTheme(page, theme)
      const svg = await page.evaluate(async () => {
        const download = new Promise((resolve) => {
          HTMLAnchorElement.prototype.click = function () {
            resolve(this.href)
          }
        })
        document.getElementById('export').click()
        const doc = new DOMParser().parseFromString(await (await fetch(await download)).text(), 'image/svg+xml')
        const luminance = (hex) => {
          const light = hex.slice(1).match(/../gu).map((value) => {
            const srgb = Number.parseInt(value, 16) / 255
            return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
          })
          return light[0] * 0.2126 + light[1] * 0.7152 + light[2] * 0.0722
        }
        const nodes = [...doc.querySelectorAll('.map-node')]
        const titleContrast = nodes.map((node) => {
          const a = luminance(node.querySelector('.outline').getAttribute('fill'))
          const b = luminance(node.querySelector('.n-title').getAttribute('fill'))
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        })
        const background = doc.querySelector('svg > rect').getAttribute('fill')
        const lines = [...doc.querySelectorAll('#wires path[marker-end]')]
        const pen = document.createElement('canvas').getContext('2d')
        const legendColor = (selector) => {
          pen.fillStyle = getComputedStyle(document.querySelector(selector)).borderTopColor
          return pen.fillStyle
        }
        const wire = name => lines.find(line => line.getAttribute('marker-end') === `url(#arr-${name})`)
        return {
          count: nodes.length,
          minContrast: Math.min(...titleContrast),
          background: luminance(background),
          normal: wire('normal')?.getAttribute('stroke'),
          possible: wire('possible')?.getAttribute('stroke'),
          normalLegend: legendColor('.legend .rail:not(.branch)'),
          possibleLegend: legendColor('#branch-legend .rail'),
          arrowsMatch: lines.every((line) => {
            const ref = line.getAttribute('marker-end').slice(4, -1)
            return doc.querySelector(`${ref} path`)?.getAttribute('fill') === line.getAttribute('stroke')
          }),
          originalBorders: nodes.every(node =>
            node.querySelector('.outline').getAttribute('stroke')
            === document.querySelector(`#stations [data-node="${CSS.escape(node.dataset.node)}"] .outline`).getAttribute('stroke')),
        }
      })
      expect(svg.count).toBeGreaterThan(5)
      expect(svg.minContrast).toBeGreaterThanOrEqual(4.5)
      if (theme === 'dark')
        expect(svg.background).toBeLessThan(0.08)
      else
        expect(svg.background).toBeGreaterThan(0.7)
      expect(svg.normal).toBe(svg.normalLegend)
      expect(svg.possible).toBe(svg.possibleLegend)
      expect(svg.normal).not.toBe(svg.possible)
      expect(svg.arrowsMatch).toBe(true)
      expect(svg.originalBorders).toBe(true)
    }
    finally {
      await page.close()
    }
  })

  it('follows a retired adoption to its original receipt and returns to the open reading position', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'airules-adoption-reader-'))
    const page = await browser.newPage()
    let server
    try {
      // Use the shared CLI fixtures so this includes the actual evidence authorization and retirement.
      const setup = [
        'from pathlib import Path',
        'import sys',
        'from test_knowledge_flow import Project, SOURCE, TARGET, LESSON, SEARCH',
        'p = Project(Path(sys.argv[1]))',
        'p.prepare_review()',
        'p.review()',
        'p.write(TARGET, "lesson-adopt", SOURCE, LESSON, "--version", 1, "--story", SEARCH, "--why", "路线中包含第二页的门店")',
        'p.cli("lesson-retire", SOURCE, LESSON, "--version", 1, "--actor", "审查员", "--why", "原接口已退役")',
      ].join('\n')
      execFileSync(python, [...pythonArgs.slice(0, -1), '-c', setup, root], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
      })
      server = await startServer(root, 'serve', '--port', '0')
      const graph = new URL('tasks/inspection-route/?view=overview&features=S-route-stop#node=S-route-stop', server.address).href
      await page.setViewport({ width: 390, height: 700 })
      await preferTheme(page, 'light')
      await page.goto(graph)
      await drawerReady(page)
      const group = '#detail details.lesson-group'
      await page.click(`${group} > summary`)
      expect(await visibleDetail(page)).toContain('采用理由')
      expect(await visibleDetail(page)).toContain('路线中包含第二页的门店')
      expect(await visibleDetail(page)).toContain('已退役')
      expect(await visibleDetail(page)).not.toContain('推荐经验')
      const evidence = '.lesson-evidence-link'
      const href = new URL(await page.$eval(evidence, node => node.href))
      expect(href.searchParams.get('approval')).toMatch(/^[a-f0-9]{64}$/u)
      await Promise.all([page.waitForNavigation(), page.click(evidence)])
      await waitForTheme(page, 'light')
      await page.click(themeToggle)
      await waitForTheme(page, 'dark')
      expect(await page.$eval('header a[aria-label="首页"]', node => new URL(node.href).pathname)).toBe('/')
      expect(await page.$eval('.download', node => node.href)).toContain('lesson-evidence')
      const bytes = await page.$eval('.download', async node => (await fetch(node.href)).text())
      expect(bytes).toContain('test_store_on_later_page')
      await Promise.all([page.waitForNavigation(), page.click('#return-map')])
      await drawerReady(page)
      await waitForTheme(page, 'dark')
      expect(page.url()).toBe(graph)
      expect(await page.$eval(group, node => node.open)).toBe(true)
    }
    finally {
      await page.close()
      await server?.stop()
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  describe('project requirement catalog', () => {
    const archived = '历史草案'
    const archivedTitle = '目录检索旧规范'
    const unplanned = 'unplanned'
    const research = 'index-study'
    const longTitle = `目录检索与资料编辑权限 \u2014 ${'DocumentIndex'.repeat(7)} 移动端查阅`
    const cards = 'article[data-task-id]'
    const search = 'input[type="search"][aria-label="搜索需求"]'
    const linkFor = id => `${cards}[data-task-id="${id}"] a[href]`
    let server

    beforeAll(async () => {
      runFlow(project, 'new', unplanned, '--request', '可查看哪些资料', '--title', longTitle)
      runFlow(project, 'new', archived, '--request', '第一版资料库查阅规则', '--title', archivedTitle)
      runFlow(project, 'archive', archived, '--allow-incomplete')
      runFlow(project, 'new', research, '--request', '调研资料格式', '--outcome', 'research')
      const archiveRecord = `.requirements/archive/${archived}/model.json`
      expect(JSON.parse(readFileSync(path.join(project, archiveRecord), 'utf8')).work.id).toBe(archived)
      const result = ['--output', '归档目录中的 model.json 可读取该需求的标识', '--evidence', archiveRecord]
      runFlow(project, 'task', research, 'finish', 'A-intake', '--actor', '资料维护者', '--rev', '1', ...result)
      server = await startServer(project, 'serve', '--port', '0', '--default-task', 'plan')
    })
    afterAll(async () => {
      await server?.stop()
    })

    function waitForCards(page, expected) {
      return page.waitForFunction((selector, ids) => {
        const shown = [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length)
        return shown.length === ids.length && shown.every(el => ids.includes(el.dataset.taskId))
      }, { timeout: 4_000 }, cards, expected)
    }
    async function follow(page, selector) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click(selector)])
    }

    it('follows the system theme and preserves a manual theme across navigation and reload', async () => {
      const context = await browser.createBrowserContext()
      try {
        const page = await context.newPage()
        await page.setViewport({ width: 1024, height: 680 })
        await preferTheme(page, 'dark')
        await page.goto(server.address)
        await waitForTheme(page, 'dark')
        expect(await page.$eval(themeToggle, el => el.getAttribute('aria-label'))).toContain('浅色')
        await preferTheme(page, 'light')
        await waitForTheme(page, 'light')
        expect(await page.$eval(themeToggle, el => el.getAttribute('aria-label'))).toContain('深色')
        await page.type(search, '批量确认')
        await waitForCards(page, ['plan'])
        await follow(page, linkFor('plan'))
        await waitForTheme(page, 'light')
        const story = '#stations [data-node="S-4"]'
        await page.waitForSelector(story)
        await page.click('#plus')
        const before = await canvasState(page)
        const fill = () => page.$eval(`${story} .outline`, el => getComputedStyle(el).fill)
        const lightFill = await fill()
        await preferTheme(page, 'dark')
        await waitForTheme(page, 'dark')
        expect(await fill()).not.toBe(lightFill)
        expect(await canvasState(page)).toEqual(before)
        await page.click(themeToggle)
        await waitForTheme(page, 'light')
        expect(await fill()).toBe(lightFill)
        expect(await page.evaluate(() => localStorage.getItem('requirement-flow:theme'))).toBe('light')
        await page.goto(new URL('?view=overview&features=S-4#node=S-4', page.url()).href)
        await drawerReady(page)
        const selection = page.url()
        await page.reload()
        await drawerReady(page)
        await waitForTheme(page, 'light')
        expect(page.url()).toBe(selection)
        expect(await page.$eval('#panel-title', el => el.textContent)).toBe('批量确认')
        await follow(page, '#inspector .drawer-home')
        await waitForTheme(page, 'light')
        await page.click(themeToggle)
        await preferTheme(page, 'light')
        await page.reload()
        await waitForTheme(page, 'dark')
      }
      finally {
        await context.close()
      }
    })

    it('switches the theme when storage is unavailable', async () => {
      const page = await browser.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      try {
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(window, 'localStorage', {
            get() { throw new DOMException('Storage unavailable', 'SecurityError') },
          })
        })
        await preferTheme(page, 'light')
        await page.goto(server.address)
        await waitForTheme(page, 'light')
        await waitForCards(page, [archived, unplanned, 'plan', research])
        await page.click(themeToggle)
        await waitForTheme(page, 'dark')
        expect(errors).toEqual([])
      }
      finally {
        await page.close()
      }
    })

    it('keeps separated graph actions and the rightmost home link in a compact header', async () => {
      const page = await browser.newPage()
      try {
        await page.goto(server.address)
        await page.type(search, 'DocumentIndex')
        await waitForCards(page, [unplanned])
        await follow(page, linkFor(unplanned))
        await page.waitForSelector('#catalog-return', { visible: true })
        for (const [width, height, gap] of [[903, 48, 8], [725, 48, 8], [520, 48, 6], [430, 44, 5], [375, 44, 5]]) {
          await page.setViewport({ width, height: width === 725 ? 593 : 623 })
          const header = await page.$eval('.app-head header', (el) => {
            const title = el.querySelector('h1')
            const home = el.querySelector('#catalog-home')
            const homeRect = home.getBoundingClientRect()
            const others = [...el.querySelectorAll('a, button')].filter(node => node !== home && node.getClientRects().length)
            const actionRects = [...others, home].map(node => node.getBoundingClientRect())
            return {
              text: el.textContent,
              height: el.getBoundingClientRect().height,
              title: title.title,
              titleWidth: title.clientWidth,
              clipped: title.scrollWidth > title.clientWidth && getComputedStyle(title).textOverflow === 'ellipsis',
              clearOfActions: others.every(node => title.getBoundingClientRect().right <= node.getBoundingClientRect().left),
              homeIsLast: others.every(node => node.getBoundingClientRect().right <= homeRect.left),
              homeIsVisible: homeRect.right <= innerWidth && Number.parseFloat(getComputedStyle(home).fontSize) > 0,
              smallestGap: Math.min(...actionRects.slice(1).map((rect, index) => rect.left - actionRects[index].right)),
            }
          })
          expect(header.text).not.toMatch(/需求全景图|\bv\d+\b/u)
          expect(header).toMatchObject({ height, title: longTitle, clearOfActions: true, homeIsLast: true, homeIsVisible: true })
          expect(header.smallestGap).toBeGreaterThanOrEqual(gap)
          if (width <= 430) {
            expect(header.clipped).toBe(true)
            expect(header.titleWidth).toBeGreaterThan(width / 3)
          }
        }
        await follow(page, '#catalog-home')
        await waitForCards(page, [archived, unplanned, 'plan', research])
      }
      finally {
        await page.close()
      }
    })

    it.each(['dark', 'light'])('keeps %s cards compact with full-card targets', async (theme) => {
      const page = await browser.newPage()
      try {
        await preferTheme(page, theme)
        await page.goto(server.address)
        await waitForTheme(page, theme)
        await waitForCards(page, ['plan', unplanned, archived, research])
        for (const width of [1079, 960, 725, 665, 390, 320]) {
          await page.setViewport({ width, height: width === 725 ? 593 : 820 })
          const metrics = await page.$eval('article[data-task-id="plan"]', (card) => {
            const bounds = card.getBoundingClientRect()
            const corner = document.elementFromPoint(bounds.left + 5, bounds.bottom - 5)
            const title = card.querySelector('h3')
            const meter = card.querySelector('progress')
            const statuses = card.querySelectorAll('.state')
            const tagLine = card.querySelector('.card-tags').getBoundingClientRect()
            const header = document.querySelector('.masthead').getBoundingClientRect()
            const active = card.closest('.section').getBoundingClientRect()
            const archive = document.querySelector('.section[data-bucket="archive"]').getBoundingClientRect()
            return {
              columns: getComputedStyle(card.parentElement).gridTemplateColumns.split(' ').length,
              headerHeight: header.height,
              toolbarGap: document.querySelector('.toolbar').getBoundingClientRect().top - header.bottom,
              firstCardTop: document.querySelector('.cards .card').getBoundingClientRect().top,
              oneStatusAboveTitle: statuses.length === 1 && statuses[0].getBoundingClientRect().bottom <= title.getBoundingClientRect().top,
              separateProgress: meter.getBoundingClientRect().top >= tagLine.bottom,
              titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
              meterHeight: meter.getBoundingClientRect().height,
              target: corner?.closest('a') === title.querySelector('a'),
              archiveBelow: archive.top >= active.bottom,
              overflow: document.documentElement.scrollWidth - innerWidth,
            }
          })
          expect(metrics.columns).toBe(width >= 700 ? 2 : 1)
          expect(metrics.headerHeight).toBeGreaterThan(0)
          expect(metrics.headerHeight).toBeLessThanOrEqual(85)
          expect(metrics.toolbarGap).toBeGreaterThanOrEqual(16)
          expect(metrics.firstCardTop).toBeLessThanOrEqual(350)
          expect(metrics.oneStatusAboveTitle).toBe(true)
          expect(metrics.separateProgress).toBe(true)
          expect(metrics.titleSize).toBeGreaterThanOrEqual(15)
          expect(metrics.meterHeight).toBeGreaterThanOrEqual(4)
          expect(metrics.target).toBe(true)
          expect(metrics.archiveBelow).toBe(true)
          expect(metrics.overflow).toBeLessThanOrEqual(0)
        }
        await page.hover(linkFor(unplanned))
        await page.waitForSelector('#card-tooltip:not([hidden])')
        expect(await page.$eval('#card-tooltip strong', tip => tip.textContent)).toBe(longTitle)
      }
      finally {
        await page.close()
      }
    })

    it.each([
      ['light', '/catalog-landscape.jpg'],
      ['dark', '/catalog-landscape-night.jpg'],
    ])('loads the %s landscape and keeps the first demand visible on a short viewport', async (theme, artworkPath) => {
      const page = await browser.newPage()
      try {
        await page.setViewport({ width: 375, height: 520, hasTouch: true })
        await page.setCacheEnabled(false)
        await preferTheme(page, theme)
        const [landscape] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === artworkPath, { timeout: 4_000 }),
          page.goto(server.address),
        ])
        expect(landscape.ok()).toBe(true)
        expect(landscape.headers()['content-type']).toBe('image/jpeg')
        await waitForTheme(page, theme)
        const backgrounds = await page.$eval('.intro', el => [
          getComputedStyle(el).backgroundImage,
          getComputedStyle(el, '::before').backgroundImage,
          getComputedStyle(el, '::after').backgroundImage,
        ])
        expect(backgrounds.some(background => background.includes(landscape.url()))).toBe(true)
        await waitForCards(page, ['plan', unplanned, archived, research])
        const firstCard = await page.$eval('.section[data-bucket="active"] .card', (el) => {
          const { top, right, bottom, left } = el.getBoundingClientRect()
          return top > 0 && bottom <= innerHeight && left >= 0 && right <= innerWidth
        })
        expect(firstCard).toBe(true)
      }
      finally {
        await page.close()
      }
    })

    it.each(['light', 'dark'])('keeps the %s active list stable beside the archive rail when filtering', async (theme) => {
      const page = await browser.newPage()
      const layout = () => page.$eval('#results', (el) => {
        const measure = (bucket) => {
          const section = el.querySelector(`.section[data-bucket="${bucket}"]`)
          if (!section)
            return null
          const { left, right, top, width } = section.getBoundingClientRect()
          const cards = section.querySelector('.cards')
          const columns = getComputedStyle(cards).gridTemplateColumns
          const firstCard = cards.firstElementChild.getBoundingClientRect()
          return { left, right, top, width, firstCardTop: firstCard.top, firstCardWidth: firstCard.width, columnCount: columns.split(' ').length }
        }
        return {
          active: measure('active'),
          archive: measure('archive'),
          width: el.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth - innerWidth,
        }
      })
      try {
        await page.setViewport({ width: 1440, height: 820, hasTouch: true })
        await preferTheme(page, theme)
        await page.goto(server.address)
        await waitForTheme(page, theme)
        await waitForCards(page, ['plan', unplanned, archived, research])
        for (const width of [1440, 1080]) {
          await page.setViewport({ width, height: 820, hasTouch: true })
          const { active, archive, overflow } = await layout()
          expect(active.columnCount).toBe(1)
          expect(archive.columnCount).toBe(1)
          expect(archive.width).toBeGreaterThan(250)
          expect(archive.width).toBeLessThan(active.width)
          expect(archive.left - active.right).toBeGreaterThanOrEqual(16)
          expect(Math.abs(archive.top - active.top)).toBeLessThanOrEqual(1)
          expect(active.firstCardTop).toBeLessThanOrEqual(350)
          expect(overflow).toBeLessThanOrEqual(0)

          await page.click('button[data-scope="active"]')
          await waitForCards(page, ['plan', unplanned, research])
          const activeOnly = await layout()
          expect(activeOnly.archive).toBeNull()
          expect(activeOnly.active).toMatchObject({ left: active.left, width: active.width, firstCardWidth: active.firstCardWidth })
          expect(activeOnly.overflow).toBeLessThanOrEqual(0)
          await page.click('button[data-scope="all"]')
          await waitForCards(page, ['plan', unplanned, archived, research])
        }
        await page.click('button[data-scope="archive"]')
        await waitForCards(page, [archived])
        const archiveOnly = await layout()
        expect(archiveOnly.active).toBeNull()
        expect(archiveOnly.archive.width).toBeCloseTo(archiveOnly.width)
        expect(archiveOnly.overflow).toBeLessThanOrEqual(0)

        await page.click('button[data-scope="all"]')
        await waitForCards(page, ['plan', unplanned, archived, research])
        const { active } = await layout()
        await page.type(search, '批量确认')
        await waitForCards(page, ['plan'])
        const matching = await layout()
        expect(matching.archive).toBeNull()
        expect(matching.active).toMatchObject({ left: active.left, width: active.width, firstCardWidth: active.firstCardWidth })
        await page.click('#clear-query')
        await waitForCards(page, ['plan', unplanned, archived, research])
        const tap = await page.$eval(`${cards}[data-task-id="plan"]`, (card) => {
          const { left, bottom } = card.getBoundingClientRect()
          const title = card.querySelector('h3').getBoundingClientRect()
          const progress = card.querySelector('progress').getBoundingClientRect()
          return { x: left + 6, y: bottom - 6, progressGap: progress.top - title.bottom }
        })
        expect(tap.progressGap).toBeGreaterThanOrEqual(0)
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.touchscreen.tap(tap.x, tap.y)])
        expect(new URL(page.url()).pathname).toBe('/tasks/plan/')
      }
      finally {
        await page.close()
      }
    })

    it('finds demands by label and highlights only the labels that match', async () => {
      const page = await browser.newPage()
      const tags = `${cards}[data-task-id="plan"] .card-tag`
      const highlighted = () => page.$$eval(`${tags}[data-matched]`, items => items.map(item => item.textContent))
      try {
        await page.goto(server.address)
        await waitForCards(page, ['plan', unplanned, archived, research])
        expect(await page.$$eval(tags, items => items.map(item => item.textContent))).toEqual(featureTitles)
        expect(await highlighted()).toEqual([])
        await page.type(search, '批量确认')
        await waitForCards(page, ['plan'])
        expect(await highlighted()).toEqual(['批量确认'])
        await page.click('#clear-query')
        await page.type(search, '陈列模板生成')
        await waitForCards(page, ['plan'])
        expect(await highlighted()).toEqual([])
      }
      finally {
        await page.close()
      }
    })

    it('shares the card and canvas geometry across navigation in both directions', async () => {
      const page = await browser.newPage()
      try {
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
        await page.bringToFront()
        await page.evaluateOnNewDocument(() => {
          window.addEventListener('pagereveal', (event) => {
            const transition = event.viewTransition
            if (!transition)
              return
            transition.ready.then(() => {
              const surfaceMoved = document.getAnimations().some(animation =>
                animation instanceof CSSAnimation && animation.animationName === '-ua-view-transition-group-anim-requirement-surface')
              document.documentElement.dataset.surfaceMoved = String(surfaceMoved)
            }, () => {
              document.documentElement.dataset.surfaceMoved = 'skipped'
            })
          })
        })
        await page.goto(server.address)
        if (!await page.evaluate(() => 'PageRevealEvent' in window))
          return
        async function moved(direction) {
          await page.waitForFunction(() => 'surfaceMoved' in document.documentElement.dataset, { timeout: 4_000 })
          expect(await page.$eval('html', html => html.dataset.surfaceMoved), direction).toBe('true')
        }
        await follow(page, linkFor('plan'))
        await moved('catalog to canvas')
        await follow(page, '#catalog-home')
        await moved('canvas to catalog')
        await waitForCards(page, [archived, unplanned, 'plan', research])
      }
      finally {
        await page.close()
      }
    })

    it('previews card details with mouse or keyboard and opens the same information on a touch screen', async () => {
      const page = await browser.newPage()
      const tip = '#card-tooltip:not([hidden])'
      try {
        await page.setViewport({ width: 665, height: 623 })
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
        await page.goto(server.address)
        const card = linkFor('plan')
        const cardStyle = () => page.$eval(card, (link) => {
          const box = link.closest('article')
          const css = getComputedStyle(box)
          const { width, height } = box.getBoundingClientRect()
          return { color: css.borderColor, border: css.borderWidth, outline: css.outlineStyle, linkOutline: getComputedStyle(link).outlineStyle, shadow: css.boxShadow, width, height }
        })
        const idle = await cardStyle()
        expect(idle).toMatchObject({ border: '1px', outline: 'none', linkOutline: 'none' })
        await page.hover(card)
        await page.waitForSelector(tip)
        const hover = await cardStyle()
        expect(hover).toEqual({ ...idle, color: expect.any(String) })
        expect(hover.color).not.toBe(idle.color)
        expect(await page.$eval(tip, el => el.textContent)).toContain('2 / 11 个场景通过')
        expect(await page.$eval(tip, el => el.textContent)).toContain('涉及功能')
        const fits = await page.$eval(tip, (el) => {
          const r = el.getBoundingClientRect()
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
        })
        expect(fits).toBe(true)
        await page.keyboard.press('Escape')
        await page.waitForSelector(tip, { hidden: true })
        await page.mouse.down()
        expect(await cardStyle()).toEqual(hover)
        await page.mouse.move(1, 1)
        await page.mouse.up()
        await page.focus(search)
        expect(await cardStyle()).toEqual(idle)
        await page.keyboard.press('Tab')
        await page.focus(card)
        await page.waitForSelector(tip)
        expect(await cardStyle()).toEqual({ ...hover, outline: 'solid' })
        expect(await page.$eval(card, el => el.getAttribute('aria-describedby'))).toBe('card-tooltip')
        await page.keyboard.press('Escape')
        await page.waitForSelector(tip, { hidden: true })
        await page.setViewport({ width: 390, height: 720, hasTouch: true })
        await Promise.all([page.waitForNavigation(), page.tap(card)])
        await drawerReady(page)
        expect(await visibleDetail(page)).toContain('2 / 11 个场景通过')
        expect(await visibleDetail(page)).toContain('涉及功能')
        await follow(page, '#inspector .drawer-home')
        await waitForCards(page, [archived, unplanned, 'plan', research])
        await page.click('button[data-scope="archive"]')
        await follow(page, '#catalog-home')
        expect(new URL(page.url()).search).toBe('')
        await waitForCards(page, [archived, unplanned, 'plan', research])
      }
      finally {
        await page.close()
      }
    })

    it('lists active and archived requirements with only currently verifiable scenario progress', async () => {
      const page = await browser.newPage()
      try {
        await page.goto(server.address)
        await waitForCards(page, ['plan', unplanned, archived, research])
        expect(await page.$eval('button[data-scope="all"]', b => b.getAttribute('aria-pressed'))).toBe('true')
        const rows = await page.$$eval(cards, elements => Object.fromEntries(elements.map((row) => {
          const bar = row.querySelector('progress')
          return [row.dataset.taskId, { bucket: row.dataset.bucket, fraction: bar.position, description: bar.getAttribute('aria-valuetext') }]
        })))
        // Two current receipts pass; the once-valid but edited artifact for SC-3 does not count.
        expect(rows.plan.bucket).toBe('active')
        expect(rows.plan.fraction).toBeCloseTo(2 / 11, 2)
        expect(rows[research]).toMatchObject({ bucket: 'active', fraction: 1, description: expect.stringContaining('调研') })
        expect(rows[unplanned]).toMatchObject({ bucket: 'active', fraction: -1 })
        expect(rows[archived]).toMatchObject({ bucket: 'archive', fraction: -1 })
        expect(rows[unplanned].description).toBeTruthy()
        expect(rows[archived].description).toBeTruthy()
      }
      finally {
        await page.close()
      }
    })

    it('searches long titles on mobile and returns to the same filtered list from an archived graph', async () => {
      const page = await browser.newPage()
      try {
        await page.setViewport({ width: 375, height: 667, hasTouch: true })
        await page.goto(server.address)
        await waitForCards(page, [archived, unplanned, 'plan', research])
        expect(await page.$eval(linkFor(unplanned), a => a.textContent)).toContain(longTitle)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.click('button[data-scope="active"]')
        await waitForCards(page, [unplanned, 'plan', research])
        await page.click('button[data-scope="all"]')
        await page.type(search, '目录检索')
        await waitForCards(page, [unplanned, archived])
        await page.click('button[data-scope="archive"]')
        await waitForCards(page, [archived])
        await waitForFilterLink(page, 'scope', 'archive')
        // The on-screen keyboard leaves a short scrolling viewport even with compact cards.
        await page.setViewport({ width: 375, height: 240, hasTouch: true })
        await page.$eval(linkFor(archived), link => link.scrollIntoView({ block: 'center' }))
        const scroll = await page.evaluate(() => scrollY)
        expect(scroll).toBeGreaterThan(0)
        const filteredUrl = page.url()
        expect(new URL(filteredUrl).searchParams.get('q')).toBe('目录检索')
        const href = await page.$eval(linkFor(archived), el => el.href)
        expect(decodeURIComponent(new URL(href).pathname)).toBe(`/tasks/${archived}/`)
        await follow(page, linkFor(archived))
        expect(await page.$eval('h1', el => el.textContent)).toBe(archivedTitle)
        const archiveLabel = await page.waitForSelector('header #archive-label', { visible: true })
        expect(await archiveLabel.evaluate(el => el.textContent)).toBe('已归档')
        await page.goBack({ waitUntil: 'domcontentloaded' })
        await waitForCards(page, [archived])
        expect(page.url()).toBe(filteredUrl)
        // The returning card's snapshot owns its paint until the shared transition settles.
        await page.waitForFunction((selector) => {
          const link = document.querySelector(selector)
          if (!link)
            return false
          const { x, y, width, height } = link.getBoundingClientRect()
          return link.contains(document.elementFromPoint(x + width / 2, y + height / 2))
        }, { timeout: 4_000 }, linkFor(archived))
        await follow(page, linkFor(archived))
        expect(await page.$eval('#catalog-home', a => a.pathname + a.search)).toBe('/')
        await follow(page, '#catalog-return')
        await waitForCards(page, [archived])
        expect(page.url()).toBe(filteredUrl)
        await page.waitForFunction(y => Math.abs(scrollY - y) < 2, { timeout: 3_000 }, scroll)
        expect(await page.$eval(search, input => input.value)).toBe('目录检索')
        await page.type(search, '无匹配')
        await waitForCards(page, [])
        await page.waitForSelector('#empty', { visible: true })
        expect(await page.$eval('#result-count', el => el.textContent)).toContain('0')
      }
      finally {
        await page.close()
      }
    })

    it('restores legacy links and keeps the graph, AI record and citations scoped to the selected task', async () => {
      const [plan, draft] = await Promise.all([browser.newPage(), browser.newPage()])
      try {
        await Promise.all([
          plan.goto(`${server.address}?view=detail&features=S-4#node=C-4`),
          draft.goto(server.address),
        ])
        await follow(draft, linkFor(unplanned))
        await plan.bringToFront()
        expect(new URL(plan.url()).pathname).toBe('/tasks/plan/')
        expect(await plan.evaluate(() => location.hash)).toBe('#node=C-4')
        await drawerReady(plan)
        expect(await plan.$eval('#panel-title', el => el.textContent)).toBe('批量确认')
        expect(await draft.$eval('h1', el => el.textContent)).toBe(longTitle)
        const aiRecord = page => page.$eval('#ai-record', async link => (await fetch(link.href)).json())
        const [context, model] = await Promise.all([aiRecord(plan), aiRecord(draft)])
        expect(Object.keys(context.stories)).toEqual(['S-4'])
        expect(model.work.id).toBe(unplanned)
        expect(model.work.stories).toEqual({})
        await plan.click('.endpoint-list .endpoint')
        await endpointReady(plan)
        const sourceLookup = plan.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.pathname === '/tasks/plan/source-location' && url.searchParams.get('ref')?.endsWith('prd.md:6') && response.ok()
        }, { timeout: 4_000 })
        const list = '#endpoint-drawer .source-list'
        await Promise.all([sourceLookup, plan.click(`${list} > summary`)])
        await (await plan.waitForSelector(`${list} ${previewTrigger}`, { visible: true })).click()
        await expectSourceLine(plan, '6保留原有位置方案')
        await draft.bringToFront()
        await draft.goto(`${server.address}#node=S-4`)
        await drawerReady(draft)
        expect(new URL(draft.url()).pathname).toBe('/tasks/plan/')
        expect(await draft.$eval('#panel-title', el => el.textContent)).toBe('批量确认')
      }
      finally {
        await Promise.all([plan.close(), draft.close()])
      }
    })

    it('shows an empty project without placeholder requirements', async () => {
      const emptyProject = mkdtempSync(path.join(tmpdir(), 'airules-empty-'))
      const page = await browser.newPage()
      let emptyServer
      try {
        runFlow(emptyProject, 'init')
        emptyServer = await startServer(emptyProject, 'serve', '--port', '0')
        await page.goto(emptyServer.address)
        await page.waitForSelector('#empty', { visible: true })
        expect(await page.$$eval(cards, rows => rows.length)).toBe(0)
        expect(await page.$eval('#result-count', el => el.textContent)).toContain('0')
      }
      finally {
        await page.close()
        await emptyServer?.stop()
        rmSync(emptyProject, { recursive: true, force: true })
      }
    })

    it('refreshes cards and total progress on return while preserving a focused search', async () => {
      const page = await browser.newPage()
      const artifact = readFileSync(batchArtifact)
      const later = 'later-request'
      let otherTab
      try {
        await page.goto(server.address)
        await page.type(search, '确认')
        await waitForCards(page, ['plan'])
        expect(await page.$eval('#overview progress', bar => [bar.value, bar.max])).toEqual([2, 11])
        otherTab = await browser.newPage()
        await otherTab.bringToFront()
        await page.waitForFunction(() => document.hidden, { polling: 100, timeout: 3_000 })
        runFlow(project, 'new', later, '--request', '确认后是否可撤回')
        writeFileSync(batchArtifact, 'updated since it was reviewed')
        await page.bringToFront()
        await waitForCards(page, ['plan', later])
        expect(await page.$eval('#overview progress', bar => [bar.value, bar.max])).toEqual([1, 11])
        expect(await page.$eval('article[data-task-id="plan"] progress', bar => [bar.value, bar.max])).toEqual([1, 11])
        expect(await page.$eval(search, input => [input.value, document.activeElement === input])).toEqual(['确认', true])
      }
      finally {
        await page.close()
        await otherTab?.close()
        writeFileSync(batchArtifact, artifact)
        rmSync(path.join(project, '.requirements/active', later), { recursive: true, force: true })
      }
    })

    it.each(['?view=detail#node=D-scope', '#node=D-scope'])('preserves a decision draft when upgrading the single-task port at %s', async (route) => {
      let viewer = await startViewer(project)
      const page = await browser.newPage()
      const note = '等待核对两份资料的适用范围'
      const writes = []
      page.on('request', (request) => {
        if (request.method() === 'POST')
          writes.push(new URL(request.url()).pathname)
      })
      try {
        await page.goto(viewer.address + route)
        await drawerReady(page)
        await page.type('input[name="reason"]', note)
        const port = new URL(viewer.address).port
        await viewer.stop()
        viewer = await startServer(project, 'serve', '--port', port, '--default-task', 'plan')
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
        await page.waitForSelector('#notice:not([hidden]) #refresh', { visible: true, timeout: 5_000 })
        await follow(page, '#refresh')
        await drawerReady(page)
        expect(await page.$eval('input[name="reason"]', input => input.value)).toBe(note)
        expect(await page.evaluate(() => location.pathname + location.hash)).toBe('/tasks/plan/#node=D-scope')
        expect(writes).toEqual([])
      }
      finally {
        await page.close()
        await viewer.stop()
      }
    })
  })

  it('keeps graph captions in a keyboard-accessible tooltip and closes it before opening the drawer', async () => {
    const page = await open(665, 623, '?view=overview&features=S-4')
    const node = '[data-node="S-4"]'
    const tip = '#card-tooltip:not([hidden])'
    try {
      const frameStyle = () => page.$eval(node, (group) => {
        const outline = group.querySelector('.outline')
        const css = getComputedStyle(outline)
        const { width, height } = outline.getBBox()
        return { stroke: css.stroke, line: css.strokeWidth, outline: getComputedStyle(group).outlineStyle, width, height }
      })
      const idle = await frameStyle()
      expect(Number.parseFloat(idle.line)).toBeGreaterThan(0)
      expect(Number.parseFloat(idle.line)).toBeLessThanOrEqual(1.5)
      await page.hover(node)
      await page.waitForSelector(tip)
      const hover = await frameStyle()
      expect(hover).toEqual({ ...idle, stroke: expect.any(String), outline: 'none' })
      expect(hover.stroke).not.toBe(idle.stroke)
      const body = await page.$eval(tip, el => el.textContent)
      expect(body).toContain('跨页选择门店类型后统一确认')
      const captions = await page.$$eval(`${node} .n-caption`, labels => labels.map(el => el.textContent))
      expect(captions[0]).toMatch(/^跨页选择门店类型/u)
      expect(captions[1]).toMatch(/下一步|待决定|待处理|进行中/u)
      expect(captions.every(text => text.length < body.length)).toBe(true)
      await page.keyboard.press('Escape')
      await page.waitForSelector(tip, { hidden: true })
      const bounds = await (await page.$(node)).boundingBox()
      await page.mouse.move(bounds.x + 20, bounds.y + 10)
      await page.mouse.down()
      await page.mouse.move(bounds.x + 48, bounds.y + 18, { steps: 4 })
      expect(await page.$(tip)).toBeNull()
      await page.mouse.up()
      await page.mouse.move(0, 0)
      await page.$eval('[data-node="@request"]', group => group.focus())
      expect(await frameStyle()).toEqual(idle)
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement.getAttribute('data-node'))).toBe('S-4')
      await page.waitForSelector(tip)
      expect(await frameStyle()).toEqual(hover)
      await page.keyboard.press('Enter')
      await drawerReady(page)
      expect(await page.$(`${node}.selected`)).not.toBeNull()
      expect(await frameStyle()).toEqual(hover)
      expect(await page.$(tip)).toBeNull()
      expect(await visibleDetail(page)).toContain('跨页选择门店类型后统一确认')
      await page.keyboard.press('Escape')
      await drawerClosed(page)
      await page.keyboard.press('Tab')
      expect(await frameStyle()).toEqual(idle)
    }
    finally {
      await page.close()
    }
  })

  it('starts with readable cards and protects zoom from mouse, trackpad and touch gestures', async () => {
    const page = await open(476, 623)
    try {
      expect(await scale(page)).toBe(100)
      expect(await page.$eval('#zoom-lock', el => el.getAttribute('aria-pressed'))).toBe('true')
      const storyVisibleAtReadingSize = await page.evaluate(() => {
        const canvas = document.querySelector('#map').getBoundingClientRect()
        return [...document.querySelectorAll('[data-node^="S-"] .outline')].some((card) => {
          const r = card.getBoundingClientRect()
          return r.width >= 150 && r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom
        })
      })
      expect(storyVisibleAtReadingSize).toBe(true)
      const box = await page.$eval('[data-node="S-4"]', (node) => {
        const card = node.querySelector('.outline').getBBox()
        return [card.width, card.height, Number(node.querySelector('.n-title').getAttribute('font-size'))]
      })
      expect(box[0]).toBeLessThanOrEqual(175)
      expect(box[1]).toBeLessThanOrEqual(96)
      expect(await page.$$eval('[data-node="S-4"] .n-caption', labels => labels.length)).toBe(2)
      expect(box[2]).toBeGreaterThanOrEqual(15)
      const controls = await page.evaluate(() => {
        const canvas = document.querySelector('#map').getBoundingClientRect()
        const lock = document.querySelector('#zoom-lock').getBoundingClientRect()
        const plus = document.querySelector('#plus').getBoundingClientRect()
        const minus = document.querySelector('#minus').getBoundingClientRect()
        return {
          nearTopRight: lock.right >= canvas.right - 72 && Math.abs(lock.top - canvas.top) < 85,
          aligned: Math.abs(plus.top - minus.top) <= 2 && Math.abs(plus.top - lock.top) <= 2,
          fitsViewport: document.documentElement.scrollWidth <= innerWidth,
        }
      })
      expect(controls).toEqual({ nearTopRight: true, aligned: true, fitsViewport: true })
      const { wheel, pinch } = await gestures(page)
      const beforePan = await page.$eval('#map', el => el.getAttribute('viewBox'))
      await wheel()
      expect(await page.$eval('#map', el => el.getAttribute('viewBox'))).not.toBe(beforePan)
      await wheel(2)
      await pinch()
      expect(await scale(page)).toBe(100)
      await page.click('#plus')
      expect(await scale(page)).toBeGreaterThan(100)
      await page.click('#minus')
      expect(await scale(page)).toBe(100)
      await page.click('#zoom-lock')
      expect(await page.$eval('#zoom-lock', el => el.getAttribute('aria-pressed'))).toBe('false')
      await wheel(2)
      const afterWheel = await scale(page)
      expect(afterWheel).toBeGreaterThan(100)
      await pinch()
      expect(await scale(page)).toBeGreaterThan(afterWheel)
      await page.click('#scale')
      expect(await scale(page)).toBe(100)
      await page.reload()
      expect(await page.$eval('#zoom-lock', el => el.getAttribute('aria-pressed'))).toBe('false')
    }
    finally {
      await page.close()
    }
  })

  it('filters into a feature chain, fits all of its cards, and retains deep links', async () => {
    const page = await open(1160, 760)
    try {
      await page.click('#filter-toggle')
      await page.click('#feature-list [aria-label="维护位置图片"]')
      await page.click('#filter-done')
      expect(await page.$eval('#detail-mode', el => el.getAttribute('aria-pressed'))).toBe('true')
      expect(await scale(page)).toBe(100)
      const feature = await page.$$eval('#stations [data-node]', els => els.map(el => el.dataset.node))
      expect(feature).toEqual(expect.arrayContaining(['S-5', 'C-5', 'A-5', 'V-5']))
      expect(feature).not.toContain('A-4')
      await page.click('#fit')
      const allFit = await page.evaluate(() => {
        const map = document.querySelector('#map').getBoundingClientRect()
        return [...document.querySelectorAll('#stations .outline')].every((card) => {
          const r = card.getBoundingClientRect()
          return r.left >= map.left - 1 && r.right <= map.right + 1 && r.top >= map.top - 1 && r.bottom <= map.bottom + 1
        })
      })
      expect(allFit).toBe(true)
      await page.click('[data-node="C-5"]')
      await page.waitForFunction(() => location.hash === '#node=C-5', { timeout: 5_000 })
      await page.reload()
      await drawerReady(page)
      expect(await page.$eval('.endpoint-method', el => el.textContent)).toBe('POST')
      expect(await page.$eval('.endpoint-path', el => el.textContent)).toBe('/display/5')
      // The filter button sits underneath the backdrop on this desktop viewport.
      await page.click('#filter-toggle')
      await drawerClosed(page)
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('false')
      expect(await page.evaluate(() => document.activeElement.dataset.node)).toBe('C-5')
      await page.click('#filter-toggle')
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('true')
      await page.keyboard.press('Escape')
      await page.click('#overview-mode')
      expect(await page.$eval('#overview-mode', el => el.getAttribute('aria-pressed'))).toBe('true')
      expect(await page.$eval('#reopen-panel', el => el.hidden)).toBe(true)
      await page.click('[data-node="S-5"]')
      await drawerReady(page)
      const overview = page.url()
      await page.click('#detail .inspect-feature')
      await drawerClosed(page)
      expect(await page.$eval('#detail-mode', el => el.getAttribute('aria-pressed'))).toBe('true')
      await page.goBack()
      await drawerReady(page)
      expect(page.url()).toBe(overview)
      expect(await page.$eval('#detail .inspect-feature', el => el === document.activeElement)).toBe(true)
      await page.goForward()
      await drawerClosed(page)
      expect(new URL(page.url()).searchParams.get('features')).toBe('S-5')
    }
    finally {
      await page.close()
    }
  })

  it.each([320, 375, 665, 1160])('overlays a full-viewport modal without moving the canvas at %ipx', async (width) => {
    const page = await open(width, 623, '?view=overview&features=S-4')
    try {
      await page.click('#plus')
      const before = await canvasState(page)
      const originalZoom = await scale(page)
      await page.click('[data-node="S-4"]')
      await drawerReady(page)
      expect(await canvasState(page)).toEqual(before)
      const bounds = await page.evaluate(() => {
        const drawer = document.querySelector('#inspector')
        const panel = drawer.getBoundingClientRect()
        const backdrop = document.querySelector('#drawer-backdrop').getBoundingClientRect()
        return {
          panel: { x: panel.x, top: panel.top, right: panel.right, height: panel.height, width: panel.width },
          backdrop: { x: backdrop.x, y: backdrop.y, width: backdrop.width, height: backdrop.height },
          hit: document.elementFromPoint(panel.x / 2, 10)?.id,
          dialog: [drawer.getAttribute('role'), drawer.getAttribute('aria-modal')],
          backgroundInert: document.querySelector('.app').inert,
          overflows: document.documentElement.scrollWidth > innerWidth || drawer.scrollWidth > drawer.clientWidth + 1,
        }
      })
      expect(bounds.dialog).toEqual(['dialog', 'true'])
      expect(bounds.backgroundInert).toBe(true)
      expect(bounds.backdrop).toEqual({ x: 0, y: 0, width, height: 623 })
      expect(bounds.panel.top).toBe(0)
      expect(bounds.panel.right).toBe(width)
      expect(bounds.panel.height).toBe(623)
      expect(bounds.panel.x).toBeGreaterThanOrEqual(24)
      expect(bounds.panel.width).toBeGreaterThanOrEqual(Math.min(270, width - 48))
      expect(bounds.hit).toBe('drawer-backdrop')
      expect(bounds.overflows).toBe(false)

      await page.mouse.move(bounds.panel.x / 2, 330)
      await page.mouse.wheel({ deltaY: 120 })
      await page.keyboard.press('ArrowRight')
      expect(await canvasState(page)).toEqual(before)
      expect(await scale(page)).toBe(originalZoom)
      await page.mouse.click(bounds.panel.x / 2, 330)
      await drawerClosed(page)
      expect(await canvasState(page)).toEqual(before)
      expect(await page.evaluate(() => document.activeElement.dataset.node)).toBe('S-4')
      await page.click('#minus')
      expect(await scale(page)).toBeLessThan(originalZoom)
    }
    finally {
      await page.close()
    }
  })

  it('traps keyboard focus and returns it to the opener across Escape, reopen and the close button', async () => {
    const page = await open(665, 623, '?view=overview&features=S-4#node=S-4')
    try {
      const trigger = '[data-node="S-4"]'
      expect(await page.evaluate(() => document.activeElement.id)).toBe('close-panel')
      await page.keyboard.down('Shift')
      await page.keyboard.press('Tab')
      await page.keyboard.up('Shift')
      expect(await page.evaluate(() => document.querySelector('#inspector').contains(document.activeElement))).toBe(true)
      expect(await page.evaluate(() => document.activeElement.id)).not.toBe('close-panel')
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement.id)).toBe('close-panel')

      const proof = '#detail .acceptance-group[data-state="passed"] details.case-proof'
      await page.click(`${proof} > summary`)
      const scrollPosition = await page.$eval('#detail', (el) => {
        el.scrollTop = 80
        return el.scrollTop
      })
      expect(scrollPosition).toBeGreaterThan(0)
      await page.keyboard.press('Escape')
      await drawerClosed(page)
      expect(await page.$eval(trigger, el => el === document.activeElement)).toBe(true)
      expect(await page.evaluate(() => location.hash)).toBe('#work')

      await page.click('#reopen-panel')
      await drawerReady(page)
      expect(await page.$eval('#panel-title', el => el.textContent)).toBe('批量确认')
      expect(await page.$eval(proof, el => el.open)).toBe(true)
      expect(await page.$eval('#detail', el => el.scrollTop)).toBe(scrollPosition)
      await page.click('#close-panel')
      await drawerClosed(page)
      expect(await page.evaluate(() => document.activeElement.id)).toBe('reopen-panel')
    }
    finally {
      await page.close()
    }
  })

  it('shows the outstanding business check first and keeps the original evidence one click away from its scenario', async () => {
    const page = await open(665, 623, '?view=overview&features=S-4#node=S-4')
    try {
      const panel = '#detail'
      const pending = `${panel} .acceptance-group[data-state="open"]`
      const passed = `${panel} .acceptance-group[data-state="passed"]`
      const toolsAreStacked = await page.$$eval(`${panel} .story-tools > *`, (rows) => {
        const bounds = rows.map(row => row.getBoundingClientRect())
        return bounds.length >= 3 && bounds.slice(1).every((row, index) =>
          row.left === bounds[0].left && row.width === bounds[0].width && row.top >= bounds[index].bottom)
      })
      expect(toolsAreStacked).toBe(true)
      const titles = group => page.$$eval(`${group} .case-title`, els => els.map(el => el.textContent))
      expect(await titles(pending)).toEqual(['在门户回读批量写入结果'])
      expect(await titles(passed)).toEqual(['跨页确认门店类型', '重试批量提交'])
      expect(await page.$eval(`${pending} .case-scope`, el => el.textContent)).toBe('真实环境待验证')
      expect(await page.$$eval(`${passed} .case-scope`, els => els.map(el => el.textContent)))
        .toEqual(['自动化测试通过', '自动化测试通过'])
      expect(await page.$$eval(`${passed} .case-outcome`, els => els.map(el => el.textContent)))
        .toEqual(['只提交选中的门店类型', '超时后保留原选择'])
      expect(await page.$eval(`${pending} .case-title`, (title) => {
        const item = title.getBoundingClientRect()
        const viewport = document.querySelector('#detail').getBoundingClientRect()
        return item.top >= viewport.top && item.bottom <= viewport.bottom
      })).toBe(true)
      expect(await visibleDetail(page)).not.toMatch(/AC-pages|raw-check-|merchandising-spec\/|SHA-256/u)

      const proof = await page.$(`${passed} .case-row details.case-proof`)
      expect(await proof.evaluate(el => el.open)).toBe(false)
      await (await proof.$('summary')).click()
      expect(await visibleDetail(page)).toContain('raw-check-AC-pages')
      expect(await visibleDetail(page)).toContain('本机跨页组件测试')
      const download = await proof.$eval('a[download]', a => a.href)
      expect(new URL(download).pathname).toMatch(/\/evidence\/[\da-f]{32}\/output\.log$/u)
      expect(readFileSync(fileURLToPath(download), 'utf8')).toContain('raw-check-AC-pages')
      expect(await proof.evaluate(el => el.open)).toBe(true)
      await (await proof.$('summary')).click()

      const files = `${panel} details.source-list`
      expect(await page.$eval(files, el => el.open)).toBe(false)
      await page.click(`${files} > summary`)
      const source = `${files} details.source-file`
      expect(await page.$$eval(`${source} > summary`, els => els.map(el => el.textContent)))
        .toEqual(['批量确认规则.md:340', 'prd.md:6', 'prd.md:12'])
      expect(await visibleDetail(page)).toContain('沿用运营确认的门店范围')
      expect(await visibleDetail(page)).not.toContain(batchSource)
      await page.click(`${source} > summary`)
      expect(await visibleDetail(page)).toContain(batchSource)
      const references = await page.$$(`${source} > summary`)
      await references[1].click()
      expect(await visibleDetail(page)).toContain('.requirements/history/tasks/plan-batch/prd.md:6')
      expect(await visibleDetail(page)).not.toContain('.moluoxixi/tasks/')
      await page.click(`${files} > summary`)
      expect(await visibleDetail(page)).not.toContain(batchSource)
    }
    finally {
      await page.close()
    }
  })

  async function endpointReady(page) {
    await page.waitForFunction(() => {
      const dialog = document.querySelector('#endpoint-drawer')
      return dialog.open && dialog.getAnimations().every(animation => animation.playState === 'finished')
    })
  }
  function endpointClosed(page) {
    return page.waitForFunction(() => !document.querySelector('#endpoint-drawer').open && !location.hash.includes('&endpoint='))
  }
  const sourceDialog = '#source-drawer[open]'
  async function expectSourceLine(page, text) {
    await page.waitForFunction(wanted => document.querySelector('#source-drawer[open] .source-target-line')?.textContent === wanted, { timeout: 6_000 }, text)
    await page.waitForFunction(() => document.querySelector('#source-drawer').getAnimations().every(animation => animation.playState === 'finished'))
    expect(await page.$eval(sourceDialog, el => el.matches(':modal'))).toBe(true)
  }
  function sourceClosed(page) {
    return page.waitForFunction(() => !document.querySelector('#source-drawer[open]') && !new URLSearchParams(location.hash.slice(1)).has('source'))
  }
  function drawerPath(page) {
    return page.evaluate(() => {
      const params = new URLSearchParams(location.hash.slice(1))
      return { via: params.getAll('via'), node: params.get('node'), endpoint: params.get('endpoint'), source: params.get('source'), side: params.get('side') }
    })
  }
  it.each([320, 615, 1160])('reads a single API in a nested modal and returns to the same list at %ipx', async (width) => {
    const page = await open(width, 350, '?view=detail&features=S-4#node=C-4')
    try {
      const cards = '.endpoint-list > button.endpoint'
      expect(await page.$$eval(cards, rows => rows.map(row => [
        row.querySelector('.endpoint-method').textContent,
        row.querySelector('strong').textContent,
        row.querySelector('.endpoint-path').textContent,
      ]))).toEqual([
        ['POST', '保存批量确认', '/api/orders/bulk/confirmation/selection/save-confirm'],
        ['POST', '撤销批量确认', '/api/orders/bulk/confirmation/selection/undo-confirm'],
      ])
      expect(await visibleDetail(page)).toContain('确认后重新查询列表。')
      expect(await visibleDetail(page)).not.toMatch(/operations|confirmedCount|typeIds|调用与职责/u)
      const [save, undo] = await page.$$(cards)
      const originalView = await canvasState(page)
      const originalScroll = await page.$eval('#detail', (el) => {
        el.scrollTop = 25
        return el.scrollTop
      })
      expect(originalScroll).toBeGreaterThan(0)
      await save.focus()
      await page.keyboard.press('Enter')
      await endpointReady(page)
      const child = '#endpoint-drawer'
      const fields = '#endpoint-fields'
      const tabs = '#endpoint-drawer .endpoint-tabs > button'
      const [request, response] = await page.$$(tabs)
      expect(await page.$eval(child, el => el.matches(':modal'))).toBe(true)
      expect(await page.$eval('#inspector', el => el.inert)).toBe(true)
      expect(await page.evaluate(() => document.activeElement.id)).toBe('endpoint-close')
      expect(await page.$$eval(tabs, buttons => buttons.map(b => b.textContent))).toEqual(['请求字段（1）', '响应字段（1）'])
      expect(await page.$eval(fields, el => el.textContent)).toContain('本期传 []')
      expect(await page.$eval(fields, el => el.textContent)).not.toContain('confirmedCount')
      await response.click()
      expect(await page.$eval(fields, el => el.textContent)).toContain('confirmedCount')
      expect(await page.$eval(fields, el => el.textContent)).not.toContain('operations')
      await request.click()
      expect(await page.$eval(fields, el => el.textContent)).toContain('operations')
      expect(await page.$eval(`${child} details.source-list`, el => el.open)).toBe(false)
      expect(await page.$eval(`${child} .endpoint-body`, el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await page.focus('#endpoint-drawer .endpoint-back')
      await page.keyboard.down('Shift')
      await page.keyboard.press('Tab')
      await page.keyboard.up('Shift')
      expect(await page.evaluate(() => document.querySelector('#endpoint-drawer').contains(document.activeElement))).toBe(true)
      expect(await page.evaluate(() => document.activeElement.dataset.side)).toBe('response')
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement.className)).toBe('endpoint-back')

      await page.keyboard.press('Escape')
      await endpointClosed(page)
      expect(await page.$eval('#inspector', el => el.inert)).toBe(false)
      expect(await page.$eval('.app', el => el.inert)).toBe(true)
      expect(await save.evaluate(el => el === document.activeElement)).toBe(true)
      expect(await page.$eval('#detail', el => el.scrollTop)).toBe(originalScroll)
      expect(await canvasState(page)).toEqual(originalView)
      await undo.click()
      await endpointReady(page)
      expect(await page.$eval('#endpoint-fields', el => el.textContent)).toContain('typeIds')
      await page.click(`${tabs}[data-side="response"]`)
      expect(await page.$eval(fields, el => el.textContent)).toContain('调用方仅检查业务成功状态。')
      await page.mouse.click(5, 100)
      await endpointClosed(page)
      expect(await undo.evaluate(el => el === document.activeElement)).toBe(true)
      await undo.click()
      await endpointReady(page)
      await page.click('#endpoint-close')
      await endpointClosed(page)
      expect(await page.$eval('#drawer-layer', el => el.hidden)).toBe(false)
    }
    finally {
      await page.close()
    }
  })

  it('restores both drawer levels from offline links, browser history and parent node changes', async () => {
    const page = await open(615, 623, '?view=detail&features=S-4#node=C-4')
    try {
      await page.click('.endpoint-list .endpoint')
      await endpointReady(page)
      const apiUrl = page.url()
      expect(apiUrl).toContain('&endpoint=')
      await page.goBack()
      await endpointClosed(page)
      expect(await page.evaluate(() => document.activeElement.classList.contains('endpoint'))).toBe(true)
      await page.goForward()
      await endpointReady(page)
      expect(await page.$eval('#endpoint-title', el => el.textContent)).toBe('保存批量确认')
      await page.reload()
      await endpointReady(page)
      expect(await page.$eval('#endpoint-fields .field-heading code', el => el.textContent)).toBe('operations')
      await page.click('#endpoint-drawer .endpoint-back')
      await endpointClosed(page)
      expect(await page.evaluate(() => location.hash)).toBe('#node=C-4')
      await page.goto(apiUrl)
      await endpointReady(page)
      await page.evaluate(() => {
        location.hash = 'node=S-4'
      })
      await page.waitForFunction(() => !document.querySelector('#endpoint-drawer').open && document.querySelector('#panel-title').textContent === '批量确认')
      expect(await page.$eval('#inspector', el => el.inert)).toBe(false)
      expect(await page.evaluate(() => document.activeElement.id)).toBe('close-panel')
    }
    finally {
      await page.close()
    }
  })

  it('follows a feature through the related contract, endpoint and source with browser and drawer navigation', async () => {
    const server = await startViewer(project)
    const page = await browser.newPage()
    let shared
    const relation = '#detail .link-button[data-dest="C-4"]'
    const group = '#endpoint-drawer .source-list'
    const save = '.endpoint-list button.endpoint'
    const endpointName = 'POST /api/orders/bulk/confirmation/selection/save-confirm'
    const citation = '.requirements/history/tasks/plan-batch/prd.md:6'
    page.setDefaultTimeout(5_000)
    try {
      await page.setViewport({ width: 375, height: 520 })
      await page.goto(`${server.address}?view=overview&features=S-4`)
      const canvas = await canvasState(page)
      await page.click('[data-node="S-4"]')
      await drawerReady(page)
      const storyRoute = page.url()
      const relations = '#detail details:has(> .link-button[data-dest="C-4"])'
      await page.click(`${relations} > summary`)
      await page.focus(relation)
      const storyScroll = await page.$eval('#detail', el => el.scrollTop)
      await page.keyboard.press('Enter')
      await page.waitForSelector(save)
      const contractRoute = page.url()
      expect(await drawerPath(page)).toMatchObject({ via: ['S-4'], node: 'C-4' })
      await page.click(save)
      await endpointReady(page)
      await page.click('#endpoint-drawer [data-side="response"]')
      await page.click(`${group} > summary`)
      await page.waitForSelector(`${group} ${previewTrigger}`)
      await page.click(`${group} ${previewTrigger}`)
      await expectSourceLine(page, '6保留原有位置方案')
      expect(await drawerPath(page)).toEqual({ via: ['S-4'], node: 'C-4', endpoint: endpointName, side: 'response', source: citation })
      const sourceRoute = page.url()
      expect(new URL(sourceRoute).search).toBe(new URL(storyRoute).search)
      expect(await page.$eval('#source-body', el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab')
        expect(await page.$eval(sourceDialog, el => el.contains(document.activeElement))).toBe(true)
      }

      await page.goBack()
      await sourceClosed(page)
      expect(await page.$eval(`${group} ${previewTrigger}`, el => el === document.activeElement)).toBe(true)
      expect(await page.$eval('#endpoint-fields', el => el.textContent)).toContain('confirmedCount')
      await page.goForward()
      await expectSourceLine(page, '6保留原有位置方案')
      expect(page.url()).toBe(sourceRoute)
      await page.keyboard.press('Escape')
      await sourceClosed(page)
      await page.keyboard.press('Escape')
      await endpointClosed(page)
      expect(page.url()).toBe(contractRoute)
      expect(await page.$eval(save, el => el === document.activeElement)).toBe(true)
      await page.click('#panel-back')
      await page.waitForSelector(relation, { visible: true })
      expect(page.url()).toBe(storyRoute)
      expect(await page.$eval(relations, el => el.open)).toBe(true)
      expect(await page.$eval(relation, el => el === document.activeElement)).toBe(true)
      expect(await page.$eval('#detail', el => el.scrollTop)).toBe(storyScroll)
      expect(await canvasState(page)).toEqual(canvas)
      await page.keyboard.press('Escape')
      await drawerClosed(page)
      expect(await page.evaluate(() => document.activeElement.dataset.node)).toBe('S-4')

      // A copied URL has no parent entries in the new tab's browser history.
      shared = await browser.newPage()
      shared.setDefaultTimeout(5_000)
      await shared.goto(sourceRoute)
      await expectSourceLine(shared, '6保留原有位置方案')
      await shared.reload()
      await expectSourceLine(shared, '6保留原有位置方案')
      await shared.click('#source-back')
      await sourceClosed(shared)
      expect(await shared.$eval('#endpoint-fields', el => el.textContent)).toContain('confirmedCount')
      await shared.click('#endpoint-drawer .endpoint-back')
      await endpointClosed(shared)
      await shared.click('#panel-back')
      await shared.waitForSelector('#detail .acceptance-group')
      expect(shared.url()).toBe(storyRoute)
    }
    finally {
      await shared?.close()
      await page.close()
      await server.stop()
    }
  })

  it('falls back to the nearest valid route without requesting a citation absent from the panel', async () => {
    const server = await startViewer(project)
    const page = await browser.newPage()
    const lookups = []
    page.setDefaultTimeout(5_000)
    page.on('request', (request) => {
      const address = new URL(request.url())
      if (address.pathname === '/source-location')
        lookups.push(address.searchParams.get('ref'))
    })
    try {
      const parent = new URL(`${server.address}?view=detail&features=S-4#node=C-4`)
      const route = new URL(parent)
      const hash = new URLSearchParams(parent.hash.slice(1))
      const endpoint = 'POST /api/orders/bulk/confirmation/selection/save-confirm'
      hash.set('endpoint', endpoint)
      hash.set('source', 'docs/retired.md:1')
      route.hash = hash.toString()
      await page.goto(route.href)
      await endpointReady(page)
      await sourceClosed(page)
      expect(await drawerPath(page)).toMatchObject({ node: 'C-4', endpoint, source: null })
      hash.set('endpoint', 'POST /retired')
      route.hash = hash.toString()
      await page.goto(route.href)
      await endpointClosed(page)
      await drawerReady(page)
      expect(page.url()).toBe(parent.href)
      expect(lookups).not.toContain('docs/retired.md:1')

      // An allowed source with a line beyond EOF stays readable as a broken reference.
      hash.delete('endpoint')
      hash.set('node', 'S-4')
      hash.set('source', '.requirements/history/tasks/plan-batch/prd.md:12')
      route.hash = hash.toString()
      await page.goto(route.href)
      await page.waitForFunction(() => document.querySelector('#source-drawer[open] [role="status"]')?.textContent.includes('当前工作区无法定位'))
      expect(await page.$(`${sourceDialog} a.source-open`)).toBeNull()
      await page.mouse.click(4, 120)
      await sourceClosed(page)
      expect(await drawerPath(page)).toMatchObject({ node: 'S-4', source: null })
    }
    finally {
      await page.close()
      await server.stop()
    }
  })

  it('opens legacy contract anchors and unwinds a repeated relation to its existing ancestor', async () => {
    const page = await open(615, 623, '?view=overview&features=S-4#contract-C-4')
    try {
      await drawerReady(page)
      expect(await page.$eval('#detail-mode', el => el.getAttribute('aria-pressed'))).toBe('true')
      expect(await page.$eval('#detail .endpoint-method', el => el.textContent)).toBe('POST')
      const deep = new URL(url)
      deep.search = '?view=overview&features=S-4'
      deep.hash = 'node=C-4&via=S-4&via=C-4&via=S-4'
      await page.goto(deep.href)
      await drawerReady(page)
      expect(await drawerPath(page)).toMatchObject({ node: 'C-4', via: ['S-4'] })
      const relation = '#detail .link-button[data-dest="S-4"]'
      await page.click('#detail details:has(> .link-button[data-dest="S-4"]) > summary')
      await page.click(relation)
      await page.waitForSelector('#detail .acceptance-group')
      expect(await drawerPath(page)).toMatchObject({ node: 'S-4', via: [] })
      await page.keyboard.press('Escape')
      await drawerClosed(page)
      expect(await page.$eval('#overview-mode', el => el.getAttribute('aria-pressed'))).toBe('true')
    }
    finally {
      await page.close()
    }
  })

  it('keeps legacy routes readable without assigning shared fields to individual APIs', async () => {
    const page = await open(375, 623, '?view=detail&features=S-5#node=C-5')
    try {
      const rows = '#detail .endpoint'
      expect(await page.$$eval(`${rows} strong`, labels => labels.map(el => el.textContent))).toEqual(['用途待补充', '用途待补充'])
      expect(await visibleDetail(page)).toContain('共享数据需按门店核对。')
      await page.click(rows)
      await endpointReady(page)
      expect(await page.$eval('#endpoint-fields', el => el.textContent)).toContain('字段未按接口整理')
      expect(await page.$eval('#endpoint-drawer', el => el.textContent)).not.toContain('sharedKey')
      await page.click('#endpoint-close')
      await endpointClosed(page)
      await page.click('#detail > details.compact-fold > summary')
      expect(await visibleDetail(page)).toContain('sharedKey')
    }
    finally {
      await page.close()
    }
  })

  it('resets inspector scroll on selection and moves a previously passed check to follow-up when its artifact changes', async () => {
    const page = await open(665, 623, '?view=overview#node=S-4')
    try {
      await page.click('#detail .source-list > summary')
      await page.evaluate(() => {
        location.hash = 'node=S-3'
      })
      await page.waitForFunction(() => document.querySelector('#panel-title')?.textContent === '单个确认')
      expect(await page.$eval('#detail', el => el.scrollTop)).toBe(0)
      expect(await page.$eval('#stations [data-node="S-3"]', el => el.getAttribute('aria-label'))).toContain('0/1 通过 · 1 需补验')
      expect(await page.$eval('#stations [data-node="S-0"]', el => el.getAttribute('aria-label'))).toBe('功能，新建方案，0/1 通过，下一步 · 新建方案')
      expect(await page.$('#detail .story-goal')).toBeNull()
      const stale = '#detail .acceptance-group[data-state="open"] .case-row[data-status="stale"]'
      expect(await page.$eval(stale, el => el.textContent)).toContain('单个确认')
      expect(await page.$eval(`${stale} .case-scope`, el => el.textContent)).toBe('证据无效，需补验')
      expect(await page.$('#detail .acceptance-group[data-state="passed"] .case-row')).toBeNull()
      expect(await visibleDetail(page)).not.toMatch(/raw-check-|批量确认规则\.md/u)
      // A new node link can arrive while the previous drawer is sliding out.
      await page.keyboard.press('Escape')
      await page.evaluate(() => {
        location.hash = 'node=S-4'
      })
      await page.waitForFunction(() => document.querySelector('#panel-title')?.textContent === '批量确认')
      await drawerReady(page)
      expect(await page.$eval('.app', el => el.inert)).toBe(true)
      expect(await page.$eval('#detail .source-list', el => el.open)).toBe(false)
    }
    finally {
      await page.close()
    }
  })

  it.each([320, 375, 476])('keeps the filter compact and the popover within a %ipx window', async (width) => {
    const page = await open(width, 623)
    try {
      const rect = selector => page.$eval(selector, (el) => {
        const { top, bottom, left, right, width, height } = el.getBoundingClientRect()
        return { top, bottom, left, right, width, height }
      })
      const canvas = await rect('#map')
      const toggle = await rect('#filter-toggle')
      const tools = await rect('#map-tools')
      expect(tools.right).toBeLessThanOrEqual(width)
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('false')
      expect((await rect('#feature-query')).height).toBe(0)
      expect(toggle.height).toBeGreaterThan(0)
      expect(toggle.left).toBeGreaterThanOrEqual(0)
      expect(toggle.right).toBeLessThanOrEqual(width)
      if (width === 476)
        expect(canvas.top).toBeLessThanOrEqual(130)
      await page.click('#filter-toggle')
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('true')
      expect(await page.evaluate(() => document.activeElement.id)).toBe('feature-query')
      expect(await rect('#map')).toEqual(canvas)
      const popover = await rect('#filter-popover')
      expect(popover.left).toBeGreaterThanOrEqual(0)
      expect(popover.right).toBeLessThanOrEqual(width + 1)
      expect(popover.bottom).toBeLessThanOrEqual(623)
      expect(popover.height).toBeGreaterThan(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.click('#feature-list [aria-label="门店指引"]')
      await page.click('#filter-done')
      expect(await page.$eval('#filter-popover', el => el.getBoundingClientRect().height)).toBe(0)
      expect(await rect('#map')).toEqual(canvas)
    }
    finally {
      await page.close()
    }
  })

  it('keeps multiple selections when closed, reloads their link and resets the selection', async () => {
    const page = await open(476, 623)
    try {
      const expanded = () => page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))
      await page.click('#filter-toggle')
      await page.click('#feature-list [aria-label="批量确认"]')
      await page.click('#feature-list [aria-label="维护位置图片"]')
      expect(await expanded()).toBe('true')
      await waitForFilterLink(page, 'features', 'S-4,S-5')
      expect(await page.$eval('#filter-badge', el => el.textContent)).toContain('2')
      await page.keyboard.press('Escape')
      expect(await expanded()).toBe('false')
      expect(await page.evaluate(() => document.activeElement.id)).toBe('filter-toggle')
      await page.reload()
      expect(await expanded()).toBe('false')
      expect(await page.$$eval('#stations [data-node]', els => els.map(el => el.dataset.node))).toEqual(expect.arrayContaining(['C-4', 'C-5']))
      await page.click('#filter-toggle')
      expect(await page.$$eval('#feature-list [aria-pressed=true]', els => els.map(el => el.getAttribute('aria-label')))).toEqual(['批量确认', '维护位置图片'])
      await page.click('#filter-reset')
      await waitForFilterLink(page, 'features', null)
      expect(await page.$eval('#all-features', el => el.getAttribute('aria-pressed'))).toBe('true')
      expect(await expanded()).toBe('true')
      await page.click('header h1')
      expect(await expanded()).toBe('false')
      await page.click('#filter-toggle')
      // Leaving the entire filter group by keyboard must give the canvas controls their place in the tab order.
      await page.focus('#filter-toggle')
      await page.keyboard.down('Shift')
      await page.keyboard.press('Tab')
      await page.keyboard.up('Shift')
      expect(await expanded()).toBe('false')
      expect(await page.evaluate(() => document.querySelector('#feature-bar').contains(document.activeElement))).toBe(false)
    }
    finally {
      await page.close()
    }
  })

  it('filters by query, restores an empty-result URL and recovers from the canvas', async () => {
    const page = await open(476, 623)
    try {
      await page.click('#filter-toggle')
      const ime = await page.createCDPSession()
      await ime.send('Input.imeSetComposition', { text: '确认', selectionStart: 2, selectionEnd: 2 })
      expect(await page.$eval('#feature-query', el => el.value)).toBe('确认')
      expect(await page.evaluate(() => new URLSearchParams(location.search).has('q'))).toBe(false)
      expect(await page.$eval('#all-features', el => el.getAttribute('aria-pressed'))).toBe('true')
      await ime.send('Input.insertText', { text: '确认' })
      await waitForFilterLink(page, 'q', '确认')
      const matches = await page.$$eval('#feature-list .feature-chip:not([hidden]):not(#all-features)', els => els.map(el => el.getAttribute('aria-label')))
      expect(matches).toEqual(['单个确认', '批量确认'])
      await page.keyboard.sendCharacter('找不到')
      await waitForFilterLink(page, 'q', '确认找不到')
      expect(await page.$eval('#filter-no-match', el => el.getBoundingClientRect().height)).toBeGreaterThan(0)
      await page.keyboard.press('Escape')
      expect(await page.$eval('#empty-search', el => el.hidden)).toBe(false)
      await page.reload()
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('false')
      expect(await page.$eval('#feature-query', el => el.value)).toBe('确认找不到')
      expect(await page.$eval('#empty-search', el => el.hidden)).toBe(false)
      await page.click('#clear-search')
      await waitForFilterLink(page, 'q', null)
      expect(await page.$eval('#empty-search', el => el.hidden)).toBe(true)
      expect(await page.$$eval('#stations [data-node^="S-"]', els => els.length)).toBe(9)
      expect(await page.evaluate(() => document.activeElement.id)).toBe('feature-query')
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('true')
    }
    finally {
      await page.close()
    }
  })

  it('routes the full implementation graph outside card interiors', async () => {
    const page = await open(1160, 760)
    try {
      await page.click('#detail-mode')
      expect(await page.$$eval('#wire-labels text', els => els.map(el => el.textContent))).toEqual(expect.arrayContaining(['本店', '全国']))
      const { edges, overlaps } = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#stations .outline')].map(el => ({
          id: el.parentElement.dataset.node,
          bounds: el.getBoundingClientRect(),
        }))
        const paths = [...document.querySelectorAll('#wires path[marker-end]')]
        const overlaps = []
        for (const path of paths) {
          const length = path.getTotalLength()
          const transform = path.getScreenCTM()
          const margin = 4 * transform.a
          for (let distance = 4; distance < length - 4; distance += 4) {
            const p = path.getPointAtLength(distance).matrixTransform(transform)
            const hit = cards.find(({ bounds: r }) => p.x > r.left + margin && p.x < r.right - margin && p.y > r.top + margin && p.y < r.bottom - margin)
            if (hit) {
              overlaps.push(hit.id)
              break
            }
          }
        }
        return { edges: paths.length, overlaps }
      })
      expect(edges).toBeGreaterThan(featureTitles.length)
      expect(overlaps).toEqual([])
    }
    finally {
      await page.close()
    }
  })
  it('previews a cited line on demand and remembers the editor for live source references', async () => {
    const target = path.resolve(project, batchSource.slice(0, -4))
    mkdirSync(path.dirname(target), { recursive: true })
    const lines = Array.from({ length: 345 }).fill('相邻行')
    lines.fill('展开前文用于核对窄屏换行。'.repeat(30), 336, 339)
    lines[339] = '<b>用户选中的原文</b>'
    writeFileSync(target, lines.join('\n'))
    const server = await startViewer(project)
    const page = await browser.newPage()
    const route = '?view=overview&features=S-4#node=S-4'
    const list = '#detail .source-list'
    const entry = `${list} .source-entry:has(> .source-file[data-ref="${batchSource}"])`
    const missingEntry = `${list} .source-entry:has(> .source-file[data-ref$="/prd.md:12"])`
    const requests = []
    page.on('request', (request) => {
      if (request.url().includes('/source-location?'))
        requests.push(request)
    })
    try {
      await page.setViewport({ width: 375, height: 550 })
      await page.goto(server.address + route)
      await drawerReady(page)
      expect(requests).toHaveLength(0)
      await page.click(`${list} > summary`)
      const link = `${entry} a.source-open`
      await page.waitForSelector(link)
      expect(requests.every(request => request.headers()['x-requirement-flow'])).toBe(true)
      const webstorm = new URL(await page.$eval(link, a => a.href))
      expect(webstorm.protocol).toBe('webstorm:')
      expect(webstorm.searchParams.get('file')).toBe(realpathSync(target))
      expect(webstorm.searchParams.get('line')).toBe('340')
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => { document.body.dataset.copied = text } },
      }))
      await page.click(`${entry} button[aria-label^="复制当前工作树"]`)
      expect(await page.$eval('body', el => el.dataset.copied)).toBe(`${realpathSync(target)}:340`)
      expect(await page.$(`${entry} pre`)).toBeNull()
      await page.click(`${entry} ${previewTrigger}`)
      await expectSourceLine(page, '340<b>用户选中的原文</b>')
      const targetVisible = await page.$eval(`${sourceDialog} .source-target-line .source-line-number`, (number) => {
        const rect = number.getBoundingClientRect()
        const reader = number.closest('#source-body')
        const bounds = reader.getBoundingClientRect()
        return reader.scrollTop > 0 && rect.top >= bounds.top && rect.bottom <= bounds.bottom
      })
      expect(targetVisible).toBe(true)
      expect(await page.$(`${sourceDialog} .source-target-line b`)).toBeNull()
      expect((await drawerPath(page)).source).toBe(batchSource)
      expect(decodeURIComponent(page.url())).not.toContain(realpathSync(project))
      await page.click('#source-back')
      await sourceClosed(page)
      expect(await page.$eval(`${entry} ${previewTrigger}`, el => el === document.activeElement)).toBe(true)
      await page.select(`${list} select`, 'vscode')
      expect(decodeURIComponent(await page.$eval(link, a => a.href))).toContain('批量确认规则.md:340:1')
      await page.reload()
      if (!await page.$eval(list, el => el.open))
        await page.click(`${list} > summary`)
      await page.waitForSelector(link, { visible: true })
      expect(await page.$eval(link, a => a.protocol)).toBe('vscode:')
      // The mapped prd.md exists but is shorter than the cited line; copying remains available.
      await page.click(`${missingEntry} .source-file > summary`)
      await page.waitForSelector(`${missingEntry} .source-unavailable`)
      const missing = await page.$eval(`${missingEntry} .source-unavailable`, el => el.closest('.source-entry').querySelector('button').getAttribute('aria-label'))
      expect(missing).toContain('复制文件引用')
    }
    finally {
      await page.close()
      await server.stop()
    }
  })
  it('opens an independent diagnosis with the original failed scenarios and downloadable evidence', async () => {
    const reviewProject = mkdtempSync(path.join(tmpdir(), 'airules-review-reader-'))
    let server, page
    try {
      const flow = (...args) => runFlow(reviewProject, ...args)
      flow('new', 'plan', '--request', '保存后可以回读')
      writeFileSync(path.join(reviewProject, 'check.cjs'), 'require("node:assert/strict").equal("missing-original-record", "saved")\n')
      const plan = {
        stories: { S: { title: '保存', actor: '用户', goal: '回读结果', examples: [{ id: 'SC', given: '有效输入', when: '保存后重开', then: '回读保存值' }] } },
        actions: { V: { title: '核验保存', kind: '验证', stories: ['S'], read_stories: ['S'], contracts: [], decisions: [], depends_on: [], covers: ['SC'], code_paths: ['check.cjs'], done: '回读一致' } },
      }
      writeFileSync(path.join(reviewProject, 'plan.json'), JSON.stringify(plan))
      flow('task', 'plan', 'plan', path.join(reviewProject, 'plan.json'), '--rev', '1', '--why', '核对保存场景')
      flow('task', 'plan', 'finish', 'A-intake', '--rev', '2', '--actor', 'planner', '--output', '范围已核对', '--evidence', '用户原话')
      const receipts = []
      for (let i = 0; i < 2; i++) {
        const { revision } = JSON.parse(flow('task', 'plan', 'next'))
        const result = spawnSync(python, [
          ...pythonArgs,
          '--project',
          reviewProject,
          'task',
          'plan',
          'verify-run',
          'V',
          '--scenario',
          'SC',
          '--rev',
          String(revision),
          '--actor',
          'original-qa',
          '--environment',
          '真实本机断言',
          '--share-output',
          '--',
          process.execPath,
          'check.cjs',
        ], { encoding: 'utf8' })
        expect(result.status, result.stderr).toBe(1)
        receipts.push(JSON.parse(result.stdout).id)
      }
      const { revision } = JSON.parse(flow('task', 'plan', 'next'))
      const claimed = JSON.parse(flow('task', 'plan', 'claim', '--rev', String(revision), '--actor', 'independent-reviewer'))
      const model = JSON.parse(readFileSync(path.join(reviewProject, '.requirements/active/plan/model.json'), 'utf8'))
      const action = model.work.actions[claimed.claimed]
      expect(action.review_for.receipts).toEqual(receipts)
      server = await startViewer(reviewProject)
      page = await browser.newPage()
      await page.goto(`${server.address}?view=detail#node=${claimed.claimed}`)
      await drawerReady(page)
      const text = await page.$eval('#detail', el => el.textContent)
      for (const expected of ['失败诊断依据', 'original-qa', 'SC', '有效输入', '保存后重开', '回读保存值', ...receipts])
        expect(text).toContain(expected)
      const downloads = await page.$$eval('#detail a[download]', links => links.map(link => link.href))
      expect(downloads).toHaveLength(2)
      for (const url of downloads) {
        const content = await page.evaluate(async url => (await fetch(url)).text(), url)
        expect(content).toContain('missing-original-record')
        expect(content).toContain('AssertionError')
      }
    }
    finally {
      await page?.close()
      await server?.stop()
      rmSync(reviewProject, { recursive: true, force: true })
    }
  }, 30_000)

  it('keeps one version request, cancels hidden polls and recovers after a real timeout', async () => {
    const server = await startViewer(project)
    const page = await browser.newPage()
    const held = []
    let versionRequests = 0
    try {
      await page.evaluateOnNewDocument(() => {
        const networkFetch = window.fetch
        const stats = { started: 0, active: 0, max: 0, aborted: 0, completed: 0 }
        window.versionNetwork = stats
        window.fetch = async (input, options) => {
          if (!String(input).endsWith('/version'))
            return networkFetch(input, options)
          stats.started++
          stats.active++
          stats.max = Math.max(stats.max, stats.active)
          try {
            const response = await networkFetch(input, options)
            stats.completed++
            return response
          }
          catch (error) {
            if (error.name === 'AbortError')
              stats.aborted++
            throw error
          }
          finally {
            stats.active--
          }
        }
      })
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith('/version') && ++versionRequests <= 2)
          held.push(request)
        else void request.continue()
      })
      await page.goto(server.address)
      await page.evaluate(() => {
        for (let i = 0; i < 20; i++) document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForFunction(() => window.versionNetwork.started === 1)
      // A real interval fires while the response remains pending.
      await new Promise(resolve => setTimeout(resolve, 4000))
      expect(await page.evaluate(() => window.versionNetwork)).toMatchObject({ started: 1, active: 1, max: 1 })
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForFunction(() => window.versionNetwork.aborted === 1 && window.versionNetwork.active === 0)
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForFunction(() => window.versionNetwork.started === 2)
      await page.waitForFunction(() => window.versionNetwork.aborted === 2, { timeout: 17_000 })
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await page.waitForFunction(() => window.versionNetwork.completed >= 1)
      expect(await page.evaluate(() => window.versionNetwork.max)).toBe(1)
    }
    finally {
      await Promise.allSettled(held.map(request => request.abort()))
      await page.close()
      await server.stop()
    }
  }, 30_000)

  it('reconnects the same tab to a restarted viewer and restores its nested citation preview', async () => {
    const source = path.join(project, '.requirements/history/tasks/plan-batch/prd.md')
    const original = readFileSync(source, 'utf8')
    let server = await startViewer(project)
    const page = await browser.newPage()
    const list = '#endpoint-drawer .source-list'
    const target = `${sourceDialog} .source-target-line`
    try {
      await page.goto(`${server.address}?view=detail&features=S-4#node=C-4`)
      await page.click('.endpoint-list .endpoint')
      await endpointReady(page)
      await page.click(`${list} > summary`)
      await page.waitForSelector(`${list} a.source-open`)
      await page.click(`${list} ${previewTrigger}`)
      await expectSourceLine(page, '6保留原有位置方案')
      const route = page.url()
      await server.stop()
      writeFileSync(source, original.replace('保留原有位置方案', '重新连接后读取的第六行'))
      server = await startViewer(project, new URL(route).port)
      // Trigger the normal version check without waiting for the polling interval.
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await page.waitForFunction(selector => document.querySelector(selector)?.textContent === '6重新连接后读取的第六行', { timeout: 7_000 }, target)
      expect(page.url()).toBe(route)
      await page.keyboard.press('Escape')
      await sourceClosed(page)
      expect(await page.$eval(`${list} a.source-open`, a => a.href)).toContain('prd.md')
      await endpointReady(page)
      expect(await page.$eval('#endpoint-title', el => el.textContent)).toBe('保存批量确认')
      await page.keyboard.press('Escape')
      await endpointClosed(page)
      expect(await page.$eval('#panel-title', el => el.textContent)).toBe('批量确认')
    }
    finally {
      await page.close()
      await server.stop()
      writeFileSync(source, original)
    }
  })

  it('upgrades a 0.5.1 tab with an inline source preview to the original response and citation', async () => {
    const server = await startViewer(project)
    const page = await browser.newPage()
    const ref = '.requirements/history/tasks/plan-batch/prd.md:6'
    try {
      await page.goto(`${server.address}?view=detail&features=S-4#node=C-4`)
      await page.click('.endpoint-list .endpoint')
      await endpointReady(page)
      const oldUrl = page.url()
      // 0.5.1 kept the active tab and its inline preview in flowReader, outside the URL.
      await page.evaluate(({ ref, oldUrl }) => {
        const folds = [...document.querySelectorAll('#endpoint-drawer .endpoint-body details')]
        const source = folds.find(fold => fold.dataset.ref === ref)
        const group = source.closest('.source-list')
        history.replaceState({
          endpointHash: location.hash,
          flowReader: {
            work: 'plan',
            url: oldUrl,
            notes: [],
            confirmDecision: null,
            panel: { open: [], scroll: 0 },
            endpoint: {
              open: [
                { index: folds.indexOf(group), key: group.querySelector('summary').textContent, preview: false },
                { index: folds.indexOf(source), key: ref, preview: true },
              ],
              scroll: 0,
            },
            side: 'response',
          },
        }, '', oldUrl)
      }, { ref, oldUrl })
      await page.reload()
      await expectSourceLine(page, '6保留原有位置方案')
      expect(await drawerPath(page)).toMatchObject({ source: ref, side: 'response' })
      await page.click('#source-back')
      await sourceClosed(page)
      expect(await page.$eval('#endpoint-fields', el => el.textContent)).toContain('confirmedCount')
      await page.click('#endpoint-drawer .endpoint-back')
      await endpointClosed(page)
      expect(await drawerPath(page)).toMatchObject({ node: 'C-4', source: null })
    }
    finally {
      await page.close()
      await server.stop()
    }
  })

  it('retains a pending decision draft in its own tab after refreshing a related contract', async () => {
    const server = await startViewer(project)
    const page = await browser.newPage()
    const reason = '先核对范围再确定'
    try {
      await page.goto(`${server.address}?view=detail#node=D-scope`)
      await drawerReady(page)
      await page.type('input[name="reason"]', reason)
      const contract = '#detail [data-dest="C-8"]'
      await page.click(contract)
      await page.waitForSelector('.endpoint-list')
      const contractUrl = page.url()
      expect(await drawerPath(page)).toMatchObject({ node: 'C-8', via: ['D-scope'] })
      expect(decodeURIComponent(contractUrl)).not.toContain(reason)
      await page.reload()
      await drawerReady(page)
      await page.click('#panel-back')
      await page.waitForSelector('input[name="reason"]')
      expect(await page.$eval('input[name="reason"]', el => el.value)).toBe(reason)
      expect(await page.$eval(contract, el => document.activeElement === el)).toBe(true)
    }
    finally {
      await page.close()
      await server.stop()
    }
  })

  it('recovers a mobile decision after a real 409 before polling and saves a corrected reason', async () => {
    const isolated = mkdtempSync(path.join(tmpdir(), 'airules-decision-race-'))
    let page, server
    try {
      createHandbook(isolated)
      const model = path.join(isolated, '.requirements/active/plan/model.json')
      const work = () => JSON.parse(readFileSync(model, 'utf8')).work
      server = await startViewer(isolated)
      page = await browser.newPage()
      await page.setViewport({ width: 390, height: 844, hasTouch: true })
      await page.goto(`${server.address}?view=detail&features=S-8&q=指引#node=D-scope`)
      await drawerReady(page)
      const route = page.url()
      const field = '#detail input[name="reason"]'
      const local = '#detail button.choose[value="local"]'
      const draft = '门店只读本店已确认方案'
      const correction = '店长复核后，只展示本店当前有效方案'
      await page.type(field, draft)

      // Hold only the browser's first outgoing form. The second writer commits after
      // the form is in flight, so the real server must return the revision conflict.
      await page.setRequestInterception(true)
      let resolveFirst
      const firstRequest = new Promise((resolve) => {
        resolveFirst = resolve
      })
      const isDecision = req => req.method() === 'POST' && new URL(req.url()).pathname.endsWith('/decision')
      page.on('request', (req) => {
        if (resolveFirst && isDecision(req)) {
          resolveFirst(req)
          resolveFirst = null
        }
        else {
          void req.continue()
        }
      })
      const response = () => page.waitForResponse(res => isDecision(res.request()))
      await page.click(local)
      const held = await firstRequest
      const revision = new URLSearchParams(held.postData()).get('revision')
      runFlow(isolated, 'task', 'plan', 'decision', 'D-scope', 'national', '--rev', revision, '--actor', '运营', '--why', '先展示全国方案')
      const [conflict] = await Promise.all([response(), page.waitForNavigation(), held.continue()])
      expect(conflict.status()).toBe(409)
      await drawerReady(page)
      expect(page.url()).toBe(route)
      expect(await page.$eval('#panel-title', el => el.textContent)).toBe('门店查看哪份方案')
      expect(await page.$eval(field, el => el.value)).toBe(draft)
      expect(await page.$eval('#detail form [role="status"]', el => el.textContent)).toContain('再次确认')
      expect(work().answers['D-scope']).toMatchObject({ choice: 'national', reason: '先展示全国方案' })

      async function confirm() {
        const [result] = await Promise.all([response(), page.waitForNavigation(), page.click(local)])
        expect(result.status()).toBe(200)
        expect(new URL(page.url()).searchParams.get('features')).toBe('S-8')
        expect(new URL(page.url()).searchParams.get('q')).toBe('指引')
      }
      await confirm()
      const decided = work().answers['D-scope']
      expect(decided).toMatchObject({ choice: 'local', reason: draft })
      await page.goto(route)
      await drawerReady(page)
      expect(await page.$eval(local, el => el.textContent)).toBe('订正当前理由')
      await page.$eval(field, el => el.select())
      await page.type(field, correction)
      await confirm()
      expect(work().answers['D-scope']).toMatchObject({ choice: 'local', version: decided.version, reason: correction })
      expect(work().events.at(-1)).toMatchObject({ kind: 'decision_reason', previous_reason: draft, output: correction })
      await page.goto(route)
      await drawerReady(page)
      expect(await page.$eval(field, el => el.value)).toBe(correction)
    }
    finally {
      await page?.close()
      await server?.stop()
      rmSync(isolated, { recursive: true, force: true })
    }
  }, 30_000)

  it('keeps a pending decision note while recovering a stale citation opened on a different node', async () => {
    let server = await startViewer(project)
    const page = await browser.newPage()
    const note = '等门店核对现行方案后再决定'
    const list = '#detail .source-list'
    try {
      await page.goto(`${server.address}?view=detail#node=D-scope`)
      await drawerReady(page)
      await page.type('input[name="reason"]', note)
      await page.evaluate(() => {
        location.hash = 'node=S-4'
      })
      await page.waitForSelector(`${list} > summary`)
      const route = page.url()
      await server.stop()
      server = await startViewer(project, new URL(route).port)
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/source-location?') && response.status() === 409, { timeout: 5_000 }),
        page.click(`${list} > summary`),
      ])
      await page.waitForSelector('#notice:not([hidden]) #refresh', { visible: true, timeout: 5_000 })
      const loaded = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
      await page.click('#refresh')
      await loaded
      await page.waitForSelector(`${list}[open] a.source-open`)
      expect(page.url()).toBe(route)
      await page.evaluate(() => {
        location.hash = 'node=D-scope'
      })
      await page.waitForSelector('input[name="reason"]')
      expect(await page.$eval('input[name="reason"]', el => el.value)).toBe(note)
      // A known-stale form must reload for a second confirmation before any write.
      const submitted = []
      page.on('request', (request) => {
        if (request.method() === 'POST')
          submitted.push(new URL(request.url()).pathname)
      })
      await server.stop()
      server = await startViewer(project, new URL(route).port)
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await page.waitForSelector('#notice:not([hidden]) #refresh', { visible: true, timeout: 5_000 })
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        page.click('button.choose'),
      ])
      await drawerReady(page)
      expect(await page.$eval('input[name="reason"]', el => el.value)).toBe(note)
      expect(new URL(page.url()).hash).toBe('#node=D-scope')
      expect(submitted).toEqual([])
    }
    finally {
      await page.close()
      await server.stop()
    }
  })

  it('distinguishes denied and missing citations and recovers from transient failure and restored files', async () => {
    const server = await startViewer(project)
    const page = await browser.newPage()
    const entry = '#detail .source-entry'
    const source = path.join(project, '.requirements/history/tasks/plan-batch/prd.md')
    const original = readFileSync(source, 'utf8')
    page.setDefaultTimeout(4_000)
    try {
      await page.setRequestInterception(true)
      let failOnce = true
      page.on('request', async (request) => {
        const url = new URL(request.url())
        const ref = url.pathname === '/source-location' && url.searchParams.get('ref')
        if (ref === batchSource) {
          await request.respond({ status: 403, contentType: 'application/json', body: '{}' })
        }
        else if (failOnce && ref && ref.endsWith('prd.md:6')) {
          failOnce = false
          await request.respond({ status: 503, contentType: 'application/json', body: '{}' })
        }
        else {
          await request.continue()
        }
      })
      await page.goto(`${server.address}?view=overview&features=S-4#node=S-4`)
      await drawerReady(page)
      await page.click('#detail .source-list > summary')
      const findRow = async ref => page.waitForFunction((selector, suffix) => [...document.querySelectorAll(selector)].find(
        row => row.querySelector('.source-note')?.textContent.endsWith(suffix),
      ), {}, entry, ref)
      const deniedRow = (await findRow(batchSource)).asElement()
      const validRow = (await findRow('prd.md:6')).asElement()
      const missingRow = (await findRow('prd.md:12')).asElement()
      await validRow.$eval('.source-file', (file) => {
        file.open = true
      })
      await missingRow.$eval('.source-file', (file) => {
        file.open = true
      })
      await page.waitForFunction(row => row.textContent.includes('无权'), {}, deniedRow)
      expect(await deniedRow.$('.source-unavailable button, a.source-open')).toBeNull()
      await page.waitForFunction(row => row.textContent.includes('暂时无法连接'), {}, validRow)
      await page.waitForFunction(row => row.textContent.includes('当前工作区无法定位'), { timeout: 4_000 }, missingRow)
      expect(await missingRow.$('a.source-open')).toBeNull()
      expect(await validRow.$eval('.source-unavailable button', button => button.textContent)).toBe('重试')
      const retry = await validRow.$('.source-unavailable button')
      await retry.click()
      await validRow.waitForSelector('a.source-open')
      await (await validRow.waitForSelector(previewTrigger)).click()
      await expectSourceLine(page, '6保留原有位置方案')
      await page.click('#source-close')
      await sourceClosed(page)
      writeFileSync(source, [original, '', '', '', '', '', '补齐的第十二行'].join('\n'))
      await page.click('#detail .source-list > summary')
      await page.waitForSelector('#detail .source-list:not([open])')
      await page.click('#detail .source-list > summary')
      await missingRow.waitForSelector('a.source-open')
      await (await missingRow.waitForSelector(previewTrigger)).click()
      await expectSourceLine(page, '12补齐的第十二行')
    }
    finally {
      await page.close()
      await server.stop()
      writeFileSync(source, original)
    }
  })

  it('keeps offline source references copyable when clipboard permissions are unavailable', async () => {
    const page = await open(375, 667, '?view=overview&features=S-4#node=S-4')
    try {
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('clipboard permission denied')) },
      }))
      const group = '#detail .source-list'
      await page.click(`${group} > summary`)
      expect(await page.$(`${group} a.source-open, ${group} select.source-editor`)).toBeNull()
      await page.click(`${group} .source-actions button`)
      const selection = await page.$eval('.source-manual-copy', el => ({
        value: el.value.slice(el.selectionStart, el.selectionEnd),
        focused: document.activeElement === el,
      }))
      expect(selection).toEqual({ value: batchSource, focused: true })
    }
    finally {
      await page.close()
    }
  })
})
