import fs from 'node:fs'
import path from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { expect, it } from 'vitest'

interface Item { id: string, title: string, text: string }
interface Result { id: string, score: number, terms: string[] }

function loadSearch(wordSegmenter = true) {
  const context = createContext({ Intl: wordSegmenter ? Intl : { Segmenter: undefined } })
  context.window = context
  const assets = path.resolve('roles/requirement-flow/skills/requirement-flow/reader/assets')
  runInContext(fs.readFileSync(path.join(assets, 'vendor/minisearch.umd.js'), 'utf8'), context)
  let builds = 0
  context.MiniSearch = new Proxy(context.MiniSearch, {
    construct(target, args) {
      builds++
      return Reflect.construct(target, args)
    },
  })
  runInContext(fs.readFileSync(path.join(assets, 'search.js'), 'utf8'), context)
  return {
    search: context.RequirementSearch.search as (items: readonly Item[], query: string) => Result[],
    builds: () => builds,
  }
}

const { search } = loadSearch()

it('finds Chinese body-only words and ranks title matches before body matches', () => {
  const items = [
    { id: 'body', title: '办理说明', text: '库存申请需要原发起人确认，保留苔痕凭条。' },
    { id: 'title', title: '库存申请', text: '提交与取消。' },
  ]
  expect(search(items, '库存 申请').map(item => item.id)).toEqual(['title', 'body'])
  expect(search(items, '苔痕凭条').map(item => item.id)).toEqual(['body'])
})

it('supports English prefixes and a small typo without fuzzing short contract codes', () => {
  const items = [{ id: 'r12', title: 'R12 cancel API', text: '原单保持不变。' }]
  expect(search(items, 'can').map(item => item.id)).toEqual(['r12'])
  expect(search(items, 'cancal').map(item => item.id)).toEqual(['r12'])
  expect(search(items, 'cancal')[0].terms).toEqual(['cancel'])
  expect(search(items, 'api').map(item => item.id)).toEqual(['r12'])
  expect(search(items, 'R13')).toEqual([])
  expect(search(items, 'APJ')).toEqual([])
})

it('uses only the supplied current texts and does not retain changed or deleted content', () => {
  const before = Object.freeze([{ id: 'key', title: '钥匙例外', text: '苔痕凭条。' }])
  expect(search(before, '苔痕凭条').map(item => item.id)).toEqual(['key'])
  const after = [{ id: 'key', title: '钥匙例外', text: '夜班新凭条。' }]
  expect(search(after, '苔痕凭条')).toEqual([])
  expect(search(after, '夜班新凭条').map(item => item.id)).toEqual(['key'])
  expect(search([], '夜班新凭条')).toEqual([])
  expect(before[0].text).toBe('苔痕凭条。')
})

it('returns no results for empty or unmatched queries', () => {
  const items = [{ id: 'task', title: '库存任务', text: '' }]
  for (const query of ['', '  ', '。', '不可索引示例'])
    expect(search(items, query)).toEqual([])
})

it('keeps Chinese and English searchable without Intl.Segmenter', () => {
  const { search: fallback } = loadSearch(false)
  const items = [{ id: 'task', title: '库存申请 API库存', text: '钥匙例外。' }]
  expect(fallback(items, '库存申请').map(item => item.id)).toEqual(['task'])
  expect(fallback(items, '钥匙').map(item => item.id)).toEqual(['task'])
  expect(fallback(items, 'API').map(item => item.id)).toEqual(['task'])
})

it('reuses one index across queries and equivalent collections, and releases it for empty input', () => {
  const cached = loadSearch()
  const items = [
    { id: 'first', title: '库存申请', text: '苔痕凭条。' },
    { id: 'second', title: '夜班规则', text: '夜班新凭条。' },
  ]
  expect(cached.search(items, '库存').map(item => item.id)).toEqual(['first'])
  expect(cached.search(items.map(item => ({ ...item })).reverse(), '夜班').map(item => item.id)).toEqual(['second'])
  expect(cached.search(items, '苔痕凭条').map(item => item.id)).toEqual(['first'])
  expect(cached.builds()).toBe(1)
  expect(cached.search([], '苔痕凭条')).toEqual([])
  expect(cached.search(items, '库存').map(item => item.id)).toEqual(['first'])
  expect(cached.builds()).toBe(2)
})

it('copies snapshot fields and rebuilds for in-place body, title and membership changes', () => {
  const cached = loadSearch()
  const items = [{ id: 'key', title: 'oldpolicy', text: 'mossreceipt' }]
  expect(cached.search(items, 'mossreceipt').map(item => item.id)).toEqual(['key'])
  expect(cached.builds()).toBe(1)
  items[0].text = 'nightreceipt'
  expect(cached.search(items, 'mossreceipt')).toEqual([])
  expect(cached.search(items, 'nightreceipt').map(item => item.id)).toEqual(['key'])
  expect(cached.builds()).toBe(2)
  items[0].title = 'newpolicy'
  expect(cached.search(items, 'oldpolicy')).toEqual([])
  expect(cached.search(items, 'newpolicy').map(item => item.id)).toEqual(['key'])
  expect(cached.builds()).toBe(3)
  items.push({ id: 'new', title: '柜台说明', text: 'dawnreceipt' })
  expect(cached.search(items, 'dawnreceipt').map(item => item.id)).toEqual(['new'])
  expect(cached.builds()).toBe(4)
  items.splice(0, 1)
  expect(cached.search(items, 'nightreceipt')).toEqual([])
  expect(cached.search(items, 'newpolicy')).toEqual([])
  expect(cached.search(items, 'dawnreceipt').map(item => item.id)).toEqual(['new'])
  expect(cached.builds()).toBe(5)
})

it('rejects duplicate ids without reusing a removed entry or corrupting the last valid index', () => {
  const cached = loadSearch()
  const items = [
    { id: 'first', title: 'firstpolicy', text: 'firstreceipt' },
    { id: 'second', title: 'secondpolicy', text: 'secondreceipt' },
  ]
  expect(cached.search(items, 'secondreceipt').map(item => item.id)).toEqual(['second'])
  expect(() => cached.search([items[0], { ...items[0] }], 'secondreceipt')).toThrow()
  expect(cached.search(items, 'secondreceipt').map(item => item.id)).toEqual(['second'])
  expect(cached.search(items, 'firstreceipt').map(item => item.id)).toEqual(['first'])
})
