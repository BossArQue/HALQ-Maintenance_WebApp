/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.0.0
   DESCRIPTION: Auth middleware stub, CORS, rate limiting for HALQ v2 API.
   ============================================ */

// Phase 0: Open access — no auth required.
// Phase 1: Add Cloudflare Access SSO JWT verification.

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Rate limiting (simple in-memory per IP)
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 100;

  // Note: In production, use KV for distributed rate limiting
  // Phase 0: Skip rate limiting (no KV yet)

  // Auth stub — Phase 1 will verify Cloudflare Access JWT here
  // const jwt = request.headers.get('CF-Access-Jwt-Assertion');
  // if (!jwt) return new Response(JSON.stringify({ok: false, error: 'Unauthorized'}), {status: 401, headers: {'Content-Type': 'application/json'}});

  const response = await next();

  // Add CORS to all responses
  Object.entries(corsHeaders).forEach(([key, val]) => {
    response.headers.set(key, val);
  });

  return response;
}