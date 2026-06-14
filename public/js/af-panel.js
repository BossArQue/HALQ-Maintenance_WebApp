/* ============================================
   FILE: af-panel.js
   PATH: public/js/af-panel.js
   VERSION: 2.1.0
   DESCRIPTION: AppFolio panel — new-tab launcher with URL bar, tabs, and WO search.
   ============================================ */
(function () {
  'use strict'

  // ── State ──
  const S = {
    baseUrl: '',
    tabs: []
  }

  // ── DOM refs ──
  let $ = {}

  function cache () {
    $ = {
      panel:      document.getElementById('appfolio-panel'),
      urlBar:     document.getElementById('af-url'),
      tabs:       document.getElementById('af-tabs'),
      tabsWrap:   document.querySelector('.af-tabs-wrap'),
      arrowLeft:  document.getElementById('tabs-arrow-left'),
      arrowRight: document.getElementById('tabs-arrow-right'),
      tabMain:    document.getElementById('tab-main')
    }
  }

  // ── Exports ──
  const API = {
    get baseUrl () { return S.baseUrl },
    set baseUrl (v) { S.baseUrl = v; _persistBaseUrl() },

    init,
    navTo, navBack, navForward, navReload,
    addTab, switchToTab, closeTab, scrollTabs,
    updateTabArrows,
    autoSearchWO,
    applyUrl
  }

  HALQ.af = API

  // ── Init ──
  async function init () {
    cache()
    _loadBaseUrl()
    if ($.tabMain) {
      $.tabMain.dataset.url = S.baseUrl
      $.tabMain.onclick = () => switchToTab($.tabMain)
    }
    if ($.urlBar) {
      $.urlBar.value = S.baseUrl
      $.urlBar.addEventListener('keydown', e => {
        if (e.key === 'Enter') navTo($.urlBar.value)
      })
    }
    updateTabArrows()
  }

  // ── Base URL persistence (non-sensitive, localStorage OK) ──
  function _persistBaseUrl () {
    try { localStorage.setItem('halq_af_baseurl', S.baseUrl) } catch (_) {}
  }

  function _loadBaseUrl () {
    try { S.baseUrl = localStorage.getItem('halq_af_baseurl') || '' } catch (_) {}
  }

  // =====================
  // NAVIGATION
  // =====================

  function navBack ()    { /* No webview history in v2 — browser handles it */ }
  function navForward () { /* No webview history in v2 — browser handles it */ }
  function navReload ()  {
    const active = document.querySelector('.af-tab.active')
    if (active?.dataset?.url) navTo(active.dataset.url)
  }

  function navTo (url) {
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    if ($.urlBar) $.urlBar.value = url
    const active = document.querySelector('.af-tab.active')
    if (active) active.dataset.url = url
    window.open(url, '_blank')
  }

  function applyUrl (url) {
    if (!url) return
    try { S.baseUrl = new URL(url).origin } catch (_) { S.baseUrl = url }
    _persistBaseUrl()
    if ($.tabMain && !$.tabMain.dataset.url) {
      $.tabMain.dataset.url = S.baseUrl
      if ($.urlBar && !$.urlBar.value) $.urlBar.value = S.baseUrl
    }
  }

  // =====================
  // AUTO-SEARCH WO
  // =====================

  function autoSearchWO (wo) {
    const woSearch = wo.wo.split('-')[0]
    const url = S.baseUrl
      ? `${S.baseUrl}/search/advanced_search?full_text_search=${encodeURIComponent(woSearch)}&section_keys=work_orders`
      : ''
    if (!url) {
      HALQ.showDebug('AppFolio base URL not set. Please enter your AppFolio URL in the bar above.')
      return
    }
    navTo(url)
  }

  // =====================
  // TABS
  // =====================

  function _nextTabNum () {
    const nums = Array.from(document.querySelectorAll('.af-tab'))
      .map(t => {
        const m = (t.querySelector('span:first-child')?.textContent || '').match(/^New Tab (\d+)$/)
        return m ? parseInt(m[1]) : 0
      })
    return Math.max(0, ...nums) + 1
  }

  function switchToTab (tab) {
    document.querySelectorAll('.af-tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    const url = tab.dataset.url || ''
    if ($.urlBar) $.urlBar.value = url
    updateTabArrows()
  }

  function addTab (url) {
    let label = 'New Tab ' + _nextTabNum()
    try { if (url) label = new URL(url).hostname.replace('www.', '') } catch (_) {}

    const tab = document.createElement('div')
    tab.className   = 'af-tab'
    tab.dataset.url = url || ''
    tab.innerHTML   = `<span title="${ntE(url || '')}">${ntE(label)}</span><span class="af-tab-close" onclick="HALQ.af.closeTab(event,this)">✕</span>`
    tab.onclick     = function (e) {
      if (e.target.classList.contains('af-tab-close')) return
      switchToTab(tab)
      tab.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }

    const newBtn = $.tabs.querySelector('.af-new-tab')
    if (newBtn) $.tabs.insertBefore(tab, newBtn)
    else $.tabs.appendChild(tab)
    switchToTab(tab)
    tab.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    updateTabArrows()
  }

  function closeTab (e, btn) {
    e.stopPropagation()
    const tab     = btn.parentElement
    const allTabs = Array.from($.tabs.querySelectorAll('.af-tab'))
    const idx     = allTabs.indexOf(tab)
    const wasActive = tab.classList.contains('active')
    tab.remove()

    if (wasActive) {
      const remaining = Array.from($.tabs.querySelectorAll('.af-tab'))
      if (remaining.length) {
        const next = remaining[Math.min(idx, remaining.length - 1)]
        switchToTab(next)
      } else {
        if ($.urlBar) $.urlBar.value = ''
      }
    }
    updateTabArrows()
  }

  function scrollTabs (dir) {
    $.tabs.scrollBy({ left: dir * 120, behavior: 'smooth' })
    setTimeout(updateTabArrows, 200)
  }

  function updateTabArrows () {
    if (!$.arrowLeft || !$.arrowRight || !$.tabs) return
    $.arrowLeft.classList.toggle('disabled',  $.tabs.scrollLeft <= 0)
    $.arrowRight.classList.toggle('disabled', $.tabs.scrollLeft + $.tabs.clientWidth >= $.tabs.scrollWidth - 2)
  }

  // ── Utility ──
  function ntE (s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

})()