/* ============================================
   FILE: api.js
   PATH: bridge/api.js
   VERSION: 2.2.1
   DESCRIPTION: HALQ API client — fetch wrapper with timeout, retry, and verbose logging.
   ============================================ */

const fetch = require('node-fetch');
const AbortController = require('abort-controller');

let _baseUrl = '';
let _token = null;
let _retryCount = 3;
let _retryDelay = 2000;
const _timeoutMs = 30000; // 30s per request

function setBaseUrl(url) {
  _baseUrl = url.replace(/\/$/, '');
  console.log('[API] Base URL set to:', _baseUrl);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), _timeoutMs);

    try {
      console.log(`[API] Request attempt ${i + 1}/${_retryCount}: ${options.method || 'GET'} ${url}`);
      const res = await fetch(url, { ...options, headers: _headers(), signal: controller.signal });
      clearTimeout(timeout);

      const bodyText = await res.text();
      let body;
      try { body = JSON.parse(bodyText); } catch { body = { raw: bodyText }; }

      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}: ${bodyText.slice(0,200)}`);
      console.log(`[API] Response OK: ${options.method || 'GET'} ${url}`);
      return body;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      console.log(`[API] Attempt ${i + 1} failed:`, err.message);
      if (i < _retryCount - 1) {
        console.log(`[API] Retrying in ${_retryDelay * (i + 1)}ms...`);
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
  const bodyStr = JSON.stringify(body);
  console.log(`[API] POST body size: ${bodyStr.length} chars`);
  return _fetchWithRetry(_baseUrl + '/api' + endpoint, {
    method: 'POST',
    body: bodyStr
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