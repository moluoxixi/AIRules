import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const peer = createRequire(import.meta.resolve('@mermaid-js/mermaid-cli'))
const { default: puppeteer } = await import(pathToFileURL(peer.resolve('puppeteer')).href)
const python = process.platform === 'win32' ? 'py' : 'python3'
const pythonPrefix = process.platform === 'win32' ? ['-3', '-B'] : ['-B']
const flow = fileURLToPath(new URL('../skills/requirement-flow/flow.py', import.meta.url))
const fixture = fileURLToPath(new URL('./test_story_withdrawal.py', import.meta.url))
let executablePath
for (const channel of [undefined, 'chrome']) {
  try {
    const binary = await puppeteer.executablePath(channel)
    if (binary && existsSync(binary)) {
      executablePath = binary
      break
    }
  }
  catch { /* The system browser is optional. */ }
}

describe.skipIf(!executablePath)('withdrawn story reader', { timeout: 20_000 }, () => {
  let project, server, browser, url
  const command = (...args) => execFileSync(python, [...pythonPrefix, flow, '--project', project, ...args], { encoding: 'utf8' })
  beforeAll(async () => {
    project = mkdtempSync(path.join(tmpdir(), 'airules-withdrawal-browser-'))
    execFileSync(python, [...pythonPrefix, fixture, '--prepare', project], { encoding: 'utf8' })
    server = spawn(python, [...pythonPrefix, flow, '--project', project, 'serve'], { stdio: ['ignore', 'pipe', 'pipe'] })
    const [output] = await once(server.stdout, 'data')
    url = String(output).trim()
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/u)
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: process.platform === 'linux' && (process.env.CI || process.getuid() === 0) ? ['--no-sandbox'] : [],
    })
  }, 60_000)
  afterAll(async () => {
    await browser?.close()
    if (server && server.exitCode === null) {
      server.kill()
      await once(server, 'exit')
    }
    if (project)
      rmSync(project, { recursive: true, force: true })
  })

  it('shows the scope decision without claiming verification, then exposes the restored gap', async () => {
    const page = await browser.newPage()
    try {
      await page.setViewport({ width: 1100, height: 800 })
      await page.goto(url)
      const card = await page.waitForSelector('article.card')
      expect(await card.evaluate(el => el.textContent)).toContain('本期范围已撤出')
      expect(await card.$eval('progress', el => el.hasAttribute('value'))).toBe(false)
      await card.hover()
      await page.waitForSelector('#card-tooltip', { visible: true })
      expect(await page.$eval('#card-tooltip', el => el.textContent)).toContain('本期无待验场景')
      await page.goto(`${url}tasks/scope/#node=S-export`)
      await page.waitForSelector('#drawer-layer.is-open')
      expect(await page.$eval('#detail', el => el.textContent)).toContain('已按业务决定移出本期范围')
      expect(await page.$eval('#detail', el => el.textContent)).toContain('验收范围调整')
      const nodeState = await page.$eval('#data', el => JSON.parse(el.textContent).graph.nodes.find(n => n.id === 'S-export').state)
      expect(nodeState).toBe('本期已撤出')

      const { revision } = JSON.parse(command('task', 'scope', 'next'))
      command('task', 'scope', 'decision', 'D-scope', 'keep', '--rev', String(revision), '--actor', '产品负责人', '--why', '恢复本期交付')
      await page.reload()
      await page.waitForSelector('#drawer-layer.is-open')
      expect(await page.$eval('#detail', el => el.textContent)).toContain('待跟进')
      expect(await page.$eval('#detail', el => el.textContent)).not.toContain('本功能已按业务决定移出本期范围')
      const data = await page.$eval('#data', el => JSON.parse(el.textContent))
      expect(data.queue.scenarios[0].status).toBe('uncovered')
      expect(data.queue.progress.withdrawn_stories).toEqual([])
      await page.goto(url)
      expect(await page.$eval('article.card', el => el.textContent)).not.toContain('本期范围已撤出')
    }
    finally {
      await page.close()
    }
  })
})
