/* ============================================
   FILE: wos.js
   PATH: functions/api/wos.js
   VERSION: 2.0.0
   DESCRIPTION: Work Orders API — GET list, GET single, POST create/upsert, PUT update, DELETE.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  try {
    if (method === 'GET') {
      const id = url.pathname.split('/').pop();
      if (id && id !== 'wos') {
        return await getOne(env.DB, id);
      }
      return await getAll(env.DB, url.searchParams);
    }

    if (method === 'POST') {
      const body = await request.json();
      return await upsert(env.DB, body);
    }

    if (method === 'PUT') {
      const id = url.pathname.split('/').pop();
      const body = await request.json();
      return await update(env.DB, id, body);
    }

    if (method === 'DELETE') {
      const id = url.pathname.split('/').pop();
      return await remove(env.DB, id);
    }

    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('[API:wos]', err);
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

// ── GET all WOs ──
async function getAll(db, params) {
  const filter = params.get('filter') || 'all';
  const search = params.get('search') || '';
  const catId = params.get('cat');

  let sql = `SELECT * FROM work_orders WHERE is_active = 1`;
  const args = [];

  if (filter === 'overdue') {
    sql += ` AND follow_up_date IS NOT NULL AND follow_up_date < date('now')`;
  } else if (filter === 'today') {
    sql += ` AND follow_up_date = date('now')`;
  }

  if (search) {
    sql += ` AND (wo_number LIKE ? OR property LIKE ? OR vendor LIKE ? OR primary_resident LIKE ? OR job_description LIKE ?)`;
    const like = `%${search}%`;
    args.push(like, like, like, like, like);
  }

  if (catId) {
    sql += ` AND (category_ids LIKE ? OR EXISTS (SELECT 1 FROM wo_tags WHERE wo_tags.wo_number = work_orders.wo_number AND wo_tags.category_id = ?))`;
    args.push(`%"${catId}"%`, catId);
  }

  sql += ` ORDER BY created_at DESC`;

  const { results } = await db.prepare(sql).bind(...args).all();

  // Parse category_ids JSON
  const wos = (results || []).map(row => ({
    ...row,
    category_ids: row.category_ids ? JSON.parse(row.category_ids) : [],
    is_active: !!row.is_active
  }));

  return jsonResponse({ ok: true, data: wos });
}

// ── GET single WO ──
async function getOne(db, woNumber) {
  const row = await db.prepare(`SELECT * FROM work_orders WHERE wo_number = ?`).bind(woNumber).first();
  if (!row) return jsonResponse({ ok: false, error: 'Not found' }, 404);

  row.category_ids = row.category_ids ? JSON.parse(row.category_ids) : [];
  row.is_active = !!row.is_active;

  return jsonResponse({ ok: true, data: row });
}

// ── POST upsert (bulk or single) ──
async function upsert(db, body) {
  const wos = Array.isArray(body) ? body : [body];
  const inserted = [];
  const updated = [];

  for (const wo of wos) {
    const existing = await db.prepare(`SELECT id FROM work_orders WHERE wo_number = ?`).bind(wo.wo_number).first();

    if (existing) {
      // Update
      await db.prepare(`
        UPDATE work_orders SET
          property = ?, property_name = ?, property_street = ?, unit = ?,
          primary_resident = ?, created_at = ?, priority = ?, status = ?,
          vendor = ?, job_description = ?, instructions = ?, work_order_type = ?,
          home_warranty_expiration = ?, estimate_req_on = ?, estimated_on = ?,
          estimate_amount = ?, estimate_approval_status = ?, estimate_approved_on = ?,
          estimate_approval_last_requested_on = ?, scheduled_start = ?, scheduled_end = ?,
          work_done_on = ?, completed_on = ?, amount = ?, invoice = ?,
          unit_turn_id = ?, recurring = ?, work_order_issue = ?, ai_resolved = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE wo_number = ?
      `).bind(
        wo.property, wo.property_name, wo.property_street, wo.unit,
        wo.primary_resident, wo.created_at, wo.priority, wo.status,
        wo.vendor, wo.job_description, wo.instructions, wo.work_order_type,
        wo.home_warranty_expiration, wo.estimate_req_on, wo.estimated_on,
        wo.estimate_amount, wo.estimate_approval_status, wo.estimate_approved_on,
        wo.estimate_approval_last_requested_on, wo.scheduled_start, wo.scheduled_end,
        wo.work_done_on, wo.completed_on, wo.amount, wo.invoice,
        wo.unit_turn_id, wo.recurring, wo.work_order_issue, wo.ai_resolved,
        wo.wo_number
      ).run();
      updated.push(wo.wo_number);
    } else {
      // Insert
      await db.prepare(`
        INSERT INTO work_orders (
          wo_number, property, property_name, property_street, unit,
          primary_resident, created_at, priority, status, vendor,
          job_description, instructions, work_order_type, home_warranty_expiration,
          estimate_req_on, estimated_on, estimate_amount, estimate_approval_status,
          estimate_approved_on, estimate_approval_last_requested_on, scheduled_start,
          scheduled_end, work_done_on, completed_on, amount, invoice,
          unit_turn_id, recurring, work_order_issue, ai_resolved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        wo.wo_number, wo.property, wo.property_name, wo.property_street, wo.unit,
        wo.primary_resident, wo.created_at, wo.priority, wo.status, wo.vendor,
        wo.job_description, wo.instructions, wo.work_order_type, wo.home_warranty_expiration,
        wo.estimate_req_on, wo.estimated_on, wo.estimate_amount, wo.estimate_approval_status,
        wo.estimate_approved_on, wo.estimate_approval_last_requested_on, wo.scheduled_start,
        wo.scheduled_end, wo.work_done_on, wo.completed_on, wo.amount, wo.invoice,
        wo.unit_turn_id, wo.recurring, wo.work_order_issue, wo.ai_resolved
      ).run();
      inserted.push(wo.wo_number);
    }
  }

  // Audit log
  if (inserted.length) {
    await db.prepare(`INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`)
      .bind('bulk_insert', 'work_order', JSON.stringify({ count: inserted.length, wos: inserted })).run();
  }
  if (updated.length) {
    await db.prepare(`INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`)
      .bind('bulk_update', 'work_order', JSON.stringify({ count: updated.length, wos: updated })).run();
  }

  return jsonResponse({ ok: true, inserted: inserted.length, updated: updated.length });
}

// ── PUT update ──
async function update(db, woNumber, body) {
  const fields = [];
  const values = [];

  const allowed = [
    'property','property_name','property_street','unit','primary_resident',
    'created_at','priority','status','vendor','job_description','instructions',
    'work_order_type','home_warranty_expiration','estimate_req_on','estimated_on',
    'estimate_amount','estimate_approval_status','estimate_approved_on',
    'estimate_approval_last_requested_on','scheduled_start','scheduled_end',
    'work_done_on','completed_on','amount','invoice','unit_turn_id','recurring',
    'work_order_issue','ai_resolved','follow_up_date','category_ids','is_active'
  ];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'category_ids' ? JSON.stringify(body[key]) : body[key]);
    }
  }

  if (!fields.length) return jsonResponse({ ok: false, error: 'No fields to update' }, 400);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(woNumber);

  await db.prepare(`UPDATE work_orders SET ${fields.join(', ')} WHERE wo_number = ?`).bind(...values).run();

  await db.prepare(`INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`)
    .bind('update', 'work_order', woNumber, JSON.stringify(body)).run();

  return jsonResponse({ ok: true });
}

// ── DELETE (soft delete) ──
async function remove(db, woNumber) {
  await db.prepare(`UPDATE work_orders SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE wo_number = ?`).bind(woNumber).run();

  await db.prepare(`INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`)
    .bind('soft_delete', 'work_order', woNumber).run();

  return jsonResponse({ ok: true });
}