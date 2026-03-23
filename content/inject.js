// SubFeed — content/inject.js
// Runs on youtube.com — watches for subscription feed and re-sorts it

const SUBFEED_VERSION = '1.0.0';
const CONTROL_BAR_ID = 'subfeed-control-bar';

// ─── Helpers ────────────────────────────────────────────────────────────────

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`SubFeed: timeout waiting for ${selector}`));
    }, timeout);
  });
}

// Parse YouTube's relative time strings into a timestamp (ms)
// e.g. "2 hours ago", "3 days ago", "1 week ago"
function parseRelativeTime(text) {
  if (!text) return 0;
  const t = text.trim().toLowerCase();
  const now = Date.now();

  // Handle "Streamed 2 hours ago", "Premiered 3 days ago", plain "2 hours ago"
  const match = t.match(/(?:(?:streamed|premiered|updated)\s+)?(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  const units = {
    second: 1000,
    minute: 60 * 1000,
    hour:   60 * 60 * 1000,
    day:    24 * 60 * 60 * 1000,
    week:   7  * 24 * 60 * 60 * 1000,
    month:  30 * 24 * 60 * 60 * 1000,
    year:   365 * 24 * 60 * 60 * 1000
  };

  return now - (value * (units[unit] || 0));
}

function getVideoTimestamp(videoEl) {
  // Try aria-label first (most reliable)
  const timeEl = videoEl.querySelector('#metadata-line span:last-child, ytd-video-meta-block #metadata-line span:last-child');
  if (timeEl) {
    const ts = parseRelativeTime(timeEl.textContent);
    if (ts > 0) return ts;
  }
  // Fallback: search all spans for relative time pattern
  const spans = videoEl.querySelectorAll('span');
  for (const span of spans) {
    const ts = parseRelativeTime(span.textContent);
    if (ts > 0) return ts;
  }
  return 0;
}

function getVideoInfo(videoEl) {
  const titleEl = videoEl.querySelector('#video-title, h3 a');
  const channelEl = videoEl.querySelector('#channel-name a, ytd-channel-name a');
  const metaSpans = videoEl.querySelectorAll('#metadata-line span');

  const title   = titleEl?.textContent?.trim() || '';
  const channel = channelEl?.textContent?.trim() || '';
  const views   = metaSpans[0]?.textContent?.trim() || '';
  const time    = metaSpans[1]?.textContent?.trim() || '';
  const ts      = getVideoTimestamp(videoEl);
  const isShort = videoEl.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]') !== null;

  return { title, channel, views, time, ts, isShort };
}

// ─── Time window cutoffs ─────────────────────────────────────────────────────

const TIME_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '3d':  3  * 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  'all': Infinity
};

// ─── Control bar injection ───────────────────────────────────────────────────

function removeControlBar() {
  document.getElementById(SUBFEED_BAR_ID)?.remove();
}

const SUBFEED_BAR_ID = CONTROL_BAR_ID;

function injectControlBar(container, cfg, stats) {
  document.getElementById(SUBFEED_BAR_ID)?.remove();

  const bar = document.createElement('div');
  bar.id = SUBFEED_BAR_ID;
  bar.innerHTML = `
    <div class="sf-bar">
      <div class="sf-bar-left">
        <span class="sf-logo">SubFeed</span>
        <span class="sf-badge">LIVE</span>
      </div>
      <div class="sf-bar-filters">
        <span class="sf-filter-label">Show:</span>
        ${['24h','3d','7d','all'].map(w =>
          `<button class="sf-pill ${cfg.timeWindow === w ? 'sf-pill-active' : ''}" data-window="${w}">
            ${w === 'all' ? 'All' : w}
          </button>`
        ).join('')}
        <div class="sf-sep"></div>
        <button class="sf-pill ${cfg.calmMode ? 'sf-pill-active' : ''}" id="sf-calm-btn">
          Calm
        </button>
        <button class="sf-pill ${cfg.hideShorts ? 'sf-pill-active' : ''}" id="sf-shorts-btn">
          Hide Shorts
        </button>
      </div>
      <div class="sf-bar-stats">
        <span class="sf-stat"><span class="sf-stat-num">${stats.shown}</span> videos</span>
        <span class="sf-stat"><span class="sf-stat-num">${stats.hidden}</span> hidden</span>
      </div>
    </div>
  `;

  // Time window buttons
  bar.querySelectorAll('.sf-pill[data-window]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await chrome.storage.local.set({ timeWindow: btn.dataset.window });
      applySubFeed();
    });
  });

  // Calm mode toggle
  bar.querySelector('#sf-calm-btn').addEventListener('click', async () => {
    const newVal = !cfg.calmMode;
    await chrome.storage.local.set({ calmMode: newVal });
    applySubFeed();
  });

  // Hide Shorts toggle
  bar.querySelector('#sf-shorts-btn').addEventListener('click', async () => {
    const newVal = !cfg.hideShorts;
    await chrome.storage.local.set({ hideShorts: newVal });
    applySubFeed();
  });

  const firstChild = container.firstChild;
  container.insertBefore(bar, firstChild);
}

