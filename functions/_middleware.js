/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.3.3
   DESCRIPTION: Auth middleware for HALQ v2 — protects routes, redirects unauthenticated users to login.
   ============================================ */

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

  // ── NEVER redirect if already at login ──
  if (path === '/login.html' || path === '/login' || path.startsWith('/login.')) {
    const response = await next();
    response.headers.set('X-HALQ-Auth', 'public-login');
    return response;
  }

  // ── Public paths ──
  const publicPaths = ['/favicon', '/assets/', '/api/auth', '/api/auth/'];
  const isPublic = publicPaths.some(p => path.startsWith(p));
  if (isPublic) {
    const response = await next();
    response.headers.set('X-HALQ-Auth', 'public');
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
    isAuthenticated = !!(payload && payload.sub);
  }

  if (!isAuthenticated) {
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    return Response.redirect(`${url.origin}/login.html`, 302);
  }

  const response = await next();
  Object.entries(corsHeaders).forEach(([key, val]) => response.headers.set(key, val));
  return response;
}
