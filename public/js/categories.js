/* ============================================
   FILE: categories.js
   PATH: public/js/categories.js
   VERSION: 2.1.5
   DESCRIPTION: Category CRUD, manager modal, drag-drop reordering.
                Uses HALQ.cat.list as single source of truth.
                All events via addEventListener (no inline onclick).
   ============================================ */

(function () {
  'use strict';

  console.log('[CAT] categories.js IIFE start');

  /* ---------- Constants ---------- */
  const CAT_COLORS = [
    '#f87171','#ef4444','#dc2626','#fca5a5',
    '#f472b6','#ec4899','#db2777','#fbcfe8',
    '#fb923c','#f97316','#ea580c','#fed7aa',
    '#fbbf24','#f59e0b','#d97706','#fde68a',
    '#4ade80','#22c55e','#16a34a','#bbf7d0',
    '#34d399','#10b981','#059669','#a7f3d0',
    '#22d3ee','#06b6d4','#0891b2','#a5f3fc',
    '#2dd4bf','#14b8a6','#0d9488','#99f6e4',
    '#60a5fa','#3b82f6','#2563eb','#bfdbfe',
    '#38bdf8','#0ea5e9','#0284c7','#bae6fd',
    '#818cf8','#6366f1','#4f46e5','#c7d2fe',
    '#a78bfa','#8b5cf6','#7c3aed','#ddd6fe',
    '#c084fc','#a855f7','#9333ea','#e9d5ff',
    '#94a3b8','#64748b','#475569','#cbd5e1',
    '#9ca3af','#6b7280','#4b5563','#d1d5db',
    '#a16207','#854d0e','#78350f','#fef08a',
  ];

  /* ---------- State ---------- */
  let _catMgrEditId = null;
  let _catMgrEditColor = null;
  let _catDragSrc = null;

  /* ---------- Helpers ---------- */
  function _list() { return HALQ.cat.list || []; }
  function _byId(id) { return _list().find(c => c.id === id) || null; }
  function _colors() { return CAT_COLORS; }

  /* ---------- Persistence (v2 — Fetch API) ---------- */
  async function load() {
    try {
      const result = await HALQ.apiGet('/categories');
      if (result.ok && result.data && result.data.length) {
        HALQ.cat.list = result.data;
        console.log('[CAT] loaded', HALQ.cat.list.length, 'categories from API');
      } else {
        console.log('[CAT] no saved categories — using defaults');
        _setDefaults();
      }
    } catch (e) {
      console.error('[CAT] load error:', e);
      _setDefaults();
    }
  }

  function _setDefaults() {
    HALQ.cat.list = [
      { id: 1, name: 'Follow-up', color: '#5b9cf6', sort_order: 1 },
      { id: 2, name: 'Urgent', color: '#ff453a', sort_order: 2 },
      { id: 3, name: 'Waiting on Vendor', color: '#ff9f0a', sort_order: 3 },
      { id: 4, name: 'Waiting on Tenant', color: '#34c759', sort_order: 4 },
      { id: 5, name: 'Waiting on Owner', color: '#bf5af2', sort_order: 5 },
      { id: 6, name: 'Inspection', color: '#00c7be', sort_order: 6 },
      { id: 7, name: 'Recurring', color: '#ffd93d', sort_order: 7 }
    ];
  }

  /* ---------- Backend sync: individual CRUD to match API contract ---------- */
  async function _apiCreate(cat) {
    const result = await HALQ.apiPost('/categories', {
      name: cat.name,
      color: cat.color,
      sort_order: cat.sort_order
    });
    if (result.ok && result.id) {
      cat.id = result.id;
      return true;
    }
    return false;
  }

  async function _apiUpdate(cat) {
    const result = await HALQ.apiPut(`/categories/${cat.id}`, {
      name: cat.name,
      color: cat.color,
      sort_order: cat.sort_order
    });
    return result.ok;
  }

  async function _apiDelete(id) {
    const result = await HALQ.apiDelete(`/categories/${id}`);
    return result.ok;
  }

  async function _apiReorder() {
    // Update sort_order for all categories
    const promises = _list().map((c, idx) =>
      HALQ.apiPut(`/categories/${c.id}`, { name: c.name, color: c.color, sort_order: idx + 1 })
    );
    await Promise.all(promises);
  }

  /* ---------- Detail drawer dropdown (rendered by wo-panel.js, but we provide helper) ---------- */
  function renderDropdown(selectedCatIds) {
    const dd = document.getElementById('cat-dropdown');
    if (!dd) return;
    const list = _list();
    dd.innerHTML = `
      <div class="cat-opt cat-opt-clear" data-catid="clear">
        <div class="cat-opt-dot" style="background:var(--border2)"></div>
        <span>Clear all</span>
      </div>
      <div class="cat-sep"></div>
      ${list.map(c => `
        <div class="cat-opt ${selectedCatIds.includes(c.id) ? 'active' : ''}" data-catid="${c.id}">
          <div class="cat-opt-dot" style="background:${c.color}"></div>
          <span style="flex:1">${c.name}</span>
          <div class="cat-checkbox">${selectedCatIds.includes(c.id) ? '✓' : ''}</div>
        </div>
      `).join('')}
      <div class="cat-sep"></div>
      <div class="cat-opt cat-opt-manage" data-action="manage">
        <span>⚙ All Categories...</span>
      </div>
    `;
  }

  /* ---------- Manager Modal ---------- */
  function openManager() {
    HALQ.app.closeAllDropdowns();
    _catMgrEditId = null;
    _catMgrEditColor = null;
    renderMgrList();
    showMgrPlaceholder();
    const newInput = document.getElementById('catmgr-new-input');
    if (newInput) newInput.value = '';
    const status = document.getElementById('catmgr-status');
    if (status) status.className = 'catmgr-status';
    const overlay = document.getElementById('catmgr-overlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeManager() {
    const overlay = document.getElementById('catmgr-overlay');
    if (overlay) overlay.classList.remove('open');
    // Refresh WO panel category chips so they reflect any changes
    if (HALQ.wo && HALQ.wo.renderCategoryChips) HALQ.wo.renderCategoryChips();
  }

  function clickOutside(e) {
    if (e.target === document.getElementById('catmgr-overlay')) closeManager();
  }

  function renderMgrList() {
    const listEl = document.getElementById('catmgr-list');
    if (!listEl) return;
    const list = _list();
    listEl.innerHTML = list.map(c => `
      <div class="catmgr-item ${_catMgrEditId === c.id ? 'selected' : ''}"
           draggable="true"
           data-catid="${c.id}">
        <span class="catmgr-drag-handle" title="Drag to reorder">⠿</span>
        <div class="catmgr-item-dot" style="background:${c.color}"></div>
        <span>${c.name}</span>
      </div>
    `).join('') || '<div style="padding:10px;font-size:11px;color:var(--text3)">No categories yet</div>';
    initMgrDrag();
    initMgrClick();
  }

  function initMgrClick() {
    const listEl = document.getElementById('catmgr-list');
    if (!listEl) return;
    listEl.querySelectorAll('.catmgr-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.catid);
        if (!isNaN(id)) mgrSelect(id);
      });
    });
  }

  function initMgrDrag() {
    const items = document.querySelectorAll('#catmgr-list .catmgr-item[draggable]');
    items.forEach(el => {
      el.addEventListener('dragstart', e => {
        _catDragSrc = el;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('#catmgr-list .catmgr-item').forEach(i => i.classList.remove('drag-over'));
        _catDragSrc = null;
      });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (el !== _catDragSrc) {
          document.querySelectorAll('#catmgr-list .catmgr-item').forEach(i => i.classList.remove('drag-over'));
          el.classList.add('drag-over');
        }
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (!_catDragSrc || _catDragSrc === el) return;
        const fromId = parseInt(_catDragSrc.dataset.catid);
        const toId = parseInt(el.dataset.catid);
        const arr = _list();
        const fromIdx = arr.findIndex(c => c.id === fromId);
        const toIdx = arr.findIndex(c => c.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        renderMgrList();
        _apiReorder().catch(e => console.error('[CAT] reorder error:', e));
      });
    });
  }

  function mgrSelect(id) {
    _catMgrEditId = id;
    const cat = _byId(id);
    if (!cat) return;
    _catMgrEditColor = cat.color;
    const renameInput = document.getElementById('catmgr-rename-input');
    if (renameInput) renameInput.value = cat.name;
    renderMgrList();
    renderMgrColors();
    const placeholder = document.getElementById('catmgr-placeholder');
    const editPanel = document.getElementById('catmgr-edit-panel');
    if (placeholder) placeholder.style.display = 'none';
    if (editPanel) editPanel.style.display = 'flex';
    const status = document.getElementById('catmgr-status');
    if (status) status.className = 'catmgr-status';
  }

  function renderMgrColors() {
    const wrap = document.getElementById('catmgr-colors');
    if (!wrap) return;
    wrap.innerHTML = CAT_COLORS.map(c => `
      <div class="catmgr-color ${_catMgrEditColor === c ? 'selected' : ''}"
           style="background:${c}"
           data-color="${c}">
      </div>
    `).join('');
    // Attach click listeners
    wrap.querySelectorAll('.catmgr-color').forEach(el => {
      el.addEventListener('click', () => {
        _catMgrEditColor = el.dataset.color;
        renderMgrColors();
      });
    });
  }

  function showMgrPlaceholder() {
    _catMgrEditId = null;
    const placeholder = document.getElementById('catmgr-placeholder');
    const editPanel = document.getElementById('catmgr-edit-panel');
    if (placeholder) placeholder.style.display = 'block';
    if (editPanel) editPanel.style.display = 'none';
  }

  async function mgrSaveEdit() {
    const nameInput = document.getElementById('catmgr-rename-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const status = document.getElementById('catmgr-status');
    if (!name) { mgrStatus('Name cannot be empty', false); return; }
    if (!_catMgrEditColor) { mgrStatus('Pick a color', false); return; }
    const cat = _byId(_catMgrEditId);
    if (!cat) return;
    cat.name = name;
    cat.color = _catMgrEditColor;
    renderMgrList();
    mgrStatus('✓ Saved', true);
    await _apiUpdate(cat);
    if (HALQ.wo && HALQ.wo.renderCategoryChips) HALQ.wo.renderCategoryChips();
  }

  async function mgrDelete() {
    const arr = _list();
    const idx = arr.findIndex(c => c.id === _catMgrEditId);
    if (idx === -1) return;
    const removed = arr.splice(idx, 1)[0];
    // Remove this category from any WOs that have it
    if (HALQ.wo && HALQ.wo.wos) {
      HALQ.wo.wos.forEach(w => {
        if (Array.isArray(w._catIds)) {
          w._catIds = w._catIds.filter(id => id !== removed.id);
        }
      });
      if (HALQ.wo.renderList) HALQ.wo.renderList();
    }
    showMgrPlaceholder();
    renderMgrList();
    await _apiDelete(removed.id);
    mgrStatus('✓ Deleted', true);
    if (HALQ.wo && HALQ.wo.renderCategoryChips) HALQ.wo.renderCategoryChips();
  }

  async function mgrAdd() {
    const input = document.getElementById('catmgr-new-input');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    const arr = _list();
    if (arr.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      mgrStatus('Already exists', false); return;
    }
    const usedColors = new Set(arr.map(c => c.color));
    const color = CAT_COLORS.find(c => !usedColors.has(c)) || CAT_COLORS[arr.length % CAT_COLORS.length];
    const nextId = arr.length ? Math.max(...arr.map(c => c.id)) + 1 : 1;
    const newCat = { id: nextId, name, color, sort_order: nextId };
    arr.push(newCat);
    if (input) input.value = '';
    renderMgrList();
    mgrStatus('✓ Added: ' + name, true);
    await _apiCreate(newCat);
    if (HALQ.wo && HALQ.wo.renderCategoryChips) HALQ.wo.renderCategoryChips();
  }

  function mgrStatus(msg, ok) {
    const el = document.getElementById('catmgr-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'catmgr-status ' + (ok ? 'ok' : 'err');
    setTimeout(() => { el.className = 'catmgr-status'; }, 2500);
  }

  /* ---------- Modal event listeners (attached once) ---------- */
  function attachModalListeners() {
    const closeBtn = document.getElementById('catmgr-close');
    const overlay = document.getElementById('catmgr-overlay');
    const saveBtn = document.getElementById('btn-catmgr-save');
    const deleteBtn = document.getElementById('btn-catmgr-delete');
    const addBtn = document.getElementById('btn-catmgr-add');

    if (closeBtn) closeBtn.addEventListener('click', closeManager);
    if (overlay) overlay.addEventListener('click', clickOutside);
    if (saveBtn) saveBtn.addEventListener('click', mgrSaveEdit);
    if (deleteBtn) deleteBtn.addEventListener('click', mgrDelete);
    if (addBtn) addBtn.addEventListener('click', mgrAdd);
  }

  /* ---------- Public API ---------- */
  HALQ.categories = {
    getList: _list,
    getById: _byId,
    getColors: _colors,
    load,
    renderDropdown,
    openManager,
    closeManager,
    clickOutside,
    mgrSelect,
    mgrPickColor: (c) => { _catMgrEditColor = c; renderMgrColors(); },
    mgrSaveEdit,
    mgrDelete,
    mgrAdd,
    mgrStatus,
    renderMgrList,
    renderMgrColors,
    showMgrPlaceholder,
    initMgrDrag,
    attachModalListeners
  };

  console.log('[CAT] categories.js IIFE complete — HALQ.categories defined:', typeof HALQ.categories);

})();