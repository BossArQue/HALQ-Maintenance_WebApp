/* ============================================
   FILE: notes-panel.js
   PATH: public/js/notes-panel.js
   VERSION: 2.1.0
   DESCRIPTION: Notes panel — tree, editor, canvas, export. Fetch API replaces IPC.
   ============================================ */
(function () {
  'use strict'

  // ── State ──
  const S = {
    meta:        { notebooks: [] },
    current:     null,   // { nbId, secId, pageId }
    dirty:       false,
    drawMode:    false,
    drawDown:    false,
    eraser:      false,
    drawCtx:     null,
    saveTimer:   null,
    promptRes:   null,
    confirmRes:  null,
    dragIdx:     null,
    panelMounted: false,
    dividersInit: false
  }

  const NT_COLORS = ['#5b9cf6','#34c759','#ff9f0a','#ff453a','#bf5af2','#00c7be','#ff6b6b','#ffd93d']

  // ── DOM refs ──
  let $ = {}

  function cache () {
    $ = {
      panel:        document.getElementById('notes-panel'),
      template:     document.getElementById('notes-body-wrap-template'),
      bodyWrap:     null,
      nbPanel:      null,
      pgPanel:      null,
      editor:       null,
      tree:         null,
      pgList:       null,
      pgHdTitle:    null,
      addPgBtn:     null,
      tb:           null,
      pageArea:     null,
      empty:        null,
      pageInner:    null,
      pgTitle:      null,
      body:         null,
      canvasWrap:   null,
      canvas:       null,
      drawBar:      null,
      drawColor:    null,
      drawSize:     null,
      drawEraserBtn:null,
      exportOverlay:document.getElementById('nt-export-overlay'),
      promptOverlay:document.getElementById('nt-prompt-overlay'),
      promptLabel:  document.getElementById('nt-prompt-label'),
      promptInput:  document.getElementById('nt-prompt-input'),
      confirmOverlay:document.getElementById('nt-confirm-overlay'),
      confirmMsg:   document.getElementById('nt-confirm-msg')
    }
  }

  // ── Exports ──
  const API = {
    init,
    renderInPanel,
    renderTree,
    renderPgPanel,
    openPage,
    savePage,
    showEmpty: _showEmpty,

    // Toolbar
    toolbar: {
      fmt: nFmt,
      block: nBlock,
      list: nList,
      checklist: nChecklist,
      table: nTable,
      image: nImage,
      file: nFile
    },

    // Drawing
    draw: {
      toggle: nToggleDraw,
      eraser: nDrawEraser,
      clear: nDrawClear,
      save: nSaveDrawing
    },

    // Export
    export: {
      modal: ntExportModal,
      close: ntExportClose,
      setScope: ntExportSetScope,
      run: ntExportRun
    }
  }

  HALQ.notes = API

  // ── UID ──
  function ntUID () {
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }

  function ntE (s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

  // =====================
  // API HELPERS (v2 Fetch)
  // =====================

  async function _apiGetNotesMeta () {
    try {
      const res = await HALQ.apiGet('/notes/meta')
      return res
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function _apiSaveNotesMeta (meta) {
    try {
      return await HALQ.apiPost('/notes/meta', meta)
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function _apiGetPage (pageId) {
    try {
      return await HALQ.apiGet(`/notes/pages/${pageId}`)
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function _apiSavePage (pageId, content) {
    try {
      return await HALQ.apiPost(`/notes/pages/${pageId}`, { content })
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function _apiDeletePage (pageId) {
    try {
      return await HALQ.apiDelete(`/notes/pages/${pageId}`)
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function _apiSaveAsset (pageId, fileName, base64) {
    try {
      return await HALQ.apiPost(`/notes/assets`, { pageId, fileName, base64 })
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async function _apiExportNotes (opts) {
    try {
      return await HALQ.apiPost('/notes/export', opts)
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  // =====================
  // MOUNT & INIT
  // =====================

  async function renderInPanel () {
    if (!S.panelMounted) {
      S.panelMounted = true
      if ($.template && $.panel) {
        while ($.template.firstChild) $.panel.appendChild($.template.firstChild)
      }
      _cachePostMount()
    }
    await init()
  }

  function _cachePostMount () {
    $.bodyWrap     = document.getElementById('notes-body-wrap')
    $.nbPanel      = document.getElementById('notes-nb-panel')
    $.pgPanel      = document.getElementById('notes-pg-panel')
    $.editor       = document.querySelector('.notes-editor')
    $.tree         = document.getElementById('notes-tree')
    $.pgList       = document.getElementById('notes-pg-list')
    $.pgHdTitle    = document.getElementById('notes-pg-hd-title')
    $.addPgBtn     = document.getElementById('notes-add-pg-btn')
    $.tb           = document.getElementById('notes-tb')
    $.pageArea     = document.getElementById('notes-page-area')
    $.empty        = document.getElementById('notes-empty')
    $.pageInner    = document.getElementById('notes-page-inner')
    $.pgTitle      = document.getElementById('notes-pg-title')
    $.body         = document.getElementById('notes-body')
    $.canvasWrap   = document.getElementById('notes-canvas-wrap')
    $.canvas       = document.getElementById('notes-canvas')
    $.drawBar      = document.getElementById('notes-draw-bar')
    $.drawColor    = document.getElementById('draw-color')
    $.drawSize     = document.getElementById('draw-size')
    $.drawEraserBtn= document.getElementById('draw-eraser')
  }

  async function init () {
    cache()
    const res = await _apiGetNotesMeta()
    if (res.ok) S.meta = res.data
    if (!S.meta.notebooks) S.meta = { notebooks: [] }
    renderTree()
  }

  // =====================
  // TREE RENDER
  // =====================

  function renderTree () {
    if (!S.meta.notebooks.length) {
      if ($.tree) $.tree.innerHTML = '<div style="padding:14px;font-size:11px;color:var(--text3);text-align:center">No notebooks.<br>Click + to create one.</div>'
      return
    }
    if ($.tree) $.tree.innerHTML = S.meta.notebooks.map(nb => _renderNB(nb)).join('')
  }

  function _renderNB (nb) {
    const secs = (nb.sections || []).map(s => _renderSec(nb.id, s)).join('')
    return `<div class="nt-nb ${nb.open ? 'open' : ''}" id="ntb-${nb.id}">
      <div class="nt-nb-row" onclick="HALQ.notes._toggleNB('${nb.id}')">
        <span class="arrow">▶</span>
        <span class="nb-label">📔 ${ntE(nb.name)}</span>
        <span class="nb-acts">
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.addSection('${nb.id}')" title="Add Section">+</button>
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.rename('nb','${nb.id}')" title="Rename">✎</button>
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.delete('nb','${nb.id}')" title="Delete">🗑</button>
        </span>
      </div>
      <div class="nt-secs">${secs}</div>
    </div>`
  }

  function _renderSec (nbId, sec) {
    const col    = sec.color || NT_COLORS[0]
    const active = (S.current?.secId === sec.id) ? 'active' : ''
    return `<div class="nt-sec" id="nts-${sec.id}">
      <div class="nt-sec-row ${active}" onclick="HALQ.notes.selectSection('${nbId}','${sec.id}')">
        <span class="nt-sec-dot" style="background:${col}"></span>
        <span class="sec-label">${ntE(sec.name)}</span>
        <span class="sec-acts">
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.rename('sec','${sec.id}','${nbId}')" title="Rename">✎</button>
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.delete('sec','${sec.id}','${nbId}')" title="Delete">🗑</button>
        </span>
      </div>
    </div>`
  }

  API._toggleNB = function (nbId) {
    const nb = S.meta.notebooks.find(n => n.id === nbId)
    if (nb) { nb.open = !nb.open; _saveMeta(); renderTree() }
  }

  // =====================
  // SECTION & PAGE PANEL
  // =====================

  let activeSec = null

  function selectSection (nbId, secId) {
    activeSec = { nbId, secId }
    if (S.current) S.current.secId = secId
    renderTree()
    renderPgPanel()
  }
  API.selectSection = selectSection

  function renderPgPanel () {
    if (!$.pgList) return
    if (!activeSec) {
      $.pgList.innerHTML = '<div class="notes-pg-empty">Select a section</div>'
      if ($.pgHdTitle) $.pgHdTitle.textContent = 'Pages'
      if ($.addPgBtn) $.addPgBtn.style.display = 'none'
      return
    }

    const { nbId, secId } = activeSec
    const nb  = S.meta.notebooks.find(n => n.id === nbId)
    const sec = nb?.sections?.find(s => s.id === secId)
    if (!sec) { $.pgList.innerHTML = '<div class="notes-pg-empty">Section not found</div>'; return }

    if ($.pgHdTitle) $.pgHdTitle.textContent = sec.name
    if ($.addPgBtn) {
      $.addPgBtn.style.display = ''
      $.addPgBtn.onclick = () => addPage(nbId, secId)
    }

    if (!sec.pages?.length) {
      $.pgList.innerHTML = '<div class="notes-pg-empty">No pages.<br>Click + to add one.</div>'
      return
    }

    $.pgList.innerHTML = sec.pages.map((pg, idx) => {
      const active = S.current?.pageId === pg.id ? 'active' : ''
      return `<div class="notes-pg-item ${active}" draggable="true"
        onclick="HALQ.notes.openPage('${nbId}','${secId}','${pg.id}')"
        ondragstart="HALQ.notes._pgDragStart(event,${idx})"
        ondragover="HALQ.notes._pgDragOver(event,${idx})"
        ondrop="HALQ.notes._pgDrop(event,'${nbId}','${secId}')"
        ondragleave="this.style.borderTop=''"
        data-idx="${idx}">
        <span class="pg-label">📄 ${ntE(pg.title || 'Untitled')}</span>
        <span class="pg-acts">
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.rename('pg','${pg.id}','${secId}','${nbId}')" title="Rename">✎</button>
          <button class="ntree-btn" onclick="event.stopPropagation();HALQ.notes.delete('pg','${pg.id}','${secId}','${nbId}')" title="Delete">🗑</button>
        </span>
      </div>`
    }).join('')
  }

  API._pgDragStart = function (e, idx) {
    S.dragIdx = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  API._pgDragOver = function (e, idx) {
    e.preventDefault()
    e.currentTarget.style.borderTop = S.dragIdx !== idx ? '2px solid var(--accent)' : ''
  }
  API._pgDrop = async function (e, nbId, secId) {
    e.preventDefault()
    e.currentTarget.style.borderTop = ''
    const toIdx = parseInt(e.currentTarget.dataset.idx)
    if (S.dragIdx === null || S.dragIdx === toIdx) return
    const nb  = S.meta.notebooks.find(n => n.id === nbId)
    const sec = nb?.sections?.find(s => s.id === secId)
    if (!sec?.pages) return
    const [moved] = sec.pages.splice(S.dragIdx, 1)
    sec.pages.splice(toIdx, 0, moved)
    S.dragIdx = null
    await _saveMeta()
    renderPgPanel()
  }

  // =====================
  // CRUD OPERATIONS
  // =====================

  async function addNotebook () {
    const name = await _prompt('Notebook name:')
    if (!name?.trim()) return
    S.meta.notebooks.push({ id: ntUID(), name: name.trim(), open: true, sections: [] })
    await _saveMeta()
    renderTree()
  }
  API.addNotebook = addNotebook

  async function addSection (nbId) {
    const name = await _prompt('Section name:')
    if (!name?.trim()) return
    const nb = S.meta.notebooks.find(n => n.id === nbId)
    if (!nb) return
    if (!nb.sections) nb.sections = []
    nb.sections.push({
      id: ntUID(), name: name.trim(),
      color: NT_COLORS[nb.sections.length % NT_COLORS.length],
      open: true, pages: []
    })
    nb.open = true
    await _saveMeta()
    renderTree()
  }
  API.addSection = addSection

  async function addPage (nbId, secId) {
    const name = await _prompt('Page title:', 'Untitled')
    if (!name?.trim()) return
    const nb  = S.meta.notebooks.find(n => n.id === nbId)
    const sec = nb?.sections?.find(s => s.id === secId)
    if (!sec) return
    if (!sec.pages) sec.pages = []
    const pageId = ntUID()
    sec.pages.push({ id: pageId, title: name.trim() })
    nb.open = true
    activeSec = { nbId, secId }
    await _saveMeta()
    renderTree()
    renderPgPanel()
    openPage(nbId, secId, pageId)
  }
  API.addPage = addPage

  async function rename (type, id, parentId, gpId) {
    let target, current
    if (type === 'nb') {
      target = S.meta.notebooks.find(n => n.id === id)
      current = target?.name
    } else if (type === 'sec') {
      target = S.meta.notebooks.find(n => n.id === parentId)?.sections?.find(s => s.id === id)
      current = target?.name
    } else {
      const nb  = S.meta.notebooks.find(n => n.id === gpId)
      const sec = nb?.sections?.find(s => s.id === parentId)
      target = sec?.pages?.find(p => p.id === id)
      current = target?.title
    }
    if (!target) return
    const name = await _prompt('Rename:', current)
    if (!name?.trim()) return
    if (type === 'pg') target.title = name.trim()
    else target.name = name.trim()
    if (type === 'pg' && S.current?.pageId === id) {
      if ($.pgTitle) $.pgTitle.value = name.trim()
    }
    await _saveMeta()
    renderTree()
    renderPgPanel()
  }
  API.rename = rename

  async function del (type, id, parentId, gpId) {
    if (type === 'nb') {
      const nb = S.meta.notebooks.find(n => n.id === id)
      if (!nb) return
      if (!await _confirm(`Delete notebook "${nb.name}" and ALL contents?`)) return
      for (const s of (nb.sections || []))
        for (const p of (s.pages || []))
          await _apiDeletePage(p.id)
      S.meta.notebooks = S.meta.notebooks.filter(n => n.id !== id)
      if (S.current) _showEmpty()
    } else if (type === 'sec') {
      const nb  = S.meta.notebooks.find(n => n.id === parentId)
      const sec = nb?.sections?.find(s => s.id === id)
      if (!sec) return
      if (!await _confirm(`Delete section "${sec.name}" and all its pages?`)) return
      for (const p of (sec.pages || [])) await _apiDeletePage(p.id)
      nb.sections = nb.sections.filter(s => s.id !== id)
      if (S.current && sec.pages?.some(p => p.id === S.current.pageId)) _showEmpty()
    } else {
      const nb  = S.meta.notebooks.find(n => n.id === gpId)
      const sec = nb?.sections?.find(s => s.id === parentId)
      const pg  = sec?.pages?.find(p => p.id === id)
      if (!pg) return
      if (!await _confirm(`Delete page "${pg.title}"?`)) return
      await _apiDeletePage(id)
      sec.pages = sec.pages.filter(p => p.id !== id)
      if (S.current?.pageId === id) _showEmpty()
    }
    await _saveMeta()
    renderTree()
    renderPgPanel()
  }
  API.delete = del

  // =====================
  // OPEN / SAVE PAGE
  // =====================

  async function openPage (nbId, secId, pageId) {
    if (S.dirty) await savePage()
    S.current = { nbId, secId, pageId }
    activeSec = { nbId, secId }

    const nb  = S.meta.notebooks.find(n => n.id === nbId)
    const sec = nb?.sections?.find(s => s.id === secId)
    const pg  = sec?.pages?.find(p => p.id === pageId)
    const res = await _apiGetPage(pageId)

    if ($.empty) $.empty.style.display = 'none'
    if ($.pageInner) $.pageInner.style.display = 'block'
    if ($.tb) $.tb.classList.add('enabled')
    if ($.pgTitle) $.pgTitle.value = pg?.title || 'Untitled'
    if ($.body) $.body.innerHTML = res.ok ? (res.content || '') : ''

    S.dirty = false
    _initCanvas()
    renderTree()
    renderPgPanel()
  }
  API.openPage = openPage

  function _showEmpty () {
    S.current = null
    if ($.empty) $.empty.style.display = ''
    if ($.pageInner) $.pageInner.style.display = 'none'
    if ($.tb) $.tb.classList.remove('enabled')
    renderTree()
    renderPgPanel()
  }

  function _markDirty () {
    S.dirty = true
    clearTimeout(S.saveTimer)
    S.saveTimer = setTimeout(savePage, 2000)
  }

  async function savePage () {
    if (!S.current || !S.dirty) return
    const title   = ($.pgTitle?.value || '').trim() || 'Untitled'
    const content = $.body?.innerHTML || ''

    const nb  = S.meta.notebooks.find(n => n.id === S.current.nbId)
    const sec = nb?.sections?.find(s => s.id === S.current.secId)
    const pg  = sec?.pages?.find(p => p.id === S.current.pageId)
    if (pg) pg.title = title

    await _apiSavePage(S.current.pageId, content)
    await _saveMeta()
    S.dirty = false
    renderTree()
    renderPgPanel()
  }
  API.savePage = savePage

  async function _saveMeta () {
    await _apiSaveNotesMeta(S.meta)
  }

  // =====================
  // TOOLBAR COMMANDS
  // =====================

  function nFmt (cmd, val) {
    $.body?.focus()
    document.execCommand(cmd, false, val || null)
    _markDirty()
  }

  function nBlock (tag) {
    $.body?.focus()
    document.execCommand('formatBlock', false, tag)
    _markDirty()
  }

  function nList (type) {
    $.body?.focus()
    document.execCommand(type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList')
    _markDirty()
  }

  function nChecklist () {
    $.body?.focus()
    document.execCommand('insertHTML', false, '<div><input type="checkbox"> <span>Task item</span></div>')
    _markDirty()
  }

  async function nTable () {
    const rows = parseInt(await _prompt('Rows:', '3')) || 3
    const cols = parseInt(await _prompt('Columns:', '3')) || 3
    let html = '<table><thead><tr>'
    for (let c = 0; c < cols; c++) html += `<th>Col ${c+1}</th>`
    html += '</tr></thead><tbody>'
    for (let r = 0; r < rows - 1; r++) {
      html += '<tr>'
      for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>'
      html += '</tr>'
    }
    html += '</tbody></table><p></p>'
    $.body?.focus()
    document.execCommand('insertHTML', false, html)
    _markDirty()
  }

  async function nImage () {
    if (!S.current) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const b64   = ev.target.result.split(',')[1]
        const saved = await _apiSaveAsset(S.current.pageId, file.name, b64)
        if (saved.ok) {
          const src = saved.src || `data:${file.type};base64,${b64}`
          $.body?.focus()
          document.execCommand('insertHTML', false, `<img src="${ntE(src)}" alt="${ntE(file.name)}">`)
          _markDirty()
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  async function nFile () {
    if (!S.current) return
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const b64   = ev.target.result.split(',')[1]
        const saved = await _apiSaveAsset(S.current.pageId, file.name, b64)
        if (!saved.ok) return
        const ext     = file.name.split('.').pop().toLowerCase()
        const icon    = ext === 'pdf' ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : '📎'
        const src     = saved.src || `data:${file.type};base64,${b64}`
        $.body?.focus()
        document.execCommand('insertHTML', false,
          `<span class="nt-file" data-src="${ntE(src)}">${icon} ${ntE(file.name)}</span><br>`)
        _markDirty()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // =====================
  // PASTE & DROP
  // =====================

  async function ntPaste (e) {
    if (!S.current) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      e.preventDefault()
      const blob   = item.getAsFile()
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const b64   = ev.target.result.split(',')[1]
        const saved = await _apiSaveAsset(S.current.pageId, `paste-${Date.now()}.png`, b64)
        if (saved.ok) {
          const src = saved.src || `data:${blob.type};base64,${b64}`
          document.execCommand('insertHTML', false, `<img src="${ntE(src)}" alt="image">`)
          _markDirty()
        }
      }
      reader.readAsDataURL(blob)
      return
    }
  }
  API.paste = ntPaste

  async function ntDrop (e) {
    if (!S.current) return
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (!files?.length) return
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const b64   = ev.target.result.split(',')[1]
        const saved = await _apiSaveAsset(S.current.pageId, file.name, b64)
        if (!saved.ok) return
        const src = saved.src || `data:${file.type};base64,${b64}`
        if (file.type.startsWith('image/')) {
          document.execCommand('insertHTML', false, `<img src="${ntE(src)}" alt="${ntE(file.name)}">`)
        } else {
          const ext     = file.name.split('.').pop().toLowerCase()
          const icon    = ext === 'pdf' ? '📄' : '📎'
          document.execCommand('insertHTML', false,
            `<span class="nt-file" data-src="${ntE(src)}">${icon} ${ntE(file.name)}</span><br>`)
        }
        _markDirty()
      }
      reader.readAsDataURL(file)
    }
  }
  API.drop = ntDrop

  // =====================
  // DRAWING
  // =====================

  function _initCanvas () {
    if (!$.canvas || !$.pageArea) return
    $.canvas.width  = $.pageArea.scrollWidth
    $.canvas.height = Math.max($.pageArea.scrollHeight, 800)
    S.drawCtx = $.canvas.getContext('2d')
    S.drawCtx.lineCap = 'round'
    S.drawCtx.lineJoin = 'round'

    $.canvas.onmousedown = (e) => {
      if (!S.drawMode) return
      S.drawDown = true
      S.drawCtx.beginPath()
      S.drawCtx.moveTo(e.offsetX, e.offsetY)
    }
    $.canvas.onmousemove = (e) => {
      if (!S.drawMode || !S.drawDown) return
      if (S.eraser) {
        S.drawCtx.clearRect(e.offsetX - 10, e.offsetY - 10, 20, 20)
      } else {
        S.drawCtx.strokeStyle = $.drawColor?.value || '#5b9cf6'
        S.drawCtx.lineWidth   = $.drawSize?.value || 3
        S.drawCtx.lineTo(e.offsetX, e.offsetY)
        S.drawCtx.stroke()
      }
    }
    $.canvas.onmouseup    = () => { S.drawDown = false; _markDirty() }
    $.canvas.onmouseleave = () => { S.drawDown = false }
  }

  function nToggleDraw () {
    S.drawMode = !S.drawMode
    S.eraser   = false
    $.canvasWrap?.classList.toggle('on', S.drawMode)
    $.drawBar?.classList.toggle('on', S.drawMode)
    const btn = document.getElementById('nbt-draw')
    if (btn) btn.classList.toggle('on', S.drawMode)
    $.drawEraserBtn?.classList.remove('on')
  }

  function nDrawEraser () {
    S.eraser = !S.eraser
    $.drawEraserBtn?.classList.toggle('on', S.eraser)
  }

  function nDrawClear () {
    if (!S.drawCtx || !$.canvas) return
    S.drawCtx.clearRect(0, 0, $.canvas.width, $.canvas.height)
    _markDirty()
  }

  async function nSaveDrawing () {
    if (!S.current || !S.drawCtx || !$.canvas) return
    const b64    = $.canvas.toDataURL('image/png').split(',')[1]
    const saved  = await _apiSaveAsset(S.current.pageId, `drawing-${Date.now()}.png`, b64)
    if (!saved.ok) return
    const src = saved.src || `data:image/png;base64,${b64}`
    $.body?.focus()
    document.execCommand('insertHTML', false, `<img src="${ntE(src)}" alt="drawing">`)
    nDrawClear()
    nToggleDraw()
    _markDirty()
  }

  // =====================
  // EXPORT MODAL
  // =====================

  let _expScope = 'notebook'

  function ntExportModal () {
    if (!S.meta.notebooks.length) { HALQ.showDebug('No notebooks to export yet.'); return }
    _expScope = 'notebook'
    _expFillNb()
    document.querySelectorAll('.nt-scope-btn').forEach(b => b.classList.remove('on'))
    document.getElementById('exp-scope-nb')?.classList.add('on')
    const rowSec = document.getElementById('exp-row-sec')
    const rowPg  = document.getElementById('exp-row-pg')
    if (rowSec) rowSec.style.display = 'none'
    if (rowPg)  rowPg.style.display  = 'none'
    if (activeSec) {
      const nbSel = document.getElementById('exp-sel-nb')
      if (nbSel) { nbSel.value = activeSec.nbId; _expNbChanged() }
      const secSel = document.getElementById('exp-sel-sec')
      if (secSel) { secSel.value = activeSec.secId; _expSecChanged() }
      if (S.current?.pageId) {
        const pgSel = document.getElementById('exp-sel-pg')
        if (pgSel) pgSel.value = S.current.pageId
      }
    }
    $.exportOverlay?.classList.add('on')
  }

  function ntExportClose () {
    $.exportOverlay?.classList.remove('on')
  }

  function _expFillNb () {
    const sel = document.getElementById('exp-sel-nb')
    if (!sel) return
    sel.innerHTML = S.meta.notebooks.map(n => `<option value="${n.id}">${n.name}</option>`).join('')
    _expNbChanged()
  }

  function _expNbChanged () {
    const nb = S.meta.notebooks.find(n => n.id === document.getElementById('exp-sel-nb')?.value)
    const secSel = document.getElementById('exp-sel-sec')
    if (secSel) secSel.innerHTML = (nb?.sections || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')
    _expSecChanged()
  }

  function _expSecChanged () {
    const nbId  = document.getElementById('exp-sel-nb')?.value
    const secId = document.getElementById('exp-sel-sec')?.value
    const nb    = S.meta.notebooks.find(n => n.id === nbId)
    const sec   = nb?.sections?.find(s => s.id === secId)
    const pgSel = document.getElementById('exp-sel-pg')
    if (pgSel) pgSel.innerHTML = (sec?.pages || []).map(p => `<option value="${p.id}">${p.title || 'Untitled'}</option>`).join('')
  }

  function ntExportSetScope (scope) {
    _expScope = scope
    document.querySelectorAll('.nt-scope-btn').forEach(b => b.classList.remove('on'))
    document.getElementById('exp-scope-' + (scope === 'notebook' ? 'nb' : scope === 'section' ? 'sec' : 'pg'))?.classList.add('on')
    const rowSec = document.getElementById('exp-row-sec')
    const rowPg  = document.getElementById('exp-row-pg')
    if (rowSec) rowSec.style.display = (scope === 'section' || scope === 'page') ? '' : 'none'
    if (rowPg)  rowPg.style.display  = scope === 'page' ? '' : 'none'
  }

  async function ntExportRun () {
    const nbId  = document.getElementById('exp-sel-nb')?.value
    const secId = document.getElementById('exp-sel-sec')?.value
    const pgId  = document.getElementById('exp-sel-pg')?.value
    if (!nbId) return
    ntExportClose()
    HALQ.showDebug('⏳ Exporting...')
    const result = await _apiExportNotes({ type: _expScope, nbId, secId, pgId })
    if (!result.ok) { HALQ.showErrorDialog('Export Failed', result.error); return }
    if (result.downloadUrl) {
      const a = document.createElement('a')
      a.href = result.downloadUrl
      a.download = result.fileName || 'export.zip'
      a.click()
    }
    HALQ.showDebug('✓ Export ready')
  }

  // =====================
  // PROMPT / CONFIRM MODALS
  // =====================

  function _prompt (label, defaultVal = '') {
    return new Promise(resolve => {
      S.promptRes = resolve
      if ($.promptLabel) $.promptLabel.textContent = label
      if ($.promptInput) {
        $.promptInput.value = defaultVal
        $.promptInput.type = 'text'
      }
      $.promptOverlay?.classList.add('on')
      setTimeout(() => { $.promptInput?.focus(); $.promptInput?.select() }, 40)
    })
  }

  function _promptOK () {
    const val = $.promptInput?.value
    $.promptOverlay?.classList.remove('on')
    if (S.promptRes) { S.promptRes(val); S.promptRes = null }
  }
  API._promptOK = _promptOK

  function _promptCancel () {
    $.promptOverlay?.classList.remove('on')
    if (S.promptRes) { S.promptRes(null); S.promptRes = null }
  }
  API._promptCancel = _promptCancel

  function _confirm (msg) {
    return new Promise(resolve => {
      S.confirmRes = resolve
      if ($.confirmMsg) $.confirmMsg.textContent = msg
      $.confirmOverlay?.classList.add('on')
    })
  }

  function _confirmOK () {
    $.confirmOverlay?.classList.remove('on')
    if (S.confirmRes) { S.confirmRes(true); S.confirmRes = null }
  }
  API._confirmOK = _confirmOK

  function _confirmCancel () {
    $.confirmOverlay?.classList.remove('on')
    if (S.confirmRes) { S.confirmRes(false); S.confirmRes = null }
  }
  API._confirmCancel = _confirmCancel

})()