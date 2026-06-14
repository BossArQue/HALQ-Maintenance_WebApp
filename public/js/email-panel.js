/* ============================================
   FILE: email-panel.js
   PATH: public/js/email-panel.js
   VERSION: 2.1.0
   DESCRIPTION: Email panel — Outlook new-tab launcher with tabs and URL tracking.
   ============================================ */
(function () {
  'use strict'

  // ── State ──
  const S = {
    defaultUrl: 'https://outlook.office.com/mail',
    tabs: []
  }

  // ── DOM refs ──
  let $ = {}

  function cache () {
    $ = {
      panel:      document.getElementById('email-panel'),
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
    cache()
    if ($.tabMain) {
      $.tabMain.dataset.url = S.defaultUrl
      $.tabMain.onclick = () => emSwitchToTab($.tabMain)
    }
    if ($.urlBar) {
      $.urlBar.value = S.defaultUrl
      $.urlBar.addEventListener('keydown', e => {
        if (e.key === 'Enter') emNavTo($.urlBar.value)
      })
    }
  }

  // =====================
  // NAVIGATION
  // =====================

  function emRefresh () {
    const active = document.querySelector('#em-tabs .af-tab.active')
    if (active?.dataset?.url) emNavTo(active.dataset.url)
  }

  function emNavBack ()    { /* Browser handles history in new-tab mode */ }
  function emNavForward () { /* Browser handles history in new-tab mode */ }

  function emNavTo (url) {
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    $.urlBar.value = url
    const active = document.querySelector('#em-tabs .af-tab.active')
    if (active) active.dataset.url = url
    window.open(url, '_blank')
  }

  // =====================
  // TABS
  // =====================

  function emSwitchToTab (el) {
    document.querySelectorAll('#em-tabs .af-tab').forEach(t => t.classList.remove('active'))
    el.classList.add('active')
    const url = el.dataset.url || S.defaultUrl
    if ($.urlBar) $.urlBar.value = url
  }

  function emAddTab (url) {
    url = url || S.defaultUrl
    const tabs   = $.tabs
    const newBtn = tabs.querySelector('.af-new-tab')
    const tab    = document.createElement('div')
    tab.className   = 'af-tab'
    tab.dataset.url = url
    let label = '✉ Outlook'
    try { label = new URL(url).hostname.replace('www.', '') } catch (_) {}
    tab.innerHTML   = `<span title="${ntE(url)}">${ntE(label)}</span><span class="af-tab-close" onclick="HALQ.email.closeTab(event,this)">✕</span>`
    tab.onclick     = () => emSwitchToTab(tab)
    if (newBtn) tabs.insertBefore(tab, newBtn)
    else tabs.appendChild(tab)
    emSwitchToTab(tab)
  }

  function emCloseTab (e, closeBtn) {
    e.stopPropagation()
    const tab  = closeBtn.parentElement
    const tabs = $.tabs
    const all  = [...tabs.querySelectorAll('.af-tab')]
    if (all.length <= 1) return
    const idx  = all.indexOf(tab)
    const wasActive = tab.classList.contains('active')
    tab.remove()
    const remaining = [...tabs.querySelectorAll('.af-tab')]
    const next = remaining[Math.min(idx, remaining.length - 1)]
    if (next) emSwitchToTab(next)
    else if ($.urlBar) $.urlBar.value = ''
  }

  function emScrollTabs (dir) {
    $.tabs.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  // ── Utility ──
  function ntE (s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

})()