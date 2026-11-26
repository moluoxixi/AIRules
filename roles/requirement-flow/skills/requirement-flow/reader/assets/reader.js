/* A read-only view of Markdown. Documents and their ordinary links own the content. */
(() => {
  const { marked, DOMPurify, mermaid } = window
  const $ = id => document.getElementById(id)
  const ui = Object.fromEntries([
    'project-name',
    'home-link',
    'business-view',
    'task-view',
    'business-count',
    'task-count',
    'navigation',
    'search-input',
    'breadcrumbs',
    'source-button',
    'copy-link',
    'refresh-button',
    'document-kind',
    'page-title',
    'page-description',
    'notice',
    'phase-filter',
    'article',
    'context',
    'source-dialog',
    'source-title',
    'source-type',
    'source-hash',
    'source-original',
    'source-content',
    'close-source',
    'toast',
    'mobile-menu',
    'sidebar',
    'nav-shade',
    'diagram-dialog',
    'diagram-title',
    'diagram-phase',
    'diagram-full',
    'close-diagram',
  ].map(id => [id, $(id)]))
  const phases = { current: '现状', proposed: '拟议变更', observed: '实测结果' }
  const phaseKeys = Object.fromEntries(Object.entries(phases).map(([key, title]) => [title, key]))
  const phaseMarker = /^\s*\[(现状|拟议变更|实测结果)\]\s*/u
  const cache = new Map()
  const scrollPositions = new Map()
  const diagramDefinitions = new Map()
  let catalog
  let documents = new Map()
  let sources = new Map()
  let renderVersion = 0
  let currentPath = ''
  let currentPhase = 'all'
  let currentView = 'page'
  let refreshing = false
  let searchTimer
  let toastTimer
  let diagramNumber = 0
  let sourceVersion = 0
  let diagramVersion = 0
  let loadErrors = []

  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char])
  const contentUrl = path => `/content/${path.split('/').map(encodeURIComponent).join('/')}`
  const cleanTitle = value => String(value).replace(phaseMarker, '')
  const slug = value => value.toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '').replace(/\s+/g, '-') || 'section'

  function routeUrl(path, section = '') {
    const params = new URLSearchParams({ page: path })
    if (section)
      params.set('section', section)
    return `#${params}`
  }

  function routeInfo() {
    const params = new URLSearchParams(location.hash.slice(1))
    return {
      path: params.get('page') || catalog?.entry,
      section: params.get('section') || '',
      query: (params.get('q') || '').trim(),
      view: params.get('view') === 'tasks' ? 'tasks' : 'page',
      phase: phases[params.get('phase')] ? params.get('phase') : 'all',
    }
  }

  function toast(message) {
    clearTimeout(toastTimer)
    ui.toast.textContent = message
    ui.toast.hidden = false
    toastTimer = setTimeout(() => {
      ui.toast.hidden = true
    }, 3200)
  }

  function notice(message = '', error = false) {
    ui.notice.textContent = message
    ui.notice.classList.toggle('error', error)
    ui.notice.hidden = !message
  }

  async function fetchResource(url, format = 'text') {
    const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
    if (!response.ok) {
      let detail = ''
      try {
        detail = (await response.json()).error || ''
      }
      catch {
        // The status remains useful when an intermediary returns HTML.
      }
      throw new Error(detail || `读取失败（HTTP ${response.status}），请刷新内容或检查来源路径。`)
    }
    return format === 'json' ? response.json() : response.text()
  }

  async function documentText(doc) {
    const saved = cache.get(doc.path)
    if (saved?.revision === doc.sha256)
      return saved.text
    const text = await fetchResource(contentUrl(doc.path))
    cache.set(doc.path, { revision: doc.sha256, text })
    return text
  }

  function related(doc, kind) {
    const linked = new Map()
    for (const link of doc.links || []) {
      const target = documents.get(link.target)
      if (link.kind !== 'document' || link.exists === false || !target || target.path === doc.path || target.kind !== kind)
        continue
      const fragment = link.fragment || ''
      const key = `${target.path}#${fragment}`
      if (!linked.has(key))
        linked.set(key, { ...target, linkLabel: link.label || target.title, linkFragment: fragment })
    }
    for (const link of doc.backlinks || []) {
      const target = documents.get(link.path)
      if (target && target.path !== doc.path && target.kind === kind && ![...linked.values()].some(item => item.path === target.path))
        linked.set(target.path, { ...target, linkLabel: target.title, referencedBy: true })
    }
    return [...linked.values()]
  }

  function navLink(doc, extraClass = '', label = doc.title || doc.path, fragment = '') {
    return `<a class="${extraClass}" href="${escape(routeUrl(doc.path, fragment))}"${currentPath === doc.path && currentView === 'page' ? ' aria-current="page"' : ''}>${escape(cleanTitle(label))}</a>`
  }

  function renderNavigation() {
    const tasks = [...documents.values()].filter(doc => doc.kind === 'task')
    const navigation = (catalog.navigation || []).filter(link => documents.has(link.path))
    ui['business-count'].textContent = navigation.length
    ui['task-count'].textContent = tasks.length
    ui['business-view'].closest('nav').hidden = false
    ui['business-view'].href = routeUrl(catalog.entry)
    ui['home-link'].href = routeUrl(catalog.entry)
    ui['business-view'].toggleAttribute('aria-current', currentView !== 'tasks')
    ui['task-view'].toggleAttribute('aria-current', currentView === 'tasks')
    ui.navigation.innerHTML = `<div class="nav-group">入口目录</div>${navigation.map(link => navLink(documents.get(link.path), 'nav-link', link.label, link.fragment)).join('') || '<p class="quiet">入口尚无文档链接</p>'}`
  }

  function setHeader({ title, kind = '业务内容', description = '', path = '', showSource = false }) {
    ui['page-title'].textContent = title
    ui['document-kind'].textContent = kind
    ui['page-description'].textContent = description
    ui.breadcrumbs.textContent = path || `${catalog?.project || '项目'} / 业务阅读`
    ui['source-button'].hidden = !showSource
    document.title = `${title} · 业务手册`
  }

  function setMenu(open) {
    ui.sidebar.classList.toggle('open', open)
    ui['nav-shade'].hidden = !open
    ui['mobile-menu'].setAttribute('aria-expanded', String(open))
  }

  function resolveLink(href, doc) {
    if (/^(https?:|mailto:)/i.test(href))
      return { kind: 'external', target: href, exists: true, fragment: '' }
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//'))
      return null
    try {
      const base = new URL(doc.path, 'https://reader.invalid/')
      const parsed = new URL(href, base)
      const target = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
      const fragment = decodeURIComponent(parsed.hash.slice(1))
      const explicit = (doc.links || []).find(link => link.target === target && (link.fragment || '') === fragment)
      if (explicit)
        return explicit
      if (documents.has(target))
        return { kind: 'document', target, fragment, exists: true }
      if (sources.has(target))
        return { kind: 'source', target, fragment, exists: true }
      return { target, fragment, exists: false }
    }
    catch { return null }
  }

  function instrumentLinks(parent, doc) {
    for (const anchor of parent.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href')
      const link = resolveLink(href, doc)
      if (!link || link.exists === false) {
        const span = document.createElement('span')
        span.className = 'unavailable-link'
        span.textContent = anchor.textContent
        span.tabIndex = 0
        span.dataset.reason = `来源未收录或不可读取：${link?.target || href}。确认链接指向可读取的项目内文本后刷新内容。`
        span.title = span.dataset.reason
        anchor.replaceWith(span)
      }
      else if (link.kind === 'document') {
        anchor.href = routeUrl(link.target, link.fragment)
        anchor.removeAttribute('target')
      }
      else if (link.kind === 'source') {
        anchor.href = contentUrl(link.target)
        anchor.dataset.source = link.target
        anchor.removeAttribute('target')
      }
      else {
        anchor.href = link.target
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
      }
    }
  }

  const markdown = new marked.Marked({
    gfm: true,
    breaks: false,
    renderer: {
      image({ href, text }) {
        return `<a href="${escape(href)}">图片：${escape(text || href)}</a>`
      },
      checkbox({ checked }) {
        return `<span class="task-mark" role="img" aria-label="原文${checked ? '已' : '未'}勾选">${checked ? '☑' : '☐'}</span> `
      },
    },
  })

  function firstParagraph(source) {
    const body = source.replace(/^\uFEFF?---[\t ]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/, '')
    for (const token of markdown.lexer(body)) {
      if (token.type !== 'paragraph')
        continue
      const plain = DOMPurify.sanitize(markdown.parseInline(token.text), {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        RETURN_DOM_FRAGMENT: true,
      }).textContent.replace(/\s+/g, ' ').trim()
      if (plain)
        return plain
    }
    return ''
  }

  function paragraphExcerpt(source, maximum = 190) {
    const paragraph = firstParagraph(source)
    if (paragraph.length <= maximum)
      return paragraph
    const prefix = paragraph.slice(0, maximum)
    const boundary = Math.max(...['。', '！', '？', '；', '. ', '! ', '? ', '; '].map(mark => prefix.lastIndexOf(mark)))
    return `${prefix.slice(0, boundary >= maximum / 2 ? boundary + 1 : maximum).trimEnd()}…`
  }
  function markdownSections(raw, doc) {
    const fragment = DOMPurify.sanitize(markdown.parse(raw), {
      USE_PROFILES: { html: true },
      RETURN_DOM_FRAGMENT: true,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio', 'source', 'img', 'link', 'meta', 'base'],
      FORBID_ATTR: ['style', 'id', 'name', 'srcset'],
    })
    instrumentLinks(fragment, doc)
    const container = document.createElement('div')
    const toc = []
    const stack = []
    const ids = new Map()
    let current = document.createElement('section')
    current.className = 'content-section'
    current.dataset.phase = 'unclassified'
    container.append(current)
    let firstHeading = true
    for (const node of [...fragment.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.tagName)) {
        const level = Number(node.tagName[1])
        const original = node.textContent.trim()
        const marker = original.match(phaseMarker)
        while (stack.length && stack.at(-1).level >= level)
          stack.pop()
        const phase = marker ? phaseKeys[marker[1]] : stack.at(-1)?.phase || 'unclassified'
        stack.push({ level, phase })
        if (firstHeading && level === 1 && !marker) {
          firstHeading = false
          continue
        }
        firstHeading = false
        const baseId = slug(original)
        const occurrence = ids.get(baseId) || 0
        ids.set(baseId, occurrence + 1)
        const id = occurrence ? `${baseId}-${occurrence}` : baseId
        node.id = `section-${id}`
        node.dataset.anchor = id
        node.dataset.alias = slug(cleanTitle(original))
        node.textContent = cleanTitle(original)
        const permalink = document.createElement('a')
        permalink.className = 'section-anchor'
        permalink.href = routeUrl(doc.path, id)
        permalink.textContent = '#'
        permalink.setAttribute('aria-label', `链接到${cleanTitle(original)}`)
        node.append(permalink)
        current = document.createElement('section')
        current.className = `content-section phase-${phase}`
        current.dataset.phase = phase
        if (marker) {
          const badge = document.createElement('span')
          badge.className = `phase-badge ${phase}`
          badge.textContent = `${phases[phase]} · 原文标记`
          current.append(badge)
        }
        current.append(node)
        container.append(current)
        toc.push({ id, title: cleanTitle(original), level, phase })
      }
      else {
        current.append(node)
      }
    }
    for (const section of container.querySelectorAll('.content-section')) {
      if (!section.textContent.trim())
        section.remove()
    }
    for (const table of container.querySelectorAll('table')) {
      const wrapper = document.createElement('div')
      wrapper.className = 'table-scroll'
      table.replaceWith(wrapper)
      wrapper.append(table)
    }
    return { container, toc }
  }

  function renderPhaseFilter() {
    const counts = Object.fromEntries(Object.keys(phases).map(key => [key, ui.article.querySelectorAll(`.content-section[data-phase="${key}"]`).length]))
    const buttons = [['all', '全部内容'], ...Object.entries(phases)]
    ui['phase-filter'].innerHTML = `${buttons.map(([key, title]) => `<button type="button" data-phase="${key}" aria-pressed="${currentPhase === key}">${title}${key === 'all' ? '' : `<span class="phase-count">${counts[key]}</span>`}</button>`).join('')}<span class="filter-note">分类来自 Markdown 标题标记</span>`
    applyPhaseFilter()
  }

  function applyPhaseFilter() {
    let visible = 0
    for (const section of ui.article.querySelectorAll('.content-section')) {
      section.hidden = currentPhase !== 'all' && section.dataset.phase !== currentPhase
      if (!section.hidden)
        visible++
    }
    ui.article.querySelector('.filter-empty')?.remove()
    if (!visible) {
      const message = document.createElement('div')
      message.className = 'empty filter-empty'
      message.textContent = `原文没有明确标记的“${phases[currentPhase]}”章节。选择“全部内容”可查看完整原文。`
      ui.article.append(message)
    }
    for (const button of ui['phase-filter'].querySelectorAll('[data-phase]'))
      button.setAttribute('aria-pressed', String(button.dataset.phase === currentPhase))
  }

  function contextBlock(title, body) {
    return `<section class="context-block"><h2>${title}</h2>${body}</section>`
  }

  function renderContext(doc, toc) {
    const taskLinks = related(doc, 'task')
    const documentLinks = related(doc, 'document')
    const contextDocs = doc.kind === 'task' ? documentLinks : taskLinks
    let html = contextBlock('本页目录', toc.length ? toc.map(item => `<a class="toc-link level-${Math.min(item.level, 3)}" href="${escape(routeUrl(doc.path, item.id))}">${escape(item.title)}</a>`).join('') : '<p class="context-note">本页没有分节标题</p>')
    html += contextBlock(doc.kind === 'task' ? '相关文档' : '关联任务', contextDocs.length ? contextDocs.map(item => `<a class="related-card" href="${escape(routeUrl(item.path, item.linkFragment))}">${escape(cleanTitle(item.linkLabel || item.title || item.path))}<small>${escape(item.path)}${item.referencedBy ? ' · 引用本页' : ''}</small></a>`).join('') : '<p class="context-note">原文暂无相关文档链接</p>')
    const references = (doc.links || []).filter(link => link.kind === 'source' || link.kind === 'external'
      || (doc.kind !== 'task' && link.kind === 'document' && link.target !== doc.path && documents.get(link.target)?.kind !== 'task'))
    const unique = [...new Map(references.map(item => [`${item.target}#${item.fragment || ''}`, item])).values()]
    html += contextBlock('来源与依据', unique.length
      ? unique.map((link) => {
          if (link.exists === false)
            return `<span class="source-link unavailable-link" tabindex="0" title="来源未收录或不可读取；确认链接指向可读取的项目内文本后刷新内容" data-reason="来源未收录或不可读取：${escape(link.target)}。确认链接指向可读取的项目内文本后刷新内容。">${escape(link.label || link.target)}</span>`
          return link.kind === 'external'
            ? `<a class="source-link" href="${escape(link.target)}" target="_blank" rel="noopener noreferrer">${escape(link.label || link.target)} ↗</a>`
            : link.kind === 'document'
              ? `<a class="source-link" href="${escape(routeUrl(link.target, link.fragment))}">${escape(link.label || link.target)}</a>`
              : `<a class="source-link" href="${escape(contentUrl(link.target))}" data-source="${escape(link.target)}">${escape(link.label || link.target)}</a>`
        }).join('')
      : '<p class="context-note">来源可在正文链接中查阅</p>')
    const other = (doc.backlinks || []).filter(item => item.path !== doc.path && item.kind === doc.kind)
    if (other.length)
      html += contextBlock('被这些页面引用', other.map(item => `<a class="source-link" href="${escape(routeUrl(item.path))}">${escape(cleanTitle(item.title || item.path))}</a>`).join(''))
    html += contextBlock('本次读取', `<div class="source-fingerprint"><b>${escape(doc.path)}</b><br>原文摘要 ${escape((doc.sha256 || '').slice(0, 12))}<br>${escape(formatTime(catalog.read_at))}</div>`)
    if (catalog.warnings?.length)
      html += contextBlock('来源提示', `<details><summary>${catalog.warnings.length} 条需要留意的来源</summary><ul>${catalog.warnings.map(item => `<li>${escape(item)}</li>`).join('')}</ul></details>`)
    ui.context.innerHTML = html
    ui.context.hidden = false
  }

  function formatTime(value) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.valueOf()) ? String(value || '') : parsed.toLocaleString('zh-CN', { hour12: false })
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    maxTextSize: 30000,
    secure: ['securityLevel', 'startOnLoad', 'suppressErrorRendering', 'maxTextSize'],
    theme: 'base',
    htmlLabels: false,
    fontFamily: 'Optima, PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif',
    themeVariables: {
      primaryColor: '#e5e8d6',
      primaryBorderColor: '#34604f',
      primaryTextColor: '#202b29',
      lineColor: '#8a806a',
      secondaryColor: '#f0dcd0',
      tertiaryColor: '#fcf7ea',
      fontSize: '13px',
    },
    flowchart: { htmlLabels: false, useMaxWidth: true, curve: 'basis' },
  })

  function safeDiagram(svg) {
    return DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['foreignObject', 'a', 'image', 'script'],
      FORBID_ATTR: ['href', 'xlink:href'],
    })
  }

  async function openDiagram(key) {
    const definition = diagramDefinitions.get(key)
    if (!definition)
      return toast('图表内容已经更新，请从当前页面重新打开。')
    const version = ++diagramVersion
    const id = `reader-diagram-${++diagramNumber}`
    ui['diagram-title'].textContent = definition.title
    ui['diagram-phase'].textContent = phases[definition.phase] ? `${phases[definition.phase]} · 图表细节` : '图表细节 · 原文未分类'
    ui['diagram-phase'].className = phases[definition.phase] ? `phase-badge ${definition.phase}` : 'eyebrow'
    ui['diagram-full'].innerHTML = '<div class="loading">正在读取图表细节…</div>'
    if (!ui['diagram-dialog'].open)
      ui['diagram-dialog'].showModal()
    try {
      const { svg } = await mermaid.render(id, definition.source)
      if (version !== diagramVersion || !ui['diagram-dialog'].open)
        return
      ui['diagram-full'].innerHTML = safeDiagram(svg)
      const drawing = ui['diagram-full'].querySelector('svg')
      if (!drawing)
        throw new Error('没有取得可显示的图表')
      const dimensions = drawing.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
      if (dimensions?.length === 4 && dimensions[2] > 0 && dimensions[3] > 0) {
        drawing.setAttribute('width', String(dimensions[2]))
        drawing.setAttribute('height', String(dimensions[3]))
        drawing.style.width = `${dimensions[2]}px`
        drawing.style.height = `${dimensions[3]}px`
      }
      drawing.style.maxWidth = 'none'
      drawing.setAttribute('aria-label', `${definition.title}，按原始比例显示`)
      ui['diagram-full'].scrollTo(0, 0)
    }
    catch (error) {
      if (version === diagramVersion)
        ui['diagram-full'].textContent = `图表未能放大：${error.message || '请关闭后重试'}。`
      document.getElementById(id)?.remove()
      document.getElementById(`d${id}`)?.remove()
    }
  }

  async function renderDiagrams(version) {
    for (const code of [...ui.article.querySelectorAll('pre > code.language-mermaid')]) {
      if (version !== renderVersion)
        return
      const source = code.textContent
      const figure = document.createElement('figure')
      figure.className = 'diagram'
      const stage = document.createElement('div')
      stage.className = 'diagram-stage'
      const caption = document.createElement('figcaption')
      caption.innerHTML = '<span>流程与状态 · Mermaid</span><span>来自当前 Markdown</span>'
      const details = document.createElement('details')
      const summary = document.createElement('summary')
      summary.textContent = '查看图表原文'
      const raw = document.createElement('pre')
      raw.textContent = source
      details.append(summary, raw)
      figure.append(stage, caption, details)
      code.parentElement.replaceWith(figure)
      const id = `reader-diagram-${++diagramNumber}`
      try {
        if (/%%\s*\{|^\s*---/m.test(source))
          throw new Error('图表只接受结构定义；渲染配置由阅读器统一设置。')
        const { svg } = await mermaid.render(id, source)
        if (version !== renderVersion || !stage.isConnected)
          return
        stage.innerHTML = safeDiagram(svg)
        stage.querySelector('svg')?.setAttribute('aria-label', '由 Markdown Mermaid 代码渲染的图表')
        const heading = figure.closest('.content-section')?.querySelector('h1,h2,h3,h4,h5,h6')
        diagramDefinitions.set(id, {
          source,
          title: heading?.textContent.replace(/#$/, '').trim() || '放大图表',
          phase: figure.closest('.content-section')?.dataset.phase,
        })
        const expand = document.createElement('button')
        expand.className = 'button diagram-expand'
        expand.dataset.diagram = id
        expand.textContent = '放大图表'
        caption.append(expand)
      }
      catch (error) {
        stage.classList.add('diagram-error')
        stage.textContent = `图表未能渲染：${error.message || '请检查 Mermaid 语法'}。可展开下方原文核对。`
        document.getElementById(id)?.remove()
        document.getElementById(`d${id}`)?.remove()
      }
    }
  }

  function cardRelated(doc, label, kind) {
    const linked = related(doc, kind)
    return linked.length ? `<div class="card-related"><span>${label}</span>${linked.map(item => `<a href="${escape(routeUrl(item.path, item.linkFragment))}">${escape(cleanTitle(item.linkLabel || item.title || item.path))}${item.referencedBy ? ' · 引用本页' : ''} →</a>`).join('')}</div>` : ''
  }

  async function renderTasks(version) {
    const tasks = [...documents.values()].filter(doc => doc.kind === 'task')
    setHeader({ title: '任务卡', kind: '变更与接手', description: '从既有 Markdown 任务记录查看目标、实现、验证和关联业务。' })
    ui['phase-filter'].innerHTML = ''
    ui.context.hidden = true
    if (!tasks.length) {
      ui.article.innerHTML = '<div class="empty"><p>当前没有收录任务记录。</p><p>业务文档可以照常阅读。</p></div>'
      return
    }
    const records = await Promise.all(tasks.map(async doc => ({ doc, raw: await documentText(doc).catch(() => '') })))
    if (version !== renderVersion)
      return
    ui.article.innerHTML = `<div class="task-grid">${records.map(({ doc, raw }) => {
      const summary = paragraphExcerpt(raw)
      return `<section class="task-card"><div class="card-source">${escape(doc.path)}</div><h2>${navLink(doc)}</h2><p>${escape(summary ? `原文首段：${summary}` : '打开任务记录查阅原文。')}</p>${cardRelated(doc, '相关文档', 'document')}</section>`
    }).join('')}</div>`
  }

  function excerpt(raw, query) {
    const selected = paragraphExcerpt(raw)
    if (!selected)
      return '原文没有正文段落，可打开文档查看。'
    const position = selected.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
    if (position < 0)
      return escape(selected)
    return `${escape(selected.slice(0, position))}<mark>${escape(selected.slice(position, position + query.length))}</mark>${escape(selected.slice(position + query.length))}`
  }

  async function renderSearch(query, version) {
    setHeader({ title: `查找“${query}”`, kind: '业务查询', description: '搜索收录的文档与任务原文，沿普通链接查看关联和依据。' })
    ui['phase-filter'].innerHTML = ''
    ui.context.hidden = true
    const records = await Promise.all([...documents.values()].map(async (doc) => {
      try {
        return { doc, raw: await documentText(doc) }
      }
      catch (error) {
        loadErrors.push(`${doc.path}：${error.message}`)
        return null
      }
    }))
    if (version !== renderVersion)
      return
    const needle = query.toLocaleLowerCase()
    const matches = records.filter(item => item && `${item.doc.title}\n${item.raw}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => {
        const titleA = cleanTitle(a.doc.title || '').toLocaleLowerCase().includes(needle)
        const titleB = cleanTitle(b.doc.title || '').toLocaleLowerCase().includes(needle)
        if (titleA !== titleB)
          return titleA ? -1 : 1
        const kindOrder = Number(a.doc.kind === 'task') - Number(b.doc.kind === 'task')
        if (kindOrder)
          return kindOrder
        return a.doc.path < b.doc.path ? -1 : a.doc.path > b.doc.path ? 1 : 0
      })
    if (!matches.length) {
      ui.article.innerHTML = '<div class="empty"><p>没有找到匹配内容。</p><p>可换一个业务对象、操作或规则名称。</p></div>'
    }
    else {
      ui.article.innerHTML = `<p class="search-results-summary">找到 ${matches.length} 份文档 · 内容来自当前 Markdown</p><div class="search-results">${matches.map(({ doc, raw }) => `<section class="search-card"><div class="card-source">${escape(doc.path)}</div><h2>${navLink(doc)}<span class="result-type ${doc.kind === 'task' ? 'task' : ''}">${doc.kind === 'task' ? '任务记录' : '文档'}</span></h2><p>原文首段：${excerpt(raw, query)}</p>${cardRelated(doc, doc.kind === 'task' ? '相关文档' : '关联任务', doc.kind === 'task' ? 'document' : 'task')}</section>`).join('')}</div>`
    }
    if (loadErrors.length)
      notice(`部分文档未读取，查询结果可能不完整。${[...new Set(loadErrors)].join('；')}`, true)
  }

  async function renderPage(info, version) {
    const doc = documents.get(info.path)
    if (!doc)
      throw new Error(`文档未收录或已经移除：${info.path}。请刷新目录后从业务入口继续。`)
    const raw = await documentText(doc)
    if (version !== renderVersion)
      return
    setHeader({ title: cleanTitle(doc.title || doc.path), kind: doc.kind === 'task' ? '任务记录' : doc.path === catalog.entry ? '业务入口' : '文档', description: doc.kind === 'task' ? '目标、实际实现和验证范围以本记录中的明确说明为准。' : '阅读规则、例外与依据；章节用途取自原文标记，适用范围以正文为准。', path: doc.path, showSource: true })
    const { container, toc } = markdownSections(raw, doc)
    ui.article.replaceChildren(...container.childNodes)
    renderPhaseFilter()
    renderContext(doc, toc)
    await renderDiagrams(version)
    if (version !== renderVersion)
      return
    if (info.section) {
      const heading = [...ui.article.querySelectorAll('[data-anchor]')].find(node => node.dataset.anchor === info.section || node.dataset.alias === info.section)
      if (heading) {
        const hiddenSection = heading.closest('.content-section[hidden]')
        if (hiddenSection) {
          currentPhase = 'all'
          applyPhaseFilter()
          const params = new URLSearchParams(location.hash.slice(1))
          params.delete('phase')
          history.replaceState(null, '', `#${params}`)
        }
        heading.scrollIntoView({ block: 'start' })
      }
      else { notice(`原文中未找到章节“${info.section}”，已显示该文档。`) }
    }
    else { window.scrollTo({ top: scrollPositions.get(doc.path) || 0, behavior: 'instant' }) }
  }

  async function renderRoute() {
    if (!catalog)
      return
    if (currentPath && currentView === 'page')
      scrollPositions.set(currentPath, window.scrollY)
    const info = routeInfo()
    const version = ++renderVersion
    diagramDefinitions.clear()
    if (ui['diagram-dialog'].open)
      ui['diagram-dialog'].close()
    currentPath = info.path
    currentPhase = info.phase
    currentView = info.query ? 'search' : info.view
    ui['search-input'].value = info.query
    setMenu(false)
    notice('')
    renderNavigation()
    ui['phase-filter'].replaceChildren()
    ui.context.replaceChildren()
    ui.context.hidden = true
    ui['source-button'].hidden = true
    ui.article.innerHTML = '<div class="loading">正在读取 Markdown…</div>'
    try {
      if (info.query)
        await renderSearch(info.query, version)
      else if (info.view === 'tasks')
        await renderTasks(version)
      else
        await renderPage(info, version)
    }
    catch (error) {
      if (version !== renderVersion)
        return
      setHeader({ title: '文档读取失败', kind: '来源未读取', description: '从目录选择可用文档，或检查来源后刷新内容。', path: info.path })
      ui['phase-filter'].replaceChildren()
      ui.context.replaceChildren()
      ui.article.innerHTML = '<div class="empty"><p>当前内容未能加载。</p><p>可点击“刷新内容”重新读取来源，或从左侧选择其他文档。</p></div>'
      notice(error.message, true)
      ui.context.hidden = true
    }
  }

  async function refresh() {
    if (refreshing)
      return
    refreshing = true
    ui['refresh-button'].setAttribute('aria-busy', 'true')
    ui['refresh-button'].title = '正在读取 Markdown，完成后可再次刷新'
    try {
      const next = await fetchResource('/api/catalog', 'json')
      if (!Array.isArray(next.documents))
        throw new Error('目录响应缺少文档列表。')
      catalog = next
      documents = new Map(next.documents.map(doc => [doc.path, doc]))
      sources = new Map((next.sources || []).map(source => [source.path, source]))
      cache.clear()
      loadErrors = []
      ui['project-name'].textContent = next.project
      await renderRoute()
    }
    catch (error) {
      // A failed catalog read cannot leave the previous reading snapshot looking current.
      renderVersion++
      sourceVersion++
      diagramVersion++
      catalog = null
      documents.clear()
      sources.clear()
      cache.clear()
      scrollPositions.clear()
      diagramDefinitions.clear()
      loadErrors = []
      currentPath = ''
      currentPhase = 'all'
      currentView = 'page'
      if (ui['source-dialog'].open)
        ui['source-dialog'].close()
      if (ui['diagram-dialog'].open)
        ui['diagram-dialog'].close()
      for (const id of ['source-content', 'source-hash', 'source-title', 'diagram-full', 'diagram-title', 'diagram-phase'])
        ui[id].replaceChildren()
      ui['source-original'].removeAttribute('href')
      ui['project-name'].textContent = '来源未能读取'
      ui.navigation.innerHTML = '<p class="quiet">目录未能读取。恢复 Markdown 入口后可重新读取。</p>'
      ui['business-view'].closest('nav').hidden = true
      ui['business-count'].textContent = ''
      ui['task-count'].textContent = ''
      ui['phase-filter'].replaceChildren()
      ui.context.replaceChildren()
      ui.context.hidden = true
      setHeader({ title: '业务内容读取失败', kind: '来源未读取', description: '当前未展示业务内容。请检查或恢复 Markdown 入口后重试。' })
      ui.article.innerHTML = '<div class="empty"><p>本次未能读取最新 Markdown。</p><p>请检查或恢复业务入口，完成后重新读取。</p><button type="button" class="button" data-retry-read>重试读取</button></div>'
      notice(error.message, true)
    }
    finally {
      refreshing = false
      ui['refresh-button'].removeAttribute('aria-busy')
      ui['refresh-button'].removeAttribute('title')
    }
  }

  async function openSource(path) {
    const version = ++sourceVersion
    const metadata = documents.get(path) || sources.get(path)
    if (!metadata)
      return toast('该来源未收录，请先刷新内容。')
    const doc = documents.get(path)
    ui['source-title'].textContent = path
    ui['source-type'].textContent = doc ? '本次读取的 Markdown 原文' : '项目文本来源'
    ui['source-original'].href = contentUrl(path)
    ui['source-hash'].textContent = ''
    ui['source-content'].textContent = '正在读取来源…'
    if (!ui['source-dialog'].open)
      ui['source-dialog'].showModal()
    try {
      const text = doc ? await documentText(doc) : await fetchResource(contentUrl(path))
      if (version !== sourceVersion || !ui['source-dialog'].open)
        return
      ui['source-content'].textContent = text
      if (crypto.subtle) {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
        if (version !== sourceVersion || !ui['source-dialog'].open)
          return
        const hex = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
        ui['source-hash'].textContent = `本次文本摘要 ${hex.slice(0, 16)}`
      }
    }
    catch (error) {
      if (version === sourceVersion)
        ui['source-content'].textContent = error.message
    }
  }

  ui['search-input'].addEventListener('input', () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const params = new URLSearchParams(location.hash.slice(1))
      const value = ui['search-input'].value.trim()
      if (value)
        params.set('q', value)
      else
        params.delete('q')
      history.replaceState(null, '', `#${params}`)
      renderRoute()
    }, 180)
  })
  ui['phase-filter'].addEventListener('click', (event) => {
    const button = event.target.closest('button[data-phase]')
    if (!button)
      return
    currentPhase = button.dataset.phase
    const params = new URLSearchParams(location.hash.slice(1))
    if (currentPhase === 'all')
      params.delete('phase')
    else
      params.set('phase', currentPhase)
    history.replaceState(null, '', `#${params}`)
    applyPhaseFilter()
  })
  document.addEventListener('click', (event) => {
    if (event.target.closest('button[data-retry-read]')) {
      refresh()
      return
    }
    const diagram = event.target.closest('button[data-diagram]')
    if (diagram) {
      openDiagram(diagram.dataset.diagram)
      return
    }
    const source = event.target.closest('a[data-source]')
    if (source) {
      event.preventDefault()
      openSource(source.dataset.source)
    }
  })
  ui['source-button'].addEventListener('click', () => openSource(currentPath))
  ui['close-source'].addEventListener('click', () => ui['source-dialog'].close())
  ui['source-dialog'].addEventListener('close', () => {
    sourceVersion++
  })
  ui['source-dialog'].addEventListener('click', (event) => {
    if (event.target === ui['source-dialog']) {
      const bounds = ui['source-dialog'].getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
        ui['source-dialog'].close()
    }
  })
  ui['close-diagram'].addEventListener('click', () => ui['diagram-dialog'].close())
  ui['diagram-dialog'].addEventListener('close', () => {
    diagramVersion++
  })
  ui['copy-link'].addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      toast('当前阅读链接已复制')
    }
    catch {
      toast('无法自动复制，请复制浏览器地址。')
    }
  })
  ui['refresh-button'].addEventListener('click', refresh)
  ui['mobile-menu'].addEventListener('click', () => setMenu(!ui.sidebar.classList.contains('open')))
  ui['nav-shade'].addEventListener('click', () => setMenu(false))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      setMenu(false)
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !/^(INPUT|TEXTAREA)$/.test(event.target.tagName) && !ui['source-dialog'].open && !ui['diagram-dialog'].open) {
      event.preventDefault()
      ui['search-input'].focus()
    }
  })
  window.addEventListener('hashchange', renderRoute)
  refresh()
})()
