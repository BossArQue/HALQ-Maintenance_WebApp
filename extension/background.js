// background.js — Extension service worker for HALQ tab navigation bridge
// v1.0.5: Listens for messages from HALQ, finds AppFolio/Outlook tabs, updates them.

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('[HALQ Bridge BG] onMessageExternal fired. request:', request, 'sender:', sender);
  if (!request || !request.action) {
    sendResponse({ok: false, error: 'Missing action'});
    return false;
  }

  console.log('[HALQ Bridge BG] Received action:', request.action, 'data:', request.data);

  if (request.action === 'navigate') {
    const url = request.data?.url;
    const target = request.data?.target || 'appfolio';
    if (!url) {
      sendResponse({ok: false, error: 'Missing URL'});
      return false;
    }

    const query = target === 'outlook'
      ? {url: ['*://outlook.office.com/*', '*://outlook.live.com/*']}
      : {url: '*://*.appfolio.com/*'};

    console.log('[HALQ Bridge BG] Querying tabs with:', query);
    chrome.tabs.query(query, (tabs) => {
      console.log('[HALQ Bridge BG] tabs.query returned:', tabs);
      if (tabs && tabs.length > 0) {
        const tab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
        console.log('[HALQ Bridge BG] Updating tab', tab.id, 'to', url);
        chrome.tabs.update(tab.id, {url: url, active: false}, () => {
          if (chrome.runtime.lastError) {
            console.error('[HALQ Bridge BG] tabs.update failed:', chrome.runtime.lastError.message);
            sendResponse({ok: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('[HALQ Bridge BG] tabs.update succeeded');
            sendResponse({ok: true, tabId: tab.id});
          }
        });
      } else {
        console.log('[HALQ Bridge BG] No existing tab found, creating new tab for', url);
        chrome.tabs.create({url: url, active: false}, (newTab) => {
          if (chrome.runtime.lastError) {
            console.error('[HALQ Bridge BG] tabs.create failed:', chrome.runtime.lastError.message);
            sendResponse({ok: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('[HALQ Bridge BG] tabs.create succeeded, newTab:', newTab);
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
