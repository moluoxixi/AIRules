import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('../skills/requirement-flow/reader/assets/reader.js', import.meta.url)), 'utf8')

it('groups adjacent author aliases without crossing readable content or repeatedly reading a long quote', () => {
  interface Node {
    tagName: string
    nodeType: number
    textContent: string
    childNodes: Node[]
    parentElement: Node | null
    parentNode: Node | null
    matches: (selector: string) => boolean
  }
  function element(tagName: string, textContent = '', childNodes: Node[] = []): Node {
    const node: Node = {
      tagName,
      nodeType: 1,
      textContent,
      childNodes,
      parentElement: null,
      parentNode: null,
      matches: selector => selector === 'a:not([href]),span' ? ['A', 'SPAN'].includes(tagName) : /^H[1-6]$/.test(tagName),
    }
    for (const child of childNodes)
      child.parentElement = child.parentNode = node
    return node
  }
  const targets = new Map<string, Node>()
  const children: Node[] = []
  function marker(name: string) {
    const anchor = element('A')
    targets.set(name, anchor)
    children.push(element('P', '', [anchor]))
  }
  marker('old')
  marker('new')
  const proposed = element('H2', '[拟议变更] 新规则')
  children.push(proposed)
  marker('before-text')
  children.push(element('P', 'This visible rule prevents reassignment.'), element('H2', 'Next rule'))
  for (let index = 0; index < 480; index++) {
    marker(`policy-${index}`)
    children.push(element('H3', `Rule ${index}`), element('P', 'Retain the original receipt.'))
  }
  const quote = element('BLOCKQUOTE', '', children)
  let quoteReads = 0
  Object.defineProperty(quote, 'textContent', {
    get: () => {
      quoteReads++
      return '480 readable rules'
    },
  })
  const fragment = { contains: () => true }
  const start = source.indexOf('  function markdownSections(')
  const end = source.indexOf('    const container = document.createElement(\'div\')', start)
  const code = `${source.slice(start, end)}\nreturn anchors\n}\nmarkdownSections('', {})`
  const result = runInNewContext(code, {
    markdownFragment: (_raw: string, anchors: Map<string, Node>) => {
      for (const [name, node] of targets)
        anchors.set(name, node)
      return fragment
    },
    instrumentLinks: () => {},
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  }) as Map<string, Node>
  expect(result.get('old')).toBe(proposed)
  expect(result.get('new')).toBe(proposed)
  expect(result.get('before-text')).toBe(targets.get('before-text'))
  expect(result.get('policy-479')?.textContent).toBe('Rule 479')
  expect(quoteReads).toBe(1)
})

it.each([false, true])('keeps closed body headings navigable without highlighting them, summary visible=%s', (summary) => {
  function item(visible: boolean) {
    return {
      heading: {
        dataset: { phase: 'current' },
        parentElement: null as null | { tagName: string, open: boolean, parentElement: null, querySelector: () => { contains: () => boolean } },
        closest: () => null,
        getClientRects: () => visible ? [{}] : [],
        getBoundingClientRect: () => ({ top: 100 }),
      },
      link: {
        hidden: false,
        attributes: new Map<string, string>(),
        setAttribute(name: string, value: string) { this.attributes.set(name, value) },
        removeAttribute(name: string) { this.attributes.delete(name) },
      },
    }
  }
  const current = item(true)
  const historical = item(true)
  historical.heading.parentElement = { tagName: 'DETAILS', open: false, parentElement: null, querySelector: () => ({ contains: () => summary }) }
  const context = {
    tocItems: [current, historical],
    currentPhase: 'all',
    ui: { context: { querySelector: () => null } },
    siteHeader: { getBoundingClientRect: () => ({ height: 56 }) },
    window: { scrollY: 100, innerHeight: 900 },
    document: { documentElement: { scrollHeight: 1000 } },
  }
  const code = source.slice(source.indexOf('  function syncToc('), source.indexOf('  function scheduleToc('))
  runInNewContext(`${code}\nsyncToc()`, context)
  expect(historical.link.hidden).toBe(false)
  expect(current.link.attributes.get('aria-current')).toBe(summary ? undefined : 'location')
  expect(historical.link.attributes.get('aria-current')).toBe(summary ? 'location' : undefined)
})

