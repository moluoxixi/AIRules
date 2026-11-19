;(() => {
  'use strict'
  const $ = id => document.getElementById(id)
  const { model, states, impacts, graph: fullGraph, csrf, queue, lesson_version: lessonVersion } = JSON.parse($('data').textContent)
  const { work, protocol } = model
  const research = work.outcome === 'research'
  const evidenceKind = research ? '调研' : '验证'
  const map = $('map')
  const dagre = window.dagre
  const layouts = new Map()
  let ignoreClicksUntil = 0
  const storyIds = Object.keys(work.stories)
  const featureNodes = new Map(storyIds.map(id => [id, new Set(fullGraph.features[id].nodes)]))
  const searchable = new Map(
    storyIds.map((id) => {
      const story = work.stories[id]
      return [
        id,
        [story.title, story.goal, story.actor, ...(story.flow || [])].join(' ').normalize('NFKC').toLowerCase(),
      ]
    }),
  )
  const picks = new Set()
  const chipButtons = new Map()
  const decisionNotes = new Map()
  let graph = fullGraph
  let nodes = new Map()
  let visibleActions = new Set()
  let visibleStories = []
  let scoped = false
  const styles = {
    request: { fill: '#19394e', stroke: '#19394e', title: '#ffffff', text: '#c5e6e9', icon: '#a5e0d2' },
    story: { fill: '#eaf2ff', stroke: '#80a5d2', title: '#193e6a', text: '#41698e', icon: '#316ba7' },
    decision: { fill: '#fff1d8', stroke: '#bd813b', title: '#693c10', text: '#855019', icon: '#a5671e' },
    contract: { fill: '#e4f4ee', stroke: '#73a89a', title: '#174f4d', text: '#346c60', icon: '#247b6b' },
    research: { fill: '#e7f4f2', stroke: '#76ada5', title: '#184f52', text: '#396e71', icon: '#2a7772' },
    develop: { fill: '#ffffff', stroke: '#87a2b8', title: '#193d53', text: '#486a7e', icon: '#32778a' },
    verify: { fill: '#f2edfa', stroke: '#a998c2', title: '#513e70', text: '#68547e', icon: '#796398' },
    delivery: { fill: '#e5ebf1', stroke: '#89a1b3', title: '#29485b', text: '#50697c', icon: '#567286' },
  }
  const glyph = {
    request: 'M2 8h5m0 0c3 0 1-5 5-5h2M7 8c3 0 1 5 5 5h2',
    story: 'M2 3h5l1.5 1.5L10 3h4v10h-4l-1.5 1L7 13H2zM8.5 4.5V14',
    decision: 'M8 1.5 14.5 8 8 14.5 1.5 8z',
    contract: 'M3 2h7l3 3v9H3zM9 2v4h4M5 9h6m-6 2.5h4',
    research: 'M10.5 10.5 14 14M12 7A5 5 0 1 1 2 7a5 5 0 0 1 10 0',
    develop: 'm5.8 4-4 4 4 4m4.4-8 4 4-4 4',
    verify: 'M8 1.5 14 4v4c0 2.5-3 5.2-6 6.5C5 13.2 2 10.5 2 8V4zM5 8l2 2 4-4',
    delivery: 'M2 5h12v8H2zM1 2.5h14V5H1zM6 8h4',
  }
  const lineColors = {
    normal: '#718da2',
    story: '#678bb5',
    done: '#498879',
    possible: '#ac742e',
    chosen: '#95581b',
    skipped: '#9ca8b1',
  }
  const activeName = {
    ready: '可推进',
    active: 'AI 进行中',
    blocked: '等待前置',
    dormant: '按条件启用',
    skipped: '本次跳过',
    done: '已完成',
    stale: '需复核',
  }
  const svgns = 'http://www.w3.org/2000/svg'
  function svg(tag, attrs, parent, value) {
    const el = document.createElementNS(svgns, tag)
    for (const [key, val] of Object.entries(attrs || {})) el.setAttribute(key, val)
    if (value !== undefined)
      el.textContent = value
    if (parent)
      parent.append(el)
    return el
  }
  function html(tag, parent, value, className) {
    const el = document.createElement(tag)
    if (value !== undefined && value !== null)
      el.textContent = value
    if (className)
      el.className = className
    if (parent)
      parent.append(el)
    return el
  }
  const ctx = document.createElement('canvas').getContext('2d')
  const font = '"Instrument Sans","PingFang SC","Microsoft YaHei",system-ui,sans-serif'
  const mono = '"IBM Plex Mono","SFMono-Regular",Consolas,monospace'
  function widthOf(text, size = 14, bold = 500, coding = false) {
    ctx.font = `${bold} ${size}px ${coding ? mono : font}`
    return ctx.measureText(text).width
  }
  function linesOf(value, width, max, size = 14, bold = 500, coding = false) {
    const text = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
    const out = []
    let current = ''
    for (const ch of text) {
      if (current && widthOf(current + ch, size, bold, coding) > width) {
        if (out.length === max - 1) {
          while (current && widthOf(`${current}…`, size, bold, coding) > width) current = current.slice(0, -1)
          out.push(`${current.trimEnd()}…`)
          return out
        }
        out.push(current.trimEnd())
        current = ''
      }
      current += ch
    }
    if (current)
      out.push(current.trim())
    return out
  }
  const boxes = new Map()
  let roomy
  function measureBoxes(wide) {
    if (roomy === wide)
      return
    roomy = wide
    boxes.clear()
    for (const n of nodes.values()) {
      const size = n.kind === 'request' ? 17 : n.mono ? 14 : 15.5
      const inset = n.kind === 'decision' ? 23 : 14
      const minWidth = n.kind === 'request' ? 169 : n.kind === 'delivery' ? 151 : wide ? 197 : 157
      const shortCaption = n.caption && Array.from(n.caption).length <= 24 ? widthOf(n.caption, 11.7, 450) : 0
      const sharedWidth = n.sharedNote ? widthOf(n.sharedNote, 11.2, 600) + 4 : 0
      const contentWidth = Math.max(widthOf(n.title, size, 680, n.mono), shortCaption, sharedWidth) + 2 * inset + 2
      const width = Math.ceil(Math.min(n.kind === 'decision' ? 257 : 235, Math.max(minWidth, contentWidth)))
      const labels = linesOf(n.title, width - 2 * inset, 2, size, 680, n.mono)
      const caps = linesOf(n.caption, width - 2 * inset, 1, 11.7, 450)
      const shared = linesOf(n.sharedNote, width - 2 * inset, 1, 11.2, 600)
      const height = 34 + 18 * labels.length + (caps.length ? 14 : 0) + (shared.length ? 17 : 0)
      boxes.set(n.id, { width, height, size, inset, labels, caps, shared })
    }
    layouts.clear()
  }
  for (const [name, color] of Object.entries(lineColors)) {
    const marker = svg(
      'marker',
      {
        id: `arr-${name}`,
        viewBox: '0 0 8 8',
        refX: 7,
        refY: 4,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto',
        markerUnits: 'userSpaceOnUse',
      },
      $('drawing-defs'),
    )
    svg(
      'path',
      {
        'd': 'M.8 .8 7 4 .8 7.2',
        'fill': 'none',
        'stroke': color,
        'stroke-width': 1.4,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      },
      marker,
    )
  }
  function makeLayout(dir) {
    if (layouts.has(dir))
      return layouts.get(dir)
    const g = new dagre.graphlib.Graph({ multigraph: true })
    g.setGraph({
      rankdir: dir,
      ranksep: dir === 'TB' ? 20 : 34,
      nodesep: dir === 'TB' ? 52 : 82,
      edgesep: 15,
      marginx: 8,
      marginy: 8,
    })
    g.setDefaultEdgeLabel(() => ({}))
    for (const [id, box] of boxes) g.setNode(id, { width: box.width, height: box.height })
    graph.edges.forEach((e, i) => {
      const label = e.label
      const weight = e.source === '@request' && nodes.get(e.target).kind === 'story' ? 14 : e.mode === 'normal' ? 3 : 1
      g.setEdge(
        e.source,
        e.target,
        { width: label ? widthOf(label, 11.8, 600) + 12 : 0, height: label ? 17 : 0, labelpos: 'c', weight },
        String(i),
      )
    })
    dagre.layout(g)
    const result = {
      dir,
      width: g.graph().width,
      height: g.graph().height,
      positions: new Map(graph.nodes.map(n => [n.id, g.node(n.id)])),
      routes: graph.edges.map((e, i) => g.edge(e.source, e.target, String(i))),
    }
    layouts.set(dir, result)
    return result
  }
  function rounded(points) {
    if (!points || !points.length)
      return ''
    const xy = p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    let d = `M${xy(points[0])}`
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1]
      const b = points[i]
      const c = points[i + 1]
      const ab = Math.hypot(a.x - b.x, a.y - b.y)
      const bc = Math.hypot(c.x - b.x, c.y - b.y)
      if (!ab || !bc)
        continue
      const r = Math.min(14, ab / 2, bc / 2)
      d
        += ` L${
          xy({ x: b.x + ((a.x - b.x) * r) / ab, y: b.y + ((a.y - b.y) * r) / ab })
        } Q${
          xy(b)
        } ${
          xy({ x: b.x + ((c.x - b.x) * r) / bc, y: b.y + ((c.y - b.y) * r) / bc })}`
    }
    return `${d} L${xy(points[points.length - 1])}`
  }
  let layout
  let camera = { x: 0, y: 0, scale: 1 }
  let fitted = 1
  let selected = null
  let restoreCamera = null
  let boxSize = { w: 0, h: 0 }
  const nodeEls = new Map()
  const edgeEls = []
  function drawWire(e, i) {
    const route = layout.routes[i]
    let key = e.mode
    if (key === 'normal' && nodes.get(e.target).kind === 'story')
      key = 'story'
    else if (key === 'normal' && nodes.get(e.source).kind === 'contract')
      key = 'done'
    const color = lineColors[key]
    const group = svg('g', { 'class': 'map-edge', 'aria-hidden': 'true' }, $('wires'))
    const at = {
      'd': rounded(route.points),
      'class': 'map-line',
      'stroke': color,
      'stroke-width': e.mode === 'chosen' ? 2.8 : 1.9,
      'marker-end': `url(#arr-${key})`,
    }
    if (e.mode === 'possible' || e.mode === 'skipped')
      at['stroke-dasharray'] = e.mode === 'possible' ? '5 4' : '2 5'
    svg('path', at, group)
    let label = null
    if (e.label && Number.isFinite(route.x)) {
      label = svg(
        'g',
        { 'class': 'map-edge', 'aria-hidden': 'true', 'transform': `translate(${route.x} ${route.y})` },
        $('wire-labels'),
      )
      svg(
        'rect',
        {
          'x': -route.width / 2,
          'y': -8.5,
          'width': route.width,
          'height': 17,
          'rx': 4,
          'fill': '#fff9ec',
          'stroke': '#e2cba8',
          'stroke-width': 0.7,
        },
        label,
      )
      svg(
        'text',
        {
          'x': 0,
          'y': 4.3,
          'class': 'map-label',
          'text-anchor': 'middle',
          'font-size': 11.8,
          'font-weight': 600,
          'fill': e.mode === 'skipped' ? '#687783' : '#84501e',
        },
        label,
        e.label,
      )
    }
    edgeEls.push([group, label])
  }
  function drawNode(n) {
    const p = layout.positions.get(n.id)
    const b = boxes.get(n.id)
    const c = styles[n.kind]
    const g = svg(
      'g',
      {
        'class': 'map-node',
        'role': 'button',
        'tabindex': '0',
        'aria-label': [n.label, n.title, n.state, n.sharedNote].filter(Boolean).join('，'),
        'aria-haspopup': 'dialog',
        'aria-expanded': 'false',
        'data-node': n.id,
        'transform': `translate(${p.x} ${p.y})`,
      },
      $('stations'),
    )
    svg('title', {}, g, [n.title, n.state, n.caption, n.sharedNote].filter(Boolean).join(' · '))
    const x = -b.width / 2
    const y = -b.height / 2
    const groupColor = n.activity === 'active' ? '#216c84' : c.stroke
    const shape = {
      'fill': c.fill,
      'stroke': groupColor,
      'stroke-width': n.activity === 'active' ? 2.5 : 1.45,
      'class': 'outline',
    }
    if (n.kind === 'decision') {
      const r = 13
      const right = -x
      const bottom = -y
      svg(
        'path',
        {
          ...shape,
          d:
            `M${
              x + r
            } ${
              y
            }H${
              right - r
            }L${
              right
            } 0 ${
              right - r
            } ${
              bottom
            }H${
              x + r
            }L${
              x
            } 0Z`,
        },
        g,
      )
    }
    else if (n.kind === 'contract') {
      const cut = 11
      const right = -x
      const bottom = -y
      svg(
        'path',
        {
          ...shape,
          d:
            `M${
              x + 5
            } ${
              y
            }H${
              right - cut
            }L${
              right
            } ${
              y + cut
            }V${
              bottom - 5
            }Q${
              right
            } ${
              bottom
            } ${
              right - 5
            } ${
              bottom
            }H${
              x + 5
            }Q${
              x
            } ${
              bottom
            } ${
              x
            } ${
              bottom - 5
            }V${
              y + 5
            }Q${
              x
            } ${
              y
            } ${
              x + 5
            } ${
              y
            }Z`,
        },
        g,
      )
      svg('path', { d: `M${right - cut} ${y}v${cut}h${cut}`, fill: 'none', stroke: c.stroke }, g)
    }
    else {
      const radius = n.kind === 'request' ? 14 : n.kind === 'delivery' ? 19 : n.kind === 'verify' ? 12 : 8
      svg('rect', { ...shape, x, y, width: b.width, height: b.height, rx: radius }, g)
    }
    const left = x + b.inset
    svg(
      'path',
      {
        'd': glyph[n.kind],
        'transform': `translate(${left} ${y + 8}) scale(.83)`,
        'fill': 'none',
        'stroke': c.icon,
        'stroke-width': 1.65,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      g,
    )
    svg('text', { 'x': left + 17, 'y': y + 18.4, 'class': 'n-label', 'font-size': 10.8, 'fill': c.text }, g, n.label)
    if (n.state) {
      const ink
        = n.state === '待你决定' || n.state === '待核对' || n.state === '需复核'
          ? '#864d16'
          : n.activity === 'active'
            ? '#0c6967'
            : c.text
      const right = -x - b.inset
      if (n.activity === 'active')
        svg('circle', { cx: right - widthOf(n.state, 10.5, 600) - 6, cy: y + 14.6, r: 2.5, fill: '#12847a' }, g)
      svg(
        'text',
        { 'x': right, 'y': y + 18.4, 'class': 'n-label', 'font-size': 10.5, 'fill': ink, 'text-anchor': 'end' },
        g,
        n.state,
      )
    }
    const center = n.kind === 'request' || n.kind === 'delivery'
    const lineX = center ? 0 : left
    b.labels.forEach((label, i) =>
      svg(
        'text',
        {
          'x': lineX,
          'y': y + 39 + i * 18,
          'class': `n-title${n.mono ? ' mono' : ''}`,
          'fill': c.title,
          'font-size': b.size,
          'text-anchor': center ? 'middle' : 'start',
        },
        g,
        label,
      ),
    )
    b.caps.forEach((cap, i) =>
      svg(
        'text',
        {
          'x': lineX,
          'y': y + 39 + b.labels.length * 18 - 2 + i * 14,
          'fill': c.text,
          'font-size': 11.7,
          'text-anchor': center ? 'middle' : 'start',
        },
        g,
        cap,
      ),
    )
    if (b.shared.length) {
      const baseline = -y - 9
      svg(
        'path',
        { 'd': `M${left} ${baseline - 13}H${-x - b.inset}`, 'stroke': c.stroke, 'stroke-width': 0.6 },
        g,
      )
      svg('text', { 'x': left, 'y': baseline, 'fill': c.title, 'font-size': 11.2, 'font-weight': 600 }, g, b.shared[0])
    }
    g.addEventListener('click', () => {
      if (performance.now() > ignoreClicksUntil)
        openPanel(n.id, true)
    })
    g.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        openPanel(n.id, true)
      }
    })
    nodeEls.set(n.id, g)
  }
  function fittedScale(l) {
    const margin = boxSize.w < 500 ? 9 : 17
    return Math.min((boxSize.w - margin * 2) / l.width, (boxSize.h - margin * 2) / l.height, 1.65)
  }
  function spreadLanes(base) {
    const vertical = base.dir === 'TB'
    const axis = vertical ? 'x' : 'y'
    const span = vertical ? 'width' : 'height'
    const size = vertical ? boxSize.w : boxSize.h
    const scale = Math.min(2.6, Math.max(1, (size - 40) / (fittedScale(base) * base[span])))
    if (scale <= 1.04)
      return base
    const positions = new Map()
    for (const [id, p] of base.positions) positions.set(id, { ...p, [axis]: p[axis] * scale })
    const routes = base.routes.map((r, i) => {
      const e = graph.edges[i]
      const first = base.positions.get(e.source)
      const last = base.positions.get(e.target)
      const points = r.points.map((p, j) => {
        const owner = j === 0 ? first : j === r.points.length - 1 ? last : null
        return { ...p, [axis]: owner ? owner[axis] * scale + p[axis] - owner[axis] : p[axis] * scale }
      })
      const out = { ...r, points }
      if (Number.isFinite(r[axis]))
        out[axis] = r[axis] * scale
      return out
    })
    return { ...base, [span]: base[span] * scale, positions, routes }
  }
  function onResize(force = false) {
    const rect = map.getBoundingClientRect()
    if (
      !nodes.size
      || !rect.width
      || !rect.height
      || (force !== true && rect.width === boxSize.w && rect.height === boxSize.h)
    ) {
      return
    }
    boxSize = { w: rect.width, h: rect.height }
    measureBoxes(boxSize.w > 840)
    const down = makeLayout('TB')
    const across = makeLayout('LR')
    const next = spreadLanes(fittedScale(across) > fittedScale(down) * 1.08 ? across : down)
    if (layout !== next) {
      layout = next
      nodeEls.clear()
      edgeEls.length = 0
      for (const id of ['wires', 'wire-labels', 'stations']) $(id).replaceChildren()
      graph.edges.forEach(drawWire)
      graph.nodes.forEach(drawNode)
    }
    fit()
    if (selected) {
      restoreCamera = { ...camera }
      highlight(selected)
      reveal(selected)
    }
  }
  function fit() {
    if (!layout)
      return
    fitted = fittedScale(layout)
    camera = { x: layout.width / 2, y: layout.height / 2, scale: fitted }
    updateCamera()
  }
  function updateCamera() {
    const w = boxSize.w / camera.scale
    const h = boxSize.h / camera.scale
    map.setAttribute('viewBox', [camera.x - w / 2, camera.y - h / 2, w, h].join(' '))
    $('scale').textContent = `${Math.round(camera.scale * 100)}%`
    for (const [id, atLimit, title, limitTitle] of [
      ['minus', camera.scale <= minZoom() + 0.0001, '缩小', '已缩至最小比例，放大后可再次缩小'],
      ['plus', camera.scale >= maxZoom() - 0.0001, '放大', '已达最大比例，缩小后可再次放大'],
    ]) {
      $(id).setAttribute('aria-disabled', String(atLimit))
      $(id).title = atLimit ? limitTitle : title
    }
  }
  function minZoom() {
    return fitted * 0.4
  }
  function maxZoom() {
    return Math.max(3, fitted * 4)
  }
  function zoom(ratio, px = boxSize.w / 2, py = boxSize.h / 2) {
    if (!layout)
      return
    const old = camera.scale
    const next = Math.min(maxZoom(), Math.max(minZoom(), old * ratio))
    camera.x += (px - boxSize.w / 2) * (1 / old - 1 / next)
    camera.y += (py - boxSize.h / 2) * (1 / old - 1 / next)
    camera.scale = next
    updateCamera()
  }
  function highlight(key) {
    const related = new Set([key])
    // Traverse each direction separately; a shared endpoint must not pull in a sibling story.
    for (const forward of [true, false]) {
      const pending = [key]
      const seen = new Set(pending)
      while (pending.length) {
        const curr = pending.pop()
        graph.edges.forEach((e) => {
          if ((forward ? e.source : e.target) !== curr)
            return
          const next = forward ? e.target : e.source
          if (!seen.has(next)) {
            seen.add(next)
            related.add(next)
            pending.push(next)
          }
        })
      }
    }
    for (const [id, el] of nodeEls) {
      el.classList.toggle('muted', !related.has(id))
      el.classList.toggle('selected', id === key)
      el.setAttribute('aria-expanded', String(id === key))
    }
    graph.edges.forEach((e, i) =>
      edgeEls[i].forEach(el => el?.classList.toggle('muted', !related.has(e.source) || !related.has(e.target))),
    )
  }
  function reveal(key) {
    const p = layout.positions.get(key)
    const panel = $('inspector').getBoundingClientRect()
    const frame = map.getBoundingClientRect()
    const sx = (p.x - camera.x) * camera.scale + frame.left + frame.width / 2
    const sy = (p.y - camera.y) * camera.scale + frame.top + frame.height / 2
    if (sx >= panel.left - 40 && sy >= panel.top - 30 && sx <= panel.right + 40 && sy <= panel.bottom + 30) {
      if (frame.width < 790)
        camera.y = p.y + (frame.height / 2 - (panel.top - frame.top) / 2) / camera.scale
      else camera.x = p.x + (frame.width / 2 - (panel.left - frame.left) / 2) / camera.scale
      updateCamera()
    }
  }
  const pointers = new Map()
  let pinch = null
  let dragging = false
  function twoPoints() {
    const [a, b] = [...pointers.values()]
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }
  map.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse')
      return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY })
    if (pointers.size === 2) {
      pinch = twoPoints()
      dragging = true
    }
  })
  map.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId)
    if (!p)
      return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (!dragging && Math.hypot(p.x - p.startX, p.y - p.startY) < 4)
      return
    dragging = true
    map.classList.add('dragging')
    if (!map.hasPointerCapture(e.pointerId))
      map.setPointerCapture(e.pointerId)
    if (pointers.size === 2 && pinch) {
      const next = twoPoints()
      const rect = map.getBoundingClientRect()
      camera.x -= (next.x - pinch.x) / camera.scale
      camera.y -= (next.y - pinch.y) / camera.scale
      zoom(next.dist / pinch.dist, next.x - rect.left, next.y - rect.top)
      pinch = next
    }
    else {
      camera.x -= dx / camera.scale
      camera.y -= dy / camera.scale
      updateCamera()
    }
  })
  function endPointer(e) {
    if (!pointers.has(e.pointerId))
      return
    if (dragging)
      ignoreClicksUntil = performance.now() + 250
    pointers.delete(e.pointerId)
    if (pointers.size < 2)
      pinch = null
    if (!pointers.size) {
      dragging = false
      map.classList.remove('dragging')
    }
  }
  window.addEventListener('pointerup', endPointer)
  window.addEventListener('pointercancel', endPointer)
  map.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const r = map.getBoundingClientRect()
      zoom(Math.exp(Math.max(-0.6, Math.min(0.6, -e.deltaY * 0.002))), e.clientX - r.left, e.clientY - r.top)
    },
    { passive: false },
  )
  $('plus').onclick = () => zoom(1.25)
  $('minus').onclick = () => zoom(0.8)
  $('fit').onclick = () => {
    closePanel(false)
    fit()
  }
  map.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoom(1.25)
    }
    if (e.key === '-') {
      e.preventDefault()
      zoom(0.8)
    }
    if (e.key === 'Home') {
      e.preventDefault()
      closePanel(false)
      fit()
    }
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (move) {
      e.preventDefault()
      camera.x += (move[0] * 44) / camera.scale
      camera.y += (move[1] * 44) / camera.scale
      updateCamera()
    }
  })

  const detail = $('detail')
  function section(title, parent = detail) {
    const group = html('section', parent)
    html('h3', group, title)
    return group
  }
  function list(parent, items, ordered = false) {
    const el = html(ordered ? 'ol' : 'ul', parent)
    for (const item of items) html('li', el, item)
  }
  function pairs(parent, entries) {
    const dl = html('dl', parent)
    for (const [key, value] of entries) {
      if (value || value === 0) {
        html('dt', dl, key)
        html('dd', dl, value)
      }
    }
  }
  function disclosure(parent, title) {
    const more = html('details', parent, null, 'compact-fold')
    html('summary', more, title)
    return more
  }
  function jump(parent, id, text) {
    const dest = graph.aliases[id] || id
    if (!nodes.has(dest))
      return
    const btn = html('button', parent, text || nodes.get(dest).title, 'link-button')
    btn.type = 'button'
    btn.onclick = () => openPanel(dest, true)
  }
  function related(parent, ids, title = '图中关联') {
    const destinations = [...new Set(ids.map(id => graph.aliases[id] || id))].filter(
      id => id !== selected && nodes.has(id),
    )
    if (destinations.length) {
      const group = section(title, parent)
      for (const id of destinations) jump(group, id)
    }
  }
  function showQueue(parent, actionIds, nodeIds, stories) {
    const group = section('工作进度', parent)
    const rows = []
    for (const item of queue.running) {
      if (actionIds.has(item.id))
        rows.push([item.id, `进行中 · ${item.actor}`, item.title])
    }
    for (const id of queue.ready) {
      if (actionIds.has(id))
        rows.push([id, '可领取', work.actions[id].title])
    }
    for (const item of queue.pending_decisions) {
      if (nodeIds.has(item.id))
        rows.push([item.id, '待决定', item.title])
    }
    for (const item of queue.technical_blockers) {
      if (item.kind === 'contract' && item.actions.some(id => actionIds.has(id)))
        rows.push([item.id, '待核对接口', item.title])
    }
    for (const [id, status, title] of rows) {
      const row = html('div', group, null, 'record queue-item')
      html('span', row, status, 'dim')
      jump(row, id, title)
    }
    if (!rows.length) {
      const unfinished = [...actionIds].filter(id => !['done', 'skipped'].includes(states[id].state))
      if (unfinished.length) {
        html('p', group, '等待前置条件。选择动作查看原因。')
        for (const id of unfinished) jump(group, id, work.actions[id].title)
      }
      else if (!actionIds.size) {
        html('p', group, '还没有安排工作。')
      }
      else if (research && !queue.scenarios.some(ex => stories.includes(ex.story))) {
        const proved = [...actionIds].some(id => work.actions[id].kind === '调研' && states[id].proof)
        html('p', group, proved ? '当前范围的调研已完成，可查看结论和来源。' : '当前范围还需要有依据的调研结论。')
      }
      else if (!stories.length || stories.some(id => queue.progress.unverified_stories.includes(id))) {
        html('p', group, '已安排的动作已结束，还需要补充功能验收。')
      }
      else {
        html('p', group, '当前范围内的工作与验收已完成。')
      }
    }
  }
  function events(parent, history) {
    if (scoped) {
      history = history.filter(
        e =>
          visibleActions.has(e.action)
          || nodes.has(e.decision)
          || (e.changed || []).some(id => nodes.has(id) || visibleActions.has(id)),
      )
    }
    if (!history.length)
      return
    const group = disclosure(parent, `查看工作记录（${history.length}）`)
    const names = { plan: '调整计划', start: '开始', finish: '完成', fail: '验证失败', decision: '业务决定', evidence: '采集场景证据' }
    for (const e of [...history].reverse()) {
      const item = html('div', group, null, 'record')
      html('strong', item, `${names[e.kind] || e.kind} · v${e.revision}`)
      pairs(item, [
        ['记录人', e.actor],
        ['结果', e.output],
        ['预期', e.expected],
        ['依据', e.evidence],
        ['环境', e.environment],
        ['证据类型', e.level],
      ])
    }
  }
  const caseStates = { uncovered: '未覆盖', pending: '待验', failed: '未通过', stale: '需复核', invalid: '证据无效', passed: '已通过' }
  const lessonStates = { pending: '待审查', approved: '已通过', rejected: '已驳回', revised: '草案已修订', retired: '已退役', superseded: '已替代', stale: '需复核' }
  function sourceLink(parent, title, url) {
    const link = html('a', parent, title, 'link-button')
    link.href = url
    return link
  }
  function showLessonSource(parent, card, source) {
    const proof = source.proof
    const row = disclosure(parent, `${source.scenario} · ${source.story_title}`)
    pairs(row, [
      ['来源需求', card.task_title],
      ['给定', source.given],
      ['当', source.when],
      ['应当', source.then],
      ['动作与回执', `${source.action_title} · ${source.receipt}`],
      ['环境', proof?.environment],
      ['实际记录', proof?.actual],
    ])
    if (!source.valid) {
      html('p', row, '原始依据当前需复核。', 'dim')
      return
    }
    if (csrf) {
      const query = new URLSearchParams({ task: card.task, lesson: card.id, version: card.version, receipt: source.receipt })
      sourceLink(row, '查看原始场景与证据', `/lesson-source?${query}`)
      return
    }
    if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(card.task) || !['active', 'archive'].includes(card.bucket))
      return
    const buckets = card.bucket === 'active' ? ['active', 'archive'] : ['archive']
    for (const bucket of buckets) {
      const base = `../../${bucket}/${encodeURIComponent(card.task)}`
      const label = bucket === 'active' ? '进行中' : '已归档'
      sourceLink(row, `${label} · 来源功能图`, `${base}/handbook.html#node=${encodeURIComponent(source.story)}`)
      const path = proof?.artifact?.path
      if (typeof path === 'string' && /^evidence\/[\da-f]{32}\/(?:output\.log|artifact\.[a-z0-9]{1,12})$/u.test(path))
        sourceLink(row, `${label} · 原始证据`, `${base}/${path}`).download = path.split('/').pop()
    }
  }
  function showLessons(parent, storyIds, { all = false } = {}) {
    const own = (queue.lesson_cards || []).filter(card => all || card.sources.some(source => storyIds.includes(source.story)))
    const related = (queue.related_lessons || []).filter(card => all || card.matched_stories.some(id => storyIds.includes(id)))
    for (const [title, cards] of [['相关项目经验', related], ['本需求的经验', own]]) {
      if (!cards.length)
        continue
      const group = section(title, parent)
      if (!csrf)
        html('p', group, `需求 v${work.revision} 的离线快照。来源依据的状态记录于生成此页时。`, 'dim')
      for (const card of cards) {
        const item = html('div', group, null, 'record')
        html('strong', item, card.observation)
        pairs(item, [
          ['命中原因', card.match_reasons?.join('；')],
          ['适用条件', card.when],
          ['做法', card.practice],
          ['边界', card.boundary],
          ['状态', lessonStates[card.state]],
          ['经验版本', `${card.id} · v${card.version}`],
          ['审查人', card.review?.actor],
          ['审查意见', card.review?.reason],
          ['复核事项', card.issues?.join('；')],
          ['替代为', card.replaced_by && `${card.replaced_by.task} / ${card.replaced_by.id}`],
          ['退役原因', card.retirement?.reason],
        ])
        for (const source of card.sources)
          showLessonSource(item, card, source)
      }
    }
  }
  function showScenarios(parent, cases) {
    if (!cases.length)
      return
    const group = section('验收场景', parent)
    for (const ex of cases) {
      const row = html('div', group, null, 'record')
      html('strong', row, `${caseStates[ex.status] || ex.status} · ${ex.id}`)
      pairs(row, [
        ['给定', ex.given],
        ['当', ex.when],
        ['应当', ex.then],
        ['判定', ex.reason],
      ])
      for (const action of ex.actions) jump(row, action, work.actions[action].title)
      for (const receipt of ex.receipts) {
        const more = disclosure(row, `${receipt.level || '证据'} · ${receipt.environment || ''} · ${receipt.id}`)
        pairs(more, [
          ['记录人', receipt.actor],
          ['命令参数', receipt.argv && JSON.stringify(receipt.argv)],
          ['实际结果', receipt.actual],
          ['退出码', receipt.exit_code],
          ['文件', receipt.artifact?.path],
          ['SHA-256', receipt.artifact?.sha256],
        ])
        const path = receipt.artifact?.path
        if (typeof path === 'string' && /^evidence\/[\da-f]{32}\/(?:output\.log|artifact(?:\.[\w-]+)?)$/u.test(path)) {
          const link = html('a', more, '下载证据文件', 'link-button')
          link.href = csrf ? `/evidence/${encodeURIComponent(receipt.id)}` : `./${path}`
          link.download = path.split('/').pop()
        }
      }
    }
  }
  function showRetiredScenarios(parent, storyIds) {
    const retired = (queue.retired_scenarios || []).filter(ex => storyIds.includes(ex.story))
    if (!retired.length)
      return
    const group = disclosure(parent, `场景范围调整记录（${retired.length}）`)
    for (const ex of retired) {
      const row = html('div', group, null, 'record')
      html('strong', row, `${ex.id} · v${ex.revision}`)
      pairs(row, [
        ['原验收条件', `${ex.given}，${ex.when}，应当${ex.then}`],
        ['决定人', ex.answer.actor],
        ['调整原因', ex.answer.reason],
      ])
      jump(row, ex.decision, work.decisions[ex.decision].title)
    }
  }
  function workDetails(parent, key) {
    const a = work.actions[key]
    const status = states[key]
    pairs(parent, [
      ['当前状态', activeName[status.state]],
      ['完成条件', a.done],
    ])
    if (status.reasons.length)
      list(section('下一步的条件', parent), status.reasons)
    showLessons(parent, [...a.stories, ...a.read_stories])
    if (a.accepts?.length)
      pairs(parent, [['验收依据', a.accepts.join('、')]])
    if (a.kind === '验证') {
      const cases = queue.scenarios.filter(ex => ex.actions.includes(key))
      if (cases.length)
        showScenarios(parent, cases)
      else html('p', parent, '此动作还没有关联适用的验收场景。', 'dim')
    }
    const input = a.depends_on.map((edge) => {
      const cond = edge.when
      return (
        work.actions[edge.id].title + (cond ? `（${work.decisions[cond.decision].options[cond.is].label}时）` : '')
      )
    })
    if (input.length)
      list(section('前置动作', parent), input)
    const records = work.events.filter(e => e.action === key)
    const proof = records.find(e => e.id === status.proof)
    if (proof) {
      const group = section('当前有效依据', parent)
      pairs(group, [
        ['结果', proof.output],
        ['证据', proof.evidence],
        ['环境', proof.environment],
        ['预期', proof.expected],
        ['版次', `v${proof.revision}`],
      ])
    }
    related(parent, [...a.stories, ...a.contracts, ...a.decisions], '相关故事与输入')
    events(parent, records)
  }
  function protocolDetail(parent) {
    const group = disclosure(parent, '协作方式与 AI 写回')
    for (const m of protocol.moments) {
      const row = html('div', group, null, 'record')
      html('strong', row, m.name)
      pairs(row, [
        ['人', m.human],
        ['AI', m.agent],
      ])
    }
    html('p', group, protocol.ai.read)
    html('p', group, protocol.ai.write)
    html('p', group, protocol.ai.new_request)
  }
  function decisionDetail(key, parent) {
    const d = work.decisions[key]
    const answer = work.answers[key]
    html('p', parent, d.why)
    pairs(parent, [
      ['决定人', d.owner],
      ['已选', answer && d.options[answer.choice].label],
      ['理由', answer?.reason],
    ])
    for (const [code, option] of Object.entries(d.options)) {
      const item = html('div', parent, null, 'choice')
      html('strong', item, option.label + (answer?.choice === code ? ' · 已采用' : ''))
      html('p', item, option.consequence)
      const routes = work.contract_routes?.filter(r => r.decision === key && r.option === code) || []
      for (const r of routes) jump(item, r.contract, `${work.contracts[r.contract].title} ↗`)
      const changes = impacts[key][code]
      if (changes.length) {
        list(
          disclosure(item, '受影响的工作'),
          changes.map(([name, before, after]) => `${name} · ${before} → ${after}`),
        )
      }
    }
    if (csrf) {
      const form = html('form', parent)
      form.method = 'post'
      form.action = `/decision${filterQuery()}`
      for (const [name, value] of Object.entries({ csrf, revision: work.revision, decision: key })) {
        const field = html('input', form)
        field.type = 'hidden'
        field.name = name
        field.value = value
      }
      const label = html('label', form, '决定理由（选填）')
      const input = html('input', label)
      input.name = 'reason'
      input.maxLength = 500
      input.autocomplete = 'off'
      input.value = decisionNotes.get(key) || ''
      input.addEventListener('input', () => decisionNotes.set(key, input.value))
      for (const [code, option] of Object.entries(d.options)) {
        if (answer?.choice !== code) {
          const btn = html('button', form, `采用「${option.label}」`, 'choose')
          btn.type = 'submit'
          btn.name = 'choice'
          btn.value = code
        }
      }
    }
    else {
      html('p', parent, '离线图保留当时的记录。可在本机协作页或聊天中登记决定。', 'dim')
    }
    events(
      parent,
      work.events.filter(e => e.decision === key),
    )
  }
  function populate(key) {
    const n = nodes.get(key)
    detail.replaceChildren()
    $('panel-type').textContent = n.label + (n.state ? ` · ${n.state}` : '')
    html('h2', detail, n.kind === 'contract' ? work.contracts[key].title : n.title)
    if (n.kind === 'request') {
      html('p', detail, work.raw_request)
      pairs(detail, [
        ['目标', work.goal],
        ['来源', work.kind],
      ])
      showLessons(detail, visibleStories, { all: !scoped })
      showQueue(detail, visibleActions, nodes, visibleStories)
      if (work.scope.length)
        list(section('本次范围'), work.scope)
      related(detail, Object.keys(work.stories), '用户故事')
      protocolDetail(detail)
      events(detail, work.events)
    }
    else if (n.kind === 'story') {
      const story = work.stories[key]
      html('p', detail, story.goal)
      pairs(detail, [
        ['角色', story.actor],
        ['前置', story.before],
        ['依据', story.basis],
      ])
      showLessons(detail, [key])
      showQueue(detail, new Set(fullGraph.features[key].actions), featureNodes.get(key), [key])
      if (story.flow?.length)
        list(section('关键处理'), story.flow, true)
      showScenarios(detail, queue.scenarios.filter(ex => ex.story === key))
      showRetiredScenarios(detail, [key])
      const refs = Object.entries(work.actions).filter(([, a]) => a.stories.includes(key))
      related(
        detail,
        refs.flatMap(([id, a]) => [id, ...a.contracts, ...a.decisions]),
      )
    }
    else if (n.kind === 'decision') {
      decisionDetail(key, detail)
    }
    else if (n.kind === 'contract') {
      const c = work.contracts[key]
      html('code', detail, c.operation)
      pairs(detail, [
        ['依据', c.source],
        ['核实状态', c.status],
      ])
      if (n.users.length)
        pairs(detail, [['关联功能', n.users.map(id => work.stories[id].title).join('、')]])
      showLessons(detail, n.users.filter(id => visibleStories.includes(id)))
      const fields = section('字段与处理')
      for (const f of c.fields) {
        const item = html('div', fields, null, 'field')
        html('strong', item, `${f.name} · ${f.type}`)
        html('p', item, f.use)
        html('p', item, f.constraint, 'dim')
      }
      if (!c.fields.length)
        html('p', fields, '待补充字段。', 'dim')
      for (const id of n.research.filter(id => visibleActions.has(id)))
        workDetails(disclosure(detail, `关联调研 · ${work.actions[id].title}`), id)
      const users = Object.entries(work.actions)
        .filter(([, a]) => a.contracts.includes(key))
        .map(([id]) => id)
      related(detail, users, '使用这份契约的工作')
    }
    else if (n.kind === 'delivery') {
      showLessons(detail, visibleStories, { all: !scoped })
      const checks = Object.entries(work.actions).filter(
        ([id, a]) => a.kind === evidenceKind && states[id].state !== 'skipped' && visibleActions.has(id),
      )
      const cases = queue.scenarios.filter(ex => visibleStories.includes(ex.story))
      if (cases.length)
        showScenarios(detail, cases)
      else if (!research)
        html('p', detail, '待梳理可验收的业务场景。')
      showRetiredScenarios(detail, visibleStories)
      if (research && checks.length) {
        const group = section('调研产出与依据')
        for (const [id, a] of checks) {
          const item = html('div', group, null, 'record')
          jump(item, id, a.title)
          const proof = work.events.find(e => e.id === states[id].proof)
          pairs(item, [
            ['预期', a.done],
            ['结果', proof?.output || activeName[states[id].state]],
            ['环境', proof?.environment],
            ['依据', proof?.evidence],
          ])
        }
      }
      if (work.lessons.length) {
        const group = section('历史经验记录')
        for (const l of work.lessons) {
          const more = disclosure(group, l.observation)
          pairs(more, [
            ['触发条件', l.when],
            ['做法', l.practice],
            ['适用边界', l.boundary],
            ['证据', l.evidence],
            ['复核时机', l.review],
          ])
        }
      }
      events(detail, work.events)
    }
    else {
      workDetails(detail, key)
    }
  }
  function recordHash(hash) {
    try {
      history.replaceState(null, '', hash)
    }
    catch {
      /* Some offline viewers disallow URL changes. */
    }
  }
  function openPanel(key, changeHash) {
    if (!nodes.has(key))
      return
    if (!selected)
      restoreCamera = { ...camera }
    selected = key
    populate(key)
    $('inspector').hidden = false
    detail.scrollTop = 0
    highlight(key)
    reveal(key)
    if (changeHash)
      recordHash(`#node=${encodeURIComponent(key)}`)
    $('close-panel').focus({ preventScroll: true })
  }
  function closePanel(focus = true, changeHash = true) {
    if (!selected)
      return
    const previous = selected
    selected = null
    $('inspector').hidden = true
    for (const el of nodeEls.values()) {
      el.classList.remove('selected', 'muted')
      el.setAttribute('aria-expanded', 'false')
    }
    for (const items of edgeEls) {
      for (const el of items) el?.classList.remove('muted')
    }
    if (restoreCamera) {
      camera = { ...restoreCamera }
      restoreCamera = null
      updateCamera()
    }
    if (changeHash)
      recordHash('#work')
    if (focus)
      nodeEls.get(previous)?.focus({ preventScroll: true })
  }
  function route() {
    let hash
    try {
      hash = decodeURIComponent(location.hash.slice(1))
    }
    catch {
      hash = ''
    }
    const key = hash.startsWith('node=')
      ? hash.slice(5)
      : hash.startsWith('contract-')
        ? hash.slice(9)
        : hash === 'agent'
          ? '@request'
          : null
    if (key && nodes.has(key))
      openPanel(key, false)
    else if (selected)
      closePanel(false)
  }
  $('close-panel').onclick = () => closePanel()
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected)
      closePanel()
  })
  $('inspector').setAttribute('role', 'dialog')
  window.addEventListener('hashchange', route)
  function exportMap() {
    if (!layout)
      return
    const copy = map.cloneNode(true)
    for (const el of copy.querySelectorAll('.muted,.selected')) el.classList.remove('muted', 'selected')
    for (const el of [copy, ...copy.querySelectorAll('[tabindex]')]) {
      for (const attr of ['id', 'tabindex', 'role', 'aria-describedby', 'aria-expanded', 'aria-haspopup'])
        el.removeAttribute(attr)
    }
    const pad = 20
    const rect = [-pad, -pad, layout.width + 2 * pad, layout.height + 2 * pad]
    copy.setAttribute('viewBox', rect.join(' '))
    copy.setAttribute('width', rect[2])
    copy.setAttribute('height', rect[3])
    const bg = svg('rect', { x: rect[0], y: rect[1], width: rect[2], height: rect[3], fill: '#f5f8fb' })
    copy.insertBefore(bg, copy.firstChild)
    const subject = scoped ? visibleStories.map(id => work.stories[id].title).join('、') : work.title
    const title = svg('title', {}, null, `${subject} · ${work.kind} · v${work.revision}`)
    copy.insertBefore(title, copy.firstChild)
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = html('a', document.body)
    a.href = url
    a.download = subject.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) + (scoped ? '-功能图.svg' : '-全景图.svg')
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
  $('export').onclick = exportMap
  $('refresh').onclick = () => location.reload()
  if (csrf) {
    async function poll() {
      if (document.hidden)
        return
      try {
        const res = await fetch('/version', { cache: 'no-store' })
        if (!res.ok)
          return
        const current = await res.json()
        const displayed = queue.scenarios.map(ex => [ex.id, ex.status])
        if (current.revision === work.revision && current.lesson_version === lessonVersion
          && JSON.stringify(current.case_states) === JSON.stringify(displayed)) {
          return
        }
        const note = detail.querySelector('input[name="reason"]')
        if (note && (note.value || note === document.activeElement))
          $('notice').hidden = false
        else location.reload()
      }
      catch {
        /* The map retains its last locally rendered revision. */
      }
    }
    setInterval(poll, 3500)
    document.addEventListener('visibilitychange', poll)
  }
  function filterQuery() {
    const args = new URLSearchParams()
    const ids = storyIds.filter(id => picks.has(id))
    if (ids.length)
      args.set('features', ids.join(','))
    const term = $('feature-query').value.trim()
    if (term)
      args.set('q', term)
    const query = args.toString()
    return query ? `?${query}` : ''
  }

  function readFilters() {
    const url = new URL(location.href)
    const fromURL = new Set((url.searchParams.get('features') || '').split(','))
    picks.clear()
    for (const id of storyIds) {
      if (fromURL.has(id))
        picks.add(id)
    }
    $('feature-query').value = storyIds.length ? (url.searchParams.get('q') || '').slice(0, 80) : ''
  }

  function selectGraph(ids) {
    visibleStories = ids
    scoped = ids.length < storyIds.length
    const featureSlices = ids.map(id => featureNodes.get(id))
    const visibleIds = new Set(featureSlices.flatMap(slice => [...slice]))
    const included = new Set(ids)
    visibleActions = scoped
      ? new Set(ids.flatMap(id => fullGraph.features[id].actions))
      : new Set(Object.keys(work.actions))
    const checks = [...visibleActions].filter(
      id => work.actions[id].kind === evidenceKind && states[id].state !== 'skipped',
    )
    const proven = checks.filter(id => states[id].state === 'done').length
    const viewNodes = fullGraph.nodes
      .filter(n => !scoped || visibleIds.has(n.id))
      .map((n) => {
        if (n.kind === 'delivery' && scoped) {
          const cases = queue.scenarios.filter(ex => included.has(ex.story))
          const passed = cases.filter(ex => ex.status === 'passed').length
          if (cases.length)
            return { ...n, caption: `${passed} / ${cases.length} 个场景通过` }
          return {
            ...n,
            caption: research ? `${proven} / ${checks.length} 项调研有证据` : '待梳理验收场景',
          }
        }
        if (n.kind !== 'contract' || n.users.length < 2)
          return n
        const outside = n.users.filter(id => !included.has(id))
        const sharedNote
          = outside.length === 1
            ? `「${work.stories[outside[0]].title}」也在用`
            : outside.length
              ? `另有 ${outside.length} 个功能使用`
              : `${n.users.length} 个功能共用`
        return { ...n, sharedNote }
      })
    let edges = fullGraph.edges
    if (scoped) {
      // A shared interface can lead to several consumers. Accept a wire only
      // when one selected feature actually contains both of its endpoints.
      edges = fullGraph.edges.filter(
        e => e.target !== '@delivery' && featureSlices.some(slice => slice.has(e.source) && slice.has(e.target)),
      )
      const sources = new Set(edges.map(e => e.source))
      for (const n of viewNodes) {
        if (n.id !== '@delivery' && !sources.has(n.id)) {
          edges.push({ source: n.id, target: '@delivery', mode: 'normal', label: '', decision: '', choice: '' })
        }
      }
    }
    graph = { ...fullGraph, nodes: viewNodes, edges }
    nodes = new Map(viewNodes.map(n => [n.id, n]))
  }

  function refreshFeatures(changeUrl = true) {
    if (selected)
      closePanel(false, changeUrl)
    const search = $('feature-query')
    const term = search.value.trim()
    const words = term.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean)
    const matches = storyIds.filter(id => words.every(word => searchable.get(id).includes(word)))
    const ids = words.length ? matches : picks.size ? storyIds.filter(id => picks.has(id)) : storyIds
    selectGraph(ids)
    for (const [id, btn] of chipButtons) {
      btn.hidden = Boolean(words.length) && !matches.includes(id)
      btn.setAttribute('aria-pressed', String(picks.has(id)))
    }
    $('all-features').setAttribute('aria-pressed', String(!picks.size && !words.length))
    $('feature-count').textContent
      = `${(words.length ? '匹配 ' : picks.size ? '已选 ' : '显示 ') + ids.length} / ${storyIds.length}`
    const empty = Boolean(words.length) && !ids.length
    $('empty-search').hidden = !empty
    $('empty-label').textContent = empty ? `没有匹配「${term}」的功能点` : ''
    map.style.visibility = empty ? 'hidden' : 'visible'
    map.setAttribute('aria-hidden', String(empty))
    document.querySelector('.app').classList.toggle('no-results', empty)
    $('export').setAttribute('aria-disabled', String(empty))
    $('export').title = empty ? '当前没有匹配的功能点，清空搜索或更换关键词后可导出' : '保存当前显示的节点与连线为 SVG'
    $('export-caption').textContent = scoped ? '导出当前图' : '导出整图'
    const ai = $('ai-record')
    const contextParams = new URLSearchParams()
    if (csrf && scoped && !empty) {
      for (const id of ids) contextParams.append('story', id)
    }
    const contextQuery = contextParams.toString()
    ai.href = contextQuery ? `/context?${contextQuery}` : 'model.json'
    ai.title = contextQuery ? '读取当前功能的 AI 记录' : '读取完整需求的 AI 记录'
    if (changeUrl) {
      const url = new URL(location.href)
      url.searchParams.delete('q')
      url.searchParams.delete('features')
      for (const [k, v] of new URLSearchParams(filterQuery())) url.searchParams.set(k, v)
      recordHash(url.href)
    }
    roomy = undefined
    layout = null
    layouts.clear()
    if (empty) {
      for (const id of ['wires', 'wire-labels', 'stations']) $(id).replaceChildren()
      nodeEls.clear()
      edgeEls.length = 0
      return
    }
    onResize(true)
  }

  function initializeFeatures() {
    const search = $('feature-query')
    $('feature-bar').hidden = !storyIds.length
    for (const id of storyIds) {
      const btn = html('button', $('feature-list'), work.stories[id].title, 'feature-chip')
      btn.type = 'button'
      btn.setAttribute('aria-label', work.stories[id].title)
      chipButtons.set(id, btn)
      btn.onclick = () => {
        if (picks.has(id))
          picks.delete(id)
        else picks.add(id)
        search.value = ''
        refreshFeatures()
      }
    }
    $('all-features').setAttribute('aria-label', '全部功能')
    $('all-features').onclick = () => {
      picks.clear()
      search.value = ''
      refreshFeatures()
    }
    $('clear-search').onclick = () => {
      search.value = ''
      refreshFeatures()
      search.focus()
    }
    search.addEventListener('input', (event) => {
      if (!event.isComposing)
        refreshFeatures()
    })
    search.addEventListener('compositionend', () => refreshFeatures())
    readFilters()
    refreshFeatures(false)
    window.addEventListener('popstate', () => {
      readFilters()
      refreshFeatures(false)
      route()
    })
  }

  initializeFeatures()
  route()
  new ResizeObserver(onResize).observe(map)
})()
