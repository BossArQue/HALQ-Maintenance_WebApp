/* ============================================
   FILE: api.js
   PATH: bridge/api.js
   VERSION: 2.2.0
   DESCRIPTION: HALQ API client — fetch wrapper, auth, retry logic.
   ============================================ */

const fetch = require('node-fetch');

let _baseUrl = '';
let _token = null;
let _retryCount = 3;
let _retryDelay = 2000;

function setBaseUrl(url) {
  _baseUrl = url.replace(/\/$/, '');
}

function setToken(token) {
  _token = token;
}

function setRetry(count, delayMs) {
  _retryCount = count;
  _retryDelay = delayMs;
}

function _headers() {
  const h = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = 'Bearer ' + _token;
  return h;
}

async function _fetchWithRetry(url, options) {
  let lastErr;
  for (let i = 0; i < _retryCount; i++) {
    try {
      const res = await fetch(url, { ...options, headers: _headers() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    } catch (err) {
      lastErr = err;
      if (i < _retryCount - 1) {
        await sleep(_retryDelay * (i + 1));
      }
    }
  }
  throw lastErr;
}

async function apiGet(endpoint, params = {}) {
  const url = new URL(_baseUrl + '/api' + endpoint);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });
  return _fetchWithRetry(url.toString(), { method: 'GET' });
}

async function apiPost(endpoint, body) {
  return _fetchWithRetry(_baseUrl + '/api' + endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

async function apiPut(endpoint, body) {
  return _fetchWithRetry(_baseUrl + '/api' + endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

async function apiDelete(endpoint) {
  return _fetchWithRetry(_baseUrl + '/api' + endpoint, { method: 'DELETE' });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  setBaseUrl,
  setToken,
  setRetry,
  apiGet,
  apiPost,
  apiPut,
  apiDelete
};