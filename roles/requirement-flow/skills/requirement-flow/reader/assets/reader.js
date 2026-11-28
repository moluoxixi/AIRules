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
    'nav-tooltip',
    'search-input',
    'breadcrumbs',
    'source-button',
    'copy-link',
    'refresh-button',
    'theme-button',
    'document-kind',
    'page-title',
    'page-description',
    'page-links',
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
  const scrollPositions = new Map()
  const diagramDefinitions = new Map()
  const readLinkBindings = new WeakMap()
  let catalog
  let documents = new Map()
  let sources = new Map()
  let taskPages = new Map()
  let searchTexts = new Map()
  let pendingTexts
  let renderVersion = 0
  let readPageVersion = 0
  let readPageKey
  let currentPath = ''
  let currentPhase = 'all'
  let currentView = 'page'
  let refreshing = false
  let searchTimer
  let toastTimer
  let diagramNumber = 0
  let sourceVersion = 0
  let sourceRoute
  let taskFrameRead
  let diagramVersion = 0
  let tocItems = []
  let documentAnchors = new Map()
  let tocFrame = 0
  let navTooltipTarget
  let navTooltipFocusTarget
  let navTooltipTimer
  const wideOutline = window.matchMedia('(min-width: 1280px)')
  const siteHeader = document.querySelector('.site-header')

  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char])
  const taskFileUrl = (page, path) => `/task-page/${page.sha256}/${page.model_sha256}/${path.split('/').map(encodeURIComponent).join('/')}`
  const cleanTitle = value => String(value).replace(phaseMarker, '')
  const slug = value => value.toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '').replace(/\s+/g, '-') || 'section'

  function originalTaskPage(path) {
    if (catalog?.task_errors?.[path])
      return
    const page = knownTaskPage(path)
    return page && !page.readError ? page : undefined
  }

  function knownTaskPage(path) {
    const page = taskPages.get(path) || taskPages.get(`${path.slice(0, path.lastIndexOf('/') + 1)}handbook.html`)
    return page && (page.path === path || page.model_path === path) ? page : undefined
  }

  function sourceReadError(path) {
    const metadata = documents.get(path) || sources.get(path) || taskPages.get(path)
    if (catalog?.readFailure && (!metadata || (metadata.readResultVersion || 0) <= (catalog.readFailureVersion ?? Infinity)))
      return catalog.readFailure
    if (metadata)
      return metadata.readError ? { error: metadata.readError, unchecked: Boolean(metadata.readUnchecked), changed: Boolean(metadata.readChanged), status: metadata.readStatus, scope_limited: Boolean(metadata.readScopeLimited) } : undefined
    return catalog?.readChecks?.get(path)
  }

  function sourceUrl(path, revision = documents.get(path)?.sha256 || sources.get(path)?.sha256) {
    const readError = sourceReadError(path)
    if (readError)
      throw new Error(unavailableReason({ target: path, ...readError }))
    if (catalog?.task_errors?.[path])
      throw new Error(unavailableReason({ target: path }))
    const page = originalTaskPage(path)
    return page
      ? taskFileUrl(page, path)
      : `/content/${path.split('/').map(encodeURIComponent).join('/')}${revision ? `?sha256=${encodeURIComponent(revision)}` : ''}`
  }

  function taskQuery(value) {
    const params = new URLSearchParams()
    for (const [key, entry] of new URLSearchParams(value)) {
      if (['view', 'q', 'features'].includes(key))
        params.set(key, entry)
    }
    if (params.has('view') && !['overview', 'detail'].includes(params.get('view')))
      params.delete('view')
    params.sort()
    return params.toString()
  }

  function routeUrl(path, section = '', query = '') {
    const params = new URLSearchParams({ page: path })
    if (section)
      params.set('section', section)
    if (section && path === currentPath && currentPhase !== 'all')
      params.set('phase', currentPhase)
    if (query)
      params.set('task_query', taskQuery(query))
    return `#${params}`
  }

  function routeInfo() {
    const params = new URLSearchParams(location.hash.slice(1))
    return {
      path: params.get('page') || catalog?.entry,
      section: params.get('section') || '',
      taskQuery: taskQuery(params.get('task_query') || ''),
      query: (params.get('q') || '').trim(),
      view: params.get('view') === 'tasks' ? 'tasks' : 'page',
      phase: phases[params.get('phase')] ? params.get('phase') : 'all',
    }
  }

  function readPageScope(info = routeInfo()) {
    const key = JSON.stringify(['path', 'view', 'query', 'taskQuery', 'phase', 'section'].map(name => info[name]))
    if (key !== readPageKey) {
      readPageKey = key
      readPageVersion++
    }
    return readPageVersion
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
      let scopeLimited = false
      let catalogFailure = false
      let source = ''
      try {
        const failure = await response.json()
        detail = failure.error || ''
        scopeLimited = failure.scope_limited === true
        catalogFailure = failure.error_stage === 'catalog'
        source = catalogFailure && typeof failure.error_source === 'string' ? failure.error_source : ''
      }
      catch {
        // The status remains useful when an intermediary returns HTML.
      }
      const error = Object.assign(new Error(detail || `读取失败（HTTP ${response.status}），请刷新内容或检查来源路径。`), { status: response.status })
      if (scopeLimited)
        error.scope_limited = true
      if (catalogFailure) {
        error.error_stage = 'catalog'
        if (source)
          error.error_source = source
      }
      throw error
    }
    return format === 'json' ? response.json() : response.text()
  }

  async function documentText(doc, isCurrent, request) {
    const url = sourceUrl(doc.path, doc.sha256)
    return readSource(doc.path, url, isCurrent, request)
  }

  async function documentRecords(list, scope, version) {
    const pageScope = readPageScope()
    if (pendingTexts?.catalog !== catalog || pendingTexts.scope !== scope || pendingTexts.pageScope !== pageScope || pendingTexts.readVersion !== (catalog.readVersion || 0)) {
      catalog.readVersion = (catalog.readVersion || 0) + 1
      pendingTexts = { catalog, scope, pageScope, readVersion: catalog.readVersion, result: fetchResource(`/api/document-texts?scope=${scope}`, 'json') }
    }
    const batch = pendingTexts
    const owner = () => catalog === batch.catalog && readPageScope() === batch.pageScope
    const current = () => owner() && catalog.readVersion === batch.readVersion
    const knownPaths = new Set([...batch.catalog.documents, ...(batch.catalog.task_pages || [])].map(item => item.path))
    try {
      const { records: rows, warnings, source_checks: sourceChecks = [], navigation } = await batch.result
      const byPath = new Map(rows.map(row => [row.path, row]))
      const checksByPath = new Map([...sourceChecks, ...rows].map(row => [row.path, row]))
      for (const row of rows) {
        if (row.kind === 'task-page')
          checksByPath.set(`${row.path.slice(0, row.path.lastIndexOf('/') + 1)}model.json`, row)
      }
      const targets = new Set([
        ...(batch.catalog.navigation || []).map(link => link.path),
        ...Object.keys(batch.catalog.document_errors || {}),
        ...Object.keys(batch.catalog.task_errors || {}),
        ...batch.catalog.documents.flatMap(doc => (doc.links || []).filter(link => link.kind !== 'external').map(link => link.target)),
      ])
      const readChecks = new Map([...targets].map((path) => {
        const row = checksByPath.get(path)
        const check = row?.error || row?.status >= 400
          ? readCheck(row, {}, '来源')
          : { ...readCheck(undefined, {}, '来源'), ...(row?.sha256 ? { error: '本批已读到该来源，但未纳入当前目录。请刷新内容后核对原文。' } : {}) }
        return [path, check]
      }))
      const requestedPaths = new Set(list.map(doc => doc.path))
      const documentChecks = batch.catalog.documents
        .filter(doc => !requestedPaths.has(doc.path))
        .map(doc => ({ doc, ...readCheck(byPath.get(doc.path), { sha256: doc.sha256 }, '原文') }))
      const records = list.map((doc) => {
        const row = byPath.get(doc.path)
        const check = readCheck(row, { sha256: doc.sha256 }, '原文')
        if (check.error)
          return { doc, raw: '', ...check }
        if (typeof row.text !== 'string')
          return { doc, raw: '', ...readCheck(undefined, { sha256: doc.sha256 }, '正文') }
        // Match the UTF-8 BOM handling of Response.text() on the individual document route.
        const raw = row.text.replace(/^\uFEFF/u, '')
        return { doc, raw }
      })
      return {
        records,
        taskPages: rows.filter(row => row.kind === 'task-page'),
        sourceChecks,
        documentChecks,
        navigation,
        readChecks,
        current,
        addedPaths: rows.filter(row => !row.error && row.sha256 && (row.kind !== 'task-page' || row.model_sha256) && !knownPaths.has(row.path)).map(row => row.path),
        warnings,
      }
    }
    catch (error) {
      if (error.error_stage === 'catalog' && owner()
        && (batch.catalog.readDirectoryVersion || 0) <= batch.readVersion) {
        const valid = invalidateCatalogRead(batch.catalog, error, batch.readVersion)
        error.readCurrent = () => owner() && valid()
      }
      else { error.readCurrent = () => version === renderVersion && current() }
      throw error
    }
    finally {
      if (pendingTexts === batch)
        pendingTexts = undefined
    }
  }

  function readCheck(row, versions, label) {
    const failed = Boolean(row?.error || row?.status >= 400)
    const changed = row?.status === 409 || Boolean(row && !failed && Object.entries(versions).some(([key, value]) => typeof row[key] === 'string' && row[key] && row[key] !== value))
    const matches = Boolean(row && !failed && Object.entries(versions).every(([key, value]) => row[key] === value))
    const unchecked = !row || (!failed && !matches && !changed)
    const error = row?.error || (changed ? `${label}已更新，请刷新内容后核对新版。` : matches ? '' : failed ? `${label}读取失败（HTTP ${row.status}）。` : `本批未读到与目录版本一致的${label}，请刷新内容重新核对目录。`)
    return { error, changed, unchecked, status: row?.status, scope_limited: Boolean(row?.scope_limited) }
  }

  function applyReadCheck(metadata, check, resultVersion) {
    metadata.readResultVersion = resultVersion ?? (catalog?.readVersion || 0)
    metadata.readError = check.error || ''
    metadata.readUnchecked = Boolean(check.unchecked)
    metadata.readChanged = Boolean(check.changed)
    metadata.readStatus = check.status
    metadata.readScopeLimited = Boolean(check.scope_limited)
  }

  function clearSourceContents() {
    for (const id of ['source-content', 'source-hash']) {
      ui[id].textContent = ''
      ui[id].title = ''
    }
    ui['source-original'].removeAttribute('href')
    ui['source-original'].hidden = true
  }

  function syncSourceFailure(snapshot) {
    const dialog = ui['source-dialog']
    const reading = dialog?.reading
    if (!dialog?.open || !reading?.displayed || reading.catalog !== snapshot || !sourceReadError(reading.path))
      return
    sourceVersion++
    sourceRoute = undefined
    dialog.reading = undefined
    clearSourceContents()
    dialog.close()
  }

  function refreshCurrentReadState(directoryFailure) {
    const snapshot = catalog
    const pageScope = readPageScope()
    // Other accepted checks in this turn may supersede the fact before the browser paints it.
    Promise.resolve().then(() => {
      if (catalog !== snapshot || readPageScope() !== pageScope || (directoryFailure && catalog.readFailure !== directoryFailure))
        return
      if (directoryFailure)
        notice(directoryFailure.error, true)
      if (currentView !== 'page' || !ui.article)
        return
      const page = taskPages.get(currentPath)
      const doc = documents.get(currentPath)
      if (!page && !doc)
        return
      const failure = sourceReadError(currentPath)
      if (failure) {
        const message = unavailableReason({ target: currentPath, ...failure })
        if (page || failure !== catalog.readFailure) {
          showReadFailure(currentPath, message)
        }
        else {
          if (ui['page-description'])
            ui['page-description'].textContent = ui['page-description'].title = '本页来源尚未重新核对，其余目录尚待刷新核对。'
          notice(`本页来源尚未重新核对。${message}`, true)
        }
        return
      }
      if (page) {
        if (!ui.article.querySelector('.original-task-frame')) {
          showUnloadedTask(page, true)
        }
        else if (catalog.readFailure) {
          const message = '原任务来源已重新核对，其余目录尚待刷新核对。'
          ui['page-description'].textContent = ui['page-description'].title = message
          notice(message, true)
        }
        return
      }
      const missingBody = ui.article.dataset.failedSource === currentPath
      if (catalog.readFailure || missingBody) {
        const message = `本页原文已重新核对。${catalog.readFailure ? '其余目录尚待刷新核对。' : ''}`
        setHeader({ title: doc.title || doc.path, kind: doc.kind === 'task' ? '变更记录' : doc.path === catalog.entry ? '业务入口' : '文档', description: message, path: doc.path, showSource: true })
        if (missingBody) {
          ui.article.innerHTML = '<div class="empty"><p>本页原文已重新核对。</p><p>请点击“刷新内容”后继续阅读。</p></div>'
          delete ui.article.dataset.failedSource
        }
        notice(`${message}${missingBody ? '请刷新内容后继续阅读。' : ''}`, true)
      }
    })
  }

  function invalidateCatalogRead(snapshot, error, version = snapshot.readVersion || 0) {
    if (catalog !== snapshot || (snapshot.readDirectoryVersion || 0) > version)
      return () => false
    if (snapshot.readDirectoryVersion === version && snapshot.readFailure) {
      const failure = snapshot.readFailure
      error.message = failure.error
      return () => catalog === snapshot && snapshot.readFailure === failure && snapshot.readDirectoryVersion === version
    }
    const source = error.error_source ? `（${error.error_source}）` : ''
    const recovery = error.error_source ? '请修复或恢复该目录来源后刷新内容重新核对。' : '请按目录失败原因处理后刷新内容重新核对。'
    const check = { ...readCheck(undefined, {}, '目录'), error: `目录未能核对${source}：${error.message.replace(/。$/, '')}。${recovery}` }
    const navigation = []
    snapshot.readResultVersion = Math.max(snapshot.readResultVersion || 0, version)
    snapshot.readDirectoryVersion = version
    snapshot.readFailure = check
    snapshot.readFailureVersion = version
    snapshot.readNavigation = navigation
    for (const metadata of new Set([...documents.values(), ...sources.values(), ...taskPages.values()])) {
      if ((metadata.readResultVersion || 0) <= version)
        applyReadCheck(metadata, check, version)
    }
    syncSourceFailure(snapshot)
    renderNavigation()
    refreshReadLinks()
    const currentDoc = documents.get(currentPath)
    if (!currentDoc || currentDoc.readError) {
      const reading = ui.context.reading || ui.context.suspendedReading
      if (reading) {
        if (ui.context.reading)
          reading.open = [...ui.context.querySelectorAll?.(':scope > details') || []].map(node => node.open)
        ui.context.suspendedReading = reading
      }
      ui.context.replaceChildren()
      ui.context.reading = undefined
      ui.context.hidden = true
      tocItems = []
    }
    refreshCurrentReadState(check)
    error.message = check.error
    return () => catalog === snapshot && snapshot.readFailure === check && snapshot.readDirectoryVersion === version
  }

  async function readSource(path, url, isCurrent = () => true, request) {
    const snapshot = catalog
    const catalogVersion = (snapshot.readVersion || 0) + 1
    snapshot.readVersion = catalogVersion
    const page = knownTaskPage(path)
    const metadata = page || documents.get(path) || sources.get(path)
    const owner = (current = isCurrent) => catalog === snapshot && current() && metadata
      && metadata === (knownTaskPage(path) || documents.get(path) || sources.get(path))
    const active = () => owner() && (metadata.readResultVersion || 0) <= catalogVersion
    const accept = (check) => {
      let changed = false
      for (const target of new Set([metadata, ...(page ? [sources.get(page.path), sources.get(page.model_path)] : [])])) {
        if (!target || (target.readResultVersion || 0) > catalogVersion)
          continue
        if (check || target.readError) {
          changed = true
          applyReadCheck(target, check || { error: '' }, catalogVersion)
        }
        else { target.readResultVersion = catalogVersion }
      }
      snapshot.readResultVersion = Math.max(snapshot.readResultVersion || 0, catalogVersion)
      return changed
    }
    if (request)
      request.current = active
    try {
      const text = await fetchResource(url)
      if (!active())
        return
      if (accept()) {
        renderNavigation()
        refreshReadLinks()
        refreshCurrentReadState()
      }
      return text
    }
    catch (error) {
      if (error.error_stage === 'catalog') {
        if (!owner(request?.directoryCurrent) || (snapshot.readDirectoryVersion || 0) > catalogVersion)
          return
        const current = invalidateCatalogRead(snapshot, error, catalogVersion)
        error.readCurrent = () => owner(request?.directoryCurrent) && current()
        throw error
      }
      if (!active())
        return
      const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : undefined
      const check = status
        ? readCheck({ error: error.message, status, scope_limited: error.scope_limited === true }, {}, '来源')
        : { ...readCheck(undefined, {}, '来源'), error: `本次来源读取尚未确认：${error.message || '读取失败'}。请刷新内容重试。` }
      accept(check)
      if (path === snapshot.entry)
        snapshot.readNavigation = []
      error.readCurrent = active
      syncSourceFailure(snapshot)
      renderNavigation()
      refreshReadLinks()
      refreshCurrentReadState()
      throw error
    }
  }

  function updateReadChecks(records, pages, sourceChecks = [], documentChecks = [], navigation, readChecks, warnings) {
    catalog.readVersion = (catalog.readVersion || 0) + 1
    catalog.readResultVersion = catalog.readVersion
    catalog.readDirectoryVersion = catalog.readVersion
    catalog.readFailure = undefined
    catalog.readFailureVersion = undefined
    catalog.readChecks = readChecks || new Map()
    if (Array.isArray(warnings))
      catalog.readWarnings = [...warnings]
    if (Array.isArray(navigation))
      catalog.readNavigation = navigation
    for (const record of [...records, ...documentChecks])
      applyReadCheck(record.doc, record)
    const paired = new Set([...taskPages.values()].flatMap(page => [page.path, page.model_path]))
    for (const row of sourceChecks) {
      const metadata = sources.get(row.path)
      if (metadata && !paired.has(row.path))
        applyReadCheck(metadata, readCheck(row, { sha256: metadata.sha256 }, '来源'))
    }
    const checked = new Map(pages.map(page => [page.path, page]))
    for (const page of taskPages.values()) {
      const row = checked.get(page.path)
      const check = readCheck(row, { sha256: page.sha256, model_sha256: page.model_sha256 }, '原任务')
      applyReadCheck(page, check)
      for (const path of [page.path, page.model_path]) {
        const metadata = sources.get(path)
        if (metadata) {
          applyReadCheck(metadata, check)
        }
      }
    }
    for (const row of pages) {
      if (taskPages.has(row.path))
        continue
      const check = row.error ? readCheck(row, {}, '原任务') : { error: '本批原任务配对尚未纳入目录，请刷新内容后核对。', unchecked: true }
      for (const path of [row.path, `${row.path.slice(0, row.path.lastIndexOf('/') + 1)}model.json`]) {
        const metadata = sources.get(path)
        if (metadata)
          applyReadCheck(metadata, check)
      }
    }
    syncSourceFailure(catalog)
    renderNavigation()
  }

  function related(doc, kind) {
    if (doc.readError)
      return []
    const linked = new Map()
    for (const link of doc.links || []) {
      const target = documents.get(link.target)
      if (link.kind !== 'document' || link.exists === false || !target || target.readError || target.path === doc.path || target.kind !== kind)
        continue
      const fragment = link.fragment || ''
      const key = `${target.path}#${fragment}`
      if (!linked.has(key))
        linked.set(key, { ...target, linkLabel: link.label || target.title, linkFragment: fragment })
    }
    for (const link of doc.backlinks || []) {
      const target = documents.get(link.path)
      if (target && !target.readError && target.path !== doc.path && target.kind === kind && ![...linked.values()].some(item => item.path === target.path))
        linked.set(target.path, { ...target, linkLabel: target.title, referencedBy: true })
    }
    return [...linked.values()]
  }

  function navLink(doc, extraClass = '', label = doc.title || doc.path, fragment = '', query = '', from = '') {
    const attributes = readLinkAttributes({ target: doc.path, kind: taskPages.has(doc.path) || doc.model_path || catalog?.task_errors?.[doc.path] ? 'task-page' : 'document', fragment, query }, from || doc.path, label)
    if (doc.readError) {
      const reason = unavailableReason({ target: doc.path, error: doc.readError, unchecked: doc.readUnchecked, changed: doc.readChanged, status: doc.readStatus, scope_limited: doc.readScopeLimited })
      return `<span class="${extraClass} unavailable-link" tabindex="0" title="${escape(label)}；${escape(reason)}" data-reason="${escape(reason)}"${attributes}>${escape(label)}</span>`
    }
    let href = routeUrl(doc.path, fragment, query)
    if (extraClass === 'nav-link') {
      const params = new URLSearchParams(href.slice(1))
      params.delete('phase')
      href = `#${params}`
    }
    const title = extraClass === 'nav-link' ? '' : ` title="${escape(label)}"`
    return `<a class="${extraClass}" href="${escape(href)}"${title}${extraClass !== 'nav-link' && currentPath === doc.path && currentView === 'page' ? ' aria-current="page"' : ''}${attributes}>${escape(label)}</a>`
  }

  function hideNavTooltip() {
    clearTimeout(navTooltipTimer)
    navTooltipTarget?.removeAttribute('aria-describedby')
    navTooltipTarget = undefined
    ui['nav-tooltip'].hidden = true
  }

  function delayNavTooltipHide() {
    clearTimeout(navTooltipTimer)
    navTooltipTimer = setTimeout(hideNavTooltip, 180)
  }

  function dismissNavTooltip() {
    navTooltipFocusTarget = undefined
    hideNavTooltip()
  }

  function showNavTooltip(link) {
    hideNavTooltip()
    const reason = link?.dataset?.reason
    if (!link || (!reason && link.scrollWidth <= link.clientWidth + 1))
      return
    const tooltip = ui['nav-tooltip']
    const anchor = link.getBoundingClientRect()
    const viewport = document.documentElement
    const scrollport = ui.navigation.getBoundingClientRect()
    if (anchor.right <= 0 || anchor.left >= viewport.clientWidth || anchor.bottom <= 0 || anchor.top >= viewport.clientHeight)
      return
    if (anchor.right <= scrollport.left || anchor.left >= scrollport.right || anchor.bottom <= scrollport.top || anchor.top >= scrollport.bottom)
      return
    tooltip.textContent = reason ? `${link.textContent}；${reason}` : link.textContent
    tooltip.hidden = false
    const bounds = tooltip.getBoundingClientRect()
    let left = anchor.right + 8
    let top = anchor.top + (anchor.height - bounds.height) / 2
    if (left + bounds.width > viewport.clientWidth - 8) {
      left = anchor.left - bounds.width - 8
      if (left < 8) {
        left = 8
        top = anchor.bottom + 8
      }
    }
    tooltip.style.left = `${Math.max(8, Math.min(left, viewport.clientWidth - bounds.width - 8))}px`
    tooltip.style.top = `${Math.max(8, Math.min(top, viewport.clientHeight - bounds.height - 8))}px`
    navTooltipTarget = link
    link.setAttribute('aria-describedby', 'nav-tooltip')
  }

  function originalTaskLinks(doc) {
    if (doc.readError)
      return []
    const linked = new Map()
    const pagePaths = new Set()
    for (const link of doc.links || []) {
      if (!link.exists || !['task-page', 'source'].includes(link.kind))
        continue
      const page = originalTaskPage(link.target)
      if (!page)
        continue
      const isPage = link.target === page.path
      const fragment = isPage ? link.fragment || '' : ''
      const query = isPage ? link.query || '' : ''
      if (isPage) {
        pagePaths.add(page.path)
        linked.delete(JSON.stringify([page.path]))
      }
      else if (pagePaths.has(page.path)) {
        continue
      }
      const key = JSON.stringify(isPage ? [page.path, query, fragment] : [page.path])
      linked.set(key, { ...page, linkFragment: fragment, linkQuery: query, linkLabel: isPage ? link.label || page.title : page.title })
    }
    return [...linked.values()]
  }

  function originalTaskRelated(doc) {
    const linked = originalTaskLinks(doc)
    return linked.length ? `<div class="card-related"><span>原任务页面</span>${linked.map(page => navLink(page, '', page.linkLabel, page.linkFragment, page.linkQuery, doc.path)).join('')}</div>` : ''
  }

  function renderNavigation() {
    dismissNavTooltip()
    const tasks = [...documents.values()].filter(doc => doc.kind === 'task')
    const navigationKey = link => JSON.stringify([link.path, link.label || '', link.fragment || '', link.query || ''])
    const checked = Array.isArray(catalog.readNavigation) ? new Set(catalog.readNavigation.map(navigationKey)) : undefined
    const navigation = (catalog.navigation || []).filter(link => !checked || checked.has(navigationKey(link))).map((link) => {
      let doc = documents.get(link.path) || taskPages.get(link.path)
      const failure = catalog.document_errors?.[link.path]
      const taskError = catalog.task_errors?.[link.path]
      if (!doc && (failure || taskError)) {
        const current = sourceReadError(link.path)
        doc = {
          path: link.path,
          title: link.label,
          readError: current?.error || failure?.error || taskError,
          readStatus: current ? current.status : failure?.status || catalog.task_error_statuses?.[link.path],
          readUnchecked: current?.unchecked,
          readChanged: current?.changed,
          readScopeLimited: current ? current.scope_limited : failure?.scope_limited || catalog.task_scope_limited?.includes(link.path),
        }
      }
      return doc ? { link, doc } : undefined
    }).filter(Boolean)
    ui['business-count'].textContent = navigation.length
    ui['task-count'].textContent = tasks.length + taskPages.size
    ui['business-view'].closest('nav').hidden = false
    ui['business-view'].href = routeUrl(catalog.entry)
    ui['home-link'].href = routeUrl(catalog.entry)
    const taskContext = routeInfo().view === 'tasks' || taskPages.has(currentPath) || documents.get(currentPath)?.kind === 'task'
    ui['business-view'].toggleAttribute('aria-current', !taskContext)
    ui['task-view'].toggleAttribute('aria-current', taskContext)
    ui[taskContext ? 'task-view' : 'business-view'].setAttribute('aria-current', 'page')
    ui.sidebar.setAttribute('aria-label', taskContext ? '任务导航' : '业务导航')
    ui.navigation.classList.toggle('task-navigation', taskContext)
    if (taskContext) {
      ui.navigation.innerHTML = [['原任务页面', [...taskPages.values()]], ['变更记录', tasks]]
        .map(([label, items]) => items.length ? `<div class="nav-group">${label} · ${items.length}</div>${items.map(doc => navLink(doc, 'nav-link')).join('')}` : '')
        .join('') || '<p class="quiet">暂无任务与变更记录</p>'
    }
    else {
      ui.navigation.innerHTML = `<div class="nav-group">入口目录</div>${navigation.map(({ link, doc }) => navLink(doc, 'nav-link', link.label, link.fragment, link.query)).join('') || '<p class="quiet">暂无已核对的文档入口</p>'}`
    }
    updateNavigationSelection()
  }

  function updateNavigationSelection() {
    const links = [...ui.navigation.querySelectorAll('a.nav-link')]
    for (const link of links)
      link.removeAttribute('aria-current')
    if (currentView !== 'page')
      return
    const info = routeInfo()
    const section = (value) => {
      if (!value)
        return ''
      if (taskPages.has(currentPath))
        return new URL(`#${value}`, 'https://reader.invalid/').hash.slice(1)
      return ui.article.dataset.documentPath === currentPath ? headingFor(value)?.dataset.anchor || value : value
    }
    const candidates = links.map(link => ({ link, params: new URLSearchParams(link.getAttribute('href').slice(1)) }))
      .filter(item => item.params.get('page') === currentPath)
    const selected = candidates.find(({ params }) => section(params.get('section')) === section(info.section)
      && taskQuery(params.get('task_query') || '') === taskQuery(info.taskQuery || ''))
    || (candidates.length === 1 && !candidates[0].params.get('section') && !candidates[0].params.get('task_query') ? candidates[0] : undefined)
    selected?.link.setAttribute('aria-current', 'page')
  }

  function setHeader({ title, kind = '业务内容', description = '', path = '', showSource = false }) {
    ui['page-title'].textContent = title
    ui['page-title'].title = title
    ui['document-kind'].textContent = kind
    ui['document-kind'].hidden = !kind
    ui['page-links'].replaceChildren()
    ui['page-links'].hidden = true
    ui['page-description'].textContent = description
    ui['page-description'].title = description
    ui.breadcrumbs.textContent = path || `${catalog?.project || '项目'} / 业务阅读`
    ui.breadcrumbs.title = ui.breadcrumbs.textContent
    ui['source-button'].hidden = !showSource
    document.title = `${title} · 业务手册`
    updateHeaderOffset()
  }

  function updateHeaderOffset() {
    const height = siteHeader.getBoundingClientRect().height
    document.documentElement.style.setProperty('--header-offset', `${height + 16}px`)
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
      // Match the backend's forgiving percent decoding without treating literal + or & as form syntax.
      const unquote = value => new URLSearchParams(`value=${value.replace(/[+&]/g, character => encodeURIComponent(character))}`).get('value')
      const base = new URL(doc.path.split('/').map(encodeURIComponent).join('/'), 'https://reader.invalid/')
      const parsed = new URL(href, base)
      const path = unquote(href.replace(/[\t\r\n]/g, '').split(/[?#]/, 1)[0])
      if (path.startsWith('/') || path.includes('\\') || path.includes(':') || path.includes('\0'))
        return null
      const parts = doc.path.split('/')
      if (path) {
        parts.pop()
        for (const part of path.split('/')) {
          if (!part || part === '.')
            continue
          if (part === '..') {
            if (!parts.length)
              return null
            parts.pop()
          }
          else {
            parts.push(part)
          }
        }
      }
      const target = parts.join('/')
      const taskError = catalog?.task_errors?.[target]
      const fragment = (taskPages.has(target) || taskError) ? parsed.hash.slice(1) : unquote(parsed.hash.slice(1))
      const explicit = (doc.links || []).find((link) => {
        const linkFragment = link.kind === 'task-page' ? new URL(`#${link.fragment || ''}`, base).hash.slice(1) : link.fragment || ''
        return link.target === target && linkFragment === fragment
          && (link.kind !== 'task-page' || taskQuery(link.query || '') === taskQuery(parsed.search))
      })
      const readError = sourceReadError(target)
      if (readError)
        return { ...explicit, target, fragment, exists: false, ...readError }
      if (explicit)
        return taskError ? { ...explicit, exists: false } : explicit
      if (taskError)
        return { target, fragment, exists: false }
      if (documents.has(target))
        return { kind: 'document', target, fragment, exists: true }
      if (sources.has(target))
        return { kind: 'source', target, fragment, exists: true }
      return { target, fragment, exists: false }
    }
    catch { return null }
  }

  function unavailableReason(link, fallback = '') {
    const target = link?.target || fallback
    if (link?.scope_limited)
      return `来源未能检查：${(link.error || target).replace(/。$/, '')}。请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器。`
    if (link?.unchecked)
      return `来源尚未核对：${target}。${link.error || '本批未读到该来源，请刷新内容重新核对目录。'}`
    if (link?.changed)
      return `来源已更新：${target}。请刷新内容后核对新版。`
    if (link?.error)
      return `来源无法读取：${link.error}。${link.status === 413 ? '请缩小内容或使用外部链接后点击“刷新内容”重试。' : '请修复或恢复来源后点击“刷新内容”重试。'}`
    const taskError = catalog?.task_errors?.[target]
    const recovery = catalog?.task_scope_limited?.includes(target)
      ? '请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器。'
      : catalog?.task_error_statuses?.[target] === 413
        ? '请缩小内容或使用外部链接后点击“刷新内容”重试。'
        : '请修复或恢复原任务图页和对应 AI 记录后点击“刷新内容”重试。'
    return taskError
      ? `任务来源无法读取：${taskError.replace(/。$/, '')}。${recovery}`
      : `来源未收录或不可读取：${target}。确认链接指向可读取的项目内文本后刷新内容。`
  }

  function readLinkAttributes(link, from = '', title = '') {
    return ` data-reader-target="${escape(link.target)}" data-reader-kind="${escape(link.kind)}" data-reader-section="${escape(link.fragment || '')}" data-reader-query="${escape(link.query || '')}" data-reader-from="${escape(from)}" data-reader-title="${escape(title)}"`
  }

  function sourceLink(path, label, from = '') {
    const attributes = readLinkAttributes({ target: path, kind: 'source' }, from, label)
    const error = sourceReadError(path)
    if (error) {
      const reason = unavailableReason({ target: path, ...error })
      return `<span class="unavailable-link" tabindex="0" title="${escape(label)}；${escape(reason)}" data-reason="${escape(reason)}"${attributes}>${escape(label)}</span>`
    }
    return `<a href="${escape(sourceUrl(path))}" data-source="${escape(path)}"${attributes}>${escape(label)}</a>`
  }

  function rememberReadLink(node, link, from = '', anchor = node) {
    const kind = link?.kind || (taskPages.has(link?.target) ? 'task-page' : documents.has(link?.target) ? 'document' : sources.has(link?.target) ? 'source' : '')
    if (!['document', 'task-page', 'source'].includes(kind))
      return
    const failure = link.error || link.status >= 400
      ? { error: link.error, status: link.status, scope_limited: link.scope_limited, unchecked: link.unchecked, changed: link.changed }
      : undefined
    const binding = { anchor, link: { target: link.target, kind, fragment: link.fragment || '', query: link.query || '' }, from, title: anchor.title || '', catalog, failure }
    readLinkBindings.set(node, binding)
    return binding
  }

  function registerReadLinks(parent) {
    for (const node of parent.querySelectorAll?.('[data-reader-kind]') || []) {
      if (readLinkBindings.has(node))
        continue
      const anchor = node.tagName === 'A' ? node : document.createElement('a')
      if (anchor !== node)
        anchor.className = node.className.replace(/\bunavailable-link\b/g, '').trim()
      const binding = rememberReadLink(node, { target: node.dataset.readerTarget, kind: node.dataset.readerKind, fragment: node.dataset.readerSection, query: node.dataset.readerQuery }, node.dataset.readerFrom || '', anchor)
      if (binding)
        binding.title = node.dataset.readerTitle || anchor.title || ''
    }
  }

  function readLinkError(binding) {
    const { target, kind } = binding.link
    const error = sourceReadError(target)
    if (error)
      return { target, ...error }
    const known = kind === 'task-page' ? taskPages.has(target) : kind === 'document' ? documents.has(target) : sources.has(target)
    if (!known) {
      if (binding.catalog === catalog && binding.failure)
        return { target, ...binding.failure }
      return { target, unchecked: true, error: '该来源尚未纳入当前目录，请刷新内容重新核对。' }
    }
    if (binding.from) {
      const fromError = sourceReadError(binding.from)
      if (fromError)
        return { target: binding.from, ...fromError }
    }
  }

  function restoreReadLink(node, binding) {
    const { anchor, link } = binding
    anchor.replaceChildren(...node.childNodes)
    anchor.href = link.kind === 'source' ? sourceUrl(link.target) : routeUrl(link.target, link.fragment, link.query)
    anchor.removeAttribute('target')
    anchor.dataset.readerTarget = link.target
    if (link.kind === 'source')
      anchor.dataset.source = link.target
    else
      delete anchor.dataset.source
    anchor.title = binding.title
    node.replaceWith(anchor)
    readLinkBindings.delete(node)
    readLinkBindings.set(anchor, binding)
    for (const [name, target] of documentAnchors) {
      if (target === node)
        documentAnchors.set(name, anchor)
    }
  }

  function instrumentLinks(parent, doc, anchors) {
    for (const anchor of parent.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href')
      const link = resolveLink(href, doc)
      if (link?.kind !== 'external' && link?.target)
        rememberReadLink(anchor, link, doc.path)
      if (!link || link.exists === false) {
        disableLink(anchor, link, href, anchors)
      }
      else if (link.kind === 'document' || link.kind === 'task-page') {
        anchor.dataset.readerTarget = link.target
        delete anchor.dataset.source
        anchor.href = routeUrl(link.target, link.fragment, link.query)
        anchor.removeAttribute('target')
      }
      else if (link.kind === 'source') {
        anchor.dataset.readerTarget = link.target
        anchor.href = sourceUrl(link.target)
        anchor.dataset.source = link.target
        anchor.removeAttribute('target')
      }
      else {
        delete anchor.dataset.readerTarget
        delete anchor.dataset.source
        anchor.href = link.target
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
      }
    }
  }

  function setReadLinkHint(node, title, reason) {
    const hint = title ? `${title}；${reason}` : reason
    node.title = node.dataset.reason = hint
  }

  function disableLink(anchor, link, fallback = '', anchors) {
    const binding = readLinkBindings.get(anchor) || rememberReadLink(anchor, link)
    const span = document.createElement('span')
    span.className = 'unavailable-link'
    span.append(...anchor.childNodes)
    span.tabIndex = 0
    if (binding) {
      binding.title = anchor.title || binding.title
      span.dataset.readerTarget = binding.link.target
      readLinkBindings.set(span, binding)
    }
    setReadLinkHint(span, binding?.title || anchor.title || '', unavailableReason(link, fallback))
    for (const [name, target] of anchors || []) {
      if (target === anchor)
        anchors.set(name, span)
    }
    anchor.replaceWith(span)
  }

  function refreshReadLinks() {
    for (const node of ui.article.querySelectorAll('a[data-reader-target],a[data-source],span[data-reader-target]')) {
      const target = node.dataset.readerTarget || node.dataset.source
      const binding = readLinkBindings.get(node)
      const error = binding ? readLinkError(binding) : sourceReadError(target)
      if (node.tagName === 'SPAN') {
        if (error) {
          setReadLinkHint(node, binding?.title || '', unavailableReason(error))
        }
        else if (binding) {
          restoreReadLink(node, binding)
        }
      }
      else if (error) {
        disableLink(node, { target, ...error }, '', documentAnchors)
      }
    }
    const reading = ui.context.reading || ui.context.suspendedReading
    if (reading && (!ui.context.hidden || ui.context.suspendedReading) && currentView === 'page' && documents.get(currentPath) === reading.doc
      && !reading.doc.readError && ui.article.dataset.documentPath === currentPath) {
      const open = reading.open || [...ui.context.querySelectorAll(':scope > details')].map(node => node.open)
      renderContext(reading.doc, reading.toc)
      ui.context.suspendedReading = undefined
      for (const [index, node] of [...ui.context.querySelectorAll(':scope > details')].entries()) {
        if (index < open.length)
          node.open = open[index]
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
    for (const paragraph of markdownFragment(body).children) {
      if (paragraph.tagName !== 'P')
        continue
      const plain = visibleNodeText(paragraph)
      if (plain)
        return plain
    }
    return ''
  }

  function paragraphExcerpt(paragraph, maximum = 190) {
    if (paragraph.length <= maximum)
      return paragraph
    const prefix = paragraph.slice(0, maximum)
    const boundary = Math.max(...['。', '！', '？', '；', '. ', '! ', '? ', '; '].map(mark => prefix.lastIndexOf(mark)))
    return `${prefix.slice(0, boundary >= maximum / 2 ? boundary + 1 : maximum).trimEnd()}…`
  }
  function markdownFragment(raw, anchors) {
    const template = document.createElement('template')
    template.innerHTML = markdown.parse(raw)
    // The template stays inert; remove hidden contents before sanitization can unwrap their parent.
    for (const node of template.content.querySelectorAll('[hidden]'))
      node.remove()
    // Keep author destinations as node references, without exposing their IDs to the host DOM.
    const collectAnchor = (node) => {
      for (const name of [node.getAttribute?.('id'), node.tagName === 'A' && node.getAttribute('name')]) {
        if (name && !anchors.has(name))
          anchors.set(name, node)
      }
    }
    if (anchors)
      DOMPurify.addHook('beforeSanitizeAttributes', collectAnchor)
    try {
      return DOMPurify.sanitize(template.content, {
        USE_PROFILES: { html: true },
        RETURN_DOM_FRAGMENT: true,
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'video', 'audio', 'source', 'img', 'link', 'meta', 'base'],
        FORBID_ATTR: ['style', 'id', 'name', 'srcset'],
      })
    }
    finally {
      if (anchors)
        DOMPurify.removeHook('beforeSanitizeAttributes', collectAnchor)
    }
  }

  function visibleNodeText(node) {
    const fragment = node.cloneNode(true)
    for (const hidden of fragment.querySelectorAll('[hidden]'))
      hidden.remove()
    for (const node of fragment.querySelectorAll('br,hr,address,article,aside,blockquote,caption,dd,details,div,dl,dt,fieldset,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,legend,li,main,nav,ol,p,pre,section,summary,table,tbody,td,tfoot,th,thead,tr,ul')) {
      node.before(' ')
      node.after(' ')
    }
    return fragment.textContent.replace(/\s+/g, ' ').trim()
  }

  function visibleText(raw) {
    return visibleNodeText(markdownFragment(raw))
  }

  function markdownSections(raw, doc) {
    const anchors = new Map()
    const fragment = markdownFragment(raw, anchors)
    instrumentLinks(fragment, doc, anchors)
    const headings = 'h1,h2,h3,h4,h5,h6'
    const emptyNodes = new WeakMap()
    const markerGroups = new Map()
    function isEmpty(node) {
      if (!emptyNodes.has(node))
        emptyNodes.set(node, !node.textContent.trim())
      return emptyNodes.get(node)
    }
    for (const [name, target] of anchors) {
      if (!fragment.contains(target)) {
        anchors.delete(name)
        continue
      }
      if (!target.matches('a:not([href]),span') || !isEmpty(target))
        continue
      let marker = target
      while (marker.parentElement && isEmpty(marker.parentElement))
        marker = marker.parentElement
      if (!markerGroups.has(marker.parentNode))
        markerGroups.set(marker.parentNode, new Map())
      const markers = markerGroups.get(marker.parentNode)
      if (!markers.has(marker))
        markers.set(marker, [])
      markers.get(marker).push(name)
    }
    for (const [parent, markers] of markerGroups) {
      let pending = []
      for (const node of parent.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim())
          continue
        if (markers.has(node)) {
          pending.push(...markers.get(node))
          continue
        }
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(headings)) {
          for (const name of pending)
            anchors.set(name, node)
        }
        pending = []
      }
    }
    const container = document.createElement('div')
    const toc = []
    const ids = new Map()
    const usedIds = new Set(anchors.keys())
    let firstHeading = true

    function section(parent, scope) {
      const phase = scope?.phase || 'unclassified'
      const part = document.createElement('section')
      part.className = `content-section phase-${phase}`
      part.dataset.phase = phase
      part.dataset.sectionTitle = scope?.title || ''
      parent.append(part)
      return part
    }

    function heading(node, stack) {
      const level = Number(node.tagName[1])
      const original = visibleNodeText(node)
      const title = cleanTitle(original)
      const marker = original.match(phaseMarker)
      while (stack.length && stack.at(-1).level >= level)
        stack.pop()
      const phase = marker ? phaseKeys[marker[1]] : stack.at(-1)?.phase || 'unclassified'
      stack.push({ level, phase, title })
      const baseId = slug(original)
      let occurrence = ids.get(baseId) || 0
      let id = occurrence ? `${baseId}-${occurrence}` : baseId
      while (usedIds.has(id))
        id = `${baseId}-${++occurrence}`
      ids.set(baseId, occurrence + 1)
      usedIds.add(id)
      if (firstHeading && level === 1 && !marker && !node.querySelector('a[href],.unavailable-link') && !node.closest('summary')) {
        firstHeading = false
        anchors.set(id, ui['page-title'])
        for (const [name, target] of anchors) {
          if (target === node || node.contains(target))
            anchors.set(name, ui['page-title'])
        }
        return null
      }
      firstHeading = false
      node.id = `section-${id}`
      node.dataset.anchor = id
      node.dataset.alias = slug(cleanTitle(original))
      node.dataset.phase = phase
      node.dataset.phaseHeading = ''
      let prefix = marker ? (node.textContent.match(phaseMarker)?.[0].length || 0) : 0
      const text = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      while (prefix && text.nextNode()) {
        const length = Math.min(prefix, text.currentNode.textContent.length)
        text.currentNode.textContent = text.currentNode.textContent.slice(length)
        prefix -= length
      }
      const permalink = document.createElement('a')
      permalink.className = 'section-anchor'
      permalink.href = routeUrl(doc.path, id)
      permalink.textContent = '#'
      permalink.setAttribute('aria-label', `链接到${cleanTitle(original)}`)
      node.append(permalink)
      let badge
      if (marker) {
        badge = document.createElement('span')
        badge.className = `phase-badge ${phase}`
        badge.dataset.phase = phase
        badge.textContent = `${phases[phase]} · 原文标记`
      }
      toc.push({ id, title, level, phase })
      return { phase, title, badge }
    }

    function split(parent, nodes, inherited = []) {
      const stack = [...inherited]
      let current = section(parent, stack.at(-1))
      for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(headings)) {
          const info = heading(node, stack)
          if (!info)
            continue
          current = section(parent, info)
          if (info.badge)
            current.append(info.badge)
          current.append(node)
        }
        else if (node.nodeType === Node.ELEMENT_NODE && node.querySelector(headings)) {
          // A quoted/listed rule has its own scope; it does not reclassify the text after it.
          divide(node, stack)
          parent.append(node)
          current = section(parent, stack.at(-1))
        }
        else {
          current.append(node)
        }
      }
    }

    function divide(node, inherited) {
      node.dataset.phaseContainer = ''
      const children = [...node.childNodes]
      node.replaceChildren()
      if (node.matches('details')) {
        const summary = children.find(child => child.nodeType === Node.ELEMENT_NODE && child.matches('summary'))
        const scope = [...inherited]
        if (summary) {
          node.append(summary)
          for (const title of summary.querySelectorAll(headings)) {
            const info = heading(title, scope)
            if (info?.badge)
              title.before(info.badge)
          }
        }
        split(node, children.filter(child => child !== summary), scope)
      }
      else if (node.matches('ul,ol,dl,table,thead,tbody,tfoot,tr')) {
        for (const child of children) {
          if (child.nodeType === Node.ELEMENT_NODE)
            divide(child, inherited)
          node.append(child)
        }
      }
      else {
        split(node, children, inherited)
      }
    }

    split(container, [...fragment.childNodes])
    for (const section of container.querySelectorAll('.content-section')) {
      if (!section.textContent.trim()) {
        for (const [name, target] of anchors) {
          if (section.contains(target))
            anchors.set(name, section.nextElementSibling || section.previousElementSibling || ui['page-title'])
        }
        section.remove()
      }
    }
    for (const table of container.querySelectorAll('table')) {
      const wrapper = document.createElement('div')
      wrapper.className = 'table-scroll'
      table.replaceWith(wrapper)
      wrapper.append(table)
    }
    return { container, toc, anchors: new Map([...anchors].filter(([, target]) => target === ui['page-title'] || container.contains(target))) }
  }

  function renderPhaseFilter() {
    const counts = Object.fromEntries(Object.keys(phases).map(key => [key, ui.article.querySelectorAll(`[data-phase="${key}"][data-phase-heading]`).length]))
    if (!Object.values(counts).some(Boolean) && currentPhase === 'all') {
      ui['phase-filter'].replaceChildren()
      applyPhaseFilter()
      return
    }
    const buttons = [['all', '全部内容'], ...Object.entries(phases).filter(([key]) => counts[key])]
    ui['phase-filter'].innerHTML = `${buttons.map(([key, title]) => `<button type="button" data-phase="${key}" aria-pressed="${currentPhase === key}">${title}${key === 'all' ? '' : `<span class="phase-count">${counts[key]}</span>`}</button>`).join('')}<span class="filter-note">分类来自 Markdown 标题标记</span>`
    applyPhaseFilter()
  }

  function applyPhaseFilter() {
    let visible = [...ui.article.querySelectorAll('summary [data-phase-heading]')].filter(heading => currentPhase === 'all' || heading.dataset.phase === currentPhase).length
    for (const heading of ui.article.querySelectorAll('summary [data-phase-heading]')) {
      heading.hidden = currentPhase !== 'all' && heading.dataset.phase !== currentPhase
      const badge = heading.previousElementSibling
      if (badge?.classList.contains('phase-badge'))
        badge.hidden = heading.hidden
    }
    for (const summary of ui.article.querySelectorAll('summary')) {
      if (!summary.querySelector('[data-phase-heading]'))
        continue
      let fallback = summary.querySelector('[data-summary-fallback]')
      if (fallback)
        fallback.hidden = true
      if (!visibleNodeText(summary)) {
        if (!fallback) {
          fallback = document.createElement('span')
          fallback.dataset.summaryFallback = ''
          summary.append(fallback)
        }
        fallback.textContent = currentPhase === 'all' ? '查看内容' : `查看${phases[currentPhase]}内容`
        fallback.hidden = false
      }
    }
    for (const section of ui.article.querySelectorAll('.content-section')) {
      section.hidden = currentPhase !== 'all' && section.dataset.phase !== currentPhase
      if (!section.hidden)
        visible++
    }
    for (const container of ui.article.querySelectorAll('[data-phase-container]'))
      container.hidden = ![...container.querySelectorAll('.content-section,[data-phase-heading]')].some(part => currentPhase === 'all' || part.dataset.phase === currentPhase)
    ui.article.querySelector('.filter-empty')?.remove()
    if (!visible) {
      const message = document.createElement('div')
      message.className = 'empty filter-empty'
      message.textContent = currentPhase === 'all'
        ? '本页暂无正文，可查看 Markdown 原文。'
        : `本链接指定的“${phases[currentPhase]}”分类在当前原文中不存在。选择“全部内容”可主动查看完整原文。`
      ui.article.append(message)
    }
    for (const button of ui['phase-filter'].querySelectorAll('[data-phase]'))
      button.setAttribute('aria-pressed', String(button.dataset.phase === currentPhase))
    for (const link of document.querySelectorAll('#article a[href^="#"],.toc-link')) {
      const params = new URLSearchParams(link.getAttribute('href').slice(1))
      if (params.get('page') !== currentPath || !params.get('section'))
        continue
      if (currentPhase === 'all')
        params.delete('phase')
      else
        params.set('phase', currentPhase)
      link.href = `#${params}`
    }
    syncToc()
  }

  function contextBlock(title, body) {
    return `<section class="context-block"><h2>${title}</h2>${body}</section>`
  }

  function setTextTitles(root) {
    for (const element of root.querySelectorAll('.card-source, .toc-link, .source-link:not(.unavailable-link), .card-related a, .related-card>span, .related-card small, .source-fingerprint b'))
      element.title = element.textContent.trim()
  }

  function renderContext(doc, toc) {
    const taskLinks = related(doc, 'task')
    const documentLinks = related(doc, 'document')
    const contextDocs = doc.kind === 'task' ? documentLinks : taskLinks
    let html = contextBlock(doc.kind === 'task' ? '相关文档' : '变更记录', contextDocs.length ? contextDocs.map(item => `<a class="related-card" href="${escape(routeUrl(item.path, item.linkFragment))}"><span>${escape(item.linkLabel || item.title || item.path)}</span><small>${escape(item.path)}${item.referencedBy ? ' · 引用本页' : ''}</small></a>`).join('') : '<p class="context-note">原文暂无相关文档链接</p>')
    if (originalTaskLinks(doc).length)
      html += contextBlock('原任务页面', originalTaskRelated(doc))
    const references = (doc.links || []).map((link) => {
      const error = sourceReadError(link.target)
      return error ? { ...link, exists: false, ...error } : link
    }).filter(link => link.exists === false || link.kind === 'source' || link.kind === 'external'
      || (link.kind === 'task-page' && (link.exists === false || catalog?.task_errors?.[link.target]))
      || (doc.kind !== 'task' && link.kind === 'document' && link.target !== doc.path && documents.get(link.target)?.kind !== 'task'))
    const unique = [...new Map(references.map(item => [`${item.target}#${item.fragment || ''}`, item])).values()]
    html += contextBlock('来源与依据', unique.length
      ? unique.map((link) => {
          if (link.exists === false || catalog?.task_errors?.[link.target]) {
            const reason = unavailableReason(link)
            return `<span class="source-link unavailable-link" tabindex="0" title="${escape(link.label || link.target)}；${escape(reason)}" data-reason="${escape(reason)}"><span>${escape(link.label || link.target)}</span></span>`
          }
          return link.kind === 'external'
            ? `<a class="source-link" href="${escape(link.target)}" target="_blank" rel="noopener noreferrer">${escape(link.label || link.target)} ↗</a>`
            : link.kind === 'document'
              ? `<a class="source-link" href="${escape(routeUrl(link.target, link.fragment))}">${escape(link.label || link.target)}</a>`
              : `<a class="source-link" href="${escape(sourceUrl(link.target))}" data-source="${escape(link.target)}">${escape(link.label || link.target)}</a>`
        }).join('')
      : '<p class="context-note">来源可在正文链接中查阅</p>')
    const other = (doc.backlinks || []).filter(item => item.path !== doc.path && item.kind === doc.kind && !documents.get(item.path)?.readError)
    if (other.length)
      html += contextBlock('被这些页面引用', other.map(item => `<a class="source-link" href="${escape(routeUrl(item.path))}">${escape(item.title || item.path)}</a>`).join(''))
    html += contextBlock('本次读取', `<div class="source-fingerprint"><b>${escape(doc.path)}</b>原文摘要 ${escape((doc.sha256 || '').slice(0, 12))}<br>${escape(formatTime(catalog.read_at))}</div>`)
    const warnings = Array.isArray(catalog.readWarnings) ? catalog.readWarnings : catalog.warnings || []
    if (warnings.length)
      html += contextBlock('来源提示', `<details><summary>${warnings.length} 条需要留意的来源</summary><ul>${warnings.map(item => `<li>${escape(item)}</li>`).join('')}</ul></details>`)
    ui.context.innerHTML = `<details class="outline-disclosure"${wideOutline.matches ? ' open' : ''}><summary>本页目录</summary><nav class="toc-list" aria-label="本页目录">${toc.map(item => `<a class="toc-link level-${Math.min(item.level, 3)}" data-anchor="${escape(item.id)}" href="${escape(routeUrl(doc.path, item.id))}">${escape(item.title)}</a>`).join('')}<p class="context-note toc-empty"${toc.length ? ' hidden' : ''}>本页没有分节标题</p></nav></details><details class="related-disclosure"><summary>关联与依据</summary><div class="context-details-body">${html}</div></details>`
    setTextTitles(ui.context)
    ui.context.hidden = false
    tocItems = [...ui.context.querySelectorAll('.toc-link')].map(link => ({ link, heading: document.getElementById(`section-${link.dataset.anchor}`) }))
    syncToc()
    ui.context.reading = { doc, toc }
    ui.context.suspendedReading = undefined
  }

  function syncToc() {
    const visible = tocItems.filter(({ link, heading }) => {
      link.hidden = !heading || Boolean(heading.closest('[hidden]'))
        || (currentPhase !== 'all' && heading.dataset.phase !== currentPhase)
      return !link.hidden
    })
    const empty = ui.context.querySelector('.toc-empty')
    if (empty) {
      empty.hidden = visible.length > 0
      empty.textContent = tocItems.length ? '当前分类没有章节' : '本页没有分节标题'
    }
    const readable = visible.filter(({ heading }) => {
      for (let parent = heading.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS' && !parent.open && !parent.querySelector(':scope > summary')?.contains(heading))
          return false
      }
      return heading.getClientRects().length > 0
    })
    let active = readable[0]
    const offset = siteHeader.getBoundingClientRect().height + 16
    for (const item of readable) {
      if (item.heading.getBoundingClientRect().top <= offset + 1)
        active = item
    }
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2)
      active = readable.at(-1)
    for (const item of tocItems) {
      if (item === active)
        item.link.setAttribute('aria-current', 'location')
      else
        item.link.removeAttribute('aria-current')
    }
  }

  function scheduleToc() {
    if (tocFrame)
      return
    tocFrame = requestAnimationFrame(() => {
      tocFrame = 0
      syncToc()
    })
  }

  function formatTime(value) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.valueOf()) ? String(value || '') : parsed.toLocaleString('zh-CN', { hour12: false })
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme
    const label = theme === 'dark' ? '切换为宣纸主题' : '切换为夜墨主题'
    ui['theme-button'].setAttribute('aria-label', label)
    ui['theme-button'].setAttribute('aria-pressed', String(theme === 'dark'))
    ui['theme-button'].title = label
    const colors = getComputedStyle(document.documentElement)
    const color = name => colors.getPropertyValue(name).trim()
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
        darkMode: theme === 'dark',
        background: color('--surface'),
        primaryColor: color('--success-bg'),
        primaryBorderColor: color('--teal'),
        primaryTextColor: color('--ink'),
        lineColor: color('--line-strong'),
        secondaryColor: color('--accent-bg'),
        tertiaryColor: color('--surface'),
        textColor: color('--text'),
        fontSize: '13px',
      },
      flowchart: { htmlLabels: false, useMaxWidth: true, curve: 'basis' },
    })
  }

  let savedTheme
  try {
    savedTheme = localStorage.getItem('requirement-flow.theme')
  }
  catch {
    // Theme switching remains available when the browser blocks storage.
  }
  applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

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
    ui['diagram-title'].title = definition.title
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
      const original = code.parentElement
      for (const [name, target] of documentAnchors) {
        if (original === target || original.contains(target))
          documentAnchors.set(name, figure)
      }
      original.replaceWith(figure)
      const id = `reader-diagram-${++diagramNumber}`
      try {
        if (/%%\s*\{|^\s*---/m.test(source))
          throw new Error('图表只接受结构定义；渲染配置由阅读器统一设置。')
        const { svg } = await mermaid.render(id, source)
        if (version !== renderVersion || !stage.isConnected)
          return
        stage.innerHTML = safeDiagram(svg)
        const section = figure.closest('.content-section')
        const heading = section?.querySelector('h1,h2,h3,h4,h5,h6')
        const title = section?.dataset.sectionTitle || (heading && visibleNodeText(heading).replace(/#$/, '').trim()) || '放大图表'
        stage.querySelector('svg')?.setAttribute('aria-label', `${title}，由 Markdown Mermaid 代码渲染`)
        diagramDefinitions.set(id, {
          source,
          title,
          phase: section?.dataset.phase,
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
    return linked.length ? `<div class="card-related"><span>${label}</span>${linked.map(item => `<a href="${escape(routeUrl(item.path, item.linkFragment))}"${readLinkAttributes({ target: item.path, kind: 'document', fragment: item.linkFragment }, doc.path, item.linkLabel || item.title || item.path)}>${escape(item.linkLabel || item.title || item.path)}${item.referencedBy ? ' · 引用本页' : ''} →</a>`).join('')}</div>` : ''
  }

  function renderReadNotice(errors, addedPaths, warnings, searching = false) {
    const messages = []
    if (errors.length)
      messages.push(`本批未读到 ${errors.length} 项目录来源${searching ? '，查询结果可能不完整' : ''}。`)
    if (addedPaths.length)
      messages.push(`新增来源尚未纳入本次目录读取：${addedPaths.length} 项，刷新内容后查阅。`)
    if (warnings.length)
      messages.push(`本次读取有 ${warnings.length} 条来源提示，请按具体原因处理后重新读取。`)
    const groups = [['本批未读到的目录来源', errors], ['新增来源尚未纳入本次目录读取', addedPaths], ['本次来源提示', warnings]].filter(([, items]) => items.length)
    if (groups.length) {
      ui.article.innerHTML = `<details class="notice reading-details"><summary>读取明细</summary>${groups.map(([title, items]) => `<h3>${title} · ${items.length}</h3><ul>${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`).join('')}</details>${ui.article.innerHTML}`
      messages.push('逐项原因与继续条件见“读取明细”。')
    }
    notice(messages.join(' '), messages.length > 0)
  }

  async function renderTasks(version) {
    const changes = [...documents.values()].filter(doc => doc.kind === 'task')
    setHeader({ title: '任务与变更记录', kind: '项目已有材料', description: '原任务页面沿用已有需求全景图；Markdown 变更记录按原文阅读。' })
    ui['phase-filter'].innerHTML = ''
    ui.context.hidden = true
    const { records, taskPages: currentTaskPages, sourceChecks, documentChecks, navigation, readChecks, current: batchCurrent, addedPaths, warnings } = await documentRecords(changes, 'tasks', version)
    if (version !== renderVersion || (batchCurrent && !batchCurrent()))
      return
    updateReadChecks(records, currentTaskPages, sourceChecks, documentChecks, navigation, readChecks, warnings)
    window.scrollTo({ top: 0, behavior: 'instant' })
    const pages = [...taskPages.values()]
    ui.article.innerHTML = `${pages.length ? `<h2>原任务页面</h2><div class="record-grid">${pages.map(page => `<section class="record-card"><div class="card-source">${escape(page.path)}</div><h3>${navLink(page)}</h3><p>${escape(page.readError || (page.synchronized ? '目录读取时：图页声明的模型摘要与 AI 记录一致' : '图页声明的模型摘要与 AI 记录不一致或未声明，请核对原文'))}</p>${sourceLink(page.model_path, 'AI 记录', page.path)}</section>`).join('')}</div>` : ''}${records.length
      ? `<h2>Markdown 变更记录</h2><div class="record-grid">${records.map(({ doc, raw, error }) => {
        const paragraph = firstParagraph(raw)
        const summary = paragraphExcerpt(paragraph)
        return `<section class="record-card"><div class="card-source">${escape(doc.path)}</div><h3>${navLink(doc)}</h3><p title="${escape(error || paragraph || '打开变更记录查阅原文。')}">${escape(error ? `原文未能读取：${error}` : summary ? `原文首段：${summary}` : '打开变更记录查阅原文。')}</p>${cardRelated(doc, '相关文档', 'document')}${originalTaskRelated(doc)}</section>`
      }).join('')}</div>`
      : ''}`
    if (!pages.length && !records.length)
      ui.article.innerHTML = '<div class="empty"><p>本次目录读取未收录原任务页面或变更记录。</p><p>业务文档可以照常阅读。</p></div>'
    const errors = records.filter(item => item.error).map(item => `${item.doc.path}：${item.error}`)
    for (const page of pages) {
      if (page.readError)
        errors.push(`${page.path}：${page.readError}`)
    }
    renderReadNotice(errors, addedPaths, warnings)
    registerReadLinks(ui.article)
  }

  function renderOriginalTask(page, info, version = renderVersion) {
    delete ui.article.dataset.failedSource
    delete ui.article.dataset.documentPath
    setHeader({ title: page.title, kind: '', description: '只读查看已有需求全景图与 AI 记录；页面中的状态保留原文含义。', path: page.path })
    ui['phase-filter'].replaceChildren()
    const params = new URLSearchParams(info.taskQuery)
    const base = taskFileUrl(page, page.path)
    const fragment = info.section ? `#${info.section}` : ''
    const url = `${base}?${params}${fragment}`
    ui['page-links'].innerHTML = `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">原网页 ↗</a><a href="${escape(sourceUrl(page.model_path))}" data-source="${escape(page.model_path)}">AI 记录</a>`
    ui['page-links'].hidden = false
    params.set('embed', '1')
    const request = crypto.randomUUID().replaceAll('-', '')
    params.set('embed_request', request)
    ui.article.innerHTML = `<iframe class="original-task-frame" sandbox="allow-scripts" title="${escape(page.title)}" src="${escape(`${base}?${params}${fragment}`)}"></iframe>`
    taskFrameRead = {
      catalog,
      page,
      version,
      pageScope: readPageScope(info),
      request,
      url: base,
      frame: ui.article.querySelector('.original-task-frame'),
      claimed: false,
    }
    if (!page.synchronized)
      notice('图页声明的模型摘要与 AI 记录不一致或未声明；当前画布为已保存的网页，请核对各自原文。', true)

    const backlinks = page.backlinks || []
    ui.context.innerHTML = backlinks.length ? `<details class="related-disclosure"><summary>关联业务文档</summary><div class="context-details-body">${backlinks.map(doc => navLink(documents.get(doc.path) || doc, 'source-link')).join('')}</div></details>` : ''
    ui.context.hidden = !backlinks.length
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function currentTaskScope(read) {
    return catalog === read.catalog && readPageScope() === read.pageScope
      && currentView === 'page' && currentPath === read.page.path && taskPages.get(read.page.path) === read.page
  }

  function currentTaskFrame(read) {
    return taskFrameRead === read && renderVersion === read.version && currentTaskScope(read) && read.frame?.isConnected && ui.article.querySelector('.original-task-frame') === read.frame
  }

  function showUnloadedTask(page, verified) {
    taskFrameRead = undefined
    delete ui.article.dataset.failedSource
    delete ui.article.dataset.documentPath
    const message = catalog.readFailure
      ? '当前画布未能加载；原任务来源已重新核对，其余目录尚待刷新核对。'
      : verified ? '当前画布未能加载；原任务来源已重新核对。' : '当前画布未能加载。'
    setHeader({ title: page.title, kind: '', description: message, path: page.path })
    ui['page-links'].innerHTML = ''
    ui['page-links'].hidden = true
    ui.context.replaceChildren()
    ui.context.reading = undefined
    ui.context.suspendedReading = undefined
    ui.context.hidden = true
    tocItems = []
    ui.article.innerHTML = `<div class="empty"><p>${message}</p><p>请点击“刷新内容”后重开原任务。</p></div>`
    notice(`${message}请刷新内容后重开原任务。`, true)
  }

  async function taskFrameError(event) {
    const read = taskFrameRead
    const data = event.data
    if (!read || read.claimed || !currentTaskFrame(read) || event.origin !== 'null' || event.source !== read.frame.contentWindow
      || data?.type !== 'requirement-flow:task-page-error' || data.request !== read.request || data.path !== read.page.path
      || data.sha256 !== read.page.sha256 || data.model_sha256 !== read.page.model_sha256) {
      return
    }
    read.claimed = true
    // Opening or cancelling AI text is not proof that this still-visible frame loaded.
    const request = { current: () => true, directoryCurrent: () => currentTaskScope(read) }
    let verified = false
    try {
      const text = await readSource(read.page.path, read.url, () => currentTaskScope(read), request)
      verified = request.current() && typeof text === 'string'
    }
    catch {
      if (!currentTaskFrame(read))
        return
      const failure = sourceReadError(read.page.path)
      if (failure) {
        showReadFailure(read.page.path, unavailableReason({ target: read.page.path, ...failure }))
        return
      }
    }
    if (!currentTaskFrame(read))
      return
    const failure = sourceReadError(read.page.path)
    if (failure)
      return showReadFailure(read.page.path, unavailableReason({ target: read.page.path, ...failure }))
    showUnloadedTask(read.page, verified)
  }

  function excerpt(text, query, terms = []) {
    const needle = [query, ...terms].map(term => term.toLocaleLowerCase()).find(term => text.toLocaleLowerCase().includes(term)) || query.toLocaleLowerCase()
    const position = text.toLocaleLowerCase().indexOf(needle)
    const start = Math.max(0, position - 55)
    const end = Math.min(text.length, Math.max(start + 190, position + needle.length + 55))
    const selected = text.slice(start, end)
    const prefix = start ? '…' : ''
    const suffix = end < text.length ? '…' : ''
    if (position < 0)
      return escape(paragraphExcerpt(text) || '可打开文档查看原文。')
    const offset = position - start
    return `${prefix}${escape(selected.slice(0, offset))}<mark>${escape(selected.slice(offset, offset + needle.length))}</mark>${escape(selected.slice(offset + needle.length))}${suffix}`
  }

  async function renderSearch(query, version) {
    setHeader({ title: `查找“${query}”`, kind: '本地搜索', description: '查找文档正文与原任务标题，沿原文查看规则、关联和依据。' })
    ui['phase-filter'].innerHTML = ''
    ui.context.hidden = true
    const { records, taskPages: currentTaskPages, sourceChecks, documentChecks, navigation, readChecks, current: batchCurrent, addedPaths, warnings } = await documentRecords([...documents.values()], 'all', version)
    if (version !== renderVersion || (batchCurrent && !batchCurrent()))
      return
    if (!window.RequirementSearch)
      throw new Error('本地搜索组件未能加载，请刷新页面。')
    updateReadChecks(records, currentTaskPages, sourceChecks, documentChecks, navigation, readChecks, warnings)
    window.scrollTo({ top: 0, behavior: 'instant' })
    const current = new Map()
    const checkedTexts = new Map()
    for (const item of records) {
      if (item.error)
        continue
      const cached = searchTexts.get(item.doc.path)
      const text = cached?.sha256 === item.doc.sha256 ? cached.text : visibleText(item.raw)
      checkedTexts.set(item.doc.path, { sha256: item.doc.sha256, text })
      current.set(item.doc.path, { ...item, text })
    }
    searchTexts = checkedTexts
    const items = [...current.values()].map(({ doc, text }) => ({ id: doc.path, title: doc.title, text }))
    const taskErrors = []
    for (const page of taskPages.values()) {
      if (!page.readError)
        items.push({ id: page.path, title: page.title, text: '' })
      else
        taskErrors.push(`${page.path}：${page.readError}`)
    }
    const matches = window.RequirementSearch.search(items, query)
    ui.article.innerHTML = matches.length
      ? `<p class="search-results-summary">找到 ${matches.length} 项 · 本地全文搜索</p><div class="search-results">${matches.map(({ id, terms }) => {
        const record = current.get(id)
        if (!record) {
          const page = taskPages.get(id)
          return `<section class="search-card"><div class="card-source">${escape(page.path)}</div><h2>${navLink(page)}<span class="result-type task">原任务页面</span></h2><p>已有需求全景图 · 标题匹配</p></section>`
        }
        const { doc, text } = record
        return `<section class="search-card"><div class="card-source">${escape(doc.path)}</div><h2>${navLink(doc)}<span class="result-type ${doc.kind === 'task' ? 'task' : ''}">${doc.kind === 'task' ? '变更记录' : '文档'}</span></h2><p>原文片段：${excerpt(text, query, terms)}</p>${cardRelated(doc, doc.kind === 'task' ? '相关文档' : '变更记录', doc.kind === 'task' ? 'document' : 'task')}${originalTaskRelated(doc)}</section>`
      }).join('')}</div>`
      : '<div class="empty"><p>本次目录读取中没有找到匹配内容。</p><p>可换一个业务对象、操作或规则名称。</p></div>'
    const errors = [...records.filter(item => item.error).map(item => `${item.doc.path}：${item.error}`), ...taskErrors]
    renderReadNotice(errors, addedPaths, warnings, true)
    registerReadLinks(ui.article)
  }

  function headingFor(section) {
    const headings = [...ui.article.querySelectorAll('[data-anchor]')]
    return headings.find(node => node.dataset.anchor === section) || documentAnchors.get(section) || headings.find(node => node.dataset.alias === section)
  }

  function anchorPhases(target) {
    if (target === ui['page-title'])
      return []
    const phase = target.dataset.phase || target.closest('[data-phase]')?.dataset.phase
    if (phase)
      return [phase]
    const container = target.closest('[data-phase-container]')
    const values = container ? [...new Set([...container.querySelectorAll('[data-phase]')].map(node => node.dataset.phase))] : []
    return values.length ? values : ['unclassified']
  }

  function revealHeading(heading) {
    for (let parent = heading.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS')
        parent.open = true
    }
    heading.scrollIntoView({ block: 'start' })
  }

  async function renderPage(info, version) {
    const readError = sourceReadError(info.path)
    if (readError)
      throw new Error(unavailableReason({ target: info.path, ...readError }))
    if (taskPages.has(info.path))
      return renderOriginalTask(taskPages.get(info.path), info, version)
    const doc = documents.get(info.path)
    if (!doc) {
      const taskError = catalog.task_errors?.[info.path]
      const documentError = catalog.document_errors?.[info.path]
      throw new Error(taskError || documentError
        ? unavailableReason({ target: info.path, ...documentError })
        : `文档未收录或已经移除：${info.path}。请刷新目录后从业务入口继续。`)
    }
    const snapshot = catalog
    const pageScope = readPageScope()
    const request = { current: () => true }
    const raw = await documentText(doc, () => catalog === snapshot && readPageScope() === pageScope, request)
    if (version !== renderVersion || !request.current() || typeof raw !== 'string')
      return
    setHeader({ title: doc.title || doc.path, kind: doc.kind === 'task' ? '变更记录' : doc.path === catalog.entry ? '业务入口' : '文档', description: doc.kind === 'task' ? '目标、实际实现和验证范围以本记录中的明确说明为准。' : '阅读规则、例外与依据；章节用途取自原文标记，适用范围以正文为准。', path: doc.path, showSource: true })
    delete ui.article.dataset.failedSource
    const { container, toc, anchors } = markdownSections(raw, doc)
    ui.article.replaceChildren(...container.childNodes)
    documentAnchors = anchors
    ui.article.dataset.documentPath = doc.path
    renderPhaseFilter()
    renderContext(doc, toc)
    await renderDiagrams(version)
    if (version !== renderVersion)
      return
    if (info.section) {
      const heading = headingFor(info.section)
      if (heading) {
        const targetPhases = anchorPhases(heading)
        if (heading.closest('[hidden]') || (currentPhase !== 'all' && targetPhases.length && !targetPhases.includes(currentPhase))) {
          notice(`链接目标包含“${targetPhases.map(phase => phases[phase] || '未分类').join('、')}”，当前只显示“${phases[currentPhase]}”。可切换分类或选择“全部内容”查看。`)
        }
        else {
          if (currentPhase !== 'all' && targetPhases.length > 1)
            notice(`链接目标包含多种分类，当前仅显示“${phases[currentPhase]}”部分。选择“全部内容”可查看完整范围。`)
          revealHeading(heading)
        }
      }
      else { notice(`原文中未找到章节“${info.section}”，已显示该文档。`) }
    }
    else { window.scrollTo({ top: scrollPositions.get(doc.path) || 0, behavior: 'instant' }) }
    syncToc()
    updateNavigationSelection()
  }

  async function renderRoute() {
    if (!catalog)
      return
    if (currentPath && currentView === 'page')
      scrollPositions.set(currentPath, window.scrollY)
    const info = routeInfo()
    readPageScope(info)
    const pendingSource = ui['source-dialog'].open && !ui['source-dialog'].reading?.displayed
    if (sourceRoute && (['path', 'view', 'query', 'taskQuery', 'phase'].some(key => sourceRoute[key] !== info[key])
      || (pendingSource && sourceRoute.section !== info.section))) {
      sourceVersion++
      sourceRoute = undefined
      if (pendingSource) {
        clearSourceContents()
        ui['source-dialog'].reading = undefined
      }
      if (ui['source-dialog'].open)
        ui['source-dialog'].close()
    }
    const version = ++renderVersion
    taskFrameRead = undefined
    cancelAnimationFrame(tocFrame)
    tocFrame = 0
    tocItems = []
    documentAnchors = new Map()
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
    ui.context.reading = undefined
    ui.context.suspendedReading = undefined
    ui.context.hidden = true
    ui['source-button'].hidden = true
    ui['page-links'].hidden = true
    delete ui.article.dataset.failedSource
    delete ui.article.dataset.documentPath
    ui.article.innerHTML = '<div class="loading">正在读取 Markdown…</div>'
    try {
      if (info.query)
        await renderSearch(info.query, version)
      else if (info.view === 'tasks')
        await renderTasks(version)
      else
        await renderPage(info, version)
      if (version === renderVersion) {
        setTextTitles(ui.article)
        if (catalog.readFailure)
          refreshCurrentReadState()
      }
    }
    catch (error) {
      if (version !== renderVersion || (typeof error.readCurrent === 'function' && !error.readCurrent()))
        return
      showReadFailure(info.path, error.message)
    }
  }

  function showReadFailure(path, message) {
    taskFrameRead = undefined
    ui.article.dataset.failedSource = path
    delete ui.article.dataset.documentPath
    tocItems = []
    const pendingDirectory = Boolean(catalog?.readFailure)
    const directory = pendingDirectory && sourceReadError(path) === catalog.readFailure
    setHeader({ title: '文档读取失败', kind: '来源未读取', description: directory ? '请先处理目录来源问题，再刷新内容重新核对。' : pendingDirectory ? '请按当前来源原因处理，再刷新内容核对其余目录。' : '从目录选择可用文档，或检查来源后刷新内容。', path })
    ui['phase-filter'].replaceChildren()
    ui.context.replaceChildren()
    ui.context.hidden = true
    ui.article.innerHTML = directory
      ? '<div class="empty"><p>当前目录未能核对。</p><p>请先处理目录来源问题，再点击“刷新内容”重新读取。</p></div>'
      : pendingDirectory
        ? '<div class="empty"><p>当前内容未能加载。</p><p>请按当前来源原因处理，再点击“刷新内容”核对其余目录。</p></div>'
        : '<div class="empty"><p>当前内容未能加载。</p><p>可点击“刷新内容”重新读取来源，或从左侧选择其他文档。</p></div>'
    notice(pendingDirectory && !directory ? `${message} 其余目录尚待刷新核对。` : message, true)
  }

  async function refresh() {
    if (refreshing)
      return
    refreshing = true
    searchTexts.clear()
    ui['refresh-button'].setAttribute('aria-busy', 'true')
    ui['refresh-button'].title = '正在读取 Markdown，完成后可再次刷新'
    try {
      const next = await fetchResource('/api/catalog', 'json')
      if (!Array.isArray(next.documents))
        throw new Error('目录响应缺少文档列表。')
      sourceVersion++
      if (ui['source-dialog'].open)
        ui['source-dialog'].close()
      catalog = next
      documents = new Map(next.documents.map(doc => [doc.path, doc]))
      sources = new Map((next.sources || []).map(source => [source.path, source]))
      taskPages = new Map((next.task_pages || []).map(page => [page.path, page]))
      ui['project-name'].textContent = next.project
      ui['project-name'].title = next.project
      await renderRoute()
    }
    catch (error) {
      // A failed catalog read cannot leave the previous reading snapshot looking current.
      renderVersion++
      sourceVersion++
      diagramVersion++
      catalog = null
      tocItems = []
      documents.clear()
      sources.clear()
      taskPages.clear()
      searchTexts.clear()
      window.RequirementSearch?.search([], '')
      scrollPositions.clear()
      diagramDefinitions.clear()
      currentPath = ''
      currentPhase = 'all'
      currentView = 'page'
      if (ui['source-dialog'].open)
        ui['source-dialog'].close()
      if (ui['diagram-dialog'].open)
        ui['diagram-dialog'].close()
      for (const id of ['source-content', 'source-hash', 'source-title', 'diagram-full', 'diagram-title', 'diagram-phase'])
        ui[id].replaceChildren()
      ui['source-hash'].removeAttribute('title')
      ui['source-original'].removeAttribute('href')
      ui['project-name'].textContent = '来源未能读取'
      ui['project-name'].title = '来源未能读取'
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
      ui['refresh-button'].title = '刷新内容'
    }
  }

  async function openSource(path) {
    const version = ++sourceVersion
    const snapshot = catalog
    const metadata = documents.get(path) || sources.get(path)
    if (!metadata && !catalog?.task_errors?.[path])
      return toast('该来源未收录，请先刷新内容。')
    const ownerRoute = routeInfo()
    const ownerVersion = readPageScope(ownerRoute)
    sourceRoute = ownerRoute
    ui['source-dialog'].reading = { path, catalog: snapshot, displayed: false }
    const doc = documents.get(path)
    ui['source-title'].textContent = path
    ui['source-title'].title = path
    ui['source-type'].textContent = doc ? '本次读取的 Markdown 原文' : '项目文本来源'
    ui['source-original'].removeAttribute('href')
    ui['source-original'].hidden = true
    ui['source-hash'].textContent = ''
    ui['source-hash'].title = ''
    ui['source-content'].textContent = '正在读取来源…'
    if (!ui['source-dialog'].open)
      ui['source-dialog'].showModal()
    const owner = () => catalog === snapshot && readPageScope() === ownerVersion
    const active = () => owner() && version === sourceVersion && ui['source-dialog'].open
    const request = {
      current: () => true,
      directoryCurrent: owner,
    }
    const showLatest = () => {
      const error = sourceReadError(path)
      ui['source-content'].textContent = error ? unavailableReason({ target: path, ...error }) : '来源已由更新的核对取代，请重新打开原文。'
    }
    try {
      const url = sourceUrl(path, metadata?.sha256)
      const text = doc ? await documentText(doc, owner, request) : await readSource(path, url, owner, request)
      if (!active())
        return
      if (!request.current() || typeof text !== 'string') {
        showLatest()
        return
      }
      ui['source-content'].textContent = text
      ui['source-hash'].textContent = `原文字节摘要 ${metadata.sha256.slice(0, 16)}`
      ui['source-hash'].title = metadata.sha256
      ui['source-original'].href = url
      ui['source-original'].hidden = false
      ui['source-dialog'].reading.displayed = true
    }
    catch (error) {
      if (active()) {
        if (!request.current() || (typeof error.readCurrent === 'function' && !error.readCurrent())) {
          showLatest()
          return
        }
        const failure = sourceReadError(path)
        const message = failure ? unavailableReason({ target: path, ...failure }) : error.message
        ui['source-content'].textContent = message
        if (currentView === 'page' && (path === currentPath || path === taskPages.get(currentPath)?.model_path))
          showReadFailure(currentPath, message)
      }
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
  window.addEventListener('message', taskFrameError)
  ui['phase-filter'].addEventListener('click', (event) => {
    const button = event.target.closest('button[data-phase]')
    if (!button)
      return
    currentPhase = button.dataset.phase
    const params = new URLSearchParams(location.hash.slice(1))
    let heading
    if (params.has('section')) {
      heading = headingFor(params.get('section'))
      const targetPhases = heading ? anchorPhases(heading) : []
      if (!heading || (currentPhase !== 'all' && targetPhases.length && !targetPhases.includes(currentPhase))) {
        params.delete('section')
        heading = undefined
      }
    }
    if (currentPhase === 'all')
      params.delete('phase')
    else
      params.set('phase', currentPhase)
    history.replaceState(null, '', `#${params}`)
    readPageScope()
    notice()
    renderPhaseFilter()
    updateNavigationSelection()
    if (heading) {
      if (currentPhase !== 'all' && anchorPhases(heading).length > 1)
        notice(`链接目标包含多种分类，当前仅显示“${phases[currentPhase]}”部分。选择“全部内容”可查看完整范围。`)
      revealHeading(heading)
    }
  })
  document.addEventListener('click', (event) => {
    if (event.target.closest('a[href="#content"]')) {
      event.preventDefault()
      const content = $('content')
      content.focus({ preventScroll: true })
      content.scrollIntoView({ block: 'start' })
      return
    }
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
    if (source && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      openSource(source.dataset.source)
    }
    const section = event.target.closest('a[href^="#"]')
    if (section?.getAttribute('href') === location.hash && routeInfo().section
      && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      renderRoute()
    }
  })
  ui['source-button'].addEventListener('click', () => openSource(currentPath))
  ui['close-source'].addEventListener('click', () => ui['source-dialog'].close())
  ui['source-dialog'].addEventListener('close', () => {
    if (ui['source-dialog'].open)
      return
    sourceVersion++
    sourceRoute = undefined
    ui['source-dialog'].reading = undefined
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
  ui['theme-button'].addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(theme)
    try {
      localStorage.setItem('requirement-flow.theme', theme)
    }
    catch {
      // The selected theme still applies to the current page.
    }
    renderRoute()
  })
  ui['mobile-menu'].addEventListener('click', () => setMenu(!ui.sidebar.classList.contains('open')))
  ui['nav-shade'].addEventListener('click', () => setMenu(false))
  ui.navigation.addEventListener('pointerover', (event) => {
    const link = event.target.closest('.nav-link')
    if (link && !link.contains(event.relatedTarget))
      showNavTooltip(link)
  })
  ui.navigation.addEventListener('pointerout', (event) => {
    if (navTooltipTarget && !navTooltipTarget.contains(event.relatedTarget)
      && !ui['nav-tooltip'].contains(event.relatedTarget) && document.activeElement !== navTooltipTarget) {
      delayNavTooltipHide()
    }
  })
  ui.navigation.addEventListener('focusin', (event) => {
    navTooltipFocusTarget = event.target.closest('.nav-link')
    showNavTooltip(navTooltipFocusTarget)
  })
  ui.navigation.addEventListener('focusout', (event) => {
    navTooltipFocusTarget = undefined
    if (!ui['nav-tooltip'].contains(event.relatedTarget) && !ui['nav-tooltip'].matches(':hover'))
      hideNavTooltip()
  })
  ui.navigation.addEventListener('click', dismissNavTooltip)
  ui.navigation.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key))
      dismissNavTooltip()
  })
  ui['nav-tooltip'].addEventListener('pointerenter', () => clearTimeout(navTooltipTimer))
  ui['nav-tooltip'].addEventListener('pointerleave', (event) => {
    if (!navTooltipTarget?.contains(event.relatedTarget) && document.activeElement !== navTooltipTarget)
      delayNavTooltipHide()
  })
  document.addEventListener('pointerdown', (event) => {
    if (!ui['nav-tooltip'].contains(event.target))
      dismissNavTooltip()
  })
  for (const type of ['wheel', 'touchstart']) {
    document.addEventListener(type, (event) => {
      if (!ui['nav-tooltip'].contains(event.target))
        dismissNavTooltip()
    }, { passive: true })
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      dismissNavTooltip()
  })
  window.addEventListener('scroll', (event) => {
    if (event.target !== ui['nav-tooltip']) {
      const focused = document.activeElement
      showNavTooltip(focused === navTooltipFocusTarget ? focused : null)
    }
  }, { capture: true, passive: true })
  window.addEventListener('resize', dismissNavTooltip)
  window.addEventListener('hashchange', dismissNavTooltip)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      setMenu(false)
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !/^(INPUT|TEXTAREA)$/.test(event.target.tagName) && !ui['source-dialog'].open && !ui['diagram-dialog'].open) {
      event.preventDefault()
      ui['search-input'].focus()
    }
  })
  window.addEventListener('hashchange', renderRoute)
  window.addEventListener('scroll', scheduleToc, { passive: true })
  ui.article.addEventListener('toggle', scheduleToc, true)
  window.addEventListener('resize', scheduleToc)
  wideOutline.addEventListener('change', () => {
    const outline = ui.context.querySelector('.outline-disclosure')
    if (outline)
      outline.open = wideOutline.matches
    scheduleToc()
  })
  new ResizeObserver(updateHeaderOffset).observe(siteHeader)
  refresh()
})()
