import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Use the browser driver already supplied for Mermaid rendering in development.
const requireMermaidPeer = createRequire(import.meta.resolve('@mermaid-js/mermaid-cli'))
const { default: puppeteer } = await import(pathToFileURL(requireMermaidPeer.resolve('puppeteer')).href)
const featureTitles = ['新建方案', '配置模板', '刷新门店资源', '单个确认', '批量确认', '维护位置图片', '详情', '方案状态', '门店指引']

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
  return pathToFileURL(handbook).href
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
  }, 20_000)
  afterAll(async () => {
    await browser?.close()
    if (project)
      rmSync(project, { recursive: true, force: true })
  })
  async function open(width, height) {
    const page = await browser.newPage()
    await page.setViewport({ width, height, hasTouch: true })
    const failed = new Promise((_, reject) => page.once('pageerror', reject))
    try {
      await Promise.race([
        failed,
        page.goto(url, { waitUntil: 'domcontentloaded' })
          .then(() => page.waitForSelector('#stations [data-node]', { timeout: 4_000 })),
      ])
      return page
    }
    catch (error) {
      await page.close()
      throw error
    }
  }
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
      expect(await page.$eval('#inspector', el => el.hidden)).toBe(false)
      expect(await page.$eval('#detail', el => el.textContent)).toContain('POST /display/5')
      await page.click('#filter-toggle')
      await page.keyboard.press('Escape')
      expect(await page.$eval('#inspector', el => el.hidden)).toBe(false)
      expect(await page.$eval('#filter-toggle', el => el.getAttribute('aria-expanded'))).toBe('false')
      await page.keyboard.press('Escape')
      expect(await page.$eval('#inspector', el => el.hidden)).toBe(true)
      await page.click('#overview-mode')
      expect(await page.$eval('#overview-mode', el => el.getAttribute('aria-pressed'))).toBe('true')
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
})
