/* ============================================
   FILE: categories.js
   PATH: public/js/categories.js
   VERSION: 2.1.0
   DESCRIPTION: Category data, manager modal, drag-drop reordering, color picker.
   ============================================ */

(function () {
  'use strict';

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
  let _categories = [];
  let _catMgrEditId = null;
  let _catMgrEditColor = null;
  let _catDragSrc = null;

  /* ---------- Public getters ---------- */
  function getList() { return _categories; }
  function getById(id) { return _categories.find(c => c.id === id) || null; }
  function getColors() { return CAT_COLORS; }

  /* ---------- Persistence (v2 — Fetch API) ---------- */
  async function load() {
    try {
      const result = await HALQ.apiGet('/categories');
      if (result.ok && result.data && result.data.length) {
        _categories = result.data;
        console.log('[CAT] loaded', _categories.length, 'categories from API');
      } else {
        console.log('[CAT] no saved categories — using defaults');
        _categories = [
          { id: 1, name: 'Follow-up', color: '#5b9cf6', sort_order: 1 },
          { id: 2, name: 'Urgent', color: '#ff453a', sort_order: 2 },
          { id: 3, name: 'Waiting on Vendor', color: '#ff9f0a', sort_order: 3 },
          { id: 4, name: 'Waiting on Tenant', color: '#34c759', sort_order: 4 },
          { id: 5, name: 'Waiting on Owner', color: '#bf5af2', sort_order: 5 },
          { id: 6, name: 'Inspection', color: '#00c7be', sort_order: 6 },
          { id: 7, name: 'Recurring', color: '#ffd93d', sort_order: 7 }
        ];
      }
    } catch (e) {
      console.error('[CAT] load error:', e);
    }
  }

  async function save() {
    try {
      const result = await HALQ.apiPost('/categories', _categories);
      console.log('[CAT] saved', _categories.length, 'categories:', result.ok ? 'OK' : 'FAIL');
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
    HALQ.app.closeAllDropdowns();
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

  async function mgrSaveEdit() {
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
    await save();
    if (HALQ.wo && HALQ.wo.selectedCatId === _catMgrEditId) select(_catMgrEditId);
  }

  async function mgrDelete() {
    const idx = _categories.findIndex(c => c.id === _catMgrEditId);
    if (idx === -1) return;
    _categories.splice(idx, 1);
    if (HALQ.wo && HALQ.wo.selectedCatId === _catMgrEditId) select(null);
    showMgrPlaceholder();
    renderMgrList();
    await save();
  }

  async function mgrAdd() {
    const input = document.getElementById('catmgr-new-input');
    const name = input ? input.value.trim() : '';
    if (!name) return;
    if (_categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      mgrStatus('Already exists', false); return;
    }
    const usedColors = new Set(_categories.map(c => c.color));
    const color = CAT_COLORS.find(c => !usedColors.has(c)) || CAT_COLORS[_categories.length % CAT_COLORS.length];
    const nextId = _categories.length ? Math.max(..._categories.map(c => c.id)) + 1 : 1;
    _categories.push({ id: nextId, name, color, sort_order: nextId });
    if (input) input.value = '';
    renderMgrList();
    mgrStatus('✓ Added: ' + name, true);
    await save();
  }

  function mgrStatus(msg, ok) {
    const el = document.getElementById('catmgr-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'catmgr-status ' + (ok ? 'ok' : 'err');
    setTimeout(() => { el.className = 'catmgr-status'; }, 2500);
  }

  /* ---------- Public API ---------- */
  HALQ.categories = {
    getList,
    getById,
    getColors,
    load,
    save,
    renderDropdown,
    toggleDropdown,
    select,
    openManager,
    closeManager,
    clickOutside,
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