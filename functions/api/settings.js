/* ============================================
   FILE: settings.js
   PATH: functions/api/settings.js
   VERSION: 2.1.0
   DESCRIPTION: User Settings API — key-value store for themes, fonts, layout prefs.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    if (method === 'GET') {
      const key = url.searchParams.get('key');
      return await getAll(env.DB, key);
    }

    if (method === 'POST') {
      const body = await request.json();
      return await save(env.DB, body);
    }

    if (method === 'DELETE') {
      const key = path.split('/').pop();
      return await remove(env.DB, key);
    }

    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('[API:settings]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── GET all or single ──
async function getAll(db, key) {
  if (key) {
    const row = await db.prepare(`SELECT key, value, updated_at FROM user_settings WHERE key = ?`).bind(key).first();
    if (!row) return jsonResponse({ ok: false, error: 'Not found' }, 404);
    let val = row.value;
    try { val = JSON.parse(val); } catch (_) {}
    return jsonResponse({ ok: true, data: { key: row.key, value: val, updated_at: row.updated_at } });
  }

  const { results } = await db.prepare(
    `SELECT key, value, updated_at FROM user_settings ORDER BY key`
  ).all();

  const parsed = (results || []).map(r => {
    let val = r.value;
    try { val = JSON.parse(val); } catch (_) {}
    return { key: r.key, value: val, updated_at: r.updated_at };
  });

  return jsonResponse({ ok: true, data: parsed });
}

// ── POST save (upsert by key) ──
async function save(db, body) {
  const { key, value } = body;
  if (!key) return jsonResponse({ ok: false, error: 'key required' }, 400);

  const strVal = typeof value === 'string' ? value : JSON.stringify(value);

  const existing = await db.prepare(`SELECT id FROM user_settings WHERE key = ?`).bind(key).first();

  if (existing) {
    await db.prepare(
      `UPDATE user_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`
    ).bind(strVal, key).run();
  } else {
    await db.prepare(
      `INSERT INTO user_settings (key, value) VALUES (?, ?)`
    ).bind(key, strVal).run();
  }

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`
  ).bind('save', 'user_setting', key, JSON.stringify({ value })).run();

  return jsonResponse({ ok: true });
}

// ── DELETE ──
async function remove(db, key) {
  if (!key || key === 'settings') {
    return jsonResponse({ ok: false, error: 'key required' }, 400);
  }

  await db.prepare(`DELETE FROM user_settings WHERE key = ?`).bind(key).run();

  await db.prepare(
    `INSERT INTO audit_log (action, entity_type, entity_id) VALUES (?, ?, ?)`
  ).bind('delete', 'user_setting', key).run();

  return jsonResponse({ ok: true });
}