// ─── Core feed transformation ────────────────────────────────────────────────

async function applySubFeed() {
  // Check kill switch and enabled state
  const cfg = await chrome.storage.local.get([
    'rawEnabled', 'timeWindow', 'calmMode', 'hideShorts', 'killSwitch'
  ]);

  if (cfg.killSwitch) {
    console.log('SubFeed: disabled by remote kill switch');
    document.getElementById(SUBFEED_BAR_ID)?.remove();
    return;
  }

  if (cfg.rawEnabled === false) {
    document.getElementById(SUBFEED_BAR_ID)?.remove();
    return;
  }

  // Only run on subscriptions feed page
  if (!window.location.pathname.includes('/feed/subscriptions')) return;

  // Wait for the feed content container
  let container;
  try {
    container = await waitForElement('ytd-section-list-renderer #contents, #contents.ytd-section-list-renderer');
  } catch (e) {
    // Not on the right page yet
    return;
  }

  // Gather all video renderer elements
  const videoItems = [...container.querySelectorAll('ytd-video-renderer, ytd-rich-item-renderer')];
  if (videoItems.length === 0) return;

  const timeWindow = cfg.timeWindow || '7d';
  const cutoff     = Date.now() - (TIME_WINDOWS[timeWindow] ?? TIME_WINDOWS['7d']);
  const calmMode   = cfg.calmMode ?? false;
  const hideShorts = cfg.hideShorts ?? true;

  let shown = 0;
  let hidden = 0;

  // Tag each item with its timestamp (data attribute for easy re-sorting)
  videoItems.forEach(item => {
    const info = getVideoInfo(item);
    item.dataset.sfTs = info.ts;
    item.dataset.sfIsShort = info.isShort;
  });

  // Sort by timestamp descending (newest first)
  const sorted = [...videoItems].sort((a, b) =>
    parseInt(b.dataset.sfTs) - parseInt(a.dataset.sfTs)
  );

  // Find the actual content list (direct parent of items)
  const listEl = videoItems[0]?.parentElement;
  if (!listEl) return;

  // Re-append in sorted order, applying visibility filters
  sorted.forEach(item => {
    const ts      = parseInt(item.dataset.sfTs);
    const isShort = item.dataset.sfIsShort === 'true';

    let hide = false;
    if (ts > 0 && ts < cutoff) hide = true;
    if (hideShorts && isShort) hide = true;

    item.style.display = hide ? 'none' : '';
    hide ? hidden++ : shown++;

    listEl.appendChild(item); // moves to end in sorted order
  });

  // Calm mode — hide thumbnails
  container.querySelectorAll('ytd-thumbnail').forEach(thumb => {
    thumb.style.display = calmMode ? 'none' : '';
  });

  // Persist stats for popup
  chrome.storage.local.set({ hiddenCount: hidden, todayCount: shown });

  // Inject control bar
  injectControlBar(container, cfg, { shown, hidden });
}

// ─── SPA navigation watcher ──────────────────────────────────────────────────
// YouTube is a Single Page App — URL changes don't trigger page reloads.
// We watch for navigation events and re-apply SubFeed when the user
// navigates to the subscriptions feed.

let lastUrl = location.href;

const navObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    // Small delay to let YouTube render the new page
    setTimeout(() => {
      applySubFeed();
    }, 1200);
  }
});

navObserver.observe(document.body, { childList: true, subtree: true });

// Also watch for YouTube's own navigation event
window.addEventListener('yt-navigate-finish', () => {
  setTimeout(applySubFeed, 800);
});

// ─── Initial run ─────────────────────────────────────────────────────────────

// Set defaults on first install
chrome.storage.local.get(['rawEnabled', 'timeWindow'], (data) => {
  const defaults = {};
  if (data.rawEnabled === undefined) defaults.rawEnabled = true;
  if (data.timeWindow === undefined) defaults.timeWindow = '7d';
  if (Object.keys(defaults).length > 0) {
    chrome.storage.local.set(defaults);
  }
});

// Listen for refresh messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SUBFEED_REFRESH') {
    applySubFeed();
  }
});

// Run on initial page load
applySubFeed();