it('uses an authored anchor scope without treating visible containers as unclassified or mixed rules as one phase', () => {
  const code = source.slice(source.indexOf('  function anchorPhases('), source.indexOf('  function revealHeading('))
  const pageTitle = {}
  const phases = runInNewContext(`${code}\nanchorPhases`, { ui: { 'page-title': pageTitle } }) as (node: object) => string[]
  expect(phases({ dataset: {}, closest: () => ({ dataset: { phase: 'current' } }) })).toEqual(['current'])
  expect(phases({ dataset: { phase: 'proposed' }, closest: () => ({ dataset: { phase: 'current' } }) })).toEqual(['proposed'])
  expect(phases({ dataset: {}, closest: () => null })).toEqual(['unclassified'])
  expect(phases(pageTitle)).toEqual([])
  function container(values: string[]) {
    return { dataset: {}, closest: (selector: string) => selector === '[data-phase-container]' ? { querySelectorAll: () => values.map(phase => ({ dataset: { phase } })) } : null }
  }
  expect(phases(container(['current', 'current']))).toEqual(['current'])
  expect(phases(container(['current', 'proposed', 'current']))).toEqual(['current', 'proposed'])
})

it('filters classified summary headings and badges while retaining native summaries and a usable fallback', () => {
  class Element {
    dataset: Record<string, string> = {}
    hidden = false
    className = ''
    open = false
    children: Element[] = []
    parentElement: Element | null = null

    constructor(readonly tagName: string, private content = '') {}

    get textContent(): string {
      return this.content + this.children.map(child => child.textContent).join('')
    }

    set textContent(value: string) {
      this.content = value
      this.children = []
    }

    get previousElementSibling(): Element | null {
      return this.parentElement?.children[this.parentElement.children.indexOf(this) - 1] || null
    }

    get classList() {
      return { contains: (name: string) => this.className.split(/\s+/).includes(name) }
    }

    append(...nodes: Element[]) {
      for (const node of nodes) {
        node.remove()
        node.parentElement = this
        this.children.push(node)
      }
    }

    remove() {
      if (this.parentElement)
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1)
      this.parentElement = null
    }

    before(text: string) {
      if (this.parentElement) {
        const node = new Element('', text)
        node.parentElement = this.parentElement
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 0, node)
      }
    }

    after(text: string) {
      if (this.parentElement) {
        const node = new Element('', text)
        node.parentElement = this.parentElement
        this.parentElement.children.splice(this.parentElement.children.indexOf(this) + 1, 0, node)
      }
    }

    cloneNode(deep: boolean): Element {
      const copy = new Element(this.tagName, this.content)
      copy.dataset = { ...this.dataset }
      copy.hidden = this.hidden
      copy.className = this.className
      if (deep)
        copy.append(...this.children.map(child => child.cloneNode(true)))
      return copy
    }

    matches(selector: string): boolean {
      const parts = selector.split(' ')
      if (parts.length > 1) {
        if (!this.matches(parts.at(-1)!))
          return false
        for (let parent = this.parentElement; parent; parent = parent.parentElement) {
          if (parent.matches(parts[0]))
            return true
        }
        return false
      }
      if (selector === '[hidden]')
        return this.hidden
      if (selector.startsWith('[data-')) {
        const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
        return key in this.dataset
      }
      return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : this.tagName.toLowerCase() === selector
    }

    querySelectorAll(selector: string): Element[] {
      const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')])
      return selector === '*' ? descendants : descendants.filter(child => selector.split(',').some(part => child.matches(part)))
    }

    querySelector(selector: string): Element | null {
      return this.querySelectorAll(selector)[0] || null
    }
  }

  const article = new Element('ARTICLE')
  function details(summary: Element) {
    const node = new Element('DETAILS')
    node.dataset.phaseContainer = ''
    const current = new Element('SECTION', '现行正文')
    const proposed = new Element('SECTION', '拟议正文')
    current.className = proposed.className = 'content-section'
    current.dataset.phase = 'current'
    proposed.dataset.phase = 'proposed'
    node.append(summary, current, proposed)
    article.append(node)
    return node
  }
  function classified(phase: string, title: string) {
    const summary = new Element('SUMMARY')
    const heading = new Element('H3', title)
    heading.dataset = { phase, phaseHeading: '' }
    const badge = new Element('SPAN', phase === 'current' ? '现状 · 原文标记' : '拟议变更 · 原文标记')
    badge.className = 'phase-badge'
    badge.dataset.phase = phase
    summary.append(badge, heading)
    return { summary, heading, badge, details: details(summary), title }
  }
  const current = classified('current', '现行办理说明')
  const proposed = classified('proposed', '变更审核规则')
  const ordinary = new Element('SUMMARY', '展开办理说明')
  const empty = new Element('SUMMARY')
  const plainDetails = [details(ordinary), details(empty)]
  const context = {
    currentPhase: 'all',
    currentPath: 'rules.md',
    phases: { current: '现状', proposed: '拟议变更' },
    ui: { article, 'phase-filter': { querySelectorAll: () => [] } },
    document: { createElement: (tag: string) => new Element(tag.toUpperCase()), querySelectorAll: () => [] },
    syncToc: () => {},
    URLSearchParams,
  }
  const text = source.slice(source.indexOf('  function visibleNodeText('), source.indexOf('  function visibleText('))
  const filter = source.slice(source.indexOf('  function applyPhaseFilter('), source.indexOf('  function contextBlock('))
  const actual = runInNewContext(`${text}\n${filter}\n({applyPhaseFilter,visibleNodeText})`, context) as {
    applyPhaseFilter: () => void
    visibleNodeText: (node: Element) => string
  }
  const states = [
    { phase: 'current', currentHidden: false, proposedHidden: true, currentFallback: '', proposedFallback: '查看现状内容' },
    { phase: 'proposed', currentHidden: true, proposedHidden: false, currentFallback: '查看拟议变更内容', proposedFallback: '' },
    { phase: 'all', currentHidden: false, proposedHidden: false, currentFallback: '', proposedFallback: '' },
  ]
  for (const state of [...states, ...states]) {
    context.currentPhase = state.phase
    actual.applyPhaseFilter()
    for (const [fixture, hidden, label] of [[current, state.currentHidden, state.currentFallback], [proposed, state.proposedHidden, state.proposedFallback]] as const) {
      expect(fixture.heading.hidden).toBe(hidden)
      expect(fixture.badge.hidden).toBe(hidden)
      expect(fixture.summary.hidden).toBe(false)
      expect(fixture.summary.tagName).toBe('SUMMARY')
      expect(fixture.details.hidden).toBe(false)
      expect(fixture.details.open).toBe(false)
      const fallback = fixture.summary.querySelector('[data-summary-fallback]')
      expect(fixture.summary.querySelectorAll('[data-summary-fallback]').length).toBeLessThanOrEqual(1)
      if (label) {
        expect(fallback?.hidden).toBe(false)
        expect(fallback?.textContent).toBe(label)
        expect(actual.visibleNodeText(fixture.summary)).toBe(label)
      }
      else {
        expect(!fallback || fallback.hidden).toBe(true)
        expect(actual.visibleNodeText(fixture.summary)).toContain(fixture.title)
      }
    }
    expect(ordinary.textContent).toBe('展开办理说明')
    expect(empty.textContent).toBe('')
    for (const summary of [ordinary, empty]) {
      expect(summary.hidden).toBe(false)
      expect(summary.querySelector('[data-summary-fallback]')).toBeNull()
    }
    expect(plainDetails.map(node => node.hidden)).toEqual([false, false])
  }
})
