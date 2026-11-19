;(() => {
  'use strict'
  const $ = id => document.getElementById(id)
  const { model, states, impacts, graph: fullGraph, csrf, queue, lesson_version: lessonVersion, source_labels: sourceLabels = {} } = JSON.parse($('data').textContent)
  const { work, protocol } = model
  const research = work.outcome === 'research'
  const evidenceKind = research ? '调研' : '验证'
  const map = $('map')
  const app = document.querySelector('.app')
  const drawerLayer = $('drawer-layer')
  const drawer = $('inspector')
  const reopenPanel = $('reopen-panel')
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
  let viewPreference = null
  let chainNodes = new Map()
  let graph = fullGraph
  let nodes = new Map()
  let visibleActions = new Set()
  let visibleStories = []
  let scoped = false
  const canvasPaper = '#f8f8f4'
  const styles = {
    request: { fill: '#193c4a', stroke: '#193c4a', title: '#fffdf5', text: '#cce4e2', icon: '#9ad4c5' },
    story: { fill: '#edf3f9', stroke: '#718b9f', title: '#1c3d57', text: '#425d70', icon: '#395f81' },
    decision: { fill: '#fbf2e1', stroke: '#a6814e', title: '#603e1c', text: '#765734', icon: '#855624' },
    contract: { fill: '#e7f3ed', stroke: '#668c80', title: '#174a45', text: '#385f57', icon: '#246d61' },
    research: { fill: '#eaf3f2', stroke: '#668a88', title: '#244b50', text: '#446065', icon: '#346a6c' },
    develop: { fill: '#eff2f3', stroke: '#7d8d96', title: '#293e4c', text: '#4d5f69', icon: '#4d6675' },
    verify: { fill: '#f2edf7', stroke: '#907d9b', title: '#493852', text: '#67546e', icon: '#795b87' },
    delivery: { fill: '#e8eeeb', stroke: '#738981', title: '#304a43', text: '#486358', icon: '#4c6a60' },
  }
  const statusColors = {
    passed: { fill: '#d8ebdd', ink: '#24593a' },
    pending: { fill: '#f8e8c9', ink: '#714b17' },
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
    normal: '#65808a',
    story: '#6484a0',
    done: '#537e70',
    possible: '#a16c2d',
    chosen: '#83531e',
    skipped: '#7c8986',
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
      // Cards keep a consistent reading width at each zoom.
      const width = n.kind === 'request' ? 228 : isOverview() ? 198 : n.kind === 'decision' ? 238 : 216
      const labels = linesOf(n.title, width - 2 * inset, 2, size, 680, n.mono)
      const caps = linesOf(n.caption, width - 2 * inset, 1, 11.7, 450)
      const shared = linesOf(n.sharedNote, width - 2 * inset, 1, 11.2, 600)
      const height = Math.max(isOverview() ? 74 : 78, 36 + 18 * labels.length + (caps.length ? 14 : 0) + (shared.length ? 17 : 0))
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
        'd': 'M1 1 7 4 1 7Z',
        'fill': color,
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
      ranksep: dir === 'TB' ? 66 : 76,
      nodesep: dir === 'TB' ? 44 : 36,
      edgesep: 20,
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
    routeWires(result)
    layouts.set(dir, result)
    return result
  }
  function routeWires(result) {
    // Dagre supplies clear passages between cards, including waypoints beside
    // intervening ranks on long dependencies. Turn only in the gutters.
    const across = result.dir === 'LR'
    const along = across ? 'x' : 'y'
    const cross = across ? 'y' : 'x'
    const depth = across ? 'width' : 'height'
    const breadth = across ? 'height' : 'width'
    const rankDepth = new Map()
    const ports = new Map()
    const gutters = new Map()
    const reserve = obj => rankDepth.set(obj[along], Math.max(rankDepth.get(obj[along]) || 0, obj[depth] / 2))
    for (const card of result.positions.values()) reserve(card)
    for (const route of result.routes) {
      if (Number.isFinite(route[along]))
        reserve(route)
    }

    const anchors = result.routes.map((route, i) => {
      const edge = graph.edges[i]
      const from = result.positions.get(edge.source)
      const to = result.positions.get(edge.target)
      const sign = Math.sign(to[along] - from[along])
      if (!sign || route.points.length < 3)
        return null
      const middle = route.points.slice(1, -1)
      const ends = [[edge.source, from, sign, middle[0]], [edge.target, to, -sign, middle.at(-1)]]
      const [start, end] = ends.map(([id, card, side, neighbor], j) => {
        const paper = { ...card }
        const face = JSON.stringify([id, side])
        if (!ports.has(face))
          ports.set(face, [])
        ports.get(face).push({ paper, toward: neighbor[cross], tie: j ? from[cross] : to[cross] })
        return paper
      })
      return [start, ...middle, end]
    })
    // Even at a busy junction an arrow meets the flat part of its card.
    for (const face of ports.values()) {
      face.sort((a, b) => a.toward - b.toward || a.tie - b.tie)
      const step = Math.min(12, Math.max(0, face[0].paper[breadth] - 32) / Math.max(1, face.length - 1))
      face.forEach(({ paper }, j) => {
        paper[cross] += (j - (face.length - 1) / 2) * step
      })
    }

    const legs = anchors.map(points => points && points.slice(1).map((next, i) => {
      const prev = points[i]
      const lo = Math.min(prev[along], next[along])
      const hi = Math.max(prev[along], next[along])
      const left = lo + (rankDepth.get(lo) || 0)
      const right = hi - (rankDepth.get(hi) || 0)
      const leg = { turn: (left + right) / 2, left, right, low: Math.min(prev[cross], next[cross]), high: Math.max(prev[cross], next[cross]) }
      if (leg.low !== leg.high) {
        const key = JSON.stringify([lo, hi])
        if (!gutters.has(key))
          gutters.set(key, [])
        gutters.get(key).push(leg)
      }
      return leg
    }))
    // Give overlapping transverse segments separate tracks. Disjoint
    // branches can reuse the same track without suggesting a connection.
    for (const group of gutters.values()) {
      const last = []
      group.sort((a, b) => a.low - b.low || a.high - b.high)
      for (const leg of group) {
        let lane = last.findIndex(end => end + 5 < leg.low)
        if (lane < 0)
          lane = last.length
        last[lane] = leg.high
        leg.lane = lane
      }
      const space = Math.max(0, group[0].right - group[0].left - 12)
      const step = Math.min(8, space / Math.max(1, last.length - 1))
      for (const leg of group) leg.turn += (leg.lane - (last.length - 1) / 2) * step
    }
    anchors.forEach((points, i) => {
      if (!points)
        return
      const end = points.at(-1)
      const start = points[0]
      const sign = Math.sign(end[along] - start[along])
      const turns = []
      const add = (u, v) => {
        const point = { [along]: u, [cross]: v }
        const last = turns.at(-1)
        if (last && last.x === point.x && last.y === point.y)
          return
        const prev = turns.at(-2)
        if (prev && ((prev.x === last.x && last.x === point.x) || (prev.y === last.y && last.y === point.y)))
          turns.pop()
        turns.push(point)
      }
      add(start[along] + sign * (start[depth] / 2 + 1), start[cross])
      for (const [j, leg] of legs[i].entries()) {
        add(leg.turn, points[j][cross])
        add(leg.turn, points[j + 1][cross])
        if (j < legs[i].length - 1)
          add(points[j + 1][along], points[j + 1][cross])
      }
      add(end[along] - sign * (end[depth] / 2 + 2.5), end[cross])
      result.routes[i].points = turns
    })
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
      const r = Math.min(7, ab / 2, bc / 2)
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
  let cameraMode = 'reading'
  let gestureLocked = true
  let selected = null
  let recentNode = null
  let drawerTrigger = null
  let returningFocus = false
  let drawerVersion = 0
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
    const d = rounded(route.points)
    // A narrow background stroke gives a crossing a visible overpass in the SVG export too.
    svg('path', { 'd': d, 'class': 'map-line', 'stroke': canvasPaper, 'stroke-width': 5.5 }, group)
    const at = {
      'd': d,
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
          'fill': e.mode === 'skipped' ? styles.develop.fill : styles.decision.fill,
          'stroke': e.mode === 'skipped' ? styles.develop.stroke : styles.decision.stroke,
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
          'fill': e.mode === 'skipped' ? styles.develop.text : styles.decision.text,
        },
        label,
        e.label,
      )
    }
    edgeEls.push([group, label])
  }
  function isOverview() {
    if (!storyIds.length)
      return false
    if (viewPreference)
      return viewPreference === 'overview'
    return !picks.size && !$('feature-query').value.trim()
  }

  function overviewLayout() {
    const rootBox = boxes.get('@request')
    const cardWidth = boxes.get(visibleStories[0]).width
    const pitch = cardWidth + 34
    const columns = Math.min(visibleStories.length, Math.max(1, Math.min(3, Math.floor((boxSize.w - 8) / pitch))))
    const width = Math.max(rootBox.width + 24, columns * pitch + 6)
    const root = { x: width / 2, y: 12 + rootBox.height / 2 }
    const positions = new Map([['@request', root]])
    const branches = []
    let top = root.y + rootBox.height / 2 + 29
    for (let i = 0; i < visibleStories.length; i += columns) {
      const row = visibleStories.slice(i, i + columns)
      const rowHeight = Math.max(...row.map(id => boxes.get(id).height))
      row.forEach((id, col) => {
        const b = boxes.get(id)
        const left = columns === 2 && col === 0
        const x = columns === 2
          ? root.x + (left ? -1 : 1) * (b.width / 2 + 15)
          : (width - columns * pitch) / 2 + (col + 0.5) * pitch + 6
        const y = top + rowHeight / 2
        positions.set(id, { x, y })
        const end = x + (left ? 1 : -1) * b.width / 2
        branches.push({ y, end, rail: columns === 2 ? root.x : end - 15 })
      })
      top += rowHeight + 14
    }
    return { dir: 'TB', width, height: top, positions, branches }
  }

  function drawOverviewWires() {
    const { positions, branches } = layout
    const root = positions.get('@request')
    const bottom = root.y + boxes.get('@request').height / 2
    const joint = bottom + 14
    const attrs = { 'class': 'map-line', 'stroke': lineColors.normal, 'stroke-width': 1.7 }
    const base = $('wires')
    const rails = new Map()
    for (const { rail, y } of branches) rails.set(rail, y)
    svg('path', { ...attrs, d: `M${root.x} ${bottom}V${joint}` }, base)
    const xs = [root.x, ...rails.keys()]
    svg('path', { ...attrs, d: `M${Math.min(...xs)} ${joint}H${Math.max(...xs)}` }, base)
    for (const [x, lastY] of rails)
      svg('path', { ...attrs, d: `M${x} ${joint}V${lastY}` }, base)
    const junctions = new Set()
    for (const { rail, y, end } of branches) {
      const line = svg('path', { ...attrs, class: 'map-edge map-line', d: `M${rail} ${y}H${end}` }, base)
      if (!junctions.has(`${rail},${y}`))
        svg('circle', { cx: rail, cy: y, r: 2.3, fill: attrs.stroke }, base)
      junctions.add(`${rail},${y}`)
      edgeEls.push([line])
    }
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
        'aria-controls': 'inspector',
        'aria-expanded': 'false',
        'data-node': n.id,
        'transform': `translate(${p.x} ${p.y})`,
      },
      $('stations'),
    )
    svg('title', {}, g, [n.title, n.state, n.caption, n.sharedNote].filter(Boolean).join(' · '))
    const x = -b.width / 2
    const y = -b.height / 2
    const groupColor = n.activity === 'active' ? '#28746a' : c.stroke
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
      const right = -x - b.inset
      const progress = n.kind === 'story' && n.state.match(/^(\d+)\/(\d+) 已验$/)
      let badge
      if (progress)
        badge = progress[1] === progress[2] ? statusColors.passed : statusColors.pending
      else if (['待你决定', '待核对', '需复核', '待验'].includes(n.state) || (n.kind === 'verify' && n.activity === 'ready'))
        badge = statusColors.pending
      if (badge) {
        const width = widthOf(n.state, 10.5, 600) + 10
        svg('rect', { x: right - width + 4, y: y + 5, width, height: 18, rx: 5, fill: badge.fill }, g)
      }
      if (n.activity === 'active')
        svg('circle', { cx: right - widthOf(n.state, 10.5, 600) - 6, cy: y + 14.6, r: 2.5, fill: '#28746a' }, g)
      const ink = badge?.ink || (n.activity === 'done' ? statusColors.passed.ink : c.text)
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
        openPanel(n.id, true, g)
    })
    g.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        openPanel(n.id, true, g)
      }
    })
    nodeEls.set(n.id, g)
  }
  function fittedScale(l) {
    const margin = boxSize.w < 500 ? 9 : 17
    return Math.min(Math.max(1, boxSize.w - margin * 2) / l.width, Math.max(1, boxSize.h - margin * 2) / l.height, 1)
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
    const previous = layout
    boxSize = { w: rect.width, h: rect.height }
    measureBoxes(boxSize.w > 840)
    let next
    if (isOverview()) {
      next = overviewLayout()
    }
    else {
      const down = makeLayout('TB')
      const across = makeLayout('LR')
      next = fittedScale(across) > fittedScale(down) * 1.08 ? across : down
    }
    if (layout !== next) {
      layout = next
      nodeEls.clear()
      edgeEls.length = 0
      for (const id of ['wires', 'wire-labels', 'stations']) $(id).replaceChildren()
      if (isOverview())
        drawOverviewWires()
      else graph.edges.forEach(drawWire)
      graph.nodes.forEach(drawNode)
    }
    fitted = fittedScale(layout)
    if (!previous || force === true) {
      // A new filter starts at its entrance. A whole-map thumbnail does not carry across views.
      readingPosition(cameraMode === 'fit' ? 1 : camera.scale)
    }
    else if (cameraMode === 'fit') {
      fit()
    }
    else if (cameraMode === 'reading') {
      readingPosition(camera.scale)
    }
    else if (previous !== layout) {
      // Anchor the same card when wrapping columns or rotating the diagram.
      anchorCamera(previous)
      updateCamera()
    }
    else {
      updateCamera()
    }
    if (selected)
      highlight(selected)
  }
  function anchorCamera(previous) {
    const distance = p => Math.hypot(p.x - camera.x, p.y - camera.y)
    const [id, before] = [...previous.positions].reduce((best, entry) =>
      distance(entry[1]) < distance(best[1]) ? entry : best)
    const after = layout.positions.get(id)
    camera.x += after.x - before.x
    camera.y += after.y - before.y
  }
  function readingPosition(scale = 1) {
    if (!layout)
      return
    cameraMode = 'reading'
    const entry = layout.positions.get('@request')
    const top = boxSize.h / (2 * scale)
    camera = { x: layout.width / 2, y: top, scale }
    if (!isOverview() && entry) {
      if (layout.dir === 'LR') {
        camera.x = Math.min(boxSize.w / (2 * scale), layout.width / 2)
        camera.y = entry.y
      }
      else {
        camera.x = entry.x
      }
    }
    updateCamera()
  }
  function fit() {
    if (!layout)
      return
    cameraMode = 'fit'
    camera = { x: layout.width / 2, y: layout.height / 2, scale: fitted }
    updateCamera()
  }
  function updateCamera() {
    const w = boxSize.w / camera.scale
    const h = boxSize.h / camera.scale
    if (layout && cameraMode === 'manual') {
      const margin = 24 / camera.scale
      function withinContent(value, viewport, content) {
        const start = viewport / 2 - margin
        const end = content - viewport / 2 + margin
        return Math.max(Math.min(start, end), Math.min(Math.max(start, end), value))
      }
      camera.x = withinContent(camera.x, w, layout.width)
      camera.y = withinContent(camera.y, h, layout.height)
    }
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
    return Math.min(0.25, fitted)
  }
  function maxZoom() {
    return 3
  }
  function zoom(ratio, px = boxSize.w / 2, py = boxSize.h / 2) {
    if (!layout)
      return
    const old = camera.scale
    const next = Math.min(maxZoom(), Math.max(minZoom(), old * ratio))
    if (next === old) {
      updateCamera()
      return
    }
    cameraMode = 'manual'
    camera.x += (px - boxSize.w / 2) * (1 / old - 1 / next)
    camera.y += (py - boxSize.h / 2) * (1 / old - 1 / next)
    camera.scale = next
    updateCamera()
  }
  function highlight(key) {
    const related = new Set([key])
    const tracedEdges = new Set()
    // Traverse each direction separately; a shared endpoint must not pull in a sibling story.
    for (const forward of [true, false]) {
      const pending = [key]
      const seen = new Set(pending)
      while (pending.length) {
        const curr = pending.pop()
        graph.edges.forEach((e, i) => {
          if ((forward ? e.source : e.target) !== curr)
            return
          tracedEdges.add(i)
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
    edgeEls.forEach((items, i) => {
      const traced = tracedEdges.has(i)
      for (const el of items) {
        if (!el)
          continue
        el.classList.toggle('muted', !traced)
        if (traced)
          el.parentNode.append(el)
      }
    })
  }
  function reveal(key) {
    const p = layout?.positions.get(key)
    if (!p)
      return
    const { width, height } = boxes.get(key)
    function shift(pos, center, span, cardSize) {
      const target = (pos - center) * camera.scale + span / 2
      const margin = Math.min(span / 2, cardSize * camera.scale / 2 + 12)
      const safe = Math.max(margin, Math.min(span - margin, target))
      return (target - safe) / camera.scale
    }
    camera.x += shift(p.x, camera.x, boxSize.w, width)
    camera.y += shift(p.y, camera.y, boxSize.h, height)
    updateCamera()
  }
  map.addEventListener('focusin', (event) => {
    const card = event.target.closest('[data-node]')
    if (!returningFocus && card?.matches(':focus-visible'))
      reveal(card.dataset.node)
  })
  const pointers = new Map()
  let pinch = null
  let dragging = false
  function twoPoints() {
    const [a, b] = [...pointers.values()]
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }
  map.addEventListener('pointerdown', (e) => {
    if ((e.button !== 0 && e.pointerType === 'mouse') || pointers.size >= 2)
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
    cameraMode = 'manual'
    map.classList.add('dragging')
    if (!map.hasPointerCapture(e.pointerId))
      map.setPointerCapture(e.pointerId)
    if (pointers.size === 2 && pinch) {
      const next = twoPoints()
      const rect = map.getBoundingClientRect()
      camera.x -= (next.x - pinch.x) / camera.scale
      camera.y -= (next.y - pinch.y) / camera.scale
      if (gestureLocked)
        updateCamera()
      else zoom(next.dist / pinch.dist, next.x - rect.left, next.y - rect.top)
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
      if (!layout)
        return
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? boxSize.h : 1
      if (gestureLocked) {
        // Touchpad pinch is delivered as Ctrl+wheel by Chromium and Firefox.
        if (e.ctrlKey || e.metaKey)
          return
        cameraMode = 'manual'
        camera.x += (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit / camera.scale
        camera.y += (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit / camera.scale
        updateCamera()
        return
      }
      const r = map.getBoundingClientRect()
      zoom(Math.exp(Math.max(-0.6, Math.min(0.6, -e.deltaY * unit * 0.002))), e.clientX - r.left, e.clientY - r.top)
    },
    { passive: false },
  )
  $('plus').onclick = () => zoom(1.25)
  $('minus').onclick = () => zoom(0.8)
  $('scale').onclick = () => {
    closePanel(false)
    readingPosition()
  }
  // Safari on macOS reports trackpad pinches as gesture events.
  let gestureScale = 1
  map.addEventListener('gesturestart', (e) => {
    e.preventDefault()
    gestureScale = e.scale
  }, { passive: false })
  map.addEventListener('gesturechange', (e) => {
    e.preventDefault()
    if (!gestureLocked && pointers.size < 2 && gestureScale > 0 && e.scale > 0) {
      const rect = map.getBoundingClientRect()
      const x = Number.isFinite(e.clientX) ? e.clientX - rect.left : boxSize.w / 2
      const y = Number.isFinite(e.clientY) ? e.clientY - rect.top : boxSize.h / 2
      zoom(e.scale / gestureScale, x, y)
    }
    gestureScale = e.scale
  }, { passive: false })
  map.addEventListener('gestureend', e => e.preventDefault(), { passive: false })

  const lock = $('zoom-lock')
  const lockKey = 'airules.requirement-flow.gesture-lock'
  try {
    gestureLocked = localStorage.getItem(lockKey) !== 'off'
  }
  catch { /* Storage can be disabled for offline handbooks. */ }
  function showLock() {
    lock.setAttribute('aria-pressed', String(gestureLocked))
    lock.title = gestureLocked ? '手势缩放已锁定，点击后允许滚轮和双指缩放' : '手势缩放已开启，点击锁定当前比例'
  }
  showLock()
  lock.onclick = () => {
    gestureLocked = !gestureLocked
    showLock()
    try {
      localStorage.setItem(lockKey, gestureLocked ? 'on' : 'off')
    }
    catch { /* The switch remains usable without storage. */ }
  }
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
      cameraMode = 'manual'
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
  const sourceEditors = { webstorm: 'WebStorm', vscode: 'VS Code' }
  const editorKey = 'requirement-flow-editor'
  let preferredEditor = 'webstorm'
  try {
    // A new serve session can use a different port on the same loopback host.
    const stored = document.cookie.split('; ').find(value => value.startsWith(`${editorKey}=`))?.slice(editorKey.length + 1) || localStorage.getItem(editorKey)
    if (Object.hasOwn(sourceEditors, stored))
      preferredEditor = stored
  }
  catch { /* Storage can be unavailable for local files. */ }

  function setEditorLink(link) {
    const url = link.dataset[preferredEditor]
    if (url) {
      link.href = url
      link.title = `在 ${sourceEditors[preferredEditor]} 中打开 ${link.dataset.ref}`
    }
    else {
      link.removeAttribute('href')
      link.title = '所选编辑器没有此文件的打开链接，可复制文件引用'
    }
  }
  function sourceEditorPicker(group) {
    const label = html('label', group, '打开文件使用', 'source-editor-label')
    const select = html('select', label, null, 'source-editor')
    for (const [id, name] of Object.entries(sourceEditors)) html('option', select, name).value = id
    select.value = preferredEditor
    select.onchange = () => {
      preferredEditor = select.value
      try {
        localStorage.setItem(editorKey, preferredEditor)
        document.cookie = `${editorKey}=${preferredEditor}; Path=/; Max-Age=31536000; SameSite=Strict`
      }
      catch { /* Keep using the choice for this page. */ }
      for (const picker of document.querySelectorAll('select.source-editor')) picker.value = preferredEditor
      for (const link of document.querySelectorAll('.source-open')) setEditorLink(link)
    }
  }
  function sourceFilename(ref) {
    // Descriptive prose, schemes and references outside the project remain plain text.
    if (/^[\\/]|[:\\]\/\/|[\p{Cc}<>"|?*]/u.test(ref))
      return ''
    const parts = ref.split(/[/\\]/u)
    if (parts.some(part => !part || part === '..') || parts.slice(0, -1).some(part => part.includes(':')))
      return ''
    const name = parts.at(-1)
    return /^(?:[^:]+\.[\p{L}\d_-]+|Makefile|Dockerfile|LICENSE|README)(?::\d+(?::\d+)?(?:-\d+)?)?$/u.test(name) ? name : ''
  }
  async function copySource(button, ref, file) {
    try {
      await navigator.clipboard.writeText(ref)
      button.textContent = '已复制'
    }
    catch {
      file.open = true
      let input = file.querySelector('input.source-manual-copy')
      if (!input) {
        input = html('input', file, null, 'source-manual-copy')
        input.readOnly = true
        input.setAttribute('aria-label', '手动复制文件引用')
        input.value = ref
      }
      input.focus()
      input.select()
      button.textContent = '请手动复制'
    }
  }
  function showFileSource(group, ref, name) {
    const row = html('div', group, null, 'source-entry')
    const file = disclosure(row, name)
    file.classList.add('source-file')
    html('p', file, ref, 'source-note')
    const actions = html('div', row, null, 'source-actions')
    const copy = html('button', actions, '复制')
    copy.type = 'button'
    copy.title = `复制文件引用 ${ref}`
    copy.setAttribute('aria-label', copy.title)
    copy.setAttribute('aria-live', 'polite')
    copy.onclick = () => copySource(copy, ref, file)
    if (!csrf)
      return
    const summary = file.querySelector('summary')
    let loading = false
    group.addEventListener('toggle', async () => {
      if (!group.open || loading)
        return
      loading = true
      try {
        const reply = await fetch(`/source-location?${new URLSearchParams({ ref })}`, {
          headers: { 'X-Requirement-Flow': csrf },
          cache: 'no-store',
          redirect: 'error',
        })
        if (!reply.ok)
          throw new Error('unavailable')
        const { editors, preview, line } = await reply.json()
        const choices = Object.entries(editors || {}).filter(([editor, value]) => {
          if (!Object.hasOwn(sourceEditors, editor) || typeof value !== 'string')
            return false
          try {
            const url = new URL(value)
            return url.protocol === `${editor}:` && url.host === (editor === 'webstorm' ? 'open' : 'file')
          }
          catch { return false }
        })
        if (choices.length) {
          const link = html('a', null, name, 'source-open')
          link.dataset.ref = ref
          for (const [editor, url] of choices) link.dataset[editor] = url
          setEditorLink(link)
          summary.replaceChildren(link)
        }
        if (preview?.lines?.length && Number.isSafeInteger(preview.startLine)) {
          const toggle = html('button', null, '预览')
          toggle.type = 'button'
          toggle.title = `预览 ${name} 附近的原文`
          toggle.setAttribute('aria-expanded', 'false')
          actions.prepend(toggle)
          const code = html('pre', file, null, 'source-preview')
          code.hidden = true
          for (const [offset, content] of preview.lines.entries()) {
            const number = preview.startLine + offset
            const codeLine = html('span', code, null, 'source-code-line')
            if (number === line)
              codeLine.classList.add('source-target-line')
            html('span', codeLine, number, 'source-line-number')
            html('span', codeLine, content)
          }
          toggle.onclick = () => {
            const show = !file.open || code.hidden
            if (show)
              file.open = true
            code.hidden = !show
            toggle.setAttribute('aria-expanded', String(show))
          }
          file.addEventListener('toggle', () => {
            if (!file.open) {
              code.hidden = true
              toggle.setAttribute('aria-expanded', 'false')
            }
          })
        }
        row.querySelector('.source-unavailable')?.remove()
      }
      catch {
        loading = false
        if (!file.querySelector('.source-unavailable'))
          html('p', file, '当前工作区无法定位此文件，可复制引用。', 'source-unavailable')
      }
    })
  }
  function showSources(parent, source, title = '涉及文件与依据', labels = sourceLabels) {
    const content = Array.isArray(source) ? source.join('\n') : String(source ?? '')
    const lines = content.split(/\r?\n/u).map(line => line.trim()).filter(Boolean)
    if (!lines.length)
      return
    const group = disclosure(parent, `${title}（${lines.length}）`)
    group.classList.add('source-list')
    if (csrf && lines.some(line => sourceFilename(line)))
      sourceEditorPicker(group)
    for (const original of lines) {
      const line = Object.hasOwn(labels, original) ? labels[original] : original
      if (/^https?:\/\/\S+$/iu.test(line)) {
        sourceLink(group, line, line)
        continue
      }
      const name = sourceFilename(line)
      if (name) {
        showFileSource(group, line, name)
      }
      else {
        html('p', group, line, 'source-note')
      }
    }
  }
  function showContractFields(parent, fields) {
    for (const field of fields) {
      const item = html('div', parent, null, 'contract-field')
      const heading = html('div', item, null, 'field-heading')
      html('code', heading, field.name)
      html('span', heading, field.type, 'field-type')
      html('p', item, field.use)
      html('p', item, field.constraint, 'field-constraint')
    }
  }
  const endpointRows = new Map()
  let activeEndpoint = null
  let displayedSearch = location.search
  // Keep the second dialog outside the inert graph and its parent dialog. Older offline shells can use it too.
  const endpointDrawer = html('dialog', document.body)
  endpointDrawer.id = 'endpoint-drawer'
  endpointDrawer.setAttribute('aria-labelledby', 'endpoint-title')
  endpointDrawer.setAttribute('aria-modal', 'true')
  const endpointBar = html('div', endpointDrawer, null, 'panelbar')
  const endpointBack = html('button', endpointBar, '← 接口列表', 'endpoint-back')
  endpointBack.type = 'button'
  const endpointClose = $('close-panel').cloneNode(true)
  endpointClose.id = 'endpoint-close'
  endpointClose.setAttribute('aria-label', '关闭接口详情')
  endpointClose.title = '关闭接口详情（Esc）'
  endpointBar.append(endpointClose)
  const endpointBody = html('div', endpointDrawer, null, 'endpoint-body')
  const endpointHeading = html('div', endpointBody, null, 'endpoint-heading')
  const endpointMethod = html('span', endpointHeading, null, 'endpoint-method')
  const endpointTitle = html('h2', endpointHeading)
  endpointTitle.id = 'endpoint-title'
  const endpointPath = html('code', endpointBody, null, 'endpoint-path')
  const endpointSources = html('div', endpointBody)
  const endpointTabs = html('div', endpointBody, null, 'endpoint-tabs')
  endpointTabs.setAttribute('role', 'group')
  endpointTabs.setAttribute('aria-label', '字段方向')
  const endpointFields = html('div', endpointBody)
  endpointFields.id = 'endpoint-fields'
  function showEndpointFields(endpoint, side) {
    for (const button of endpointTabs.children)
      button.setAttribute('aria-pressed', String(button.dataset.side === side))
    endpointFields.replaceChildren()
    const fields = endpoint[side]
    const note = endpoint[`${side}Note`]
    if (note || !fields.length)
      html('p', endpointFields, note || '字段未记录。', 'endpoint-note')
    showContractFields(endpointFields, fields)
  }
  function openEndpoint(row, navigate) {
    if (activeEndpoint?.button === row.button)
      return
    const { button, endpoint } = row
    activeEndpoint?.button.setAttribute('aria-expanded', 'false')
    activeEndpoint = { button, scrollTop: detail.scrollTop }
    endpointMethod.textContent = endpoint.method
    endpointTitle.textContent = endpoint.purpose || '用途待补充'
    endpointPath.textContent = endpoint.path
    endpointSources.replaceChildren()
    endpointTabs.replaceChildren()
    endpointFields.replaceChildren()
    endpointTabs.hidden = !endpoint.purpose
    if (endpoint.purpose) {
      showSources(endpointSources, endpoint.source, '接口依据')
      for (const [side, label] of [['request', '请求字段'], ['response', '响应字段']]) {
        const tab = html('button', endpointTabs, `${label}（${endpoint[side].length}）`)
        tab.type = 'button'
        tab.dataset.side = side
        tab.setAttribute('aria-controls', endpointFields.id)
        tab.onclick = () => {
          showEndpointFields(endpoint, side)
          endpointBody.scrollTop = 0
        }
      }
      showEndpointFields(endpoint, 'request')
    }
    else {
      html('p', endpointFields, '原记录的字段未按接口整理。', 'dim')
    }
    drawer.inert = true
    button.setAttribute('aria-expanded', 'true')
    if (!endpointDrawer.open)
      endpointDrawer.showModal()
    endpointBody.scrollTop = 0
    endpointClose.focus({ preventScroll: true })
    if (navigate) {
      const hash = `#node=${encodeURIComponent(selected)}&endpoint=${encodeURIComponent(row.key)}`
      try {
        history.pushState({ endpointHash: hash }, '', hash)
      }
      catch {
        // Some local readers restrict URL updates. The dialog still works.
      }
    }
  }
  function hideEndpoint(restoreFocus = true) {
    if (!activeEndpoint)
      return
    const { button, scrollTop } = activeEndpoint
    activeEndpoint = null
    button.setAttribute('aria-expanded', 'false')
    endpointDrawer.close()
    drawer.inert = false
    if (restoreFocus && button.isConnected) {
      detail.scrollTop = scrollTop
      button.focus({ preventScroll: true })
    }
  }
  function dismissEndpoint() {
    if (!activeEndpoint)
      return
    hideEndpoint()
    if (history.state?.endpointHash === location.hash)
      history.back()
    else
      recordHash(`#node=${encodeURIComponent(selected)}`)
  }
  endpointBack.onclick = endpointClose.onclick = dismissEndpoint
  endpointDrawer.addEventListener('cancel', (event) => {
    event.preventDefault()
    dismissEndpoint()
  })
  endpointDrawer.addEventListener('click', (event) => {
    if (event.target !== endpointDrawer)
      return
    const bounds = endpointDrawer.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
      dismissEndpoint()
  })
  function showEndpoint(parent, endpoint) {
    const button = html('button', parent, null, 'endpoint')
    button.type = 'button'
    button.setAttribute('aria-haspopup', 'dialog')
    button.setAttribute('aria-controls', endpointDrawer.id)
    button.setAttribute('aria-expanded', 'false')
    html('span', button, endpoint.method, 'endpoint-method')
    html('strong', button, endpoint.purpose || '用途待补充')
    html('code', button, endpoint.path, 'endpoint-path')
    const key = `${endpoint.method} ${endpoint.path}`
    const row = { key, button, endpoint }
    endpointRows.set(key, row)
    button.onclick = () => openEndpoint(row, true)
  }
  function showContract(parent, contract) {
    const endpoints = new Map((contract.endpoints || []).map(endpoint => [`${endpoint.method} ${endpoint.path}`, endpoint]))
    const notes = []
    for (const line of (contract.operation || '').split(/\r?\n/u).map(line => line.trim()).filter(Boolean)) {
      const match = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+((?:\/|https?:\/\/)\S*)$/iu.exec(line)
      if (!match) {
        notes.push(line)
        continue
      }
      const method = match[1].toUpperCase()
      const path = match[2]
      const key = `${method} ${path}`
      if (!endpoints.has(key))
        endpoints.set(key, { method, path })
    }
    if (endpoints.size) {
      const group = section(`接口（${endpoints.size}）`, parent)
      group.classList.add('endpoint-list')
      for (const endpoint of endpoints.values()) showEndpoint(group, endpoint)
    }
    for (const note of notes) {
      if (!endpoints.size || note !== '调用与职责')
        html('p', parent, note)
    }
    if (contract.status)
      pairs(parent, [['核对情况', contract.status]])
    if (contract.fields.length) {
      const title = endpoints.size ? '契约字段与处理' : '字段与处理'
      showContractFields(disclosure(parent, `${title}（${contract.fields.length}）`), contract.fields)
    }
    else if (!endpoints.size) {
      html('p', parent, '接口字段待补充。', 'dim')
    }
  }
  function jump(parent, id, text) {
    const dest = graph.aliases[id] || id
    if (!chainNodes.has(dest))
      return
    const btn = html('button', parent, text || chainNodes.get(dest).title, 'link-button')
    btn.type = 'button'
    btn.onclick = () => openPanel(dest, true)
  }
  function related(parent, ids, title = '图中关联') {
    const destinations = [...new Set(ids.map(id => graph.aliases[id] || id))].filter(
      id => id !== selected && chainNodes.has(id),
    )
    if (destinations.length) {
      const group = disclosure(parent, `${title}（${destinations.length}）`)
      for (const id of destinations) jump(group, id)
    }
  }
  function showQueue(parent, actionIds, nodeIds) {
    const rows = []
    for (const item of queue.running) {
      if (actionIds.has(item.id))
        rows.push([item.id, `进行中 · ${item.actor}`, item.title])
    }
    for (const id of queue.ready) {
      if (actionIds.has(id))
        rows.push([id, '可以开始', work.actions[id].title])
    }
    for (const item of queue.pending_decisions) {
      if (nodeIds.has(item.id))
        rows.push([item.id, '待决定', item.title])
    }
    for (const item of queue.technical_blockers) {
      if (item.kind === 'contract' && item.actions.some(id => actionIds.has(id)))
        rows.push([item.id, '待核对接口', item.title])
    }
    if (!rows.length) {
      for (const id of actionIds) {
        if (!['done', 'skipped'].includes(states[id].state))
          rows.push([id, activeName[states[id].state], work.actions[id].title])
      }
    }
    if (!rows.length)
      return
    const group = disclosure(parent, `待办工作（${rows.length}）`)
    for (const [id, status, title] of rows) {
      const row = html('div', group, null, 'record queue-item')
      html('span', row, status, 'dim')
      jump(row, id, title)
    }
  }
  function events(parent, history) {
    if (scoped) {
      history = history.filter(
        e =>
          visibleActions.has(e.action)
          || chainNodes.has(e.decision)
          || (e.changed || []).some(id => chainNodes.has(id) || visibleActions.has(id)),
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
        ['环境', e.environment],
        ['证据类型', e.level],
      ])
      showSources(item, e.evidence, '记录依据')
    }
  }
  const proofLevels = { 自动化: '自动化测试', 人工核对: '人工核对', 真实环境: '真实环境' }
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
    showSources(row, source.current_basis, '来源文件', {})
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
      const group = disclosure(parent, `${title}（${cards.length}）`)
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
  function actionCaseScope(ex, id) {
    const result = states[id].cases[ex.id]
    const receipt = result?.receipt
    const level = proofLevels[receipt?.level] || receipt?.level || ''
    if (result?.accepted)
      return level ? `${level}通过` : '已验证'
    if (result?.invalid_receipt)
      return '证据无效，需补验'
    if (result?.status === 'stale')
      return '条件已变，需重验'
    if (result?.status === 'failed')
      return `${level}未通过`
    if (result?.status === 'captured')
      return `${level}已有证据，待确认`
    if (states[id].state === 'dormant')
      return '待确认是否适用'
    const levels = (work.actions[id].accepts || []).map(value => proofLevels[value] || value)
    return `${levels.join('或')}待验证`
  }
  function caseScope(ex) {
    if (ex.status === 'uncovered') {
      const skipped = Object.entries(work.actions).some(([id, a]) => a.covers?.includes(ex.id) && states[id].state === 'skipped')
      if (ex.retirement)
        return '范围已变，待确认'
      return skipped ? '原验证已跳过，需安排验证' : '待安排验证'
    }
    return [...new Set(ex.actions.map(id => actionCaseScope(ex, id)))].join(' · ')
  }
  function showCaseProof(row, ex) {
    const more = disclosure(row, ex.receipts.length ? `验收依据 · ${ex.receipts.length}` : '场景说明')
    more.classList.add('case-proof')
    pairs(more, [
      ['场景编号', ex.id],
      ['前提', ex.given],
      ['操作', ex.when],
      ['预期结果', ex.then],
      ['判定', ex.reason],
    ])
    for (const action of ex.actions) jump(more, action, work.actions[action].title)
    for (const receipt of ex.receipts) {
      const item = html('div', more, null, 'record')
      html('strong', item, `回执 ${receipt.id}`)
      pairs(item, [
        ['验证方式', proofLevels[receipt.level] || receipt.level],
        ['环境', receipt.environment],
        ['记录人', receipt.actor],
        ['判定', states[receipt.action].cases[ex.id]?.accepted ? '已用于本项验收' : receipt.reason],
        ['命令参数', receipt.argv && JSON.stringify(receipt.argv)],
        ['实际结果', receipt.actual],
        ['退出码', receipt.exit_code],
        ['文件', receipt.artifact?.path],
        ['SHA-256', receipt.artifact?.sha256],
      ])
      const path = receipt.artifact?.path
      if (typeof path === 'string' && /^evidence\/[\da-f]{32}\/(?:output\.log|artifact(?:\.[\w-]+)?)$/u.test(path)) {
        const link = html('a', item, '下载证据文件', 'link-button')
        link.href = csrf ? `/evidence/${encodeURIComponent(receipt.id)}` : `./${path}`
        link.download = path.split('/').pop()
      }
    }
  }
  function showScenarios(parent, cases) {
    if (!cases.length)
      return
    const report = section('验收结果', parent)
    report.classList.add('acceptance-report')
    for (const [kind, heading] of [['open', '待跟进'], ['passed', '已验证']]) {
      const rows = cases.filter(ex => (ex.status === 'passed') === (kind === 'passed'))
      if (!rows.length)
        continue
      const group = html('div', report, null, 'acceptance-group')
      group.dataset.state = kind
      const awaitingProof = kind === 'open' && rows.every(ex => ex.status === 'pending' && !ex.receipts.length)
      html('h4', group, `${awaitingProof ? '待验证' : heading} · ${rows.length} 项`)
      for (const ex of rows) {
        const row = html('div', group, null, 'case-row')
        row.dataset.status = ex.status
        html('strong', row, ex.when, 'case-title')
        const scope = html('span', row, caseScope(ex), 'case-scope')
        const environments = [...new Set(ex.receipts.map(proof => proof.environment).filter(Boolean))]
        if (environments.length)
          scope.title = environments.join(' / ')
        html('p', row, kind === 'open' ? `预期：${ex.then}` : ex.then, 'case-outcome')
        showCaseProof(row, ex)
      }
    }
  }
  function showRetiredScenarios(parent, storyIds) {
    const retired = (queue.retired_scenarios || []).filter(ex => storyIds.includes(ex.story))
    if (!retired.length)
      return
    const group = disclosure(parent, `验收范围调整 · ${retired.length} 条`)
    for (const ex of retired) {
      const row = html('div', group, null, 'record')
      html('strong', row, ex.when)
      pairs(row, [
        ['范围决定', `v${ex.revision} 移出验收 · ${ex.option.label}`],
        ['场景编号', ex.id],
        ['前提', ex.given],
        ['原预期结果', ex.then],
        ['决定人', ex.answer.actor],
        ['调整原因', ex.answer.reason],
      ])
      jump(row, ex.decision, work.decisions[ex.decision].title)
    }
  }
  function workDetails(parent, key) {
    const a = work.actions[key]
    const status = states[key]
    const records = work.events.filter(e => e.action === key)
    const proof = records.find(e => e.id === status.proof)
    if (a.kind === '验证') {
      const cases = queue.scenarios.filter(ex => ex.actions.includes(key))
      if (cases.length)
        showScenarios(parent, cases)
      else html('p', parent, '尚未关联验收场景。', 'dim')
    }
    else if (proof?.output) {
      html('p', parent, proof.output)
    }
    pairs(parent, [
      ['完成条件', a.done],
      ['验收方式', a.accepts?.join('、')],
    ])
    if (status.reasons.length)
      list(section('开始前需要', parent), status.reasons)
    showSources(parent, proof?.evidence)
    const input = a.depends_on.map((edge) => {
      const cond = edge.when
      return (
        work.actions[edge.id].title + (cond ? `（${work.decisions[cond.decision].options[cond.is].label}时）` : '')
      )
    })
    if (input.length)
      list(disclosure(parent, `前置工作（${input.length}）`), input)
    related(parent, [...a.stories, ...a.read_stories, ...a.contracts, ...a.decisions], '关联功能、接口与决定')
    showLessons(parent, [...a.stories, ...a.read_stories])
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
    endpointRows.clear()
    const showState = n.state && n.kind !== 'story' && (n.kind !== 'contract' || n.state !== work.contracts[key].status)
    $('panel-type').textContent = showState ? `${n.label} · ${n.state}` : n.label
    $('panel-title').textContent = n.kind === 'contract' ? work.contracts[key].title : n.title
    if (n.kind === 'request') {
      html('p', detail, work.goal || work.raw_request)
      if (work.goal && work.raw_request && work.raw_request !== work.goal)
        html('p', disclosure(detail, '需求原话'), work.raw_request)
      if (work.scope.length)
        list(disclosure(detail, '本次范围'), work.scope)
      jump(detail, '@delivery', research ? '查看调研结论' : '查看验收结果')
      related(detail, visibleStories, '涉及功能')
      showQueue(detail, visibleActions, chainNodes)
      showLessons(detail, visibleStories, { all: !scoped })
      protocolDetail(detail)
      events(detail, work.events)
    }
    else if (n.kind === 'story') {
      const story = work.stories[key]
      if (story.goal)
        html('p', detail, story.goal, 'story-goal')
      const cases = queue.scenarios.filter(ex => ex.story === key)
      if (cases.length)
        showScenarios(detail, cases)
      else if (!research)
        html('p', detail, '当前没有验收场景。', 'dim')
      const more = html('div', detail, null, 'story-tools')
      if (isOverview()) {
        const inspect = html('button', more, '查看实现链路', 'inspect-feature')
        inspect.type = 'button'
        inspect.onclick = () => {
          viewPreference = 'detail'
          picks.clear()
          picks.add(key)
          $('feature-query').value = ''
          refreshFeatures()
          map.focus({ preventScroll: true })
        }
      }
      showSources(more, story.basis)
      if (story.actor || story.before || story.flow?.length) {
        const rules = disclosure(more, '业务规则')
        pairs(rules, [['角色', story.actor], ['前置条件', story.before]])
        if (story.flow?.length)
          list(rules, story.flow, true)
      }
      showLessons(more, [key])
      showQueue(more, new Set(fullGraph.features[key].actions), featureNodes.get(key))
      showRetiredScenarios(more, [key])
      const refs = Object.entries(work.actions).filter(([, a]) => a.stories.includes(key))
      related(
        more,
        refs.flatMap(([id, a]) => [id, ...a.contracts, ...a.decisions]),
      )
    }
    else if (n.kind === 'decision') {
      decisionDetail(key, detail)
    }
    else if (n.kind === 'contract') {
      const c = work.contracts[key]
      showContract(detail, c)
      const stories = n.users.filter(id => visibleStories.includes(id))
      related(detail, stories, '关联功能')
      showSources(detail, c.source)
      for (const id of n.research.filter(id => visibleActions.has(id)))
        workDetails(disclosure(detail, `关联调研 · ${work.actions[id].title}`), id)
      const users = Object.entries(work.actions)
        .filter(([, a]) => a.contracts.includes(key))
        .map(([id]) => id)
      related(detail, users, '使用这份契约的工作')
      showLessons(detail, stories)
    }
    else if (n.kind === 'delivery') {
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
          ])
          showSources(item, proof?.evidence)
        }
      }
      if (work.lessons.length) {
        const group = disclosure(detail, `历史经验记录（${work.lessons.length}）`)
        for (const l of work.lessons) {
          const more = disclosure(group, l.observation)
          pairs(more, [
            ['触发条件', l.when],
            ['做法', l.practice],
            ['适用边界', l.boundary],
            ['复核时机', l.review],
          ])
          showSources(more, l.evidence)
        }
      }
      showLessons(detail, visibleStories, { all: !scoped })
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
  function openPanel(key, changeHash, trigger) {
    if (isOverview() && !nodes.has(key) && chainNodes.has(key)) {
      viewPreference = 'detail'
      refreshFeatures(changeHash)
    }
    if (!nodes.has(key))
      return
    if (key !== selected)
      hideEndpoint(false)
    if (!selected)
      drawerTrigger = trigger || nodeEls.get(key)
    drawerVersion++
    selected = key
    const changed = recentNode !== key
    recentNode = key
    app.inert = true
    reopenPanel.hidden = true
    reopenPanel.setAttribute('aria-expanded', 'true')
    if (drawerLayer.hidden) {
      drawerLayer.hidden = false
      drawer.hidden = false
      // Establish the off-screen position before starting the entrance transition.
      drawer.getBoundingClientRect()
    }
    drawerLayer.classList.add('is-open')
    if (changed) {
      populate(key)
      detail.scrollTop = 0
    }
    reopenPanel.title = `展开详情 · ${nodes.get(key).title}`
    reopenPanel.setAttribute('aria-label', reopenPanel.title)
    highlight(key)
    if (changeHash)
      recordHash(`#node=${encodeURIComponent(key)}`)
    $('close-panel').focus({ preventScroll: true })
  }
  function closePanel(focus = true, changeHash = true) {
    if (!selected)
      return
    hideEndpoint(false)
    const previous = selected
    const closing = ++drawerVersion
    selected = null
    drawerLayer.classList.remove('is-open')
    reopenPanel.setAttribute('aria-expanded', 'false')
    for (const el of nodeEls.values()) {
      el.classList.remove('selected', 'muted')
      el.setAttribute('aria-expanded', 'false')
    }
    for (const items of edgeEls) {
      for (const el of items) el?.classList.remove('muted')
    }
    if (changeHash)
      recordHash('#work')
    function finishClose() {
      if (closing !== drawerVersion)
        return
      drawerLayer.hidden = true
      drawer.hidden = true
      app.inert = false
      reopenPanel.hidden = !recentNode
      const trigger = drawerTrigger?.isConnected ? drawerTrigger : nodeEls.get(previous)
      drawerTrigger = null
      returningFocus = true
      const target = focus && trigger ? trigger : map
      target.focus({ preventScroll: true })
      returningFocus = false
    }
    // Await only this drawer's exit. Reduced motion completes immediately.
    const animations = drawer.getAnimations?.() || []
    if (animations.length)
      Promise.allSettled(animations.map(animation => animation.finished)).then(finishClose)
    else finishClose()
  }
  function route() {
    let hash
    try {
      hash = decodeURIComponent(location.hash.slice(1))
    }
    catch {
      hash = ''
    }
    const params = new URLSearchParams(location.hash.slice(1))
    const key = params.get('node') || (hash.startsWith('contract-') ? hash.slice(9) : hash === 'agent' ? '@request' : null)
    if (key && chainNodes.has(key)) {
      if (key !== selected)
        openPanel(key, false)
      const requested = params.get('endpoint')
      const row = endpointRows.get(requested)
      if (row) {
        openEndpoint(row, false)
      }
      else {
        hideEndpoint()
        if (requested)
          recordHash(`#node=${encodeURIComponent(key)}`)
      }
    }
    else if (selected) {
      closePanel(false)
    }
  }
  $('close-panel').onclick = () => closePanel()
  reopenPanel.onclick = () => openPanel(recentNode, true, reopenPanel)
  $('drawer-backdrop').onclick = () => closePanel()
  function drawerTabStops(panel) {
    const candidates = panel.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')
    return [...candidates].filter((el) => {
      if (el.matches(':disabled, [tabindex="-1"]') || !el.getClientRects().length)
        return false
      // Chromium can report a rect for descendants of a closed native disclosure.
      for (let fold = el.closest('details:not([open])'); fold; fold = fold.parentElement.closest('details:not([open])')) {
        if (!fold.querySelector(':scope > summary')?.contains(el))
          return false
      }
      return true
    })
  }
  window.addEventListener('keydown', (e) => {
    if (drawerLayer.hidden || e.isComposing || e.defaultPrevented)
      return
    if (e.key === 'Escape') {
      e.preventDefault()
      if (e.repeat)
        return
      if (endpointDrawer.open)
        dismissEndpoint()
      else closePanel()
    }
    if (e.key !== 'Tab')
      return
    const topPanel = endpointDrawer.open ? endpointDrawer : drawer
    const stops = drawerTabStops(topPanel)
    const first = stops[0]
    const last = stops.at(-1)
    const active = document.activeElement
    if (!topPanel.contains(active) || (e.shiftKey ? active === first : active === last)) {
      e.preventDefault()
      const target = e.shiftKey ? last : first
      target?.focus({ preventScroll: true })
    }
  })
  window.addEventListener('hashchange', route)
  function exportMap() {
    if (!layout || $('export').getAttribute('aria-disabled') === 'true')
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
    const bg = svg('rect', { x: rect[0], y: rect[1], width: rect[2], height: rect[3], fill: canvasPaper })
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
    if (viewPreference)
      args.set('view', viewPreference)
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
    const view = url.searchParams.get('view')
    viewPreference = ['overview', 'detail'].includes(view) ? view : null
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
    chainNodes = new Map(viewNodes.map(n => [n.id, n]))
    if (isOverview()) {
      const shown = viewNodes.filter(n => n.kind === 'request' || n.kind === 'story').map((n) => {
        if (n.kind === 'story')
          return { ...n, label: '功能', caption: work.stories[n.id].goal || n.caption }
        const cases = queue.scenarios.filter(ex => included.has(ex.story))
        const passed = cases.filter(ex => ex.status === 'passed').length
        const counts = [`${ids.length} 个功能`]
        if (cases.length)
          counts.push(`${passed}/${cases.length} 个场景已验`)
        return { ...n, caption: counts.join(' · ') }
      })
      graph = { ...fullGraph, nodes: shown, edges: ids.map(target => ({ source: '@request', target, mode: 'story' })) }
    }
    else {
      graph = { ...fullGraph, nodes: viewNodes, edges }
    }
    nodes = new Map(graph.nodes.map(n => [n.id, n]))
  }

  function summarizeFilter(ids, term) {
    const toggle = $('filter-toggle')
    const badge = $('filter-badge')
    const active = Boolean(term || picks.size)
    let summary = '筛选功能'
    let description = `全部 ${storyIds.length} 个功能`
    if (term) {
      summary = term
      description = `搜索「${term}」，匹配 ${ids.length} 个功能`
    }
    else if (picks.size) {
      const titles = ids.map(id => work.stories[id].title)
      summary = picks.size === 1 ? titles[0] : '已选功能'
      description = `已选 ${ids.length} 个功能，${titles.join('、')}`
    }
    $('filter-summary').textContent = summary
    badge.hidden = !term && picks.size <= 1
    badge.textContent = badge.hidden ? '' : String(ids.length)
    toggle.dataset.filtered = String(active)
    toggle.title = `筛选功能 · ${description}`
    toggle.setAttribute('aria-label', `筛选功能，${description}`)
    $('filter-reset').hidden = !active
  }

  function refreshFeatures(changeUrl = true) {
    if (selected)
      closePanel(false, changeUrl)
    recentNode = null
    reopenPanel.hidden = true
    const search = $('feature-query')
    const term = search.value.trim()
    const words = term.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean)
    const matches = storyIds.filter(id => words.every(word => searchable.get(id).includes(word)))
    const ids = words.length ? matches : picks.size ? storyIds.filter(id => picks.has(id)) : storyIds
    selectGraph(ids)
    summarizeFilter(ids, term)
    $('map-modes').hidden = !storyIds.length
    $('overview-mode').setAttribute('aria-pressed', String(isOverview()))
    $('detail-mode').setAttribute('aria-pressed', String(!isOverview()))
    $('relation-label').textContent = isOverview() ? '包含功能' : '关联'
    $('branch-legend').hidden = !graph.edges.some(e => e.decision)
    for (const [id, btn] of chipButtons) {
      btn.hidden = Boolean(words.length) && !matches.includes(id)
      btn.setAttribute('aria-pressed', String(picks.has(id)))
    }
    $('all-features').setAttribute('aria-pressed', String(!picks.size && !words.length))
    $('feature-count').textContent
      = `${(words.length ? '匹配 ' : picks.size ? '已选 ' : '显示 ') + ids.length} / ${storyIds.length}`
    const empty = Boolean(words.length) && !ids.length
    $('filter-no-match').hidden = !empty
    $('empty-search').hidden = !empty
    $('empty-label').textContent = empty ? `没有匹配「${term}」的功能点` : ''
    map.style.visibility = empty ? 'hidden' : 'visible'
    map.setAttribute('aria-hidden', String(empty))
    document.querySelector('.app').classList.toggle('no-results', empty)
    $('export').setAttribute('aria-disabled', String(empty))
    $('export').title = empty ? '当前没有匹配的功能点，清空搜索或更换关键词后可导出' : '保存当前显示的节点与连线为 SVG'
    $('export-caption').textContent = isOverview() ? '导出总览' : scoped ? '导出当前图' : '导出整图'
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
      url.searchParams.delete('view')
      for (const [k, v] of new URLSearchParams(filterQuery())) url.searchParams.set(k, v)
      recordHash(url.href)
    }
    displayedSearch = location.search
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
    const bar = $('feature-bar')
    const toggle = $('filter-toggle')
    const popover = $('filter-popover')
    function closeFilter(restoreFocus = false) {
      if (popover.hidden)
        return
      popover.hidden = true
      toggle.setAttribute('aria-expanded', 'false')
      if (restoreFocus)
        toggle.focus({ preventScroll: true })
    }
    function openFilter() {
      popover.hidden = false
      toggle.setAttribute('aria-expanded', 'true')
      search.focus({ preventScroll: true })
    }
    toggle.onclick = () => popover.hidden ? openFilter() : closeFilter(true)
    $('filter-done').onclick = () => closeFilter(true)
    bar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.isComposing && !popover.hidden) {
        event.preventDefault()
        event.stopPropagation()
        closeFilter(true)
      }
    })
    bar.addEventListener('focusout', (event) => {
      if (event.relatedTarget && !bar.contains(event.relatedTarget))
        closeFilter()
    })
    document.addEventListener('pointerdown', (event) => {
      if (!bar.contains(event.target))
        closeFilter()
    }, true)
    for (const mode of ['overview', 'detail']) {
      $(`${mode}-mode`).onclick = () => {
        if ((mode === 'overview') === isOverview())
          return
        viewPreference = mode
        refreshFeatures()
      }
    }
    bar.hidden = !storyIds.length
    for (const id of storyIds) {
      const btn = html('button', $('feature-list'), work.stories[id].title, 'feature-chip')
      btn.type = 'button'
      btn.setAttribute('aria-label', work.stories[id].title)
      chipButtons.set(id, btn)
      btn.onclick = () => {
        viewPreference = null
        if (picks.has(id))
          picks.delete(id)
        else picks.add(id)
        search.value = ''
        refreshFeatures()
      }
    }
    $('all-features').setAttribute('aria-label', '全部功能')
    function resetFilter() {
      viewPreference = null
      picks.clear()
      search.value = ''
      refreshFeatures()
    }
    $('all-features').onclick = resetFilter
    $('filter-reset').onclick = () => {
      search.focus({ preventScroll: true })
      resetFilter()
    }
    $('clear-search').onclick = () => {
      viewPreference = null
      search.value = ''
      refreshFeatures()
      openFilter()
    }
    search.addEventListener('input', (event) => {
      viewPreference = null
      if (!event.isComposing)
        refreshFeatures()
    })
    search.addEventListener('compositionend', () => refreshFeatures())
    readFilters()
    refreshFeatures(false)
    window.addEventListener('popstate', () => {
      closeFilter()
      if (location.search !== displayedSearch) {
        readFilters()
        refreshFeatures(false)
      }
      route()
    })
  }

  initializeFeatures()
  route()
  new ResizeObserver(onResize).observe(map)
})()
