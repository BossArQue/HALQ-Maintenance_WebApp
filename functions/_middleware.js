/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.3.5
   DESCRIPTION: Auth middleware — lightweight cookie check (no JWT verify), API handles full verification.
   ============================================ */

function b64urlDecode(str) {
  str += new Array(5 - str.length % 4).join('=');
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (e) { return null; }
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // ── NEVER redirect if already at login ──
  if (path === '/login.html' || path === '/login' || path.startsWith('/login.')) {
    return await next();
  }

  // ── Public paths ──
  const publicPaths = ['/favicon', '/assets/', '/api/auth', '/api/auth/'];
  const isPublic = publicPaths.some(p => path.startsWith(p));
  if (isPublic) {
    return await next();
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

  // ── Auth check: cookie exists + looks like a JWT with 'sub' ──
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/halq_auth=([^;]+)/);
  let isAuthenticated = false;

  if (match) {
    const payload = decodeJWT(match[1]);
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

  return await next();
}
