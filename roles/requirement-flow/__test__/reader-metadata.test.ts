import { spawnSync } from 'node:child_process'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const worker = fileURLToPath(new URL('../skills/requirement-flow/reader/metadata.mjs', import.meta.url))

it('extracts the rendered Markdown links and first visible heading in one offline process', () => {
  const inputs = [
    '# 当前 **规则**\n\n[[现状] 退款期限](rules.md)\n[\\[现状\\] 退款](escaped.md)',
    '[退款][ref   label]\n\n[ref label]: first.md\n[ref  label]: second.md',
    '<!--\n# 旧标题\n[旧规](old.md)\n-->\n\n# 新标题\n\n    [示例](demo.md)\n\n```md\n[示例](fence.md)\n```\n\n[规则](rules.md)',
    '[库存](stock&notes.md)\n[退款](handbook.html?view=detail&notices=1&q=甲#node=退款)\n[普通](handbook.html?view=detail&amp;q=甲)\n[二层](handbook.html?view=detail&amp;amp;q=甲)\n[编码](stock%26notes.md?q=%26%2F)',
    '<script><h1>bad</h1><a href="bad.md">bad</a></script>\n<template><h1>bad</h1><a href="bad.md">bad</a></template>\n<svg><foreignObject><h1>bad</h1><a href="bad.md">bad</a></foreignObject></svg>\n\n# good\n\n![图](picture.png)\n\n- [x] [规则](rules.md)',
  ]
  const result = spawnSync(process.execPath, [worker], {
    input: `${inputs.map(source => JSON.stringify({ source })).join('\n')}\n`,
    encoding: 'utf8',
    cwd: os.tmpdir(),
    timeout: 10_000,
  })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout.trim().split('\n').map(line => JSON.parse(line))).toEqual([
    { title: '当前 规则', links: [['[现状] 退款期限', 'rules.md'], ['[现状] 退款', 'escaped.md']] },
    { title: '', links: [['退款', 'first.md']] },
    { title: '新标题', links: [['规则', 'rules.md']] },
    {
      title: '',
      links: [
        ['库存', 'stock&notes.md'],
        ['退款', 'handbook.html?view=detail&notices=1&q=%E7%94%B2#node=%E9%80%80%E6%AC%BE'],
        ['普通', 'handbook.html?view=detail&q=%E7%94%B2'],
        ['二层', 'handbook.html?view=detail&amp;q=%E7%94%B2'],
        ['编码', 'stock%26notes.md?q=%26%2F'],
      ],
    },
    { title: 'good', links: [['图片：图', 'picture.png'], ['规则', 'rules.md']] },
  ])
})

it('returns one generic error per malformed request, then keeps processing valid Markdown', () => {
  const result = spawnSync(process.execPath, [worker], {
    input: 'private-body-with-invalid-json\n{"source":null}\n{"source":"# 正常"}\n',
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout.trim().split('\n').map(line => JSON.parse(line))).toEqual([
    { error: 'Markdown metadata unavailable' },
    { error: 'Markdown metadata unavailable' },
    { title: '正常', links: [] },
  ])
  expect(result.stdout).not.toContain('private-body')
})

it('excludes hidden subtrees from headings and links while preserving visible entries', () => {
  const inputs = ['hidden', 'hidden="false"', 'hidden="until-found"'].map(attribute => (
    `<div ${attribute}><h1>废弃退款标题</h1><a href="retired.md">过期业务链接</a><span>UNPUBLISHEDREFUND</span></div>\n\n# 本季度<span hidden>旧版</span>退款\n\n[当季规则](current.md)\n[显式入口](retired.md)`
  ))
  const result = spawnSync(process.execPath, [worker], {
    input: `${inputs.map(source => JSON.stringify({ source })).join('\n')}\n`,
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout.trim().split('\n').map(line => JSON.parse(line))).toEqual(inputs.map(() => ({
    title: '本季度退款',
    links: [['当季规则', 'current.md'], ['显式入口', 'retired.md']],
  })))
})

it('keeps line and block text boundaries without splitting inline emphasis', () => {
  const inputs = [
    '# Ware**house**<br>App*roval*\n\n[Ware**house**<br>App*roval*](rules.md)\n\n[Ware**house**App*roval*](inline.md)\n\n<div><a href="blocks.md"><div>Warehouse</div><div>Approval</div></a></div>',
    '# Ware**house**App*roval*',
  ]
  const result = spawnSync(process.execPath, [worker], {
    input: `${inputs.map(source => JSON.stringify({ source })).join('\n')}\n`,
    encoding: 'utf8',
    timeout: 10_000,
  })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.stdout.trim().split('\n').map(line => JSON.parse(line))).toEqual([
    {
      title: 'Warehouse Approval',
      links: [['Warehouse Approval', 'rules.md'], ['WarehouseApproval', 'inline.md'], ['Warehouse Approval', 'blocks.md']],
    },
    { title: 'WarehouseApproval', links: [] },
  ])
})
