/* ============================================
   FILE: tags.js
   PATH: functions/api/tags.js
   VERSION: 2.1.0
   DESCRIPTION: WO Tags API — assign/remove category tags on work orders.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  try {
    if (method === 'GET') {
      const woNumber = url.searchParams.get('wo');
      const catId = url.searchParams.get('cat');
      return await getTags(env.DB, woNumber, catId);
    }

    if (method === 'POST') {
      const body = await request.json();
      return await addTag(env.DB, body);
    }

    if (method === 'DELETE') {
      const body = await request.json();
      return await removeTag(env.DB, body);
    }

    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('[API:tags]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── GET tags ──
async function getTags(db, woNumber, catId) {
  let sql = `SELECT t.id, t.wo_number, t.category_id, t.created_at, c.name as category_name, c.color as category_color
             FROM wo_tags t JOIN categories c ON t.category_id = c.id`;
  const args = [];
  const conds = [];

  if (woNumber) { conds.push(`t.wo_number = ?`); args.push(woNumber); }
  if (catId) { conds.push(`t.category_id = ?`); args.push(parseInt(catId)); }
  if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
  sql += ` ORDER BY t.created_at DESC`;

  const { results } = await db.prepare(sql).bind(...args).all();
  return jsonResponse({ ok: true, data: results || [] });
}

// ── POST add tag ──
async function addTag(db, body) {
  const { wo_number, category_id } = body;
  if (!wo_number || !category_id) {
    return jsonResponse({ ok: false, error: 'wo_number and category_id required' }, 400);
  }

  try {
    await db.prepare(
      `INSERT INTO wo_tags (wo_number, category_id) VALUES (?, ?)`
    ).bind(wo_number, parseInt(category_id)).run();
  } catch (e) {
    if (e.message?.includes('UNIQUE')) {
      return jsonResponse({ ok: false, error: 'Tag already exists' }, 409);
    }
    throw e;
  }

  // Sync category_ids JSON on work_orders
  const existing = await db.prepare(
    `SELECT category_ids FROM work_orders WHERE wo_number = ?`
  ).bind(wo_number).first();
  let cats = existing?.category_ids ? JSON.parse(existing.category_ids) : [];
  if (!cats.includes(String(category_id))) {
    cats.push(String(category_id));
    await db.prepare(
      `UPDATE work_orders SET category_ids = ? WHERE wo_number = ?`
    ).bind(JSON.stringify(cats), wo_number).run();
  }

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
  ).bind('add_tag', 'wo_tag', wo_number, JSON.stringify({ category_id })).run();

  return jsonResponse({ ok: true });
}

// ── DELETE remove tag ──
async function removeTag(db, body) {
  const { wo_number, category_id } = body;
  if (!wo_number || !category_id) {
    return jsonResponse({ ok: false, error: 'wo_number and category_id required' }, 400);
  }

  await db.prepare(
    `DELETE FROM wo_tags WHERE wo_number = ? AND category_id = ?`
  ).bind(wo_number, parseInt(category_id)).run();

  // Sync category_ids JSON on work_orders
  const existing = await db.prepare(
    `SELECT category_ids FROM work_orders WHERE wo_number = ?`
  ).bind(wo_number).first();
  let cats = existing?.category_ids ? JSON.parse(existing.category_ids) : [];
  cats = cats.filter(id => id !== String(category_id));
  await db.prepare(
    `UPDATE work_orders SET category_ids = ? WHERE wo_number = ?`
  ).bind(JSON.stringify(cats), wo_number).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
  ).bind('remove_tag', 'wo_tag', wo_number, JSON.stringify({ category_id })).run();

  return jsonResponse({ ok: true });
}