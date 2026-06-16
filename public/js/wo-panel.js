/* ============================================
   FILE: wo-panel.js
   PATH: public/js/wo-panel.js
   VERSION: 2.1.4
   DESCRIPTION: WO list, filtering, detail drawer, Excel upload, context menu.
                All events via addEventListener (no inline onclick).
   ============================================ */

(function () {
  'use strict';

  // ── State ──
  const S = {
    wos: [],
    currentFilter: 'all',
    selected: null,
    currentFollowup: null,
    selectedCatIds: [],
    _ctxWoNum: null,
    _uploadParsing: false
  };

  // ── DOM refs (cached) ──
  let $ = {};

  function cache() {
    $ = {
      list: document.getElementById('wo-list'),
      searchInput: document.getElementById('wo-search-input'),
      searchClear: document.getElementById('wo-search-clear'),
      detail: document.getElementById('wo-detail'),
      detailBody: document.querySelector('.wo-detail-body'),
      filters: document.getElementById('wo-filters'),
      filterMoreWrap: document.getElementById('wo-filter-more-wrap'),
      filterMoreBtn: document.getElementById('wo-filter-more-btn'),
      filterDropdown: document.getElementById('wo-filter-dropdown'),
      filterDDList: document.getElementById('wo-filter-dd-list'),
      followupTrigger: document.getElementById('followup-trigger'),
      followupVal: document.getElementById('followup-val'),
      followupDD: document.getElementById('followup-dropdown'),
      followupCustom: document.getElementById('followup-custom-row'),
      followupCustomInput: document.getElementById('followup-custom-input'),
      catTrigger: document.getElementById('cat-trigger'),
      catTriggerStrips: document.getElementById('cat-trigger-strips'),
      catTriggerLabel: document.getElementById('cat-trigger-label'),
      catDropdown: document.getElementById('cat-dropdown'),
      ctxMenu: document.getElementById('wo-ctx-menu'),
      bbCount: document.getElementById('bb-wo-count'),
      bbOverdue: document.getElementById('bb-overdue'),
      navBadge: document.getElementById('nav-wo-badge'),
      woCountLabel: document.getElementById('wo-count-label'),
      prefColorCode: document.getElementById('pref-color-code'),
      prefAutoSearch: document.getElementById('pref-auto-search'),
      dWO: document.getElementById('d-wo'),
      dProp: document.getElementById('d-prop'),
      dRes: document.getElementById('d-res'),
      dVendor: document.getElementById('d-vendor'),
      dStatus: document.getElementById('d-status'),
      dAge: document.getElementById('d-age'),
      dJob: document.getElementById('d-job'),
      uploadOverlay: document.getElementById('upload-overlay'),
      uploadDropzone: document.getElementById('upload-dropzone'),
      uploadFileInput: document.getElementById('upload-file-input'),
      uploadStatus: document.getElementById('upload-status'),
      btnUploadExcel: document.getElementById('btn-upload-excel'),
      btnSaveDetail: document.getElementById('btn-save-detail'),
      btnUploadCancel: document.getElementById('btn-upload-cancel'),
      detailClose: document.getElementById('wo-detail-close')
    };
  }

  // ── Exports ──
  const API = {
    get wos() { return S.wos; },
    get currentFilter() { return S.currentFilter; },
    get selected() { return S.selected; },
    get selectedCatIds() { return S.selectedCatIds; },
    set selectedCatIds(v) { S.selectedCatIds = v; updateCatTrigger(); },
    set currentFollowup(v) { S.currentFollowup = v; },
    get currentFollowup() { return S.currentFollowup; },

    init,
    renderList,
    filter,
    toggleChip,
    select,
    saveDetail,
    toggleDetail,
    updateBottomBar,

    // Tags & categories
    loadTags,
    saveTags,
    renderCategoryChips,
    selectCatFilter,
    selectCat,
    closeCatDropdown,
    toggleCatDropdown,
    toggleFilterCatDropdown,
    updateCatTrigger,
    updateCatBtn: _updateCatBtn,

    // Follow-up
    toggleFollowup,
    setFollowup,
    setFollowupCustom,
    initFollowupDates,

    // Context menu
    showCtxMenu,
    closeCtxMenu,
    ctxSetFollowup,
    ctxSetFollowupCustom,
    ctxToggleCat,
    ctxClearCats,
    ctxSave: _ctxSave,

    // Upload
    uploadExcel,

    // Internal helpers
    getAgeClass,
    getItemClass,
    getStatusClass,
    getFilteredWOs,
    fmtDate: HALQ.fmtDate,
    fmtDateISO: HALQ.fmtDateISO,
    nextBizDay: HALQ.nextBizDay,
    nextNextBizDay: HALQ.nextNextBizDay,
    getNextFriday: HALQ.getNextFriday,
    calendarAgeToBizDays: HALQ.calendarAgeToBizDays,
    getWeekStart: HALQ.getWeekStart
  };

  HALQ.wo = API;

  // ── Init ──
  function init() {
    cache();
    attachEventListeners();
    initFollowupDates();
    initCtxDelegation();
    initUploadHandlers();
    initDetailScrollClose();
    // Load WOs from API
    loadWOs().then(() => {
      renderList();
      updateBottomBar();
    });
  }

  // Attach ALL event listeners (no inline onclick)
  function attachEventListeners() {
    // Search
    if ($.searchInput) {
      $.searchInput.addEventListener('input', e => filter(e.target.value));
    }
    if ($.searchClear) {
      $.searchClear.addEventListener('click', () => {
        $.searchInput.value = '';
        filter('');
      });
    }

    // Filter chips (delegation)
    if ($.filters) {
      $.filters.addEventListener('click', e => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        const filterType = chip.dataset.filter;
        if (filterType) toggleChip(chip, filterType);
      });
    }

    // Category filter more button
    if ($.filterMoreBtn) {
      $.filterMoreBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleFilterCatDropdown(e);
      });
    }

    // Follow-up trigger
    if ($.followupTrigger) {
      $.followupTrigger.addEventListener('click', e => {
        e.stopPropagation();
        toggleFollowup();
      });
    }

    // Follow-up options (delegation on portal dropdown)
    if ($.followupDD) {
      $.followupDD.addEventListener('click', e => {
        const opt = e.target.closest('.followup-opt');
        if (!opt) return;
        const key = opt.dataset.followup;
        if (key === 'custom') {
          $.followupCustom.classList.add('open');
          if ($.followupCustomInput) {
            $.followupCustomInput.focus();
            try { $.followupCustomInput.showPicker(); } catch (_) {}
          }
        } else if (key) {
          setFollowup(key);
        }
      });
    }

    // Custom date input
    if ($.followupCustomInput) {
      $.followupCustomInput.addEventListener('change', e => {
        if (e.target.value) setFollowupCustom(e.target.value);
      });
    }

    // Category trigger
    if ($.catTrigger) {
      $.catTrigger.addEventListener('click', e => {
        e.stopPropagation();
        toggleCatDropdown();
      });
    }

    // Category options (delegation on portal dropdown)
    if ($.catDropdown) {
      $.catDropdown.addEventListener('click', e => {
        const opt = e.target.closest('.cat-opt');
        if (!opt) return;
        if (opt.classList.contains('cat-opt-manage')) {
          HALQ.categories?.renderManager?.();
          HALQ.app.closeAllDropdowns();
          return;
        }
        if (opt.classList.contains('cat-opt-clear')) {
          selectCat(null);
          return;
        }
        const catId = parseInt(opt.dataset.catid);
        if (!isNaN(catId)) selectCat(catId);
      });
    }

    // Detail close
    if ($.detailClose) {
      $.detailClose.addEventListener('click', toggleDetail);
    }

    // Save button
    if ($.btnSaveDetail) {
      $.btnSaveDetail.addEventListener('click', saveDetail);
    }

    // Upload button
    if ($.btnUploadExcel) {
      $.btnUploadExcel.addEventListener('click', uploadExcel);
    }

    // Upload cancel
    if ($.btnUploadCancel) {
      $.btnUploadCancel.addEventListener('click', () => {
        if ($.uploadOverlay) $.uploadOverlay.style.display = 'none';
      });
    }

    // Global click to close dropdowns (if clicking outside)
    document.addEventListener('click', e => {
      if (e.target.closest('.followup-dropdown') || e.target.closest('.cat-dropdown') ||
          e.target.closest('.wo-filter-dropdown') || e.target.closest('#wo-ctx-menu') ||
          e.target.closest('.followup-trigger') || e.target.closest('.cat-trigger') ||
          e.target.closest('.wo-filter-more-btn')) {
        return;
      }
      HALQ.app.closeAllDropdowns();
    });
  }

  // Close dropdowns when detail panel scrolls
  function initDetailScrollClose() {
    if ($.detailBody) {
      $.detailBody.addEventListener('scroll', () => {
        HALQ.app.closeAllDropdowns();
      });
    }
  }

  // =====================
  // API: LOAD WOs (v2)
  // =====================

  async function loadWOs() {
    try {
      const result = await HALQ.apiGet('/wos');
      if (result.ok && result.data) {
        S.wos = result.data.map(row => ({
          wo: row.wo_number,
          prop: row.property_street || row.property_name || row.property || '',
          unit: row.unit || '',
          res: row.primary_resident || '',
          vendor: row.vendor || '',
          status: row.status || 'Waiting',
          age: row.created_at ? Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000) : 0,
          job: row.job_description || '',
          priority: row.priority || '',
          _followup: row.follow_up_date || null,
          _catIds: row.category_ids ? JSON.parse(row.category_ids) : [],
          _raw: row
        }));
        console.log('[WO] loaded', S.wos.length, 'work orders from API');
      }
    } catch (e) {
      console.error('[WO] load error:', e);
    }
  }

  // =====================
  // API: SAVE TAGS (v2)
  // =====================

  async function saveTags() {
    if (!S.selected) return;
    try {
      await HALQ.apiPut(`/wos/${S.selected.wo}`, {
        follow_up_date: S.selected._followup,
        category_ids: S.selected._catIds
      });
      console.log('[TAGS] saved to API:', S.selected.wo);
    } catch (e) {
      console.error('[TAGS] save error:', e);
    }
  }

  async function loadTags() {
    return Promise.resolve();
  }

  // =====================
  // RENDERING
  // =====================

  function getAgeClass(age) {
    if ($.prefColorCode && !$.prefColorCode.classList.contains('on')) return '';
    return age > 60 ? 'old' : age > 20 ? 'mid' : 'new';
  }

  function getItemClass(age, followup) {
    if ($.prefColorCode && !$.prefColorCode.classList.contains('on')) return '';
    if (followup) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const due = new Date(followup + 'T00:00:00');
      if (due < today) return 'overdue';
      if (due.getTime() === today.getTime()) return 'due-today';
      return 'on-track';
    }
    return 'on-track';
  }

  function getStatusClass(s) {
    return s === 'Assigned' ? 'assigned' : s === 'Scheduled' ? 'scheduled' : 'waiting';
  }

  function getFilteredWOs() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (S.currentFilter === 'overdue')
      return S.wos.filter(w => w._followup && new Date(w._followup + 'T00:00:00') < today);
    if (S.currentFilter === 'today')
      return S.wos.filter(w => w._followup && new Date(w._followup + 'T00:00:00').getTime() === today.getTime());
    if (S.currentFilter.startsWith('cat:')) {
      const catId = parseInt(S.currentFilter.split(':')[1]);
      return S.wos.filter(w => {
        const ids = Array.isArray(w._catIds) ? w._catIds : (w._catId ? [w._catId] : []);
        return ids.includes(catId);
      });
    }
    return S.wos;
  }

  function renderList(data) {
    if (!data) data = getFilteredWOs();
    if (!data.length) {
      $.list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No work orders found</div>';
      return;
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisWeekMon = HALQ.getWeekStart(today);
    const nextWeekMon = new Date(thisWeekMon); nextWeekMon.setDate(thisWeekMon.getDate() + 7);
    const weekAfterMon = new Date(thisWeekMon); weekAfterMon.setDate(thisWeekMon.getDate() + 14);
    const weekAfterEnd = new Date(thisWeekMon); weekAfterEnd.setDate(thisWeekMon.getDate() + 21);

    const noDate = data.filter(w => !w._followup).sort((a, b) => b.age - a.age);
    const withDate = data.filter(w => w._followup);

    const overdue = withDate.filter(w => { const d = new Date(w._followup + 'T00:00:00'); return d < thisWeekMon; }).sort((a, b) => new Date(a._followup) - new Date(b._followup));
    const thisWeek = withDate.filter(w => { const d = new Date(w._followup + 'T00:00:00'); return d >= thisWeekMon && d < nextWeekMon; }).sort((a, b) => new Date(a._followup) - new Date(b._followup));
    const nextWeek = withDate.filter(w => { const d = new Date(w._followup + 'T00:00:00'); return d >= nextWeekMon && d < weekAfterMon; }).sort((a, b) => new Date(a._followup) - new Date(b._followup));
    const weekAfter = withDate.filter(w => { const d = new Date(w._followup + 'T00:00:00'); return d >= weekAfterMon && d < weekAfterEnd; }).sort((a, b) => new Date(a._followup) - new Date(b._followup));
    const later = withDate.filter(w => { const d = new Date(w._followup + 'T00:00:00'); return d >= weekAfterEnd; }).sort((a, b) => new Date(a._followup) - new Date(b._followup));

    function woCard(w) {
      const catIds = Array.isArray(w._catIds) ? w._catIds : (w._catId ? [w._catId] : []);
      const cats = catIds.map(id => HALQ.cat.getById(id)).filter(Boolean);
      const strips = cats.length
        ? `<div class="wo-cat-strips">${cats.map(c => `<div class="wo-cat-strip" style="background:${c.color}" title="${c.name}">${c.name}</div>`).join('')}</div>`
        : '';
      const followupLabel = w._followup ? `<div style="font-size:9px;color:var(--accent);margin-top:2px">📅 ${HALQ.fmtDate(new Date(w._followup + 'T00:00:00'))}</div>` : '';
      const ageColor = w.age > 45 ? 'var(--red)' : w.age > 14 ? 'var(--yellow)' : 'var(--green)';
      const ageBg = w.age > 45 ? 'rgba(248,113,113,0.12)' : w.age > 14 ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.12)';
      const circumference = 81.7;
      const fillRatio = Math.min(w.age / 90, 1);
      const dashOffset = circumference * (1 - fillRatio);
      const colorCodeOn = !$.prefColorCode || $.prefColorCode.classList.contains('on');
      const ringColor = colorCodeOn ? ageColor : 'var(--border2)';
      const ringBg = colorCodeOn ? ageBg : 'rgba(255,255,255,0.05)';

      const ageRing = `<div class="wo-age-ring">
        <svg viewBox="0 0 36 36" width="36" height="36">
          <circle cx="18" cy="18" r="13" fill="none" stroke="${ringBg}" stroke-width="2.5"/>
          <circle cx="18" cy="18" r="13" fill="none" stroke="${ringColor}" stroke-width="2.5"
            stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset.toFixed(1)}" stroke-linecap="round"/>
        </svg>
        <span class="wo-age-ring-label" style="color:${ringColor}">${w.age}d</span>
      </div>`;

      return `<div class="wo-item ${getItemClass(w.age, w._followup)}" data-wo="${w.wo}" style="flex-direction:row;gap:8px;align-items:flex-start;padding:8px 10px 8px 8px">
        ${ageRing}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
          <div class="wo-item-top">
            <div class="wo-status-dot ${getStatusClass(w.status)}"></div>
            <div class="wo-num">${w.wo}</div>
            ${w.priority ? `<div class="wo-tag">${w.priority}</div>` : ''}
          </div>
          <div class="wo-prop">${w.prop}${w.unit ? ' · ' + w.unit : ''}</div>
          <div class="wo-item-bot"><div class="wo-vendor">${w.vendor}</div></div>
          ${followupLabel}
          ${strips}
        </div>
      </div>`;
    }

    function sectionHeader(label, count) {
      return `<div style="
        padding: 6px 10px 5px; font-size: 9px; font-weight: 700;
        color: var(--text2); text-transform: uppercase; letter-spacing: 0.12em;
        background: var(--surface); margin-top: 6px;
        border-top: 2px solid var(--border2); border-bottom: 1px solid var(--border);
        display:flex; justify-content:space-between; align-items:center;
        position: sticky; top: 0; z-index: 1;
      "><span style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:3px;height:12px;border-radius:2px;background:var(--accent);flex-shrink:0"></span>
        ${label}
      </span><span style="background:var(--surface2);color:var(--text3);font-size:9px;padding:1px 6px;border-radius:8px;border:1px solid var(--border)">${count}</span></div>`;
    }

    let html = '';
    const hasDateGroups = thisWeek.length || nextWeek.length || weekAfter.length || later.length;

    if (noDate.length) {
      if (hasDateGroups) html += sectionHeader('Due / No Date', noDate.length);
      html += noDate.map(woCard).join('');
    }
    if (overdue.length) html += sectionHeader('⚠ Overdue', overdue.length) + overdue.map(woCard).join('');
    if (thisWeek.length) html += sectionHeader('This Week', thisWeek.length) + thisWeek.map(woCard).join('');
    if (nextWeek.length) html += sectionHeader('Next Week', nextWeek.length) + nextWeek.map(woCard).join('');
    if (weekAfter.length) html += sectionHeader('Week After', weekAfter.length) + weekAfter.map(woCard).join('');
    if (later.length) html += sectionHeader('Later', later.length) + later.map(woCard).join('');

    $.list.innerHTML = html;

    $.list.querySelectorAll('.wo-item').forEach(el => {
      el.addEventListener('click', () => select(el.dataset.wo));
    });

    renderCategoryChips();
  }

  // =====================
  // FILTERING
  // =====================

  function filter(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) { renderList(); return; }
    const base = getFilteredWOs();
    const filtered = base.filter(w =>
      w.wo.toLowerCase().includes(q) ||
      (w.prop || '').toLowerCase().includes(q) ||
      (w.vendor || '').toLowerCase().includes(q) ||
      (w.res || '').toLowerCase().includes(q) ||
      (w.job || '').toLowerCase().includes(q)
    );
    renderList(filtered);
  }

  function toggleChip(el, filter) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.wo-filter-dd-item').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
    S.currentFilter = filter;
    if ($.searchInput && $.searchInput.value) {
      $.searchInput.value = '';
      HALQ.updateSearchClear($.searchInput);
    }
    _updateCatBtn();
    renderList();
  }


  // =====================
  // CATEGORY FILTER CHIPS
  // =====================

  function renderCategoryChips() {
    if (!$.filterDDList) return;
    const usedIds = new Set();
    S.wos.forEach(w => {
      const ids = Array.isArray(w._catIds) ? w._catIds : (w._catId ? [w._catId] : []);
      ids.forEach(id => usedIds.add(id));
    });
    const usedCats = HALQ.cat.list.filter(c => usedIds.has(c.id));

    if ($.filterMoreWrap) $.filterMoreWrap.style.display = usedCats.length ? '' : 'none';

    if (!usedCats.length) {
      $.filterDDList.innerHTML = '<div class="wo-filter-dd-empty">No categories assigned</div>';
      return;
    }

    $.filterDDList.innerHTML = usedCats.map(cat => {
      const count = S.wos.filter(w => {
        const ids = Array.isArray(w._catIds) ? w._catIds : (w._catId ? [w._catId] : []);
        return ids.includes(cat.id);
      }).length;
      const isActive = S.currentFilter === 'cat:' + cat.id;
      return `<div class="wo-filter-dd-item${isActive ? ' active' : ''}" data-catid="${cat.id}">
        <span class="wo-filter-dd-dot" style="background:${cat.color}"></span>
        <span style="flex:1">${cat.name}</span>
        <span class="wo-filter-dd-count">${count}</span>
      </div>`;
    }).join('');

    // Attach click listeners to filter dropdown items
    $.filterDDList.querySelectorAll('.wo-filter-dd-item').forEach(el => {
      el.addEventListener('click', e => {
        const catId = parseInt(e.currentTarget.dataset.catid);
        if (!isNaN(catId)) selectCatFilter(catId);
      });
    });

    _updateCatBtn();
  }

  function selectCatFilter(catId) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    S.currentFilter = 'cat:' + catId;
    closeCatDropdown();
    if ($.searchInput && $.searchInput.value) {
      $.searchInput.value = '';
      HALQ.updateSearchClear($.searchInput);
    }
    renderCategoryChips();
    renderList();
  }

  function _updateCatBtn() {
    if (!$.filterMoreBtn) return;
    if (S.currentFilter.startsWith('cat:')) {
      const cat = HALQ.cat.getById(parseInt(S.currentFilter.split(':')[1]));
      $.filterMoreBtn.classList.add('cat-active');
      $.filterMoreBtn.style.background = cat ? cat.color : 'var(--accent)';
      $.filterMoreBtn.style.borderColor = cat ? cat.color : 'var(--accent)';
      $.filterMoreBtn.textContent = (cat ? cat.name : 'Category') + ' ▾';
    } else {
      $.filterMoreBtn.classList.remove('cat-active');
      $.filterMoreBtn.style.background = '';
      $.filterMoreBtn.style.borderColor = '';
      $.filterMoreBtn.textContent = 'Categories ▾';
    }
  }

  function toggleFilterCatDropdown(e) {
    e.stopPropagation();
    if (!$.filterDropdown) return;
    if ($.filterDropdown.classList.contains('open')) { closeCatDropdown(); return; }
    const r = $.filterMoreBtn.getBoundingClientRect();
    $.filterDropdown.style.top = (r.bottom + 4) + 'px';
    $.filterDropdown.style.right = (window.innerWidth - r.right) + 'px';
    $.filterDropdown.style.left = 'auto';
    $.filterDropdown.classList.add('open');
  }

  function closeCatDropdown() {
    $.filterDropdown?.classList.remove('open');
  }

  // =====================
  // SELECTION & DETAIL
  // =====================

  function select(woNum) {
    S.selected = S.wos.find(w => w.wo === woNum);
    if (!S.selected) return;

    document.querySelectorAll('.wo-item').forEach(el => {
      el.classList.toggle('active', el.dataset.wo === woNum);
    });

    $.dWO.textContent = S.selected.wo;
    $.dProp.textContent = S.selected.prop + (S.selected.unit ? ' · ' + S.selected.unit : '');
    $.dRes.textContent = S.selected.res || '—';
    $.dVendor.textContent = S.selected.vendor || '—';
    $.dStatus.textContent = S.selected.status;
    $.dAge.textContent = S.selected.age + ' days';
    $.dJob.textContent = S.selected.job || '—';

    S.currentFollowup = S.selected._followup || null;
    if (S.currentFollowup) {
      try { $.followupVal.textContent = HALQ.fmtDate(new Date(S.currentFollowup + 'T00:00:00')); }
      catch (_) { $.followupVal.textContent = S.currentFollowup; }
    } else {
      $.followupVal.textContent = '— Not set —';
    }
    document.querySelectorAll('.followup-opt').forEach(o => o.classList.remove('active'));

    const rawIds = S.selected._catIds;
    if (Array.isArray(rawIds)) S.selectedCatIds = [...rawIds];
    else if (S.selected._catId) S.selectedCatIds = [S.selected._catId];
    else S.selectedCatIds = [];
    updateCatTrigger();

    // Auto-search in Appfolio (v2 — new tab)
    const autoSearchOn = !$.prefAutoSearch || $.prefAutoSearch.classList.contains('on');
    if (autoSearchOn) HALQ.af.autoSearchWO(S.selected);

    $.detail.classList.add('open');
  }

  function toggleDetail() {
    $.detail?.classList.toggle('open');
  }

  async function saveDetail() {
    if (!S.selected) return;
    S.selected._followup = S.currentFollowup || null;
    S.selected._catIds = [...S.selectedCatIds];

    try {
      await HALQ.apiPut(`/wos/${S.selected.wo}`, {
        follow_up_date: S.selected._followup,
        category_ids: S.selected._catIds
      });

      const btn = document.querySelector('.detail-actions .btn-primary');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Saved';
        btn.style.background = 'var(--green)';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
      }

      renderList();
    } catch (e) {
      console.error('[SAVE] error:', e);
      HALQ.showDebug('✗ Save failed: ' + e.message);
    }
  }

  // =====================
  // FOLLOW-UP DATE
  // =====================

  function initFollowupDates() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const elTomorrow = document.getElementById('fo-tomorrow');
    const elNextday = document.getElementById('fo-nextday');
    const elThisweek = document.getElementById('fo-thisweek');
    const elNextweek = document.getElementById('fo-nextweek');
    if (elTomorrow) elTomorrow.textContent = HALQ.fmtDate(HALQ.nextBizDay(today));
    if (elNextday) elNextday.textContent = HALQ.fmtDate(HALQ.nextNextBizDay(today));
    if (elThisweek) elThisweek.textContent = HALQ.fmtDate(HALQ.getNextFriday(today, 0)) + ' (Fri)';
    if (elNextweek) elNextweek.textContent = HALQ.fmtDate(HALQ.getNextFriday(today, 1)) + ' (Fri)';
  }

  function toggleFollowup() {
    const isOpen = $.followupDD.classList.contains('open');
    HALQ.app.closeAllDropdowns();
    if (!isOpen) {
      $.followupDD.classList.add('open');
      initFollowupDates();
      const rect = $.followupTrigger.getBoundingClientRect();
      $.followupDD.style.width = rect.width + 'px';
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280 && rect.top > 280) {
        $.followupDD.style.top = '';
        $.followupDD.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        $.followupDD.style.left = rect.left + 'px';
      } else {
        $.followupDD.style.bottom = '';
        $.followupDD.style.top = (rect.bottom + 4) + 'px';
        $.followupDD.style.left = rect.left + 'px';
      }
    }
  }

  function setFollowup(key) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let date;
    if (key === 'tomorrow') date = HALQ.nextBizDay(today);
    else if (key === 'nextday') date = HALQ.nextNextBizDay(today);
    else if (key === 'thisweek') date = HALQ.getNextFriday(today, 0);
    else if (key === 'nextweek') date = HALQ.getNextFriday(today, 1);

    S.currentFollowup = HALQ.fmtDateISO(date);
    $.followupVal.textContent = HALQ.fmtDate(date);
    HALQ.app.closeAllDropdowns();
  }

  function setFollowupCustom(isoVal) {
    if (!isoVal) return;
    const d = new Date(isoVal + 'T00:00:00');
    S.currentFollowup = isoVal;
    $.followupVal.textContent = HALQ.fmtDate(d);
    HALQ.app.closeAllDropdowns();
  }

  // =====================
  // CATEGORY DROPDOWN (Detail Drawer)
  // =====================

  function renderCatDropdown() {
    if (!$.catDropdown) return;
    const cats = HALQ.cat.list;
    $.catDropdown.innerHTML = `
      <div class="cat-opt cat-opt-clear" data-catid="clear">
        <div class="cat-opt-dot" style="background:var(--border2)"></div>
        <span>Clear all</span>
      </div>
      <div class="cat-sep"></div>
      ${cats.map(c => `
        <div class="cat-opt ${S.selectedCatIds.includes(c.id) ? 'active' : ''}" data-catid="${c.id}">
          <div class="cat-opt-dot" style="background:${c.color}"></div>
          <span style="flex:1">${c.name}</span>
          <div class="cat-checkbox">${S.selectedCatIds.includes(c.id) ? '✓' : ''}</div>
        </div>
      `).join('')}
      <div class="cat-sep"></div>
      <div class="cat-opt cat-opt-manage">
        <span>⚙ All Categories...</span>
      </div>
    `;
  }

  function toggleCatDropdown() {
    const isOpen = $.catDropdown.classList.contains('open');
    HALQ.app.closeAllDropdowns();
    if (!isOpen) {
      renderCatDropdown();
      $.catDropdown.classList.add('open');
      const rect = $.catTrigger.getBoundingClientRect();
      $.catDropdown.style.width = rect.width + 'px';
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 300 && rect.top > 300) {
        $.catDropdown.style.top = '';
        $.catDropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        $.catDropdown.style.left = rect.left + 'px';
      } else {
        $.catDropdown.style.bottom = '';
        $.catDropdown.style.top = (rect.bottom + 4) + 'px';
        $.catDropdown.style.left = rect.left + 'px';
      }
    }
  }

  function selectCat(id) {
    if (id === null) {
      S.selectedCatIds = [];
    } else {
      const idx = S.selectedCatIds.indexOf(id);
      if (idx === -1) S.selectedCatIds.push(id);
      else S.selectedCatIds.splice(idx, 1);
    }
    updateCatTrigger();
    if (S.selected) S.selected._catIds = [...S.selectedCatIds];
    renderCatDropdown();
  }

  function updateCatTrigger() {
    const cats = S.selectedCatIds.map(id => HALQ.cat.getById(id)).filter(Boolean);
    if (cats.length) {
      $.catTriggerStrips.innerHTML = cats.map(c =>
        `<div style="width:8px;height:8px;border-radius:50%;background:${c.color};flex-shrink:0" title="${c.name}"></div>`
      ).join('');
      $.catTriggerLabel.textContent = cats.length === 1 ? cats[0].name : cats.map(c => c.name).join(', ');
    } else {
      $.catTriggerStrips.innerHTML = '';
      $.catTriggerLabel.textContent = '— None —';
    }
  }

  // =====================
  // BOTTOM BAR
  // =====================

  function updateBottomBar() {
    const count = S.wos.length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = S.wos.filter(w => w._followup && new Date(w._followup + 'T00:00:00') < today).length;
    if ($.woCountLabel) $.woCountLabel.textContent = 'Active Monitoring · ' + count + ' open';
    if ($.bbCount) $.bbCount.textContent = count || '—';
    if ($.bbOverdue) $.bbOverdue.textContent = overdue || '—';
    if ($.navBadge) $.navBadge.textContent = count || '';
  }

  // =====================
  // CONTEXT MENU
  // =====================

  function initCtxDelegation() {
    if ($.list._ctxDelegated) return;
    $.list._ctxDelegated = true;
    $.list.addEventListener('contextmenu', e => {
      const item = e.target.closest('.wo-item');
      if (!item) return;
      showCtxMenu(e, item.dataset.wo);
    });
  }

  function closeCtxMenu() {
    if ($.ctxMenu) $.ctxMenu.style.display = 'none';
    S._ctxWoNum = null;
  }

  function showCtxMenu(e, woNum) {
    e.preventDefault();
    e.stopPropagation();
    S._ctxWoNum = woNum;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = HALQ.nextBizDay(today);
    const nextday = HALQ.nextNextBizDay(today);
    const thisweek = HALQ.getNextFriday(today, 0);
    const nextweek = HALQ.getNextFriday(today, 1);

    const w = S.wos.find(x => x.wo === woNum);
    const catIds = Array.isArray(w?._catIds) ? w._catIds : [];

    const tpl = HALQ.msg.templates;

    function flyout(id, items) {
      return `<div class="wo-ctx-flyout" id="${id}">${items}</div>`;
    }

    function tplItems(group, type) {
      let s = '';
      const list = (tpl[group]?.[type]) || [];
      list.forEach((t, i) => {
        s += `<div class="wo-ctx-item" data-group="${group}" data-type="${type}" data-idx="${i}">${t.name}</div>`;
      });
      s += `<div class="wo-ctx-item" data-freemsg="${group},${type}" style="color:var(--text3);font-style:italic">✏ Free Message</div>`;
      return s;
    }

    const tenantEmailFlyout = flyout('ctx-fly-tenant-email', tplItems('tenant', 'email'));
    const tenantTextFlyout = flyout('ctx-fly-tenant-text', tplItems('tenant', 'text'));
    const vendorEmailFlyout = flyout('ctx-fly-vendor-email', tplItems('vendor', 'email'));
    const vendorTextFlyout = flyout('ctx-fly-vendor-text', tplItems('vendor', 'text'));

    const tenantFlyout = flyout('ctx-fly-tenant',
      `<div class="wo-ctx-item has-flyout">📧 Email${tenantEmailFlyout}</div>` +
      `<div class="wo-ctx-item has-flyout">💬 Text${tenantTextFlyout}</div>`
    );
    const vendorFlyout = flyout('ctx-fly-vendor',
      `<div class="wo-ctx-item has-flyout">📧 Email${vendorEmailFlyout}</div>` +
      `<div class="wo-ctx-item has-flyout">💬 Text${vendorTextFlyout}</div>`
    );

    const followupFlyout = flyout('ctx-fly-followup',
      [
        { key: 'tomorrow', label: 'Tomorrow', date: tomorrow },
        { key: 'nextday', label: 'Next Day', date: nextday },
        { key: 'thisweek', label: 'This Week', date: thisweek },
        { key: 'nextweek', label: 'Next Week', date: nextweek },
      ].map(opt =>
        `<div class="wo-ctx-item" data-ctx-followup="${opt.key}">
          <span style="font-size:14px">📅</span>
          <span style="flex:1">${opt.label}</span>
          <span style="font-size:12px;color:var(--text3);font-family:monospace">${HALQ.fmtDate(opt.date)}</span>
        </div>`
      ).join('') +
      `<div class="wo-ctx-item" data-ctx-followup="custom">
        <span style="font-size:14px">📅</span><span>Custom…</span>
      </div>`
    );

    let catItems = '';
    if (catIds.length) {
      catItems += `<div class="wo-ctx-item" data-ctx-clearcats="1">
        <span class="ctx-dot" style="background:var(--border2)"></span>
        <span style="color:var(--text3);font-style:italic">Clear all</span>
      </div>`;
    }
    HALQ.cat.list.forEach(cat => {
      const active = catIds.includes(cat.id);
      catItems += `<div class="wo-ctx-item" data-ctx-catid="${cat.id}">
        <span class="ctx-dot" style="background:${cat.color}"></span>
        <span style="flex:1">${cat.name}</span>
        ${active ? '<span style="color:var(--accent);font-size:14px">✓</span>' : ''}
      </div>`;
    });
    if (!catItems) catItems = `<div class="wo-ctx-item" style="color:var(--text3);font-style:italic">No categories</div>`;
    const categoryFlyout = flyout('ctx-fly-category', catItems);

    let html = '';
    html += '<div class="wo-ctx-section">Messages</div>';
    html += `<div class="wo-ctx-item has-flyout">👤 Tenant${tenantFlyout}</div>`;
    html += `<div class="wo-ctx-item has-flyout">🔧 Vendor${vendorFlyout}</div>`;
    html += '<div class="wo-ctx-sep"></div>';
    html += '<div class="wo-ctx-section">Tag</div>';
    html += `<div class="wo-ctx-item has-flyout">📅 Follow-up Date${followupFlyout}</div>`;
    if (HALQ.cat.list.length) {
      html += `<div class="wo-ctx-item has-flyout">🏷 Category${categoryFlyout}</div>`;
    }

    $.ctxMenu.innerHTML = html;
    $.ctxMenu.style.display = 'block';

    // Attach delegation listener for context menu items
    $.ctxMenu.onclick = e => {
      const item = e.target.closest('.wo-ctx-item');
      if (!item) return;

      if (item.dataset.ctxFollowup) {
        if (item.dataset.ctxFollowup === 'custom') ctxSetFollowupCustom();
        else ctxSetFollowup(item.dataset.ctxFollowup);
        return;
      }
      if (item.dataset.ctxCatid) {
        ctxToggleCat(parseInt(item.dataset.ctxCatid));
        return;
      }
      if (item.dataset.ctxClearcats) {
        ctxClearCats();
        return;
      }
      if (item.dataset.group && item.dataset.type) {
        HALQ.msg.ctxSend(item.dataset.group, item.dataset.type, parseInt(item.dataset.idx));
        closeCtxMenu();
        return;
      }
      if (item.dataset.freemsg) {
        const [group, type] = item.dataset.freemsg.split(',');
        HALQ.msg.ctxSend(group, type, -1);
        closeCtxMenu();
        return;
      }
    };

    const vw = window.innerWidth, vh = window.innerHeight;
    let x = e.clientX, y = e.clientY;
    $.ctxMenu.style.left = '0'; $.ctxMenu.style.top = '0';
    requestAnimationFrame(() => {
      const mw = $.ctxMenu.offsetWidth, mh = $.ctxMenu.offsetHeight;
      if (x + mw > vw - 8) x = vw - mw - 8;
      if (y + mh > vh - 8) y = vh - mh - 8;
      $.ctxMenu.style.left = x + 'px';
      $.ctxMenu.style.top = y + 'px';

      $.ctxMenu.querySelectorAll('.wo-ctx-item.has-flyout').forEach(item => {
        item.addEventListener('mouseenter', () => {
          const fly = item.querySelector(':scope > .wo-ctx-flyout');
          if (!fly) return;
          const r = item.getBoundingClientRect();
          fly.style.top = r.top + 'px';
          fly.style.left = (r.right + 2) + 'px';
          requestAnimationFrame(() => {
            if (r.right + fly.offsetWidth + 8 > vw) {
              fly.style.left = (r.left - fly.offsetWidth - 2) + 'px';
            }
            if (r.top + fly.offsetHeight + 8 > vh) {
              fly.style.top = (vh - fly.offsetHeight - 8) + 'px';
            }
          });
        });
      });
    });
  }

  async function _ctxSave(woNum, patch) {
    const w = S.wos.find(x => x.wo === woNum);
    if (!w) return;
    if ('_followup' in patch) w._followup = patch._followup;
    if ('_catIds' in patch) w._catIds = patch._catIds;

    try {
      await HALQ.apiPut(`/wos/${woNum}`, {
        follow_up_date: w._followup || null,
        category_ids: Array.isArray(w._catIds) ? w._catIds : []
      });

      if (S.selected && S.selected.wo === woNum) {
        S.currentFollowup = w._followup || null;
        S.selectedCatIds = [...(w._catIds || [])];
        if ($.followupVal) $.followupVal.textContent = S.currentFollowup ? HALQ.fmtDate(new Date(S.currentFollowup + 'T00:00:00')) : '— Not set —';
        updateCatTrigger();
      }
      renderList();
      updateBottomBar();
      HALQ.showDebug('✓ Saved: ' + woNum);
    } catch (e) {
      console.error('[CTX SAVE] error:', e);
      HALQ.showDebug('✗ Save failed: ' + e.message);
    }
  }

  function ctxSetFollowup(key) {
    if (!S._ctxWoNum) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let date;
    if (key === 'tomorrow') date = HALQ.nextBizDay(today);
    else if (key === 'nextday') date = HALQ.nextNextBizDay(today);
    else if (key === 'thisweek') date = HALQ.getNextFriday(today, 0);
    else if (key === 'nextweek') date = HALQ.getNextFriday(today, 1);
    _ctxSave(S._ctxWoNum, { _followup: HALQ.fmtDateISO(date) });
    closeCtxMenu();
  }

  function ctxSetFollowupCustom() {
    if (!S._ctxWoNum) return;
    const woNum = S._ctxWoNum;
    closeCtxMenu();
    HALQ.promptDate('Pick follow-up date:', date => {
      if (date) _ctxSave(woNum, { _followup: date });
    });
  }

  function ctxToggleCat(catId) {
    if (!S._ctxWoNum) return;
    const w = S.wos.find(x => x.wo === S._ctxWoNum);
    if (!w) return;
    const ids = Array.isArray(w._catIds) ? [...w._catIds] : [];
    const idx = ids.indexOf(catId);
    if (idx === -1) ids.push(catId);
    else ids.splice(idx, 1);
    _ctxSave(S._ctxWoNum, { _catIds: ids });
    closeCtxMenu();
  }

  function ctxClearCats() {
    if (!S._ctxWoNum) return;
    _ctxSave(S._ctxWoNum, { _catIds: [] });
    closeCtxMenu();
  }

  // Close context menu on outside click/scroll/escape
  document.addEventListener('click', e => {
    if (!$.ctxMenu || $.ctxMenu.style.display === 'none') return;
    if ($.ctxMenu.contains(e.target)) return;
    closeCtxMenu();
  });
  document.addEventListener('scroll', closeCtxMenu, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtxMenu(); });

  // =====================
  // EXCEL UPLOAD (v2 — SheetJS + Fetch API)
  // =====================

  function initUploadHandlers() {
    if (!$.uploadDropzone || !$.uploadFileInput) return;

    // Click to browse
    $.uploadDropzone.addEventListener('click', () => $.uploadFileInput.click());

    // File input change
    $.uploadFileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleUploadFile(file);
    });

    // Drag & drop
    $.uploadDropzone.addEventListener('dragover', e => {
      e.preventDefault();
      $.uploadDropzone.classList.add('drag-over');
    });
    $.uploadDropzone.addEventListener('dragleave', () => {
      $.uploadDropzone.classList.remove('drag-over');
    });
    $.uploadDropzone.addEventListener('drop', e => {
      e.preventDefault();
      $.uploadDropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleUploadFile(file);
    });
  }

  function uploadExcel() {
    if ($.uploadOverlay) $.uploadOverlay.style.display = 'flex';
    if ($.uploadStatus) $.uploadStatus.textContent = '';
  }

  async function handleUploadFile(file) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      if ($.uploadStatus) $.uploadStatus.textContent = '✗ Please select an Excel file (.xlsx, .xls, .csv)';
      return;
    }

    if ($.uploadStatus) $.uploadStatus.textContent = '⏳ Parsing...';
    S._uploadParsing = true;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Parse Active Monitoring sheet (or first sheet)
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('active')) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!jsonData.length) {
        if ($.uploadStatus) $.uploadStatus.textContent = '✗ No data found in sheet';
        S._uploadParsing = false;
        return;
      }

      // Map columns — v2 uses full column names from AppFolio export
      const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
      const colMap = {};
      headers.forEach((h, i) => {
        if (h.includes('work order') || h === 'wo') colMap.wo = i;
        if (h.includes('property') && !h.includes('name')) colMap.property = i;
        if (h.includes('property name') || h === 'property_name') colMap.property_name = i;
        if (h.includes('street') || h.includes('address')) colMap.property_street = i;
        if (h.includes('unit') || h === 'unit number') colMap.unit = i;
        if (h.includes('resident') || h.includes('tenant')) colMap.resident = i;
        if (h.includes('created') || h.includes('date created')) colMap.created = i;
        if (h.includes('priority')) colMap.priority = i;
        if (h.includes('status')) colMap.status = i;
        if (h.includes('vendor')) colMap.vendor = i;
        if (h.includes('job') || h.includes('description') || h.includes('summary')) colMap.job = i;
      });

      // If no headers matched, try legacy column positions (A-AD mapping)
      if (Object.keys(colMap).length < 3) {
        colMap.wo = 4;           // Column E
        colMap.property = 28;    // Column AC
        colMap.unit = 9;         // Column J
        colMap.resident = 10;    // Column K
        colMap.created = 11;     // Column L
        colMap.priority = 1;     // Column B
        colMap.status = 7;       // Column H
        colMap.vendor = 8;       // Column I
        colMap.job = 5;          // Column F
      }

      const wos = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row[colMap.wo]) continue;

        const woNum = String(row[colMap.wo]).trim();
        if (!woNum) continue;

        const createdStr = row[colMap.created] ? String(row[colMap.created]) : '';
        let age = 0;
        if (createdStr) {
          try {
            const created = new Date(createdStr);
            age = Math.floor((Date.now() - created.getTime()) / 86400000);
          } catch (_) { }
        }

        wos.push({
          wo_number: woNum,
          property: row[colMap.property] ? String(row[colMap.property]) : '',
          property_name: row[colMap.property_name] ? String(row[colMap.property_name]) : '',
          property_street: row[colMap.property] ? String(row[colMap.property]) : '',
          unit: row[colMap.unit] ? String(row[colMap.unit]) : '',
          primary_resident: row[colMap.resident] ? String(row[colMap.resident]) : '',
          created_at: createdStr || new Date().toISOString().split('T')[0],
          priority: row[colMap.priority] ? String(row[colMap.priority]) : '',
          status: row[colMap.status] ? String(row[colMap.status]) : 'Waiting',
          vendor: row[colMap.vendor] ? String(row[colMap.vendor]) : '',
          job_description: row[colMap.job] ? String(row[colMap.job]) : '',
          age: age
        });
      }

      if ($.uploadStatus) $.uploadStatus.textContent = `⏳ Uploading ${wos.length} work orders...`;

      // Send to API
      const result = await HALQ.apiPost('/upload', { wos });

      if (result.ok) {
        if ($.uploadStatus) {
          $.uploadStatus.innerHTML = `✓ Uploaded: <strong>${result.inserted}</strong> new, <strong>${result.updated}</strong> updated, <strong>${result.autoClosed}</strong> closed`;
        }
        // Reload WOs from API
        await loadWOs();
        renderList();
        updateBottomBar();
        setTimeout(() => {
          if ($.uploadOverlay) $.uploadOverlay.style.display = 'none';
          if ($.uploadStatus) $.uploadStatus.textContent = '';
        }, 3000);
      } else {
        if ($.uploadStatus) $.uploadStatus.textContent = '✗ Upload failed: ' + (result.error || 'Unknown error');
      }
    } catch (e) {
      console.error('[UPLOAD] error:', e);
      if ($.uploadStatus) $.uploadStatus.textContent = '✗ Error: ' + e.message;
    } finally {
      S._uploadParsing = false;
      if ($.uploadFileInput) $.uploadFileInput.value = '';
    }
  }

})();