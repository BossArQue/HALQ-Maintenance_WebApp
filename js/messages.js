// =====================
// MESSAGES — Templates, Vendor Directory, Context Menu Send, Injection
// Registers: HALQ.msg
// Depends on: HALQ.wo (for _ctxWoNum, selected WO data)
// =====================
(function () {
  'use strict'

  // ── State ──
  const S = {
    templates: {
      tenant: {
        email: [
          { name: 'Not heard from contractor', body: 'Hello {res},\n\nIf you have not heard from our contractor, please call them directly to schedule your repair.\n\n{vendor_details}\n\n' },
          { name: 'Vendor trying to reach you', body: 'Hello {res},\n\nOur vendor is trying to reach you. Please call them directly to schedule your repair.\n\n{vendor_details}\n\n' },
        ],
        text: [
          { name: 'Not heard from contractor', body: 'Hi {res}, if you have not heard from our contractor please call them directly: {vendor_details}' },
          { name: 'Vendor trying to reach you', body: 'Hi {res}, our vendor is trying to reach you. Please call them: {vendor_details}' },
        ]
      },
      vendor: {
        email: [
          { name: 'Follow up',  body: 'Hello,\n\nWhat is the update on WO #{wo} — {prop}?\n\n' },
          { name: 'Invoice',    body: 'Hello,\n\nPlease send your invoice for WO #{wo} — {prop}.\n\n' },
        ],
        text: [
          { name: 'Follow up', body: 'Hi, what is the update on WO #{wo} at {prop}?' },
          { name: 'Invoice',   body: 'Hi, please send your invoice for WO #{wo} at {prop}.' },
        ]
      },
      owner: { email: [], text: [] }
    },
    vendorDir: []
  }

  // ── Exports ──
  const API = {
    get templates () { return S.templates },
    set templates (v) { S.templates = v },

    get vendorDir () { return S.vendorDir },
    set vendorDir (v) { S.vendorDir = v },

    init,
    resolveTokens,
    renderTemplates,
    addTemplate,
    deleteTemplate,
    saveTemplates,
    ctxSend,
    vendorLookup,
    vendorDetailsStr,
    showVendorModal,
    dirImportExcel,
    dirAddManual,
    dirEdit,
    dirDelete,
    dirRenderTable,
    dirLoad,
    dirSave
  }

  HALQ.msg = API

  // ── Init ──
  async function init () {
    await dirLoad()
  }

  // =====================
  // TOKEN RESOLUTION
  // =====================

  function vendorLookup (name) {
    if (!name) return null
    const key = name.trim().toLowerCase()
    return S.vendorDir.find(v => v.name.trim().toLowerCase() === key) || null
  }

  function vendorDetailsStr (v) {
    if (!v) return ''
    const lines = [v.name]
    if (v.phone1) lines.push(v.phone1)
    if (v.phone2) lines.push(v.phone2)
    if (v.email)  lines.push(v.email)
    return lines.join('\n')
  }

  function resolveTokens (body, wo, vendorOverride) {
    const v       = vendorOverride || vendorLookup(wo?.vendor)
    const details = vendorDetailsStr(v)
    return body
      .replace(/{wo}/g,             wo?.wo     || '')
      .replace(/{prop}/g,           wo?.prop   || '')
      .replace(/{res}/g,            wo?.res    || '')
      .replace(/{vendor}/g,         wo?.vendor || '')
      .replace(/{vendor_phone}/g,   v?.phone1  || '')
      .replace(/{vendor_email}/g,   v?.email   || '')
      .replace(/{vendor_details}/g, details)
  }

  // =====================
  // TEMPLATE UI (Settings)
  // =====================

  function renderTemplates () {
    ;['tenant','vendor','owner'].forEach(group => {
      ;['email','text'].forEach(type => {
        const container = document.getElementById(`msg-list-${group}-${type}`)
        if (!container) return
        const list = S.templates[group]?.[type] || []
        container.innerHTML = ''
        list.forEach((tpl, i) => {
          const row = document.createElement('div')
          row.className = 'msg-template-row'
          row.innerHTML = `
            <div class="msg-template-row-header">
              <input class="msg-template-name" data-group="${group}" data-type="${type}" data-idx="${i}"
                value="${tpl.name.replace(/"/g,'&quot;')}" placeholder="Template name">
              <button class="msg-del-btn" onclick="HALQ.msg.deleteTemplate('${group}','${type}',${i})" title="Delete">🗑</button>
            </div>
            <textarea class="msg-template-body" data-group="${group}" data-type="${type}" data-idx="${i}"
              rows="4" placeholder="Message body... use {wo} {prop} {res} {vendor} {vendor_phone} {vendor_email} {vendor_details}">${tpl.body}</textarea>
          `
          container.appendChild(row)
        })
      })
    })
  }

  function addTemplate (group, type) {
    if (!S.templates[group]) S.templates[group] = { email: [], text: [] }
    if (!S.templates[group][type]) S.templates[group][type] = []
    S.templates[group][type].push({ name: 'New Template', body: '' })
    renderTemplates()
  }

  function deleteTemplate (group, type, idx) {
    S.templates[group][type].splice(idx, 1)
    renderTemplates()
  }

  function _readFromUI () {
    ;['tenant','vendor','owner'].forEach(group => {
      ;['email','text'].forEach(type => {
        const names = document.querySelectorAll(`.msg-template-name[data-group="${group}"][data-type="${type}"]`)
        const bodies = document.querySelectorAll(`.msg-template-body[data-group="${group}"][data-type="${type}"]`)
        const list = []
        names.forEach((nameEl, i) => {
          list.push({ name: nameEl.value.trim() || 'Template', body: bodies[i]?.value || '' })
        })
        if (!S.templates[group]) S.templates[group] = {}
        S.templates[group][type] = list
      })
    })
  }

  async function saveTemplates () {
    _readFromUI()
    await window.halq.settingsSave({ msgTemplates: S.templates })
    HALQ.showDebug('[MSG] Templates saved ✓')
  }

  async function loadSettings (s) {
    if (s.msgTemplates) {
      ;['tenant','vendor','owner'].forEach(g => {
        ;['email','text'].forEach(t => {
          if (s.msgTemplates[g]?.[t]) S.templates[g][t] = s.msgTemplates[g][t]
        })
      })
    }
  }
  API.loadSettings = loadSettings

  // =====================
  // CONTEXT MENU SEND
  // =====================

  function ctxSend (group, type, tplIdx) {
    const woNum = HALQ.wo._ctxWoNum
    if (!woNum) return
    HALQ.wo.closeCtxMenu()

    const wo = HALQ.wo.wos.find(x => x.wo === woNum)
    const needsVendor = (group === 'tenant' && (
      (S.templates[group]?.[type]?.[tplIdx]?.body || '').includes('{vendor')
    )) || group === 'vendor'

    const vendorName = wo?.vendor || ''
    const existingV  = vendorLookup(vendorName)

    if (needsVendor && vendorName && !existingV) {
      showVendorModal({ name: vendorName, phone1: '', phone2: '', email: '' }, true, async (saved) => {
        let vendorOverride = null
        if (saved && saved.name) {
          const existing = vendorLookup(saved.name)
          if (!existing) {
            S.vendorDir.push(saved)
            S.vendorDir.sort((a,b) => a.name.localeCompare(b.name))
          } else {
            Object.assign(existing, saved)
          }
          await dirSave()
          vendorOverride = saved
        }
        _doSend(group, type, tplIdx, wo, vendorOverride)
      })
      return
    }

    _doSend(group, type, tplIdx, wo, existingV)
  }

  function _doSend (group, type, tplIdx, wo, vendorOverride) {
    const body = tplIdx >= 0
      ? resolveTokens(S.templates[group]?.[type]?.[tplIdx]?.body || '', wo, vendorOverride)
      : resolveTokens('', wo, vendorOverride)

    HALQ.showDebug(`[MSG] Starting: ${group} / ${type} / ${tplIdx >= 0 ? S.templates[group]?.[type]?.[tplIdx]?.name : 'Free Message'}`)

    const woNum    = wo?.wo || ''
    const woSearch = woNum.split('-')[0]
    const searchUrl = HALQ.af.baseUrl
      ? `${HALQ.af.baseUrl}/search/advanced_search?full_text_search=${woSearch}&section_keys=work_orders`
      : ''

    if (!searchUrl) { HALQ.showDebug('[MSG] ✗ No AppFolio URL configured'); return }

    const view = document.getElementById('appfolio-view')
    if (!view) { HALQ.showDebug('[MSG] ✗ No webview found'); return }

    HALQ.switchView('wo')

    document.getElementById('af-url').value = searchUrl
    view.src = searchUrl
    HALQ.showDebug('[MSG] Navigating to WO search...')

    const onSearchLoad = () => {
      view.removeEventListener('did-stop-loading', onSearchLoad)
      HALQ.showDebug('[MSG] Search loaded — polling for WO detail link...')
      let attempts = 0
      const poll = setInterval(() => {
        attempts++
        if (attempts > 20) { clearInterval(poll); HALQ.showDebug('[MSG] ✗ WO detail link not found'); return }
        view.executeJavaScript(`
          (function () {
            try {
              const all = Array.from(document.querySelectorAll('a[href]'))
              const match = all.find(a => a.href.includes('/service_requests/') && a.href.includes('work_order_id='))
              return match ? match.href : null
            } catch(e) { return null }
          })()
        `).then(href => {
          if (href && href.startsWith('http')) {
            clearInterval(poll)
            HALQ.showDebug('[MSG] WO detail found — navigating...')
            document.getElementById('af-url').value = href
            view.src = href

            const onDetailLoad = () => {
              view.removeEventListener('did-stop-loading', onDetailLoad)
              setTimeout(() => _injectAction(view, group, type, body), 400)
            }
            view.addEventListener('did-stop-loading', onDetailLoad)
          }
        }).catch(() => {})
      }, 200)
    }
    view.addEventListener('did-stop-loading', onSearchLoad)
  }

  // =====================
  // INJECTION
  // =====================

  function _injectAction (view, group, type, body) {
    HALQ.showDebug(`[MSG] Injecting action: ${group} / ${type}`)
    const safeBody = JSON.stringify(body)

    if (group === 'tenant' && type === 'email') {
      view.executeJavaScript(`
        (function () {
          try {
            const actBtn = document.querySelector('.js-options-dropdown-toggle')
            if (!actBtn) return 'no-actions-btn'
            actBtn.click()
            let tries = 0
            const poll = setInterval(() => {
              tries++
              if (tries > 15) { clearInterval(poll); return }
              const notifyBtn = document.querySelector('.js-work-order-action-notify_tenant')
              if (notifyBtn) {
                clearInterval(poll)
                notifyBtn.click()
                let mTries = 0
                const mPoll = setInterval(() => {
                  mTries++
                  if (mTries > 20) { clearInterval(mPoll); return }
                  const ta = document.getElementById('email_options_body')
                  if (ta) {
                    clearInterval(mPoll)
                    ta.value = ${safeBody}
                    ta.dispatchEvent(new Event('input', { bubbles: true }))
                  }
                }, 200)
              }
            }, 200)
            return 'triggered'
          } catch(e) { return 'error: ' + e.message }
        })()
      `).then(r => HALQ.showDebug('[MSG] Inject result: ' + r))
       .catch(e => HALQ.showDebug('[MSG] ✗ Inject error: ' + e.message))

    } else if (group === 'vendor' && type === 'email') {
      view.executeJavaScript(`
        (function () {
          try {
            const emailBtn = document.querySelector('.js-work-order-action-notify_vendor')
            if (!emailBtn) return 'no-vendor-email-btn'
            emailBtn.click()
            let tries = 0
            const poll = setInterval(() => {
              tries++
              if (tries > 20) { clearInterval(poll); return }
              const ta = document.getElementById('email_options_body')
              if (ta) {
                clearInterval(poll)
                ta.value = ${safeBody}
                ta.dispatchEvent(new Event('input', { bubbles: true }))
              }
            }, 200)
            return 'triggered'
          } catch(e) { return 'error: ' + e.message }
        })()
      `).then(r => HALQ.showDebug('[MSG] Inject result: ' + r))
       .catch(e => HALQ.showDebug('[MSG] ✗ Inject error: ' + e.message))

    } else if (type === 'text') {
      view.executeJavaScript(`
        (function () {
          try {
            const msgBtn = document.querySelector('[data-messaging-launcher-trigger="true"]')
            if (!msgBtn) return 'no-msg-btn'
            msgBtn.click()
            return 'triggered'
          } catch(e) { return 'error: ' + e.message }
        })()
      `).then(r => {
        HALQ.showDebug('[MSG] SMS launcher: ' + r)
        if (r !== 'triggered') return
        if (!safeBody || safeBody === '""') return

        let tries = 0
        const poll = setInterval(() => {
          tries++
          if (tries > 30) { clearInterval(poll); HALQ.showDebug('[MSG] SMS textarea not found after 6s'); return }
          view.executeJavaScript(`
            (function () {
              try {
                const ta = document.querySelector(
                  '[data-testid="message-input"], [data-qa="message-input"], .js-messaging-input, .messaging-composer textarea, .message-composer textarea, [placeholder*="message" i], [placeholder*="text" i], .sms-composer textarea, form[class*="message"] textarea, form[class*="sms"] textarea'
                )
                if (!ta) return null
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
                nativeSetter.call(ta, ${safeBody})
                ta.dispatchEvent(new Event('input', { bubbles: true }))
                ta.dispatchEvent(new Event('change', { bubbles: true }))
                ta.focus()
                return 'filled'
              } catch(e) { return 'error: ' + e.message }
            })()
          `).then(res => {
            if (res === 'filled') {
              clearInterval(poll)
              HALQ.showDebug('[MSG] SMS body filled')
            }
          }).catch(() => {})
        }, 200)
      })
      .catch(e => HALQ.showDebug('[MSG] SMS error: ' + e.message))

    } else {
      HALQ.showDebug('[MSG] ✗ Unknown action type: ' + group + '/' + type)
    }
  }

  // =====================
  // VENDOR MODAL
  // =====================

  function showVendorModal (vendor, isPrompt, onSave) {
    document.getElementById('vendor-modal-overlay')?.remove()

    const esc = s => (s||'').replace(/"/g,'&quot;')
    const overlay = document.createElement('div')
    overlay.id = 'vendor-modal-overlay'
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center'
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:20px 22px;width:420px;max-width:92vw;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:13px;color:var(--text)">${isPrompt ? '⚠ Vendor details missing' : '✎ Edit Vendor'}</span>
          <span id="vendor-modal-close" style="cursor:pointer;color:var(--text3);font-size:16px;line-height:1">✕</span>
        </div>
        ${isPrompt ? `<div style="font-size:11px;color:var(--text3);margin-bottom:2px">No details found for <strong style="color:var(--text)">${vendor.name || 'this vendor'}</strong>. Add them to continue.</div>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px">
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Vendor Name</div>
            <input id="vmod-name"   class="creds-input" style="margin:0" value="${esc(vendor.name)}"   placeholder="Company or person name"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Phone 1</div>
            <input id="vmod-phone1" class="creds-input" style="margin:0" value="${esc(vendor.phone1)}" placeholder="(xxx) xxx-xxxx"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Phone 2</div>
            <input id="vmod-phone2" class="creds-input" style="margin:0" value="${esc(vendor.phone2)}" placeholder="Optional"></div>
          <div><div style="font-size:10px;color:var(--text3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.08em">Email</div>
            <input id="vmod-email"  class="creds-input" style="margin:0" value="${esc(vendor.email)}"  placeholder="vendor@example.com"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button id="vmod-save" class="btn btn-primary" style="flex:1;justify-content:center">${isPrompt ? '💾 Save & Continue' : '💾 Save'}</button>
          <button id="vmod-cancel" class="btn btn-ghost" style="flex:1;justify-content:center">${isPrompt ? 'Skip' : 'Cancel'}</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    const close = () => overlay.remove()
    overlay.querySelector('#vendor-modal-close').addEventListener('click', close)
    overlay.querySelector('#vmod-cancel').addEventListener('click', () => { close(); if (isPrompt && onSave) onSave(null) })
    overlay.querySelector('#vmod-save').addEventListener('click', async () => {
      const updated = {
        name:   document.getElementById('vmod-name').value.trim(),
        phone1: document.getElementById('vmod-phone1').value.trim(),
        phone2: document.getElementById('vmod-phone2').value.trim(),
        email:  document.getElementById('vmod-email').value.trim()
      }
      close()
      if (onSave) onSave(updated)
    })
    setTimeout(() => document.getElementById('vmod-name')?.focus(), 60)
  }

  // =====================
  // VENDOR DIRECTORY UI
  // =====================

  async function dirLoad () {
    try {
      const r = await window.halq.vendorsLoad()
      if (r.ok) S.vendorDir = r.vendors || []
    } catch (e) { console.error('[VENDOR DIR] load error:', e) }
  }

  async function dirSave () {
    try { await window.halq.vendorsSave(S.vendorDir) } catch (e) { console.error('[VENDOR DIR] save error:', e) }
  }

  function dirRenderTable (filter) {
    const tbody     = document.getElementById('vendor-dir-tbody')
    const countEl   = document.getElementById('vendor-dir-count')
    if (!tbody) return
    const q    = (filter || '').trim().toLowerCase()
    const list = q ? S.vendorDir.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.phone1||'').includes(q) ||
      (v.email||'').toLowerCase().includes(q)
    ) : S.vendorDir

    tbody.innerHTML = list.map((v, visIdx) => {
      const realIdx = S.vendorDir.indexOf(v)
      const esc = s => (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;')
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px 8px;color:var(--text)">${esc(v.name)}</td>
        <td style="padding:5px 8px;color:var(--text2)">${esc(v.phone1)}</td>
        <td style="padding:5px 8px;color:var(--text2)">${esc(v.phone2)}</td>
        <td style="padding:5px 8px;color:var(--text2)">${esc(v.email)}</td>
        <td style="padding:5px 4px;text-align:center">
          <button style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:2px 4px" onclick="HALQ.msg.dirEdit(${realIdx})" title="Edit">✎</button>
          <button style="background:none;border:none;cursor:pointer;color:var(--red);font-size:11px;padding:2px 4px" onclick="HALQ.msg.dirDelete(${realIdx})" title="Delete">🗑</button>
        </td>
      </tr>`
    }).join('')

    if (countEl) countEl.textContent = q
      ? `${list.length} of ${S.vendorDir.length} vendors`
      : `${S.vendorDir.length} vendors`
  }

  async function dirImportExcel () {
    const statusEl = document.getElementById('vendor-dir-status')
    if (statusEl) { statusEl.textContent = 'Importing from Excel…'; statusEl.className = 'creds-status' }
    try {
      const r = await window.halq.vendorsImportExcel()
      if (!r.ok) {
        if (statusEl) { statusEl.textContent = '✗ ' + r.error; statusEl.className = 'creds-status err' }
        return
      }
      const importMap = {}
      r.vendors.forEach(v => { importMap[v.name.trim().toLowerCase()] = v })
      const kept = S.vendorDir.filter(v => !importMap[v.name.trim().toLowerCase()])
      S.vendorDir = [...kept, ...r.vendors].sort((a,b) => a.name.localeCompare(b.name))
      await dirSave()
      dirRenderTable(document.getElementById('vendor-dir-search')?.value)
      if (statusEl) { statusEl.textContent = `✓ Imported ${r.vendors.length} vendors`; statusEl.className = 'creds-status ok' }
      setTimeout(() => { if (statusEl) statusEl.textContent = '' }, 3000)
    } catch (e) {
      if (statusEl) { statusEl.textContent = '✗ ' + e.message; statusEl.className = 'creds-status err' }
    }
  }

  function dirAddManual () {
    const newV = { name: '', phone1: '', phone2: '', email: '' }
    S.vendorDir.push(newV)
    const idx = S.vendorDir.length - 1
    dirRenderTable(document.getElementById('vendor-dir-search')?.value)
    dirEdit(idx)
  }

  function dirEdit (idx) {
    const v = S.vendorDir[idx]
    if (!v) return
    showVendorModal(v, false, async (updated) => {
      S.vendorDir[idx] = updated
      S.vendorDir.sort((a,b) => a.name.localeCompare(b.name))
      await dirSave()
      dirRenderTable(document.getElementById('vendor-dir-search')?.value)
    })
  }

  async function dirDelete (idx) {
    S.vendorDir.splice(idx, 1)
    await dirSave()
    dirRenderTable(document.getElementById('vendor-dir-search')?.value)
  }

})()