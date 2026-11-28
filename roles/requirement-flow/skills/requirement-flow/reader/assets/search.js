(() => {
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'word' })
    : null
  let index
  let snapshot = new Map()

  function tokenize(text) {
    if (segmenter)
      return [...segmenter.segment(text)].filter(part => part.isWordLike).map(part => part.segment)
    // shortcut: without Intl.Segmenter, Han matches by character; add a tokenizer if word precision is needed there.
    return (text.match(/[\p{L}\p{N}]+/gu) || [])
      .flatMap(word => word.match(/\p{Script=Han}|\P{Script=Han}+/gu) || [])
  }

  window.RequirementSearch = {
    search(items, query) {
      if (!items.length) {
        index = undefined
        snapshot.clear()
        return []
      }
      if (!query.trim())
        return []
      const ids = new Set()
      const unchanged = snapshot.size === items.length && items.every(({ id, title, text }) => {
        if (ids.has(id))
          return false
        ids.add(id)
        const previous = snapshot.get(id)
        return previous?.title === title && previous.text === text
      })
      if (!index || !unchanged) {
        const records = items.map(({ id, title, text }) => ({ id, title, text }))
        const next = new window.MiniSearch({
          fields: ['title', 'text'],
          tokenize,
          searchOptions: {
            boost: { title: 4 },
            combineWith: 'AND',
            prefix: true,
            fuzzy: term => /^[a-z]{5,}$/iu.test(term) ? 0.2 : false,
            maxFuzzy: 1,
          },
        })
        next.addAll(records)
        index = next
        snapshot = new Map(records.map(item => [item.id, item]))
      }
      return index.search(query).map(({ id, score, terms }) => ({ id, score, terms }))
    },
  }
})()
