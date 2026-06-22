/* ============================================
   FILE: _middleware.js
   PATH: functions/_middleware.js
   VERSION: 2.3.6-TEMP
   DESCRIPTION: TEMPORARILY BYPASSED — auth check disabled for testing.
   ============================================ */

export async function onRequest(context) {
  return await context.next();
}
