// =====================
// EMAIL PANEL — Outlook Web Webview
// Registers: HALQ.email
// Mirrors Appfolio tab pattern exactly
// =====================
(function () {
  'use strict'

  // ── State ──
  let emViewReady = false

  // ── DOM refs ──
  let $ = {}

  function cache () {
    $ = {
      view:       document.getElementById('email-view'),
      urlBar:     document.getElementById('em-url'),
      tabs:       document.getElementById('em-tabs'),
      arrowLeft:  document.getElementById('em-tabs-arrow-left'),
      arrowRight: document.getElementById('em-tabs-arrow-right'),
      tabMain:    document.getElementById('em-tab-main')
    }
  }

  // ── Exports ──
  const API = {
    init,
    refresh:    emRefresh,
    navBack:    emNavBack,
    navForward: emNavForward,
    navTo:      emNavTo,
    addTab:     emAddTab,
    switchToTab: emSwitchToTab,
    closeTab:   emCloseTab,
    scrollTabs: emScrollTabs
  }

  HALQ.email = API

  // ── Init ──
  function init () {
    if (emViewReady) return
    emViewReady = true
    cache()
    if (!$.$view) return

    $.$view.addEventListener('did-navigate', (e) => {
      $.urlBar.value = e.url
      _updateActiveTabUrl(e.url)
    })
    $.$view.addEventListener('did-navigate-in-page', (e) => {
      $.urlBar.value = e.url
      _updateActiveTabUrl(e.url)
    })
    $.$view.addEventListener('did-start-loading', () => {
      document.querySelectorAll('#em-tabs .af-tab.active').forEach(t => t.classList.add('loading'))
    })
    $.$view.addEventListener('did-stop-loading', () => {
      document.querySelectorAll('#em-tabs .af-tab').forEach(t => t.classList.remove('loading'))
      const url = emGetView()?.getURL?.() || ''
      if (url) $.urlBar.value = url
      _updateActiveTabUrl(url)
    })
    $.$view.addEventListener('new-window', (e) => { emAddTab(e.url) })
  }

  function emGetView () { return document.getElementById('email-view') }

  // =====================
  // NAVIGATION
  // =====================

  function emRefresh ()    { emGetView()?.reload() }
  function emNavBack ()    { emGetView()?.goBack() }
  function emNavForward () { emGetView()?.goForward() }

  function emNavTo (url) {
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    $.urlBar.value = url
    emGetView()?.loadURL(url)
    _updateActiveTabUrl(url)
  }

  function _updateActiveTabUrl (url) {
    const active = document.querySelector('#em-tabs .af-tab.active')
    if (active) active.dataset.url = url || ''
  }

  // =====================
  // TABS
  // =====================

  function emSwitchToTab (el) {
    document.querySelectorAll('#em-tabs .af-tab').forEach(t => t.classList.remove('active'))
    el.classList.add('active')
    const url = el.dataset.url || 'https://outlook.office.com/mail'
    $.urlBar.value = url
    emGetView()?.loadURL(url)
  }

  function emAddTab (url) {
    url = url || 'https://outlook.office.com/mail'
    const tabs   = $.tabs
    const newBtn = tabs.querySelector('.af-new-tab')
    const tab    = document.createElement('div')
    tab.className   = 'af-tab'
    tab.dataset.url = url
    tab.innerHTML   = `<span title="${url}">✉ Outlook</span><span class="af-tab-close" onclick="HALQ.email.closeTab(event,this)">✕</span>`
    tab.onclick     = () => emSwitchToTab(tab)
    tabs.insertBefore(tab, newBtn)
    emSwitchToTab(tab)
  }

  function emCloseTab (e, closeBtn) {
    e.stopPropagation()
    const tab  = closeBtn.parentElement
    const tabs = $.tabs
    const all  = [...tabs.querySelectorAll('.af-tab')]
    if (all.length <= 1) return
    const idx  = all.indexOf(tab)
    tab.remove()
    const remaining = [...tabs.querySelectorAll('.af-tab')]
    const next = remaining[Math.min(idx, remaining.length - 1)]
    if (next) emSwitchToTab(next)
  }

  function emScrollTabs (dir) {
    $.tabs.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

})()