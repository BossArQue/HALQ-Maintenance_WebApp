/* ============================================
   FILE: upload.js
   PATH: functions/api/upload.js
   VERSION: 2.3.0
   DESCRIPTION: Excel file upload handler — receives parsed JSON from frontend/Bridge, upserts to D1, sanitizes all values.
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
      const safe = _sanitizeWO(wo);

      const existing = await db.prepare(`SELECT id FROM work_orders WHERE wo_number = ?`).bind(safe.wo_number).first();

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
          safe.property, safe.property_name, safe.property_street, safe.unit,
          safe.primary_resident, safe.created_at, safe.priority, safe.status,
          safe.vendor, safe.job_description, safe.instructions, safe.work_order_type,
          safe.home_warranty_expiration, safe.estimate_req_on, safe.estimated_on,
          safe.estimate_amount, safe.estimate_approval_status, safe.estimate_approved_on,
          safe.estimate_approval_last_requested_on, safe.scheduled_start, safe.scheduled_end,
          safe.work_done_on, safe.completed_on, safe.amount, safe.invoice,
          safe.unit_turn_id, safe.recurring, safe.work_order_issue, safe.ai_resolved,
          safe.wo_number
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
          safe.wo_number, safe.property, safe.property_name, safe.property_street, safe.unit,
          safe.primary_resident, safe.created_at, safe.priority, safe.status, safe.vendor,
          safe.job_description, safe.instructions, safe.work_order_type, safe.home_warranty_expiration,
          safe.estimate_req_on, safe.estimated_on, safe.estimate_amount, safe.estimate_approval_status,
          safe.estimate_approved_on, safe.estimate_approval_last_requested_on, safe.scheduled_start,
          safe.scheduled_end, safe.work_done_on, safe.completed_on, safe.amount, safe.invoice,
          safe.unit_turn_id, safe.recurring, safe.work_order_issue, safe.ai_resolved
        ).run();
        inserted++;
      }
    }

    // ── Handle explicit closed WOs from Bridge ──
    if (Array.isArray(closedWos) && closedWos.length) {
      for (const wo of closedWos) {
        const safe = _sanitizeWO(wo);
        await db.prepare(`
          UPDATE work_orders SET
            is_active = 0,
            status = 'Completed',
            completed_on = COALESCE(?, completed_on, date('now')),
            updated_at = CURRENT_TIMESTAMP
          WHERE wo_number = ?
        `).bind(safe.completed_on, safe.wo_number).run();
        closed++;
      }
    }

    // ── Auto-detect closed: WOs in DB but NOT in upload ──
    const { results: activeInDb } = await db.prepare(`SELECT wo_number FROM work_orders WHERE is_active = 1`).all();
    const uploadedNumbers = new Set(wos.map(w => w.wo_number).filter(Boolean));
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

// ── Sanitize WO — convert undefined/null to empty string ──
function _sanitizeWO(wo) {
  const s = {};
  const str = (v) => v == null ? '' : String(v).trim();
  const num = (v) => {
    if (v == null || v === '') return '';
    const n = parseFloat(v);
    return isNaN(n) ? '' : String(n);
  };

  s.wo_number                    = str(wo.wo_number);
  s.property                     = str(wo.property);
  s.property_name                = str(wo.property_name);
  s.property_street              = str(wo.property_street || wo.property_address);
  s.unit                         = str(wo.unit);
  s.primary_resident             = str(wo.primary_resident);
  s.created_at                   = str(wo.created_at);
  s.priority                     = str(wo.priority);
  s.status                       = str(wo.status);
  s.vendor                       = str(wo.vendor);
  s.job_description              = str(wo.job_description);
  s.instructions                 = str(wo.instructions);
  s.work_order_type              = str(wo.work_order_type || wo.wo_type);
  s.home_warranty_expiration     = str(wo.home_warranty_expiration);
  s.estimate_req_on              = str(wo.estimate_req_on);
  s.estimated_on                 = str(wo.estimated_on);
  s.estimate_amount              = num(wo.estimate_amount);
  s.estimate_approval_status     = str(wo.estimate_approval_status);
  s.estimate_approved_on         = str(wo.estimate_approved_on);
  s.estimate_approval_last_requested_on = str(wo.estimate_approval_last_requested_on);
  s.scheduled_start              = str(wo.scheduled_start);
  s.scheduled_end                = str(wo.scheduled_end);
  s.work_done_on                 = str(wo.work_done_on);
  s.completed_on                 = str(wo.completed_on);
  s.amount                       = num(wo.amount);
  s.invoice                      = str(wo.invoice);
  s.unit_turn_id                 = str(wo.unit_turn_id);
  s.recurring                    = str(wo.recurring);
  s.work_order_issue             = str(wo.work_order_issue);
  s.ai_resolved                  = str(wo.ai_resolved);

  return s;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}