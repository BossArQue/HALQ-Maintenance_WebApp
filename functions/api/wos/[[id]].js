/* ============================================
   FILE: [[id]].js
   PATH: functions/api/wos/[[id]].js
   VERSION: 2.1.4
   DESCRIPTION: Work Orders API — catchall route for /api/wos and /api/wos/:id.
                GET list, GET single, POST bulk upsert, PUT update, DELETE soft-delete.
   ============================================ */

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // [[id]] catchall behavior:
  // /api/wos          → params.id is undefined
  // /api/wos/49638-1  → params.id = ["49638-1"]
  const id = params.id ? params.id[0] : undefined;

  try {
    if (request.method === 'GET') {
      if (id) {
        return await getOne(db, id);
      }
      return await getAll(db, url);
    }

    if (request.method === 'POST') {
      const body = await request.json();
      return await upsert(db, body);
    }

    if (request.method === 'PUT') {
      if (!id) return jsonResponse({ ok: false, error: 'Missing WO ID' }, 400);
      const body = await request.json();
      return await update(db, id, body);
    }

    if (request.method === 'DELETE') {
      if (!id) return jsonResponse({ ok: false, error: 'Missing WO ID' }, 400);
      return await remove(db, id);
    }

    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('[API:wos]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

async function getAll(db, url) {
  const filter = url.searchParams.get('filter') || 'all';
  const search = url.searchParams.get('search') || '';
  const cat = url.searchParams.get('cat') || '';

  let sql = 'SELECT * FROM work_orders WHERE 1=1';
  const params = [];

  // Filter by active status
  if (filter === 'active') {
    sql += ' AND is_active = 1';
  } else if (filter === 'closed') {
    sql += ' AND is_active = 0';
  }
  // 'all' shows both active and closed

  // Search
  if (search) {
    sql += ' AND (wo_number LIKE ? OR property LIKE ? OR property_name LIKE ? OR vendor LIKE ? OR primary_resident LIKE ?)';
    const like = '%' + search + '%';
    params.push(like, like, like, like, like);
  }

  // Category filter
  if (cat) {
    sql += ' AND (category_ids LIKE ?)';
    params.push('"' + cat + '"');
  }

  sql += ' ORDER BY created_at DESC';

  const { results } = await db.prepare(sql).bind(...params).all();

  // Ensure category_ids is always a valid JSON string
  const data = (results || []).map(row => ({
    ...row,
    category_ids: row.category_ids || '[]'
  }));

  return jsonResponse({ ok: true, data });
}

async function getOne(db, id) {
  // id is the wo_number string (e.g., "49638-1")
  const row = await db.prepare('SELECT * FROM work_orders WHERE wo_number = ?').bind(id).first();
  if (!row) return jsonResponse({ ok: false, error: 'Not found' }, 404);

  row.category_ids = row.category_ids || '[]';
  return jsonResponse({ ok: true, data: row });
}

async function upsert(db, body) {
  const wos = Array.isArray(body) ? body : [body];
  let inserted = 0;
  let updated = 0;

  for (const wo of wos) {
    const existing = await db.prepare('SELECT id FROM work_orders WHERE wo_number = ?').bind(wo.wo_number).first();
    if (existing) {
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
          is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE wo_number = ?
      `).bind(
        wo.property || '', wo.property_name || '', wo.property_street || wo.property_address || '', wo.unit || '',
        wo.primary_resident || '', wo.created_at || '', wo.priority || '', wo.status || '',
        wo.vendor || '', wo.job_description || '', wo.instructions || '', wo.work_order_type || wo.wo_type || '',
        wo.home_warranty_expiration || '', wo.estimate_req_on || '', wo.estimated_on || '',
        wo.estimate_amount || '', wo.estimate_approval_status || '', wo.estimate_approved_on || '',
        wo.estimate_approval_last_requested_on || '', wo.scheduled_start || '', wo.scheduled_end || '',
        wo.work_done_on || '', wo.completed_on || '', wo.amount || '', wo.invoice || '',
        wo.unit_turn_id || '', wo.recurring || '', wo.work_order_issue || '', wo.ai_resolved || '',
        wo.wo_number
      ).run();
      updated++;
    } else {
      await db.prepare(`
        INSERT INTO work_orders (
          wo_number, property, property_name, property_street, unit,
          primary_resident, created_at, priority, status, vendor,
          job_description, instructions, work_order_type, home_warranty_expiration,
          estimate_req_on, estimated_on, estimate_amount, estimate_approval_status,
          estimate_approved_on, estimate_approval_last_requested_on, scheduled_start,
          scheduled_end, work_done_on, completed_on, amount, invoice,
          unit_turn_id, recurring, work_order_issue, ai_resolved, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        wo.wo_number, wo.property || '', wo.property_name || '', wo.property_street || wo.property_address || '', wo.unit || '',
        wo.primary_resident || '', wo.created_at || '', wo.priority || '', wo.status || '', wo.vendor || '',
        wo.job_description || '', wo.instructions || '', wo.work_order_type || wo.wo_type || '', wo.home_warranty_expiration || '',
        wo.estimate_req_on || '', wo.estimated_on || '', wo.estimate_amount || '', wo.estimate_approval_status || '',
        wo.estimate_approved_on || '', wo.estimate_approval_last_requested_on || '', wo.scheduled_start || '',
        wo.scheduled_end || '', wo.work_done_on || '', wo.completed_on || '', wo.amount || '', wo.invoice || '',
        wo.unit_turn_id || '', wo.recurring || '', wo.work_order_issue || '', wo.ai_resolved || ''
      ).run();
      inserted++;
    }
  }

  return jsonResponse({ ok: true, inserted, updated });
}

async function update(db, id, body) {
  // id is the wo_number string
  const fields = [];
  const values = [];

  const allowed = ['property', 'property_name', 'property_street', 'unit', 'primary_resident',
    'created_at', 'priority', 'status', 'vendor', 'job_description', 'instructions',
    'work_order_type', 'home_warranty_expiration', 'estimate_req_on', 'estimated_on',
    'estimate_amount', 'estimate_approval_status', 'estimate_approved_on',
    'estimate_approval_last_requested_on', 'scheduled_start', 'scheduled_end',
    'work_done_on', 'completed_on', 'amount', 'invoice', 'unit_turn_id', 'recurring',
    'work_order_issue', 'ai_resolved', 'follow_up_date', 'category_ids', 'is_active'];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(key + ' = ?');
      values.push(body[key]);
    }
  }

  if (fields.length === 0) {
    return jsonResponse({ ok: false, error: 'No fields to update' }, 400);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await db.prepare(`UPDATE work_orders SET ${fields.join(', ')} WHERE wo_number = ?`).bind(...values).run();

  // Audit log
  await db.prepare(`INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`)
    .bind('update', 'work_order', id, JSON.stringify(body)).run();

  return jsonResponse({ ok: true });
}

async function remove(db, id) {
  // id is the wo_number string
  await db.prepare('UPDATE work_orders SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE wo_number = ?').bind(id).run();

  await db.prepare(`INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`)
    .bind('delete', 'work_order', id, '{}').run();

  return jsonResponse({ ok: true });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}