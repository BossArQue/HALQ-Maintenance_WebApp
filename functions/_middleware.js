/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.0.0
   DESCRIPTION: Auth middleware stub, CORS, rate limiting for HALQ v2 API.
   ============================================ */

// Phase 0: Open access — no auth required.
// Phase 1: Add Cloudflare Access SSO JWT verification.

const JWT_SECRET = 'HALQ_JWT_SECRET';

function b64urlDecode(str) {
  str += new Array(5 - str.length % 4).join('=');
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function verifyJWT(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const secret = env.HALQ_JWT_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))); } catch (e) { return null; }
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Public paths — no auth required ──
  const publicPaths = ['/login.html', '/favicon.svg', '/assets/'];
  const isPublic = publicPaths.some(p => path.startsWith(p)) || path.startsWith('/api/auth/');
  if (isPublic) {
    const response = await next();
    return response;
  }

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── Auth check ──
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/halq_auth=([^;]+)/);
  let isAuthenticated = false;

  if (match) {
    const payload = await verifyJWT(match[1], env);
    isAuthenticated = payload && payload.sub;
  }

  if (!isAuthenticated) {
    // API requests → 401 JSON
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    // Page requests → redirect to login
    return Response.redirect(`${url.origin}/login.html`, 302);
  }

  const response = await next();
  Object.entries(corsHeaders).forEach(([key, val]) => response.headers.set(key, val));
  return response;
}