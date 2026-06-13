/* ============================================================
   HALQ — Category Manager (extracted from index.html monolith)
   ============================================================

   This module handles:
   - Category data storage and persistence
   - Category manager modal UI
   - Drag-and-drop reordering
   - Color picker
   - Add / rename / delete categories

   Dependencies: HALQ.app (for IPC via window.halq), HALQ.wo
   Loaded after: app.js, wo-panel.js
   ============================================================ */

window.HALQ = window.HALQ || {};
HALQ.categories = (function () {
  'use strict';

  /* ---------- Constants ---------- */
  const CAT_COLORS = [
    // Reds / Pinks
    '#f87171','#ef4444','#dc2626','#fca5a5',
    '#f472b6','#ec4899','#db2777','#fbcfe8',
    // Oranges / Yellows
    '#fb923c','#f97316','#ea580c','#fed7aa',
    '#fbbf24','#f59e0b','#d97706','#fde68a',
    // Greens
    '#4ade80','#22c55e','#16a34a','#bbf7d0',
    '#34d399','#10b981','#059669','#a7f3d0',
    // Teals / Cyans
    '#22d3ee','#06b6d4','#0891b2','#a5f3fc',
    '#2dd4bf','#14b8a6','#0d9488','#99f6e4',
    // Blues
    '#60a5fa','#3b82f6','#2563eb','#bfdbfe',
    '#38bdf8','#0ea5e9','#0284c7','#bae6fd',
    // Purples / Indigos
    '#818cf8','#6366f1','#4f46e5','#c7d2fe',
    '#a78bfa','#8b5cf6','#7c3aed','#ddd6fe',
    '#c084fc','#a855f7','#9333ea','#e9d5ff',
    // Neutrals
    '#94a3b8','#64748b','#475569','#cbd5e1',
    '#9ca3af','#6b7280','#4b5563','#d1d5db',
    '#a16207','#854d0e','#78350f','#fef08a',
  ];

  /* ---------- State ---------- */
  let _categories = [
    { id: 1, name: 'Low Monitoring', color: '#60a5fa' },
    { id: 2, name: 'For Invoice',    color: '#fbbf24' },
    { id: 3, name: 'Urgent',         color: '#f87171' }
  ];
  let _nextCatId = 4;
  let _catMgrEditId = null;
  let _catMgrEditColor = null;
  let _catDragSrc = null;

  /* ---------- Public getters ---------- */
  function getList()      { return _categories; }
  function getById(id)    { return _categories.find(c => c.id === id) || null; }
  function getColors()    { return CAT_COLORS; }

  /* ---------- Persistence ---------- */
  async function load() {
    try {
      const result = await window.halq.categoriesLoad();
      console.log('[CAT] load result:', JSON.stringify(result));
      if (result.ok && result.categories.length) {
        _categories = result.categories;
        _nextCatId = Math.max(..._categories.map(c => c.id)) + 1;
        console.log('[CAT] loaded', _categories.length, 'categories');
      } else {
        console.log('[CAT] no saved categories found — using defaults');
      }
    } catch (e) {
      console.error('[CAT] load error:', e);
    }
  }

  async function save() {
    try {
      console.log('[CAT] saving', _categories.length, 'categories:', _categories.map(c => c.name));
      const result = await window.halq.categoriesSave(_categories);
      console.log('[CAT] save result:', JSON.stringify(result));
    } catch (e) {
      console.error('[CAT] save error:', e);
    }
  }

  /* ---------- Detail drawer dropdown ---------- */
  function renderDropdown(selectedCatIds) {
    const dd = document.getElementById('cat-dropdown');
    if (!dd) return;
    dd.innerHTML = `
      <div class="cat-opt cat-opt-clear" onclick="HALQ.categories.select(null)">
        <div class="cat-opt-dot" style="background:var(--border2)"></div>
        <span>Clear all</span>
      </div>
      <div class="cat-sep"></div>
      ${_categories.map(c => `
        <div class="cat-opt ${selectedCatIds.includes(c.id) ? 'active' : ''}" onclick="HALQ.categories.select(${c.id})">
          <div class="cat-opt-dot" style="background:${c.color}"></div>
          <span style="flex:1">${c.name}</span>
          <div class="cat-checkbox">${selectedCatIds.includes(c.id) ? '✓' : ''}</div>
        </div>
      `).join('')}
      <div class="cat-sep"></div>
      <div class="cat-opt cat-opt-manage" onclick="HALQ.categories.openManager()">
        <span>⚙ All Categories...</span>
      </div>
    `;
  }

  function toggleDropdown() {
    const dd = document.getElementById('cat-dropdown');
    const trigger = document.getElementById('cat-trigger');
    if (!dd || !trigger) return;
    const isOpen = dd.classList.contains('open');
    if (window.HALQ.app && HALQ.app.closeAllDropdowns) HALQ.app.closeAllDropdowns();
    if (!isOpen) {
      renderDropdown(HALQ.wo ? HALQ.wo.selectedCatIds : []);
      dd.classList.add('open');
      const rect = trigger.getBoundingClientRect();
      dd.style.width = rect.width + 'px';
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 300 && rect.top > 300) {
        dd.style.top = '';
        dd.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
      } else {
        dd.style.bottom = '';
        dd.style.top = (rect.bottom + 4) + 'px';
      }
      dd.style.left = rect.left + 'px';
    }
  }

  function select(id) {
    if (!HALQ.wo) return;
    if (id === null) {
      HALQ.wo.selectedCatIds = [];
    } else {
      const idx = HALQ.wo.selectedCatIds.indexOf(id);
      if (idx === -1) HALQ.wo.selectedCatIds.push(id);
      else HALQ.wo.selectedCatIds.splice(idx, 1);
    }
    HALQ.wo.updateCatTrigger();
    if (HALQ.wo.selected) HALQ.wo.selected._catIds = [...HALQ.wo.selectedCatIds];
    renderDropdown(HALQ.wo.selectedCatIds);
  }

  /* ---------- Manager Modal ---------- */
  function openManager() {
    if (HALQ.app && HALQ.app.closeAllDropdowns) HALQ.app.closeAllDropdowns();
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
    renderDropdown(HALQ.wo ? HALQ.wo.selectedCatIds : []);
  }

  function clickOutside(e) {
    if (e.target === document.getElementById('catmgr-overlay')) closeManager();
  }

  function renderMgrList() {
    const list = document.getElementById('catmgr-list');
    if (!list) return;
    list.innerHTML = _categories.map(c => `
      <div class="catmgr-item ${_catMgrEditId === c.id ? 'selected' : ''}"
           draggable="true"
           data-catid="${c.id}"
           onclick="HALQ.categories.mgrSelect(${c.id})">
        <span class="catmgr-drag-handle" title="Drag to reorder">⠿</span>
        <div class="catmgr-item-dot" style="background:${c.color}"></div>
        <span>${c.name}</span>
      </div>
    `).join('') || '<div style="padding:10px;font-size:11px;color:var(--text3)">No categories yet</div>';
    initMgrDrag();
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
        const fromIdx = _categories.findIndex(c => c.id === fromId);
        const toIdx = _categories.findIndex(c => c.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = _categories.splice(fromIdx, 1);
        _categories.splice(toIdx, 0, moved);
        renderMgrList();
        renderDropdown(HALQ.wo ? HALQ.wo.selectedCatIds : []);
        save();
      });
    });
  }

  function mgrSelect(id) {
    _catMgrEditId = id;
    const cat = getById(id);
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
           onclick="HALQ.categories.mgrPickColor('${c}')">
      </div>
    `).join('');
  }

  function mgrPickColor(color) {
    _catMgrEditColor = color;
    renderMgrColors();
  }

  function showMgrPlaceholder() {
    _catMgrEditId = null;
    const placeholder = document.getElementById('catmgr-placeholder');
    const editPanel = document.getElementById('catmgr-edit-panel');
    if (placeholder) placeholder.style.display = 'block';
    if (editPanel) editPanel.style.display = 'none';
  }

  function mgrSaveEdit() {
    const nameInput = document.getElementById('catmgr-rename-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const status = document.getElementById('catmgr-status');
    if (!name) { mgrStatus('Name cannot be empty', false); return; }
    if (!_catMgrEditColor) { mgrStatus('Pick a color', false); return; }
    const cat = getById(_catMgrEditId);
    if (!cat) return;
    cat.name = name;
    cat.color = _catMgrEditColor;
    renderMgrList();
    mgrStatus('✓ Saved', true);
    save();
    if (HALQ.wo && HALQ.wo.selectedCatId === _catMgrEditId) select(_catMgrEditId);
  }

  function mgrDelete() {
    const idx = _categories.findIndex(c => c.id === _catMgrEditId);
    if (idx === -1) return;
    _categories.splice(idx, 1);
    if (HALQ.wo && HALQ.wo.selectedCatId === _catMgrEditId) select(null);
    showMgrPlaceholder();
    renderMgrList();
    save();
  }

  function mgrAdd() {
    const input = document.getElementById('catmgr-new-input');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    if (_categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      mgrStatus('Already exists', false); return;
    }
    const usedColors = new Set(_categories.map(c => c.color));
    const color = CAT_COLORS.find(c => !usedColors.has(c)) || CAT_COLORS[_categories.length % CAT_COLORS.length];
    _categories.push({ id: _nextCatId++, name, color });
    if (input) input.value = '';
    renderMgrList();
    mgrStatus('✓ Added: ' + name, true);
    save();
  }

  function mgrStatus(msg, ok) {
    const el = document.getElementById('catmgr-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'catmgr-status ' + (ok ? 'ok' : 'err');
    setTimeout(() => { el.className = 'catmgr-status'; }, 2500);
  }

  /* ---------- Public API ---------- */
  return {
    // Data
    getList,
    getById,
    getColors,
    // Persistence
    load,
    save,
    // Detail drawer dropdown
    renderDropdown,
    toggleDropdown,
    select,
    // Manager modal
    openManager,
    closeManager,
    clickOutside,
    // Manager internals (called from HTML onclick handlers)
    mgrSelect,
    mgrPickColor,
    mgrSaveEdit,
    mgrDelete,
    mgrAdd,
    mgrStatus,
    renderMgrList,
    renderMgrColors,
    showMgrPlaceholder,
    initMgrDrag
  };
})();