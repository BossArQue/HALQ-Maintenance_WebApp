// content.js — Injected into AppFolio pages to prevent iframe-busting
// Runs in an isolated world, so we inject a script into the page context

const script = document.createElement('script');
script.src = chrome.runtime.getURL('patch.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);
