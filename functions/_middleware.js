/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.6.0
   DESCRIPTION: CORS + JWT verification for API endpoints. Public routes (login, static) are exempt.
   ============================================ */

export async function onRequest(context) {
  const { request, env, next } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');
  const isAuth = url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth');

  // JWT verification for API endpoints (except auth itself)
  if (isApi && !isAuth) {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const payload = await verifyJWT(token, env);
    if (!payload) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  const response = await next();
  
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || isApi) {
    Object.entries(corsHeaders).forEach(([key, val]) => response.headers.set(key, val));
  }

  return response;
}

function b64urlDecode(str) {
  const padding = (4 - str.length % 4) % 4;
  str += '='.repeat(padding);
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function verifyJWT(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const secret = env.HALQ_JWT_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))); } catch (e) { return null; }
}
