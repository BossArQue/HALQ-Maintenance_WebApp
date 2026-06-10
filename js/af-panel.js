// =====================
// APPFOLIO PANEL — Webview, Tabs, Navigation, Auto-fill
// Registers: HALQ.af
// =====================
(function () {
  'use strict'

  // ── State ──
  const S = {
    baseUrl: '',
    viewReady: false
  }

  // ── DOM refs ──
  let $ = {}

  function cache () {
    $ = {
      view:       document.getElementById('appfolio-view'),
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
    set baseUrl (v) { S.baseUrl = v },

    init,
    navTo, navBack, navForward, navReload,
    addTab, switchToTab, closeTab, scrollTabs,
    updateTabArrows,
    autoSearchWO,
    applyUrl
  }

  HALQ.af = API

  // ── Init ──
  function init () {
    cache()
    if (!$.view) return

    $.view.addEventListener('did-navigate', e => {
      $.urlBar.value = e.url
    })
    $.view.addEventListener('did-navigate-in-page', e => {
      $.urlBar.value = e.url
    })
    $.view.addEventListener('did-start-loading', () => {
      document.querySelector('.af-tab.active')?.classList.add('loading')
    })
    $.view.addEventListener('did-stop-loading', () => {
      document.querySelectorAll('.af-tab').forEach(t => t.classList.remove('loading'))
      const active = document.querySelector('.af-tab.active')
      if (active) active.dataset.url = $.view.getURL()
      HALQ.autoFill.tryFill($.view)
    })
    $.view.addEventListener('focus', () => HALQ.wo.closeCtxMenu && HALQ.wo.closeCtxMenu())
    $.view.addEventListener('did-start-loading', () => HALQ.wo.closeCtxMenu && HALQ.wo.closeCtxMenu())

    updateTabArrows()

    // New tab from webview link
    window.halq.onNewTab(url => addTab(url))
  }

  // =====================
  // NAVIGATION
  // =====================

  function navBack ()    { $.view?.goBack() }
  function navForward () { $.view?.goForward() }
  function navReload ()  { $.view?.reload() }

  function navTo (url) {
    if (!url) return
    if (!url.startsWith('http')) url = 'https://' + url
    $.urlBar.value = url
    if ($.view) $.view.src = url
  }

  function applyUrl (url) {
    if (!url) return
    try { S.baseUrl = new URL(url).origin } catch (_) { S.baseUrl = url }
    if ($.tabMain && !$.tabMain.dataset.url) {
      $.tabMain.dataset.url = url
      if ($.urlBar && !$.urlBar.value) $.urlBar.value = url
      if ($.view && !$.view.src) $.view.src = url
    }
  }

  // =====================
  // AUTO-SEARCH WO
  // =====================

  function autoSearchWO (wo) {
    const woSearch = wo.wo.split('-')[0]
    const url = S.baseUrl
      ? `${S.baseUrl}/search/advanced_search?full_text_search=${woSearch}&section_keys=work_orders`
      : ''
    if (!url) return

    $.urlBar.value = url
    if ($.view) {
      $.view.src = url
      const autoNav = () => {
        $.view.removeEventListener('did-stop-loading', autoNav)
        let attempts = 0
        const poll = setInterval(() => {
          attempts++
          if (attempts >= 10) { clearInterval(poll); return }
          $.view.executeJavaScript(`
            (function () {
              try {
                const all = Array.from(document.querySelectorAll('a[href]'))
                const match = all.find(a => {
                  const h = a.href || ''
                  return h.includes('/service_requests/') && h.includes('work_order_id=')
                })
                return match ? match.href : null
              } catch(e) { return null }
            })()
          `).then(href => {
            if (href && href.startsWith('http')) {
              clearInterval(poll)
              $.urlBar.value = href
              $.view.src = href
            } else if (attempts >= 20) {
              clearInterval(poll)
            }
          }).catch(() => clearInterval(poll))
        }, 150)
      }
      const autoNavDelayed = () => {
        $.view.removeEventListener('did-stop-loading', autoNavDelayed)
        setTimeout(autoNav, 100)
      }
      $.view.addEventListener('did-stop-loading', autoNavDelayed)
    }
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
    const url = tab.dataset.url
    if (url) navTo(url)
    updateTabArrows()
  }

  function addTab (url) {
    let label = 'New Tab ' + _nextTabNum()
    try { if (url) label = new URL(url).hostname.replace('www.', '') } catch (_) {}

    const tab = document.createElement('div')
    tab.className   = 'af-tab'
    tab.dataset.url = url || ''
    tab.innerHTML   = `<span title="${url || ''}">${label}</span><span class="af-tab-close" onclick="HALQ.af.closeTab(event,this)">✕</span>`
    tab.onclick     = function (e) {
      if (e.target.classList.contains('af-tab-close')) return
      switchToTab(tab)
      tab.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }

    const newBtn = $.tabs.querySelector('.af-new-tab')
    $.tabs.insertBefore(tab, newBtn)
    switchToTab(tab)
    tab.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    updateTabArrows()
  }

  function closeTab (e, btn) {
    e.stopPropagation()
    const tab    = btn.parentElement
    const allTabs = Array.from($.tabs.querySelectorAll('.af-tab'))
    const idx     = allTabs.indexOf(tab)
    const wasActive = tab.classList.contains('active')
    tab.remove()

    if (wasActive) {
      const remaining = Array.from($.tabs.querySelectorAll('.af-tab'))
      if (remaining.length) {
        const next = remaining[Math.min(idx, remaining.length - 1)]
        switchToTab(next)
      }
    }
    updateTabArrows()
  }

  function scrollTabs (dir) {
    $.tabs.scrollBy({ left: dir * 120, behavior: 'smooth' })
    setTimeout(updateTabArrows, 200)
  }

  function updateTabArrows () {
    if (!$.arrowLeft || !$.arrowRight) return
    $.arrowLeft.classList.toggle('disabled',  $.tabs.scrollLeft <= 0)
    $.arrowRight.classList.toggle('disabled', $.tabs.scrollLeft + $.tabs.clientWidth >= $.tabs.scrollWidth - 2)
  }

})()