(() => {
  'use strict'

  const root = document.documentElement
  const storageKey = 'requirement-flow:theme'
  const system = matchMedia('(prefers-color-scheme: dark)')
  const icons = {
    dark: '<path d="M20.8 14A8.9 8.9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  }
  const buttons = []
  let override = null

  function readPreference() {
    try {
      const saved = localStorage.getItem(storageKey)
      override = saved === 'light' || saved === 'dark' ? saved : null
    }
    catch { /* The current page can still switch when storage is unavailable. */ }
  }

  function otherTheme(theme) {
    return theme === 'dark' ? 'light' : 'dark'
  }

  function setButtonAction(button, theme) {
    const next = otherTheme(theme)
    const label = next === 'light' ? '切换到浅色主题' : '切换到深色主题'
    button.setAttribute('aria-label', label)
    button.title = label
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[next]}</svg>`
  }

  function applyTheme() {
    const theme = override ?? (system.matches ? 'dark' : 'light')
    if (root.dataset.theme === theme)
      return
    root.dataset.theme = theme
    for (const button of buttons) setButtonAction(button, theme)
    window.dispatchEvent(new Event('flow-theme-change'))
  }

  readPreference()
  applyTheme()
  system.addEventListener('change', applyTheme)
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null)
      return
    readPreference()
    applyTheme()
  })
  window.addEventListener('pageshow', (event) => {
    if (event.persisted)
      readPreference()
    applyTheme()
  })
  document.addEventListener('DOMContentLoaded', () => {
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      buttons.push(button)
      setButtonAction(button, root.dataset.theme)
      button.addEventListener('click', () => {
        override = otherTheme(root.dataset.theme)
        try {
          localStorage.setItem(storageKey, override)
        }
        catch { /* Keep the choice for this page. */ }
        applyTheme()
      })
      button.hidden = false
    }
  })
})()
