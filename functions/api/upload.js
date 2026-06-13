/* ============================================
   FILE: upload.js
   PATH: functions/api/upload.js
   VERSION: 2.0.0
   DESCRIPTION: Excel file upload handler — receives parsed JSON from frontend, upserts to D1.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { wos, closedWos } = body;

    if (!Array.isArray(wos)) {
      return jsonResponse({ ok: false, error: 'Expected wos array' }, 400);
    }

    const db = env.DB;
    let inserted = 0;
    let updated = 0;
    let closed = 0;

    // ── Upsert active WOs ──
    for (const wo of wos) {
      const existing = await db.prepare(`SELECT id FROM work_orders WHERE wo_number = ?`).bind(wo.wo_number).first();

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
          wo.wo_number, wo.property, wo.property_name, wo.property_street, wo.unit,
          wo.primary_resident, wo.created_at, wo.priority, wo.status, wo.vendor,
          wo.job_description, wo.instructions, wo.work_order_type, wo.home_warranty_expiration,
          wo.estimate_req_on, wo.estimated_on, wo.estimate_amount, wo.estimate_approval_status,
          wo.estimate_approved_on, wo.estimate_approval_last_requested_on, wo.scheduled_start,
          wo.scheduled_end, wo.work_done_on, wo.completed_on, wo.amount, wo.invoice,
          wo.unit_turn_id, wo.recurring, wo.work_order_issue, wo.ai_resolved
        ).run();
        inserted++;
      }
    }

    // ── Handle closed WOs ──
    if (Array.isArray(closedWos) && closedWos.length) {
      for (const wo of closedWos) {
        await db.prepare(`
          UPDATE work_orders SET
            is_active = 0,
            status = 'Completed',
            completed_on = COALESCE(?, completed_on, date('now')),
            updated_at = CURRENT_TIMESTAMP
          WHERE wo_number = ?
        `).bind(wo.completed_on, wo.wo_number).run();
        closed++;
      }
    }

    // ── Auto-detect closed: WOs in DB but NOT in upload ──
    // Get all active WO numbers from DB
    const { results: activeInDb } = await db.prepare(`SELECT wo_number FROM work_orders WHERE is_active = 1`).all();
    const uploadedNumbers = new Set(wos.map(w => w.wo_number));
    const autoClosed = [];

    for (const row of (activeInDb || [])) {
      if (!uploadedNumbers.has(row.wo_number)) {
        await db.prepare(`
          UPDATE work_orders SET is_active = 0, status = 'Completed', updated_at = CURRENT_TIMESTAMP
          WHERE wo_number = ?
        `).bind(row.wo_number).run();
        autoClosed.push(row.wo_number);
      }
    }

    // Audit log
    await db.prepare(`INSERT INTO audit_log (action, entity_type, details) VALUES (?, ?, ?)`)
      .bind('upload', 'work_order', JSON.stringify({
        inserted, updated, closed, autoClosed: autoClosed.length, total: wos.length
      })).run();

    return jsonResponse({
      ok: true,
      inserted,
      updated,
      closed,
      autoClosed: autoClosed.length,
      total: wos.length
    });

  } catch (err) {
    console.error('[API:upload]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}