import { execFileSync, spawn } from 'node:child_process'
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

function createHandbook(project) {
  const cli = fileURLToPath(new URL('../skills/requirement-flow/flow.py', import.meta.url))
  function flow(...args) {
    const windows = process.platform === 'win32'
    return execFileSync(windows ? 'py' : 'python3', [...(windows ? ['-3'] : []), '-B', cli, '--project', project, ...args], { encoding: 'utf8' })
  }
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
    return JSON.parse(record('verify-run', action, '--scenario', scenario, '--environment', environment, '--', process.execPath, '-e', script))
  }
  const oldProof = capture('V-3', 'SC-3', '本机单选测试', 'assert.equal([1].length, 1)')
  record('finish', 'V-3', '--output', '单选通过')
  // Corrupt this once-valid artifact before subsequent commands regenerate the shared handbook.
  writeFileSync(path.resolve(path.dirname(handbook), oldProof.artifact.path), 'changed after review')
  capture('V-4', 'AC-pages', '本机跨页组件测试', 'assert.deepEqual([...new Set([1, 3, 1])], [1, 3])')
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
  return pathToFileURL(handbook).href
}

async function startViewer(project, port = '0') {
  const cli = fileURLToPath(new URL('../skills/requirement-flow/flow.py', import.meta.url))
  const windows = process.platform === 'win32'
  const child = spawn(windows ? 'py' : 'python3', [...(windows ? ['-3'] : []), '-B', cli, '--project', project, 'task', 'plan', 'serve', '--port', port])
  const address = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`viewer exited with ${code}`)))
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

const executablePath = await localChrome()
describe.skipIf(!executablePath)('generated handbook interactions in Chromium', { timeout: 15_000 }, () => {
  let project, browser, url
  beforeAll(async () => {
    project = mkdtempSync(path.join(tmpdir(), 'airules-handbook-'))
    url = createHandbook(project)
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
  async function open(width, height, route = '') {
    const page = await browser.newPage()
    await page.setViewport({ width, height, hasTouch: true })
    const failed = new Promise((_, reject) => page.once('pageerror', reject))
    try {
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
  const scale = page => page.$eval('#scale', el => Number.parseInt(el.textContent))
  // textContent also includes evidence and paths behind closed disclosures.
  // eslint-disable-next-line unicorn/prefer-dom-node-text-content
  const visibleDetail = page => page.$eval('#detail', el => el.innerText)
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
  const previewTrigger = 'button.source-preview-trigger'
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
