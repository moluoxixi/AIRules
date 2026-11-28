import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { runInNewContext } from 'node:vm'
import { parseFragment } from './assets/vendor/parse5.cjs'

const context = Object.create(null)
runInNewContext(readFileSync(new URL('./assets/vendor/marked.umd.js', import.meta.url), 'utf8'), context)
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char])
const markdown = new context.marked.Marked({
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

// Metadata only: the browser still sanitizes rendered HTML with DOMPurify.
const hiddenContent = new Set([
  'annotation-xml',
  'audio',
  'colgroup',
  'desc',
  'foreignobject',
  'head',
  'iframe',
  'math',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
  'script',
  'selectedcontent',
  'style',
  'svg',
  'template',
  'title',
  'video',
  'xmp',
])
const textBoundaries = new Set('br,hr,address,article,aside,blockquote,caption,dd,details,div,dl,dt,fieldset,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,legend,li,main,nav,ol,p,pre,section,summary,table,tbody,td,tfoot,th,thead,tr,ul'.split(','))
function visible(node) {
  return (!node.namespaceURI || node.namespaceURI === 'http://www.w3.org/1999/xhtml')
    && !hiddenContent.has(node.tagName)
    && !node.attrs?.some(attribute => attribute.name === 'hidden')
}
function text(node) {
  if (!visible(node))
    return ''
  const content = node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('')
  return textBoundaries.has(node.tagName) ? ` ${content} ` : content
}
function metadata(source) {
  const links = []
  let title = ''
  let foundHeading = false
  function visit(node) {
    if (!visible(node))
      return
    if (node.tagName === 'h1' && !foundHeading) {
      title = text(node).replace(/\s+/g, ' ').trim()
      foundHeading = true
    }
    if (node.tagName === 'a') {
      const href = node.attrs.find(attribute => attribute.name === 'href')?.value
      if (href !== undefined)
        links.push([text(node).replace(/\s+/g, ' ').trim(), href])
    }
    for (const child of node.childNodes || [])
      visit(child)
  }
  visit(parseFragment(markdown.parse(source)))
  return { title, links }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  try {
    const request = JSON.parse(line)
    if (typeof request?.source !== 'string')
      throw new TypeError('Expected Markdown')
    process.stdout.write(`${JSON.stringify(metadata(request.source))}\n`)
  }
  catch {
    process.stdout.write(`${JSON.stringify({ error: 'Markdown metadata unavailable' })}\n`)
  }
}
