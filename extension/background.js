// background.js — Extension service worker for HALQ tab navigation bridge
// v1.0.5: Listens for messages from HALQ, finds AppFolio/Outlook tabs, updates them.

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    sendResponse({ok: false, error: 'Missing action'});
    return false;
  }

  console.log('[HALQ Bridge BG] Received:', request.action, request.data);

  if (request.action === 'navigate') {
    const url = request.data?.url;
    const target = request.data?.target || 'appfolio'; // 'appfolio' | 'outlook'
    if (!url) {
      sendResponse({ok: false, error: 'Missing URL'});
      return false;
    }

    // Find the target tab by URL pattern
    const query = target === 'outlook'
      ? {url: ['*://outlook.office.com/*', '*://outlook.live.com/*']}
      : {url: '*://*.appfolio.com/*'};

    chrome.tabs.query(query, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Update the first matching tab (most recently active)
        const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
        chrome.tabs.update(tab.id, {url: url, active: false}, () => {
          if (chrome.runtime.lastError) {
            console.error('[HALQ Bridge BG] Update failed:', chrome.runtime.lastError.message);
            sendResponse({ok: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('[HALQ Bridge BG] Updated tab', tab.id, 'to', url);
            sendResponse({ok: true, tabId: tab.id});
          }
        });
      } else {
        // No existing tab — create one
        chrome.tabs.create({url: url, active: false}, (newTab) => {
          if (chrome.runtime.lastError) {
            console.error('[HALQ Bridge BG] Create failed:', chrome.runtime.lastError.message);
            sendResponse({ok: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('[HALQ Bridge BG] Created new tab', newTab.id, 'for', url);
            sendResponse({ok: true, tabId: newTab.id, created: true});
          }
        });
      }
    });

    return true; // async response
  }

  sendResponse({ok: false, error: 'Unknown action: ' + request.action});
  return false;
});

console.log('[HALQ Bridge BG] Service worker started');
