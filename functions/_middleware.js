/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.4.1
   DESCRIPTION: CORS only. Auth is handled by app.js on page load and API endpoints directly.
   ============================================ */

export async function onRequest(context) {
  const { request, next } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = await next();
  
  // Only add CORS headers to API responses, not HTML pages
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || request.url.includes('/api/')) {
    Object.entries(corsHeaders).forEach(([key, val]) => response.headers.set(key, val));
  }

  return response;
}
