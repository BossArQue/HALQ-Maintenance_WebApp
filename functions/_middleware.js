/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.3.2
   DESCRIPTION: TEMPORARILY DISABLED — auth bypass for debugging.
   ============================================ */

export async function onRequest(context) {
  const { request, next } = context;
  const response = await next();
  response.headers.set('X-HALQ-Auth', 'bypassed');
  return response;
}
