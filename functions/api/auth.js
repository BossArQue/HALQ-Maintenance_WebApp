/* ============================================
   FILE: auth.js
   PATH: functions/api/auth.js
   VERSION: 2.0.0
   DESCRIPTION: Single-user auth API — PBKDF2 password hashing, HMAC-SHA256 JWT, httpOnly cookie.
   ============================================ */

const JWT_SECRET = 'HALQ_JWT_SECRET'; // Change via wrangler secret

// ── Helpers ──

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function b64urlEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  str += new Array(5 - str.length % 4).join('=');
  str = str.replace(/\-/g, '+').replace(/\_/g, '/');
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function getSecret(env) {
  const secret = env[JWT_SECRET] || 'halq-default-change-me-immediately';
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

async function signJWT(payload, env) {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getSecret(env);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(header + '.' + body));
  return header + '.' + body + '.' + b64urlEncode(sig);
}

async function verifyJWT(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const key = await getSecret(env);
  const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (e) {
    return null;
  }
}

async function pbkdf2Hash(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return b64urlEncode(bits);
}

// ── Endpoints ──

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // ── POST /api/auth/login ──
  if (path === '/api/auth/login' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { username, password, remember } = body;

      if (!username || !password) {
        return jsonResponse({ ok: false, error: 'Username and password required' }, 400);
      }

      const db = env.DB;
      const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();

      if (!user) {
        return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401);
      }

      const salt = b64urlDecode(user.salt);
      const hash = await pbkdf2Hash(password, salt);

      if (hash !== user.password_hash) {
        return jsonResponse({ ok: false, error: 'Invalid credentials' }, 401);
      }

      // Issue JWT
      const maxAge = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 1 day
      const token = await signJWT({ sub: user.username, iat: Math.floor(Date.now() / 1000) }, env);

      const response = jsonResponse({ ok: true, data: { token, username: user.username } });
      response.headers.set('Set-Cookie', `halq_auth=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`);
      Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
      return response;

    } catch (err) {
      return jsonResponse({ ok: false, error: 'Login failed' }, 500);
    }
  }

  // ── POST /api/auth/logout ──
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const response = jsonResponse({ ok: true, data: { message: 'Logged out' } });
    response.headers.set('Set-Cookie', 'halq_auth=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  // ── GET /api/auth/me ──
  if (path === '/api/auth/me' && request.method === 'GET') {
    try {
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/halq_auth=([^;]+)/);
      if (!match) return jsonResponse({ ok: true, data: { authenticated: false } });

      const payload = await verifyJWT(match[1], env);
      if (!payload) return jsonResponse({ ok: true, data: { authenticated: false } });

      return jsonResponse({ ok: true, data: { authenticated: true, username: payload.sub } });
    } catch (err) {
      return jsonResponse({ ok: true, data: { authenticated: false } });
    }
  }

  // ── POST /api/auth/setup (one-time user creation) ──
  if (path === '/api/auth/setup' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { username, password } = body;

      if (!username || !password) {
        return jsonResponse({ ok: false, error: 'Username and password required' }, 400);
      }

      const db = env.DB;
      const existing = await db.prepare('SELECT id FROM users LIMIT 1').first();
      if (existing) {
        return jsonResponse({ ok: false, error: 'User already exists. Use login.' }, 409);
      }

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await pbkdf2Hash(password, salt);

      await db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)')
        .bind(username, hash, b64urlEncode(salt)).run();

      return jsonResponse({ ok: true, data: { message: 'User created', username } });
    } catch (err) {
      return jsonResponse({ ok: false, error: 'Setup failed' }, 500);
    }
  }

  return jsonResponse({ ok: false, error: 'Not found' }, 404);
}
