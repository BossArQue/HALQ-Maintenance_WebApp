/* ============================================
   FILE: messages.js
   PATH: public/js/messages.js
   VERSION: 2.6.0
   DESCRIPTION: Message templates, vendor directory, token resolution, clipboard send.
   ============================================ */

(function () {
  'use strict';

  // ── State ──
  const S = {
    templates: {
      tenant: { email: [], text: [] },
      vendor: { email: [], text: [] },
      owner:  { email: [], text: [] }
    },
    vendorDir: []
  };

  // ── Exports ──
  const API = {
    get templates() { return S.templates; },
    set templates(v) { S.templates = v; },
    get vendorDir() { return S.vendorDir; },
    set vendorDir(v) { S.vendorDir = v; },

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
  };

  HALQ.msg = API;

  // ── Init ──
  async function init() {
    await Promise.all([dirLoad(), loadTemplates()]);

    // Event delegation for vendor directory edit/delete (replaces inline onclick)
    const tbody = document.getElementById('vendor-dir-tbody');
    if (tbody) {
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx, 10);
        if (action === 'edit') dirEdit(idx);
        else if (action === 'delete') dirDelete(idx);
      });
    }
  }

  // =====================
  // TEMPLATES (v2 — Fetch API)
  // =====================

  async function loadTemplates() {
    try {
      const result = await HALQ.apiGet('/templates');
      if (result.ok && result.data) {
        // Normalize from DB format to internal format
        const data = result.data;
        S.templates = { tenant: { email: [], text: [] }, vendor: { email: [], text: [] }, owner: { email: [], text: [] } };
        data.forEach(t => {
          if (!S.templates[t.group_name]) S.templates[t.group_name] = { email: [], text: [] };
          if (!S.templates[t.group_name][t.type]) S.templates[t.group_name][t.type] = [];
          S.templates[t.group_name][t.type].push({ name: t.name, body: t.body });
        });
        console.log('[MSG] loaded', data.length, 'templates from API');
      }
    } catch (e) {
      console.error('[MSG] template load error:', e);
      // Fallback defaults
      S.templates = {
        tenant: {
          email: [
            { name: 'Not heard from contractor', body: `Hello {res},

If you have not heard from our contractor, please call them directly to schedule your repair.

{vendor_details}

` },
            { name: 'Vendor trying to reach you', body: `Hello {res},

Our vendor is trying to reach you. Please call them directly to schedule your repair.

{vendor_details}

` }
          ],
          text: [
            { name: 'Not heard from contractor', body: 'Hi {res}, if you have not heard from our contractor please call them directly: {vendor_details}' },
            { name: 'Vendor trying to reach you', body: 'Hi {res}, our vendor is trying to reach you. Please call them: {vendor_details}' }
          ]
        },
        vendor: {
          email: [
            { name: 'Follow up', body: `Hello,

What is the update on WO #{wo} — {prop}?

` },
            { name: 'Invoice', body: `Hello,

Please send your invoice for WO #{wo} — {prop}.

` }
          ],
          text: [
            { name: 'Follow up', body: 'Hi, what is the update on WO #{wo} at {prop}?' },
            { name: 'Invoice', body: 'Hi, please send your invoice for WO #{wo} at {prop}.' }
          ]
        },
        owner: { email: [], text: [] }
      };
    }
  }

  async function saveTemplates() {
    _readFromUI();
    try {
      // Flatten to DB format
      const flat = [];
      Object.keys(S.templates).forEach(group => {
        Object.keys(S.templates[group]).forEach(type => {
          S.templates[group][type].forEach((t, i) => {
            flat.push({ group_name: group, type, name: t.name, body: t.body, sort_order: i });
          });
        });
      });
      await HALQ.apiPost('/templates', flat);
      HALQ.showDebug('[MSG] Templates saved ✓');
    } catch (e) {
      console.error('[MSG] template save error:', e);
    }
  }

  function renderTemplates() {
    ['tenant', 'vendor', 'owner'].forEach(group => {
      ['email', 'text'].forEach(type => {
        const container = document.getElementById(`msg-list-${group}-${type}`);
        if (!container) return;
        const list = S.templates[group]?.[type] || [];
        container.innerHTML = '';
        list.forEach((tpl, i) => {
          const row = document.createElement('div');
          row.className = 'msg-template-row';
          row.innerHTML = `
            <div class="msg-template-row-header">
              <input class="msg-template-name" data-group="${group}" data-type="${type}" data-idx="${i}"
                value="${tpl.name.replace(/"/g, '&quot;')}" placeholder="Template name">
              <button class="msg-del-btn" data-action="delete-template" data-group="${group}" data-type="${type}" data-idx="${i}" title="Delete">🗑</button>
            </div>
            <textarea class="msg-template-body" data-group="${group}" data-type="${type}" data-idx="${i}"
              rows="4" placeholder="Message body... use {wo} {prop} {res} {vendor} {vendor_phone} {vendor_email} {vendor_details}">${tpl.body}</textarea>
          `;
          container.appendChild(row);
        });
      });
    });
  }

  function addTemplate(group, type) {
    if (!S.templates[group]) S.templates[group] = { email: [], text: [] };
    if (!S.templates[group][type]) S.templates[group][type] = [];
    S.templates[group][type].push({ name: 'New Template', body: '' });
    renderTemplates();
  }

  function deleteTemplate(group, type, idx) {
    S.templates[group][type].splice(idx, 1);
    renderTemplates();
  }

  function _readFromUI() {
    ['tenant', 'vendor', 'owner'].forEach(group => {
      ['email', 'text'].forEach(type => {
        const names = document.querySelectorAll(`.msg-template-name[data-group="${group}"][data-type="${type}"]`);
        const bodies = document.querySelectorAll(`.msg-template-body[data-group="${group}"][data-type="${type}"]`);
        const list = [];
        names.forEach((nameEl, i) => {
          list.push({ name: nameEl.value.trim() || 'Template', body: bodies[i]?.value || '' });
        });
        if (!S.templates[group]) S.templates[group] = {};
        S.templates[group][type] = list;
      });
    });
  }

  // =====================
  // TOKEN RESOLUTION
  // =====================

  function vendorLookup(name) {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    return S.vendorDir.find(v => v.name.trim().toLowerCase() === key) || null;
  }

  function vendorDetailsStr(v) {
    if (!v) return '';
    const lines = [v.name];
    if (v.phone1) lines.push(v.phone1);
    if (v.phone2) lines.push(v.phone2);
    if (v.email) lines.push(v.email);
    return lines.join('\n');
  }

  function resolveTokens(body, wo, vendorOverride) {
    const v = vendorOverride || vendorLookup(wo?.vendor);
    const details = vendorDetailsStr(v);
    return body
      .replace(/{wo}/g, wo?.wo || '')
      .replace(/{prop}/g, wo?.prop || '')
      .replace(/{res}/g, wo?.res || '')
      .replace(/{vendor}/g, wo?.vendor || '')
      .replace(/{vendor_phone}/g, v?.phone1 || '')
      .replace(/{vendor_email}/g, v?.email || '')
      .replace(/{vendor_details}/g, details);
  }

  // =====================
  // CONTEXT MENU SEND (v2 — Clipboard Copy, NO injection)
  // =====================

  function ctxSend(group, type, tplIdx) {
    const woNum = HALQ.wo._ctxWoNum;
    if (!woNum) return;
    HALQ.wo.closeCtxMenu();

    const wo = HALQ.wo.wos.find(x => x.wo === woNum);
    const needsVendor = (group === 'tenant' && (
      (S.templates[group]?.[type]?.[tplIdx]?.body || '').includes('{vendor')
    )) || group === 'vendor';

    const vendorName = wo?.vendor || '';
    const existingV = vendorLookup(vendorName);

    if (needsVendor && vendorName && !existingV) {
      showVendorModal({ name: vendorName, phone1: '', phone2: '', email: '' }, true, async (saved) => {
        let vendorOverride = null;
        if (saved && saved.name) {
          const existing = vendorLookup(saved.name);
          if (!existing) {
            S.vendorDir.push(saved);
            S.vendorDir.sort((a, b) => a.name.localeCompare(b.name));
          } else {
            Object.assign(existing, saved);
          }
          await dirSave();
          vendorOverride = saved;
        }
        _doSend(group, type, tplIdx, wo, vendorOverride);
      });
      return;
    }

    _doSend(group, type, tplIdx, wo, existingV);
  }

  function _doSend(group, type, tplIdx, wo, vendorOverride) {
    const body = tplIdx >= 0
      ? resolveTokens(S.templates[group]?.[type]?.[tplIdx]?.body || '', wo, vendorOverride)
      : resolveTokens('', wo, vendorOverride);

    const tplName = tplIdx >= 0 ? S.templates[group]?.[type]?.[tplIdx]?.name : 'Free Message';
    HALQ.showDebug(`[MSG] Composed: ${group} / ${type} / ${tplName}`);

    // v2: Copy to clipboard + open AppFolio in new tab
    navigator.clipboard.writeText(body).then(() => {
      HALQ.showDebug('✓ Message copied to clipboard');
      // Open AppFolio WO search in new tab
      const woSearch = (wo?.wo || '').split('-')[0];
      if (woSearch) {
        const url = `https://talley.appfolio.com/search/advanced_search?full_text_search=${encodeURIComponent(woSearch)}&section_keys=work_orders`;
        window.open(url, '_blank');
        HALQ.showDebug('✓ AppFolio opened in new tab — paste message manually');
      }
    }).catch(err => {
      HALQ.showDebug('✗ Clipboard failed: ' + err.message);
      // Fallback: show modal with copy button
      _showCopyModal(body, wo);
    });
  }

  function _showCopyModal(body, wo) {
    const existing = document.getElementById('msg-copy-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'msg-copy-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:20px 24px;width:520px;max-width:92vw;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:13px;color:var(--text)">📋 Copy Message</span>
          <span onclick="document.getElementById('msg-copy-modal').remove()" style="cursor:pointer;color:var(--text3);font-size:16px;line-height:1">✕</span>
        </div>
        <div style="font-size:11px;color:var(--text3)">Message copied to clipboard. AppFolio opened in new tab.</div>
        <textarea readonly style="background:var(--surface2);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-family:monospace;font-size:12px;padding:10px;width:100%;height:140px;resize:vertical;outline:none;user-select:text">${HALQ.app.utils.escapeHtml(body)}</textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button onclick="navigator.clipboard.writeText(this.dataset.body).then(()=>this.textContent='✓ Copied')" data-body="${HALQ.app.utils.escapeHtml(body)}" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Copy Again</button>
          <button onclick="document.getElementById('msg-copy-modal').remove()" style="background:var(--accent);border:none;color:#fff;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:12px">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // =====================
  // VENDOR MODAL
  // =====================

  function showVendorModal(vendor, isPrompt, onSave) {
    document.getElementById('vendor-modal-overlay')?.remove();

    const esc = s => (s || '').replace(/"/g, '&quot;');
    const overlay = document.createElement('div');
    overlay.id = 'vendor-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center';
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
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#vendor-modal-close').addEventListener('click', close);
    overlay.querySelector('#vmod-cancel').addEventListener('click', () => { close(); if (isPrompt && onSave) onSave(null); });
    overlay.querySelector('#vmod-save').addEventListener('click', async () => {
      const updated = {
        name: document.getElementById('vmod-name').value.trim(),
        phone1: document.getElementById('vmod-phone1').value.trim(),
        phone2: document.getElementById('vmod-phone2').value.trim(),
        email: document.getElementById('vmod-email').value.trim()
      };
      close();
      if (onSave) onSave(updated);
    });
    setTimeout(() => document.getElementById('vmod-name')?.focus(), 60);
  }

  // =====================
  // VENDOR DIRECTORY (v2 — Fetch API)
  // =====================

  async function dirLoad() {
    try {
      const r = await HALQ.apiGet('/vendors');
      if (r.ok) S.vendorDir = r.data || [];
      console.log('[VENDOR] loaded', S.vendorDir.length, 'vendors from API');
    } catch (e) { console.error('[VENDOR DIR] load error:', e); }
  }

  async function dirSave() {
    try {
      await HALQ.apiPost('/vendors', S.vendorDir);
      console.log('[VENDOR] saved', S.vendorDir.length, 'vendors');
    } catch (e) { console.error('[VENDOR DIR] save error:', e); }
  }

  function dirRenderTable(filter) {
    const tbody = document.getElementById('vendor-dir-tbody');
    const countEl = document.getElementById('vendor-dir-count');
    if (!tbody) return;
    const q = (filter || '').trim().toLowerCase();
    const list = q ? S.vendorDir.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.phone1 || '').includes(q) ||
      (v.email || '').toLowerCase().includes(q)
    ) : S.vendorDir;

    tbody.innerHTML = list.map((v, visIdx) => {
      const realIdx = S.vendorDir.indexOf(v);
      const esc = s => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px 8px;color:var(--text)">${esc(v.name)}</td>
        <td style="padding:5px 8px;color:var(--text2)">${esc(v.phone1)}</td>
        <td style="padding:5px 8px;color:var(--text2)">${esc(v.phone2)}</td>
        <td style="padding:5px 8px;color:var(--text2)">${esc(v.email)}</td>
        <td style="padding:5px 4px;text-align:center">
          <button style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:2px 4px" data-action="edit" data-idx="${realIdx}" title="Edit">✎</button>
          <button style="background:none;border:none;cursor:pointer;color:var(--red);font-size:11px;padding:2px 4px" data-action="delete" data-idx="${realIdx}" title="Delete">🗑</button>
        </td>
      </tr>`;
    }).join('');

    if (countEl) countEl.textContent = q
      ? `${list.length} of ${S.vendorDir.length} vendors`
      : `${S.vendorDir.length} vendors`;
  }

  async function dirImportExcel() {
    const statusEl = document.getElementById('vendor-dir-status');
    if (statusEl) { statusEl.textContent = 'Importing from Excel…'; statusEl.className = 'creds-status'; }
    // v2: Use file input to read Excel via SheetJS
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headers = json[0].map(h => String(h).trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('vendor'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('cell'));
        const emailIdx = headers.findIndex(h => h.includes('email'));

        const imported = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row[nameIdx]) continue;
          imported.push({
            name: String(row[nameIdx]).trim(),
            phone1: phoneIdx >= 0 ? String(row[phoneIdx] || '') : '',
            phone2: '',
            email: emailIdx >= 0 ? String(row[emailIdx] || '') : ''
          });
        }

        const importMap = {};
        imported.forEach(v => { importMap[v.name.trim().toLowerCase()] = v; });
        const kept = S.vendorDir.filter(v => !importMap[v.name.trim().toLowerCase()]);
        S.vendorDir = [...kept, ...imported].sort((a, b) => a.name.localeCompare(b.name));
        await dirSave();
        dirRenderTable(document.getElementById('vendor-dir-search')?.value);
        if (statusEl) { statusEl.textContent = `✓ Imported ${imported.length} vendors`; statusEl.className = 'creds-status ok'; }
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
      } catch (err) {
        if (statusEl) { statusEl.textContent = '✗ ' + err.message; statusEl.className = 'creds-status err'; }
      }
    };
    input.click();
  }

  function dirAddManual() {
    const newV = { name: '', phone1: '', phone2: '', email: '' };
    S.vendorDir.push(newV);
    const idx = S.vendorDir.length - 1;
    dirRenderTable(document.getElementById('vendor-dir-search')?.value);
    dirEdit(idx);
  }

  function dirEdit(idx) {
    const v = S.vendorDir[idx];
    if (!v) return;
    showVendorModal(v, false, async (updated) => {
      S.vendorDir[idx] = updated;
      S.vendorDir.sort((a, b) => a.name.localeCompare(b.name));
      await dirSave();
      dirRenderTable(document.getElementById('vendor-dir-search')?.value);
    });
  }

  async function dirDelete(idx) {
    S.vendorDir.splice(idx, 1);
    await dirSave();
    dirRenderTable(document.getElementById('vendor-dir-search')?.value);
  }

})();