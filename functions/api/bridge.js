/* ============================================
   FILE: bridge.js
   PATH: functions/api/bridge.js
   VERSION: 2.5.3
   DESCRIPTION: Bridge heartbeat ping + sync status API.
   ============================================ */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    // ── POST /api/bridge/ping ──
    if (method === 'POST' && path.endsWith('/ping')) {
      return await pingBridge(env.DB);
    }

    // ── GET /api/bridge/status ──
    if (method === 'GET' && path.endsWith('/status')) {
      return await getStatus(env.DB);
    }

    return jsonResponse({ ok: false, error: 'Not found' }, 404);
  } catch (err) {
    console.error('[API:bridge]', err);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// =====================
// PING — Store heartbeat
// =====================

async function pingBridge(db) {
  await db.prepare(
    `INSERT INTO bridge_heartbeats (id, last_seen) VALUES (1, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP`
  ).run();

  return jsonResponse({ ok: true });
}

// =====================
// STATUS — Read heartbeat
// =====================

async function getStatus(db) {
  const row = await db.prepare(
    `SELECT last_seen FROM bridge_heartbeats WHERE id = 1`
  ).first();

  if (!row || !row.last_seen) {
    return jsonResponse({ ok: true, connected: false, lastSeen: null });
  }

  const lastSeen = new Date(row.last_seen);
  const now = new Date();
  const diffMs = now - lastSeen;
  const connected = diffMs < 60000; // 60 seconds threshold

  return jsonResponse({
    ok: true,
    connected,
    lastSeen: row.last_seen,
    secondsAgo: Math.round(diffMs / 1000)
  });
}
