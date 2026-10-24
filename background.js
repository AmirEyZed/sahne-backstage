// Stream Wall — service worker
// Opens the wall where it was last left (monitor, size, fullscreen) and relays keyboard shortcuts.

const PAGE_URL = chrome.runtime.getURL('dashboard.html');
const BOUNDS_KEY = 'winBounds';

async function findWallTabs() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
  return contexts.filter((c) => c.documentUrl && c.documentUrl.startsWith(PAGE_URL));
}

async function openWall() {
  const open = await findWallTabs();
  if (open.length) {
    await chrome.windows.update(open[0].windowId, { focused: true });
    await chrome.tabs.update(open[0].tabId, { active: true });
    return;
  }

  const saved = (await chrome.storage.local.get(BOUNDS_KEY))[BOUNDS_KEY];
  const base = { url: PAGE_URL, type: 'popup' };
  let win;
  try {
    const { left, top, width, height } = saved || {};
    win = await chrome.windows.create(saved ? { ...base, left, top, width, height } : { ...base, width: 1080, height: 1920 });
  } catch {
    // Saved position is no longer on any screen (monitor unplugged / rearranged).
    win = await chrome.windows.create({ ...base, width: 1080, height: 1920 });
  }
  if (saved && (saved.state === 'fullscreen' || saved.state === 'maximized')) {
    await chrome.windows.update(win.id, { state: saved.state });
  }
}

// The wall reloads the extension when its files on disk changed (see dashboard.js); a reload
// closes the wall, so bring it back.
let reopening = null;
function reopenAfterSelfReload() {
  // Runs once per worker start, whichever of the two triggers below comes first.
  reopening ??= (async () => {
    const { reopenAfterReload } = await chrome.storage.local.get('reopenAfterReload');
    if (!reopenAfterReload) return;
    await chrome.storage.local.remove('reopenAfterReload');
    if (Date.now() - reopenAfterReload < 30000) await openWall(); // ignore a stale request
  })().catch((err) => console.error('Stream Wall: could not reopen', err));
  return reopening;
}
chrome.runtime.onInstalled.addListener(reopenAfterSelfReload);
reopenAfterSelfReload();

chrome.action.onClicked.addListener(() => {
  openWall().catch((err) => console.error('Stream Wall: could not open', err));
});

chrome.windows.onBoundsChanged.addListener(async (win) => {
  if (win.type !== 'popup' || win.state === 'minimized') return;
  const tabs = await findWallTabs();
  if (!tabs.some((t) => t.windowId === win.id)) return;
  const { left, top, width, height, state } = win;
  await chrome.storage.local.set({ [BOUNDS_KEY]: { left, top, width, height, state } });
});

chrome.commands.onCommand.addListener((command) => {
  // Only the open wall page listens; ignore the rejection when it is closed.
  chrome.runtime.sendMessage({ type: command }).catch(() => {});
});
