/* ============================================
   FILE: categories.js
   PATH: functions/api/categories.js
   VERSION: 2.1.0
   DESCRIPTION: Categories API — CRUD for tag-based folder system.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    if (method === 'GET') {
      return await getAll(env.DB);
    }

    if (method === 'POST') {
      const body = await request.json();
      return await create(env.DB, body);
    }

    if (method === 'PUT') {
      const id = path.split('/').pop();
      const body = await request.json();
      return await update(env.DB, id, body);
    }

    if (method === 'DELETE') {
      const id = path.split('/').pop();
      return await remove(env.DB, id);
    }

    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('[API:categories]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── GET all ──
async function getAll(db) {
  const { results } = await db.prepare(
    `SELECT id, name, color, sort_order, created_at FROM categories ORDER BY sort_order, created_at`
  ).all();
  return jsonResponse({ ok: true, data: results || [] });
}

// ── POST create ──
async function create(db, body) {
  const { name, color, sort_order } = body;
  if (!name) return jsonResponse({ ok: false, error: 'name required' }, 400);

  const insert = await db.prepare(
    `INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)`
  ).bind(name, color || '#5b9cf6', sort_order || 0).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`
  ).bind('create', 'category', JSON.stringify({ name, id: insert.meta.last_row_id })).run();

  return jsonResponse({ ok: true, id: insert.meta.last_row_id });
}

// ── PUT update ──
async function update(db, id, body) {
  const fields = [];
  const values = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.color !== undefined) { fields.push('color = ?'); values.push(body.color); }
  if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }

  if (!fields.length) return jsonResponse({ ok: false, error: 'No fields to update' }, 400);

  values.push(parseInt(id));
  await db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
  ).bind('update', 'category', id, JSON.stringify(body)).run();

  return jsonResponse({ ok: true });
}

// ── DELETE ──
async function remove(db, id) {
  const catId = parseInt(id);

  // Remove all WO tags first
  await db.prepare(`DELETE FROM wo_tags WHERE category_id = ?`).bind(catId).run();

  // Clear category_ids JSON references
  const { results } = await db.prepare(`SELECT wo_number, category_ids FROM work_orders WHERE category_ids LIKE ?`).bind(`%"${id}"%`).all();
  for (const row of (results || [])) {
    const cats = JSON.parse(row.category_ids).filter(cid => cid !== id);
    await db.prepare(`UPDATE work_orders SET category_ids = ? WHERE wo_number = ?`).bind(JSON.stringify(cats), row.wo_number).run();
  }

  await db.prepare(`DELETE FROM categories WHERE id = ?`).bind(catId).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`
  ).bind('delete', 'category', id).run();

  return jsonResponse({ ok: true });
}