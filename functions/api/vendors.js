/* ============================================
   FILE: vendors.js
   PATH: functions/api/vendors.js
   VERSION: 2.1.0
   DESCRIPTION: Vendor Directory API — CRUD for vendor contact info.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    if (method === 'GET') {
      const search = url.searchParams.get('search');
      return await getAll(env.DB, search);
    }

    if (method === 'POST') {
      const body = await request.json();
      return await upsert(env.DB, body);
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
    console.error('[API:vendors]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── GET all (optional search) ──
async function getAll(db, search) {
  let sql = `SELECT id, name, phone1, phone2, email, created_at, updated_at FROM vendors`;
  const args = [];

  if (search) {
    sql += ` WHERE name LIKE ? OR phone1 LIKE ? OR phone2 LIKE ? OR email LIKE ?`;
    const like = `%${search}%`;
    args.push(like, like, like, like);
  }
  sql += ` ORDER BY name`;

  const { results } = await db.prepare(sql).bind(...args).all();
  return jsonResponse({ ok: true, data: results || [] });
}

// ── POST upsert (by name) ──
async function upsert(db, body) {
  const { name, phone1, phone2, email } = body;
  if (!name) return jsonResponse({ ok: false, error: 'name required' }, 400);

  const existing = await db.prepare(`SELECT id FROM vendors WHERE name = ?`).bind(name).first();

  if (existing) {
    await db.prepare(
      `UPDATE vendors SET phone1 = ?, phone2 = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(phone1 || '', phone2 || '', email || '', existing.id).run();

    await db.prepare(
      `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
    ).bind('update', 'vendor', existing.id, JSON.stringify({ name, phone1, phone2, email })).run();

    return jsonResponse({ ok: true, id: existing.id, action: 'updated' });
  } else {
    const insert = await db.prepare(
      `INSERT INTO vendors (name, phone1, phone2, email) VALUES (?, ?, ?, ?)`
    ).bind(name, phone1 || '', phone2 || '', email || '').run();

    await db.prepare(
      `INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`
    ).bind('create', 'vendor', JSON.stringify({ name, id: insert.meta.last_row_id })).run();

    return jsonResponse({ ok: true, id: insert.meta.last_row_id, action: 'created' });
  }
}

// ── PUT update by ID ──
async function update(db, id, body) {
  const fields = [];
  const values = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.phone1 !== undefined) { fields.push('phone1 = ?'); values.push(body.phone1); }
  if (body.phone2 !== undefined) { fields.push('phone2 = ?'); values.push(body.phone2); }
  if (body.email !== undefined) { fields.push('email = ?'); values.push(body.email); }

  if (!fields.length) return jsonResponse({ ok: false, error: 'No fields to update' }, 400);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(parseInt(id));

  await db.prepare(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
  ).bind('update', 'vendor', id, JSON.stringify(body)).run();

  return jsonResponse({ ok: true });
}

// ── DELETE ──
async function remove(db, id) {
  await db.prepare(`DELETE FROM vendors WHERE id = ?`).bind(parseInt(id)).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`
  ).bind('delete', 'vendor', id).run();

  return jsonResponse({ ok: true });
}