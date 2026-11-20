;(() => {
  'use strict'
  const readers = new WeakMap()
  const tip = document.createElement('div')
  tip.id = 'card-tooltip'
  tip.className = 'card-tooltip'
  tip.setAttribute('role', 'tooltip')
  tip.hidden = true
  document.body.append(tip)
  let active, pending, timer, previousDescription
  let pressing = false
  function hide() {
    clearTimeout(timer)
    pending = null
    if (active) {
      if (previousDescription)
        active.setAttribute('aria-describedby', previousDescription)
      else active.removeAttribute('aria-describedby')
    }
    tip.hidden = true
    active = null
  }
  function text(tag, value) {
    const node = document.createElement(tag)
    node.textContent = value
    return node
  }
  function describe(container, info) {
    if (info.title)
      container.append(text('strong', info.title))
    if (info.summary)
      container.append(text('p', info.summary))
    const rows = document.createElement('dl')
    for (const [key, value] of info.rows || []) {
      if (value !== '' && value !== null && value !== undefined)
        rows.append(text('dt', key), text('dd', value))
    }
    if (rows.childElementCount)
      container.append(rows)
  }
  function place(anchor) {
    const rect = anchor.getBoundingClientRect()
    const gap = 7
    const pad = 8
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const maxX = document.documentElement.clientWidth - w - pad
    const maxY = innerHeight - h - pad
    // Prefer an empty side of the card. On a dense board, cover as little of the other cards as possible.
    const obstacles = [...document.querySelectorAll('article.card, .map-node, header, .toolbar, .map-bar')]
      .filter(element => element !== anchor)
      .map(element => element.getBoundingClientRect())
      .filter(box => box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth)
    function covered(x, y, box) {
      return Math.max(0, Math.min(x + w, box.right) - Math.max(x, box.left))
        * Math.max(0, Math.min(y + h, box.bottom) - Math.max(y, box.top))
    }
    const candidates = [
      [rect.left, rect.bottom + gap],
      [rect.left, rect.top - h - gap],
      [rect.right + gap, rect.top],
      [rect.left - w - gap, rect.top],
      [rect.right - w, rect.bottom + gap],
      [rect.right - w, rect.top - h - gap],
    ]
    let least = Infinity
    for (const [left, top] of candidates) {
      const x = Math.max(pad, Math.min(left, maxX))
      const y = Math.max(pad, Math.min(top, maxY))
      const score = covered(x, y, rect) * 100 + obstacles.reduce((sum, box) => sum + covered(x, y, box), 0)
      if (score < least) {
        least = score
        tip.style.left = `${x}px`
        tip.style.top = `${y}px`
      }
    }
  }
  function show(node) {
    const entry = readers.get(node)
    if (!entry || !node.isConnected || node.closest('[inert]')) {
      hide()
      return
    }
    if (node === active)
      return
    hide()
    active = node
    previousDescription = node.getAttribute('aria-describedby')
    node.setAttribute('aria-describedby', [previousDescription, tip.id].filter(Boolean).join(' '))
    tip.replaceChildren()
    describe(tip, entry.read())
    tip.hidden = false
    tip.style.maxHeight = ''
    tip.scrollTop = 0
    place(entry.anchor)
  }
  function anchorOf(target) {
    return target instanceof Element ? target.closest('[data-card-reader]') : null
  }
  function queue(node, delay) {
    clearTimeout(timer)
    pending = node
    timer = setTimeout(() => node ? show(node) : hide(), delay)
  }
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch' || event.buttons)
      return
    if (tip.contains(event.target)) {
      clearTimeout(timer)
      return
    }
    const node = anchorOf(event.target)
    if (node && node !== active)
      queue(node, 180)
  })
  document.addEventListener('pointerout', (event) => {
    if (event.pointerType === 'touch')
      return
    const node = anchorOf(event.target)
    const next = anchorOf(event.relatedTarget)
    if ((node || tip.contains(event.target)) && !tip.contains(event.relatedTarget) && next !== node)
      queue(null, 110)
    else if (tip.contains(event.target) && !tip.contains(event.relatedTarget) && !next)
      queue(null, 110)
  })
  document.addEventListener('focusin', (event) => {
    const node = anchorOf(event.target)
    if (node && !pressing && event.target.matches(':focus-visible') && !node.closest('[inert]'))
      show(node)
  })
  document.addEventListener('focusout', (event) => {
    if (active && !active.contains(event.relatedTarget))
      hide()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (active || pending)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      hide()
    }
  }, true)
  document.addEventListener('pointerdown', (event) => {
    pressing = true
    if (!tip.contains(event.target))
      hide()
  }, true)
  function finishPointer() {
    pressing = false
  }
  window.addEventListener('pointerup', finishPointer, true)
  window.addEventListener('pointercancel', finishPointer, true)
  window.addEventListener('blur', hide)
  window.addEventListener('resize', hide)
  document.addEventListener('wheel', (event) => {
    if (!tip.contains(event.target))
      hide()
  }, { capture: true, passive: true })
  document.addEventListener('scroll', (event) => {
    if (!tip.contains(event.target))
      hide()
  }, true)
  function bind(node, read, anchor = node) {
    node.dataset.cardReader = ''
    readers.set(node, { read, anchor })
  }
  function taskInfo(task) {
    const names = { ready: '可推进', resume: '推进中', waiting: '待处理', complete: '已完成 · 待归档', unplanned: '待规划' }
    let state = names[task.state] || '进行中'
    if (task.error)
      state = '读取异常'
    else if (task.failed)
      state = `${task.failed} 项验收未通过`
    else if (task.stale)
      state = `${task.stale} 项需复验`
    else if (task.bucket === 'archive')
      state = '已归档'
    else if (task.basis === 'withdrawn' && task.state === 'complete')
      state = '本期范围已撤出'
    else if (task.state === 'ready' && task.passed > 0)
      state = '待继续'
    const tone = task.error || task.failed || task.stale || task.state === 'waiting'
      ? 'amber'
      : task.bucket === 'archive' || task.state === 'unplanned' || task.basis === 'withdrawn' ? 'neutral' : 'green'
    const measured = !task.error && ['research', 'scenarios'].includes(task.basis) && Number.isInteger(task.total)
      && task.total > 0 && Number.isInteger(task.passed) && task.passed >= 0 && task.passed <= task.total
    const count = `${task.passed} / ${task.total}`
    const measure = measured
      ? (task.basis === 'research' ? `${count} 项调研有依据` : `${count} 个场景通过`)
      : task.error ? '记录无法读取' : task.basis === 'withdrawn' ? '本期无待验场景，原范围及决定可追溯' : task.basis === 'history' ? '历史记录待复验' : task.outcome === 'research' ? '待定义调研项' : '待定义验收场景'
    const kind = task.basis === 'history' ? '历史需求' : task.outcome === 'research' ? '调研需求' : '交付需求'
    const rows = [['需求类型', kind], ['当前状态', state], ['验收进度', measure]]
    if (!task.error && Number.isInteger(task.stories) && task.basis !== 'history')
      rows.push(['涉及功能', `${task.stories} 个`])
    if (task.withdrawnStories)
      rows.push(['本期已撤出', `${task.withdrawnStories} 个功能`])
    if (task.updatedAt)
      rows.push(['更新日期', String(task.updatedAt).slice(0, 10)])
    return { title: task.title || task.id, summary: task.error || task.summary, state, tone, measured, measure, rows }
  }
  window.FlowTooltip = { bind, hide, describe, taskInfo }
})()
