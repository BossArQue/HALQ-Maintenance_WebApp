/* ============================================
   FILE: templates.js
   PATH: functions/api/templates.js
   VERSION: 2.1.0
   DESCRIPTION: Message Templates API — CRUD for tenant/vendor/owner templates.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    if (method === 'GET') {
      const group = url.searchParams.get('group');
      const type = url.searchParams.get('type');
      return await getAll(env.DB, group, type);
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
    console.error('[API:templates]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── GET all (optional filter by group/type) ──
async function getAll(db, group, type) {
  let sql = `SELECT id, group_name, type, name, body, sort_order, created_at FROM message_templates`;
  const args = [];
  const conds = [];

  if (group) { conds.push(`group_name = ?`); args.push(group); }
  if (type) { conds.push(`type = ?`); args.push(type); }
  if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
  sql += ` ORDER BY group_name, sort_order, created_at`;

  const { results } = await db.prepare(sql).bind(...args).all();
  return jsonResponse({ ok: true, data: results || [] });
}

// ── POST create ──
async function create(db, body) {
  const { group_name, type, name, body: templateBody, sort_order } = body;
  if (!group_name || !type || !name || !templateBody) {
    return jsonResponse({ ok: false, error: 'group_name, type, name, body required' }, 400);
  }

  const insert = await db.prepare(
    `INSERT INTO message_templates (group_name, type, name, body, sort_order) VALUES (?, ?, ?, ?, ?)`
  ).bind(group_name, type, name, templateBody, sort_order || 0).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`
  ).bind('create', 'message_template', JSON.stringify({ name, id: insert.meta.last_row_id })).run();

  return jsonResponse({ ok: true, id: insert.meta.last_row_id });
}

// ── PUT update ──
async function update(db, id, body) {
  const fields = [];
  const values = [];

  if (body.group_name !== undefined) { fields.push('group_name = ?'); values.push(body.group_name); }
  if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type); }
  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.body !== undefined) { fields.push('body = ?'); values.push(body.body); }
  if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }

  if (!fields.length) return jsonResponse({ ok: false, error: 'No fields to update' }, 400);

  values.push(parseInt(id));
  await db.prepare(`UPDATE message_templates SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
  ).bind('update', 'message_template', id, JSON.stringify(body)).run();

  return jsonResponse({ ok: true });
}

// ── DELETE ──
async function remove(db, id) {
  await db.prepare(`DELETE FROM message_templates WHERE id = ?`).bind(parseInt(id)).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`
  ).bind('delete', 'message_template', id).run();

  return jsonResponse({ ok: true });
}