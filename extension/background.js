// background.js — Extension service worker for HALQ tab navigation bridge
// v1.0.5e: Clear old tracking on startup. Track tab IDs in chrome.storage.local.

const STORAGE_KEY = 'halq_tab_map';

// Clear old tracking on startup (fresh start after extension reload)
chrome.storage.local.remove(STORAGE_KEY);
console.log('[HALQ Bridge BG] Cleared old tab tracking on startup');

async function getTabMap() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  return res[STORAGE_KEY] || {};
}

async function setTabMap(map) {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

async function updateTab(target, url, sendResponse) {
  const map = await getTabMap();
  const existingId = map[target];

  if (existingId) {
    chrome.tabs.get(existingId, (tab) => {
      if (chrome.runtime.lastError) {
        console.log('[HALQ Bridge BG] Tracked tab', existingId, 'gone. Creating new.');
        setTabMap({}).then(() => createTab(target, url, sendResponse));
      } else {
        chrome.tabs.update(existingId, {url: url, active: false}, () => {
          if (chrome.runtime.lastError) {
            console.error('[HALQ Bridge BG] tabs.update failed:', chrome.runtime.lastError.message);
            sendResponse({ok: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('[HALQ Bridge BG] Updated tracked tab', existingId);
            sendResponse({ok: true, tabId: existingId, updated: true});
          }
        });
      }
    });
    return;
  }

  createTab(target, url, sendResponse);
}

async function createTab(target, url, sendResponse) {
  chrome.tabs.create({url: url, active: false}, (newTab) => {
    if (chrome.runtime.lastError) {
      console.error('[HALQ Bridge BG] tabs.create failed:', chrome.runtime.lastError.message);
      sendResponse({ok: false, error: chrome.runtime.lastError.message});
    } else {
      const map = {};
      map[target] = newTab.id;
      setTabMap(map).then(() => {
        console.log('[HALQ Bridge BG] Created new tab', newTab.id, 'for target', target);
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

    updateTab(target, url, sendResponse);
    return true; // async response
  }

  sendResponse({ok: false, error: 'Unknown action: ' + request.action});
  return false;
});

console.log('[HALQ Bridge BG] Service worker started');
