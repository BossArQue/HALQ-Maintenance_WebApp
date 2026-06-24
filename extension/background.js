// background.js — Extension service worker for HALQ tab navigation bridge
// v1.0.5f: Update the AppFolio tab in the SAME window as HALQ (handles split view).
// When a user manually splits HALQ with AppFolio, both tabs are in the same window.
// Querying by windowId ensures we update the correct tab.

const STORAGE_KEY = 'halq_tab_map';

async function getTabMap() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  return res[STORAGE_KEY] || {};
}

async function setTabMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

async function updateTab(target, url, windowId, sendResponse) {
  const map = await getTabMap();
  const key = target + ':' + windowId;
  const existingId = map[key];

  if (existingId) {
    chrome.tabs.get(existingId, (tab) => {
      if (chrome.runtime.lastError) {
        console.log('[HALQ Bridge BG] Tracked tab', existingId, 'gone. Creating new.');
        delete map[key];
        setTabMap(map).then(() => createTab(target, url, windowId, sendResponse));
      } else {
        chrome.tabs.update(existingId, {url: url, active: false}, () => {
          if (chrome.runtime.lastError) {
            console.error('[HALQ Bridge BG] tabs.update failed:', chrome.runtime.lastError.message);
            sendResponse({ok: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('[HALQ Bridge BG] Updated tracked tab', existingId, 'in window', windowId);
            sendResponse({ok: true, tabId: existingId, updated: true});
          }
        });
      }
    });
    return;
  }

  createTab(target, url, windowId, sendResponse);
}

async function createTab(target, url, windowId, sendResponse) {
  chrome.tabs.create({url: url, active: false, windowId: windowId}, (newTab) => {
    if (chrome.runtime.lastError) {
      console.error('[HALQ Bridge BG] tabs.create failed:', chrome.runtime.lastError.message);
      sendResponse({ok: false, error: chrome.runtime.lastError.message});
    } else {
      const map = {};
      const key = target + ':' + windowId;
      map[key] = newTab.id;
      setTabMap(map).then(() => {
        console.log('[HALQ Bridge BG] Created new tab', newTab.id, 'for target', target, 'in window', windowId);
        sendResponse({ok: true, tabId: newTab.id, created: true});
      });
    }
  });
}

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

    const windowId = sender?.tab?.windowId;
    if (!windowId) {
      console.warn('[HALQ Bridge BG] No windowId from sender, falling back to create in current window');
      createTab(target, url, undefined, sendResponse);
      return true;
    }

    updateTab(target, url, windowId, sendResponse);
    return true; // async response
  }

  sendResponse({ok: false, error: 'Unknown action: ' + request.action});
  return false;
});

console.log('[HALQ Bridge BG] Service worker started');
