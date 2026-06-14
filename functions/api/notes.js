/* ============================================
   FILE: notes.js
   PATH: functions/api/notes.js
   VERSION: 2.1.0
   DESCRIPTION: Notes API — notebook tree, page CRUD, asset inline, export.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    // ── GET /api/notes/meta ──
    if (method === 'GET' && path.endsWith('/meta')) {
      return await getMeta(env.DB);
    }

    // ── POST /api/notes/meta ──
    if (method === 'POST' && path.endsWith('/meta')) {
      const body = await request.json();
      return await saveMeta(env.DB, body);
    }

    // ── GET /api/notes/pages/:id ──
    if (method === 'GET' && path.includes('/pages/')) {
      const id = path.split('/pages/').pop();
      return await getPage(env.DB, id);
    }

    // ── POST /api/notes/pages/:id ──
    if (method === 'POST' && path.includes('/pages/')) {
      const id = path.split('/pages/').pop();
      const body = await request.json();
      return await savePage(env.DB, id, body);
    }

    // ── DELETE /api/notes/pages/:id ──
    if (method === 'DELETE' && path.includes('/pages/')) {
      const id = path.split('/pages/').pop();
      return await deletePage(env.DB, id);
    }

    // ── POST /api/notes/assets ──
    if (method === 'POST' && path.endsWith('/assets')) {
      const body = await request.json();
      return await saveAsset(body);
    }

    // ── POST /api/notes/export ──
    if (method === 'POST' && path.endsWith('/export')) {
      const body = await request.json();
      return await doExport(env.DB, body);
    }

    return jsonResponse({ ok: false, error: 'Not found' }, 404);
  } catch (err) {
    console.error('[API:notes]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

// ── Helpers ──

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// =====================
// GET META — Full tree
// =====================

async function getMeta(db) {
  // Fetch all notebooks
  const { results: nbs } = await db.prepare(
    `SELECT id, name, open, created_at FROM notebooks ORDER BY created_at`
  ).all();

  // Fetch all sections
  const { results: secs } = await db.prepare(
    `SELECT id, notebook_id, name, color, open, sort_order, created_at FROM sections ORDER BY sort_order, created_at`
  ).all();

  // Fetch all pages (no content — just metadata)
  const { results: pgs } = await db.prepare(
    `SELECT id, section_id, title, sort_order, created_at FROM pages ORDER BY sort_order, created_at`
  ).all();

  // Build tree
  const notebooks = (nbs || []).map(nb => ({
    id: String(nb.id),
    name: nb.name,
    open: !!nb.open,
    sections: []
  }));

  const secMap = {};
  (secs || []).forEach(sec => {
    secMap[sec.id] = {
      id: String(sec.id),
      name: sec.name,
      color: sec.color || '#5b9cf6',
      open: !!sec.open,
      sort_order: sec.sort_order,
      pages: []
    };
    const nb = notebooks.find(n => n.id === String(sec.notebook_id));
    if (nb) nb.sections.push(secMap[sec.id]);
  });

  (pgs || []).forEach(pg => {
    const sec = secMap[pg.section_id];
    if (sec) {
      sec.pages.push({
        id: String(pg.id),
        title: pg.title || 'Untitled',
        sort_order: pg.sort_order
      });
    }
  });

  return jsonResponse({ ok: true, data: { notebooks } });
}

// =====================
// SAVE META — Upsert tree
// =====================

async function saveMeta(db, body) {
  const { notebooks } = body;
  if (!Array.isArray(notebooks)) {
    return jsonResponse({ ok: false, error: 'notebooks array required' }, 400);
  }

  // Track what we touch for cleanup
  const touchedNbIds = new Set();
  const touchedSecIds = new Set();
  const touchedPgIds = new Set();

  for (const nb of notebooks) {
    const nbId = parseInt(nb.id);
    if (isNaN(nbId)) {
      // New notebook — insert, get autoincrement ID
      const insert = await db.prepare(
        `INSERT INTO notebooks (name, open) VALUES (?, ?)`
      ).bind(nb.name, nb.open ? 1 : 0).run();
      nb.id = String(insert.meta.last_row_id);
    } else {
      // Existing — update
      await db.prepare(
        `UPDATE notebooks SET name = ?, open = ? WHERE id = ?`
      ).bind(nb.name, nb.open ? 1 : 0, nbId).run();
    }
    touchedNbIds.add(parseInt(nb.id));

    for (const sec of (nb.sections || [])) {
      const secId = parseInt(sec.id);
      if (isNaN(secId)) {
        const insert = await db.prepare(
          `INSERT INTO sections (notebook_id, name, color, open, sort_order) VALUES (?, ?, ?, ?, ?)`
        ).bind(parseInt(nb.id), sec.name, sec.color || '#5b9cf6', sec.open ? 1 : 0, sec.sort_order || 0).run();
        sec.id = String(insert.meta.last_row_id);
      } else {
        await db.prepare(
          `UPDATE sections SET notebook_id = ?, name = ?, color = ?, open = ?, sort_order = ? WHERE id = ?`
        ).bind(parseInt(nb.id), sec.name, sec.color || '#5b9cf6', sec.open ? 1 : 0, sec.sort_order || 0, secId).run();
      }
      touchedSecIds.add(parseInt(sec.id));

      for (const pg of (sec.pages || [])) {
        const pgId = parseInt(pg.id);
        if (isNaN(pgId)) {
          const insert = await db.prepare(
            `INSERT INTO pages (section_id, title, sort_order) VALUES (?, ?, ?)`
          ).bind(parseInt(sec.id), pg.title || 'Untitled', pg.sort_order || 0).run();
          pg.id = String(insert.meta.last_row_id);
        } else {
          await db.prepare(
            `UPDATE pages SET section_id = ?, title = ?, sort_order = ? WHERE id = ?`
          ).bind(parseInt(sec.id), pg.title || 'Untitled', pg.sort_order || 0, pgId).run();
        }
        touchedPgIds.add(parseInt(pg.id));
      }
    }
  }

  // Cleanup: delete pages not in touched set
  if (touchedPgIds.size) {
    const placeholders = Array.from(touchedPgIds).map(() => '?').join(',');
    await db.prepare(
      `DELETE FROM pages WHERE id NOT IN (${placeholders})`
    ).bind(...Array.from(touchedPgIds)).run();
  }

  // Cleanup: delete sections not in touched set
  if (touchedSecIds.size) {
    const placeholders = Array.from(touchedSecIds).map(() => '?').join(',');
    await db.prepare(
      `DELETE FROM sections WHERE id NOT IN (${placeholders})`
    ).bind(...Array.from(touchedSecIds)).run();
  }

  // Cleanup: delete notebooks not in touched set
  if (touchedNbIds.size) {
    const placeholders = Array.from(touchedNbIds).map(() => '?').join(',');
    await db.prepare(
      `DELETE FROM notebooks WHERE id NOT IN (${placeholders})`
    ).bind(...Array.from(touchedNbIds)).run();
  }

  // Audit
  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`
  ).bind('save_meta', 'notes', JSON.stringify({ nbCount: notebooks.length })).run();

  return jsonResponse({ ok: true, data: { notebooks } });
}

// =====================
// GET PAGE — Content
// =====================

async function getPage(db, id) {
  const row = await db.prepare(
    `SELECT id, section_id, title, content FROM pages WHERE id = ?`
  ).bind(parseInt(id)).first();

  if (!row) return jsonResponse({ ok: false, error: 'Page not found' }, 404);

  return jsonResponse({
    ok: true,
    data: {
      id: String(row.id),
      section_id: String(row.section_id),
      title: row.title,
      content: row.content || ''
    }
  });
}

// =====================
// SAVE PAGE — Content
// =====================

async function savePage(db, id, body) {
  const { content } = body;
  const pgId = parseInt(id);

  if (isNaN(pgId)) {
    return jsonResponse({ ok: false, error: 'Invalid page ID' }, 400);
  }

  await db.prepare(
    `UPDATE pages SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(content || '', pgId).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`
  ).bind('save_page', 'page', id).run();

  return jsonResponse({ ok: true });
}

// =====================
// DELETE PAGE
// =====================

async function deletePage(db, id) {
  const pgId = parseInt(id);
  if (isNaN(pgId)) {
    return jsonResponse({ ok: false, error: 'Invalid page ID' }, 400);
  }

  await db.prepare(`DELETE FROM pages WHERE id = ?`).bind(pgId).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`
  ).bind('delete_page', 'page', id).run();

  return jsonResponse({ ok: true });
}

// =====================
// SAVE ASSET — Inline base64 (Phase 0)
// =====================

async function saveAsset(body) {
  const { pageId, fileName, base64 } = body;
  if (!pageId || !fileName || !base64) {
    return jsonResponse({ ok: false, error: 'pageId, fileName, base64 required' }, 400);
  }

  // Phase 0: Return data URI for inline embedding. No R2 yet.
  // Detect MIME type from extension
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeMap = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    pdf: 'application/pdf'
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  const dataUri = `data:${mime};base64,${base64}`;

  return jsonResponse({ ok: true, src: dataUri });
}

// =====================
// EXPORT — Server-side assembly (Phase 0: JSON payload)
// =====================

async function doExport(db, body) {
  const { type, nbId, secId, pgId } = body;
  if (!type || !nbId) {
    return jsonResponse({ ok: false, error: 'type and nbId required' }, 400);
  }

  // Fetch the tree
  const metaRes = await getMeta(db);
  const meta = await metaRes.json();
  if (!meta.ok) return metaRes;

  const notebooks = meta.data.notebooks;
  const targetNb = notebooks.find(n => n.id === nbId);
  if (!targetNb) return jsonResponse({ ok: false, error: 'Notebook not found' }, 404);

  let exportData = { type, notebook: targetNb.name, sections: [] };

  if (type === 'notebook') {
    for (const sec of targetNb.sections) {
      const secData = { ...sec, pages: [] };
      for (const pg of sec.pages) {
        const pgRow = await db.prepare(`SELECT title, content FROM pages WHERE id = ?`).bind(parseInt(pg.id)).first();
        secData.pages.push({ ...pg, content: pgRow?.content || '' });
      }
      exportData.sections.push(secData);
    }
  } else if (type === 'section') {
    const targetSec = targetNb.sections.find(s => s.id === secId);
    if (!targetSec) return jsonResponse({ ok: false, error: 'Section not found' }, 404);
    const secData = { ...targetSec, pages: [] };
    for (const pg of targetSec.pages) {
      const pgRow = await db.prepare(`SELECT title, content FROM pages WHERE id = ?`).bind(parseInt(pg.id)).first();
      secData.pages.push({ ...pg, content: pgRow?.content || '' });
    }
    exportData.sections.push(secData);
  } else if (type === 'page') {
    const targetSec = targetNb.sections.find(s => s.id === secId);
    if (!targetSec) return jsonResponse({ ok: false, error: 'Section not found' }, 404);
    const targetPg = targetSec.pages.find(p => p.id === pgId);
    if (!targetPg) return jsonResponse({ ok: false, error: 'Page not found' }, 404);
    const pgRow = await db.prepare(`SELECT title, content FROM pages WHERE id = ?`).bind(parseInt(pgId)).first();
    exportData.sections.push({
      ...targetSec,
      pages: [{ ...targetPg, content: pgRow?.content || '' }]
    });
  }

  // Generate HTML wrapper
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${exportData.notebook}</title>`;
  html += `<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;line-height:1.6}</style></head><body>`;
  html += `<h1>${exportData.notebook}</h1>`;
  for (const sec of exportData.sections) {
    html += `<h2>${sec.name}</h2>`;
    for (const pg of sec.pages) {
      html += `<h3>${pg.title}</h3>${pg.content}`;
    }
  }
  html += `</body></html>`;

  // Return as base64 data URI the client can trigger download from
  const b64 = btoa(unescape(encodeURIComponent(html)));
  const fileName = `HALQ-${exportData.notebook.replace(/\s+/g, '-')}-${Date.now()}.html`;

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`
  ).bind('export', 'notes', JSON.stringify({ type, nbId, secId, pgId })).run();

  return jsonResponse({
    ok: true,
    fileName,
    downloadUrl: `data:text/html;base64,${b64}`,
    html
  });
}