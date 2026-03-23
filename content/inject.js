// SubFeed — content/inject.js
// Runs on youtube.com — watches for subscription feed and re-sorts it

const SUBFEED_VERSION = '1.1.0';
const CONTROL_BAR_ID = 'subfeed-control-bar';

// ─── Selector resilience layer ──────────────────────────────────────────────
// All YouTube DOM selectors in one place. When YouTube changes their DOM,
// update this object instead of hunting through the codebase.

const SEL = {
  feedContainer:   'ytd-section-list-renderer #contents, #contents.ytd-section-list-renderer',
  videoItem:       'ytd-video-renderer, ytd-rich-item-renderer',
  videoTitle:      '#video-title, h3 a',
  channelName:     '#channel-name a, ytd-channel-name a',
  metaLine:        '#metadata-line span',
  timeSpan:        '#metadata-line span:last-child, ytd-video-meta-block #metadata-line span:last-child',
  thumbnail:       'ytd-thumbnail',
  shortsOverlay:   'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]',
  durationOverlay: 'ytd-thumbnail-overlay-time-status-renderer span, .ytd-thumbnail-overlay-time-status-renderer',
  titleLink:       'a#video-title, a.yt-simple-endpoint[href*="watch"]',
};

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
function parseRelativeTime(text) {
  if (!text) return 0;
  const t = text.trim().toLowerCase();
  const now = Date.now();

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
  const timeEl = videoEl.querySelector(SEL.timeSpan);
  if (timeEl) {
    const ts = parseRelativeTime(timeEl.textContent);
    if (ts > 0) return ts;
  }
  const spans = videoEl.querySelectorAll('span');
  for (const span of spans) {
    const ts = parseRelativeTime(span.textContent);
    if (ts > 0) return ts;
  }
  return 0;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getVideoDurationSeconds(item) {
  const durationEl = item.querySelector(SEL.durationOverlay);
  if (!durationEl) return null;

  const text = durationEl.textContent.trim();
  const parts = text.split(':').map(Number);

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function getVideoInfo(videoEl) {
  const titleEl = videoEl.querySelector(SEL.videoTitle);
  const channelEl = videoEl.querySelector(SEL.channelName);
  const metaSpans = videoEl.querySelectorAll(SEL.metaLine);
  const link = videoEl.querySelector(SEL.titleLink);

  const title   = titleEl?.textContent?.trim() || '';
  const channel = channelEl?.textContent?.trim() || '';
  const views   = metaSpans[0]?.textContent?.trim() || '';
  const time    = metaSpans[1]?.textContent?.trim() || '';
  const ts      = getVideoTimestamp(videoEl);
  const isShort = videoEl.querySelector(SEL.shortsOverlay) !== null;
  const videoId = extractVideoId(link?.href);
  const url     = link?.href || '';
  const thumbEl = videoEl.querySelector(`${SEL.thumbnail} img`);
  const thumbnail = thumbEl?.src || '';
  const duration = getVideoDurationSeconds(videoEl);

  return { title, channel, views, time, ts, isShort, videoId, url, thumbnail, duration };
}

// ─── Time window cutoffs ─────────────────────────────────────────────────────

const TIME_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '3d':  3  * 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  'all': Infinity
};

// ─── Mark as Watched ────────────────────────────────────────────────────────

function attachWatchedListeners(videoItems) {
  videoItems.forEach(item => {
    if (item.dataset.sfWatchListener) return;
    const link = item.querySelector(SEL.titleLink);
    if (!link) return;
    link.addEventListener('click', async () => {
      const videoId = extractVideoId(link.href);
      if (!videoId) return;
      const { watchedIds = [] } = await chrome.storage.local.get('watchedIds');
      if (!watchedIds.includes(videoId)) {
        watchedIds.push(videoId);
        const trimmed = watchedIds.slice(-2000);
        await chrome.storage.local.set({ watchedIds: trimmed });
      }
    });
    item.dataset.sfWatchListener = 'true';
  });
}

async function applyWatchedState(videoItems, hideWatched) {
  const { watchedIds = [] } = await chrome.storage.local.get('watchedIds');
  if (watchedIds.length === 0) return;

  const watchedSet = new Set(watchedIds);

  videoItems.forEach(item => {
    const link = item.querySelector(SEL.titleLink);
    const videoId = extractVideoId(link?.href);

    if (videoId && watchedSet.has(videoId)) {
      if (hideWatched) {
        item.style.display = 'none';
      } else {
        item.style.opacity = '0.45';
        item.classList.add('sf-watched');
        if (!item.querySelector('.sf-watched-badge')) {
          const badge = document.createElement('span');
          badge.className = 'sf-watched-badge';
          badge.textContent = 'WATCHED';
          item.style.position = 'relative';
          item.appendChild(badge);
        }
      }
    } else {
      item.style.opacity = '';
      item.classList.remove('sf-watched');
      item.querySelector('.sf-watched-badge')?.remove();
    }
  });
}

// ─── Watch Later ────────────────────────────────────────────────────────────

function injectBookmarkButtons(videoItems) {
  videoItems.forEach(item => {
    if (item.querySelector('.sf-bookmark-btn')) return;
    const info = getVideoInfo(item);
    if (!info.videoId) return;

    const btn = document.createElement('button');
    btn.className = 'sf-bookmark-btn';
    btn.title = 'Save to Watch Later';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2h10v11l-5-3-5 3V2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { watchLater = [] } = await chrome.storage.local.get('watchLater');
      if (watchLater.some(v => v.id === info.videoId)) {
        // Remove if already saved
        await chrome.storage.local.set({
          watchLater: watchLater.filter(v => v.id !== info.videoId)
        });
        btn.classList.remove('sf-bookmarked');
      } else {
        watchLater.unshift({
          id: info.videoId,
          title: info.title,
          channel: info.channel,
          thumbnail: info.thumbnail,
          url: info.url,
          savedAt: Date.now()
        });
        await chrome.storage.local.set({ watchLater });
        btn.classList.add('sf-bookmarked');
      }
    });

    // Check if already saved
    chrome.storage.local.get('watchLater', ({ watchLater = [] }) => {
      if (watchLater.some(v => v.id === info.videoId)) {
        btn.classList.add('sf-bookmarked');
      }
    });

    item.style.position = 'relative';
    item.appendChild(btn);
  });
}

// ─── Keyword Mute ───────────────────────────────────────────────────────────

async function applyKeywordMute(videoItems) {
  const { mutedKeywords = [] } = await chrome.storage.local.get('mutedKeywords');
  if (mutedKeywords.length === 0) return 0;

  const patterns = mutedKeywords.map(k => k.toLowerCase().trim()).filter(Boolean);
  let mutedCount = 0;

  videoItems.forEach(item => {
    if (item.style.display === 'none') return; // already hidden
    const title = item.querySelector(SEL.videoTitle)?.textContent?.toLowerCase() || '';
    if (patterns.some(kw => title.includes(kw))) {
      item.style.display = 'none';
      mutedCount++;
    }
  });

  return mutedCount;
}

// ─── Duration Filter ────────────────────────────────────────────────────────

async function applyDurationFilter(videoItems) {
  const { durationMin = 0, durationMax = 0 } = await chrome.storage.local.get(['durationMin', 'durationMax']);
  if (durationMin === 0 && durationMax === 0) return 0;

  let filteredCount = 0;
  const minSecs = durationMin * 60;
  const maxSecs = durationMax > 0 ? durationMax * 60 : Infinity;

  videoItems.forEach(item => {
    if (item.style.display === 'none') return;
    const dur = getVideoDurationSeconds(item);
    if (dur === null) return; // keep if unknown (live streams etc.)
    if (dur < minSecs || dur > maxSecs) {
      item.style.display = 'none';
      filteredCount++;
    }
  });

  return filteredCount;
}

// ─── Control bar injection ───────────────────────────────────────────────────

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
        <button class="sf-pill ${cfg.hideWatched ? 'sf-pill-active' : ''}" id="sf-watched-btn">
          Unwatched
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
    await chrome.storage.local.set({ calmMode: !cfg.calmMode });
    applySubFeed();
  });

  // Hide Shorts toggle
  bar.querySelector('#sf-shorts-btn').addEventListener('click', async () => {
    await chrome.storage.local.set({ hideShorts: !cfg.hideShorts });
    applySubFeed();
  });

  // Unwatched only toggle
  bar.querySelector('#sf-watched-btn').addEventListener('click', async () => {
    await chrome.storage.local.set({ hideWatched: !cfg.hideWatched });
    applySubFeed();
  });

  const firstChild = container.firstChild;
  container.insertBefore(bar, firstChild);
}

// ─── Core feed transformation ────────────────────────────────────────────────

let isApplying = false;

async function applySubFeed() {
  if (isApplying) return;
  isApplying = true;

  try {
    const cfg = await chrome.storage.local.get([
      'rawEnabled', 'timeWindow', 'calmMode', 'hideShorts', 'hideWatched',
      'killSwitch', 'durationMin', 'durationMax'
    ]);

    if (cfg.killSwitch) {
      document.getElementById(SUBFEED_BAR_ID)?.remove();
      return;
    }

    if (cfg.rawEnabled === false) {
      document.getElementById(SUBFEED_BAR_ID)?.remove();
      return;
    }

    if (!window.location.pathname.includes('/feed/subscriptions')) return;

    let container;
    try {
      container = await waitForElement(SEL.feedContainer);
    } catch (e) {
      return;
    }

    const videoItems = [...container.querySelectorAll(SEL.videoItem)];
    if (videoItems.length === 0) return;

    const timeWindow = cfg.timeWindow || '7d';
    const cutoff     = Date.now() - (TIME_WINDOWS[timeWindow] ?? TIME_WINDOWS['7d']);
    const calmMode   = cfg.calmMode ?? false;
    const hideShorts = cfg.hideShorts ?? true;
    const hideWatched = cfg.hideWatched ?? false;

    let shown = 0;
    let hidden = 0;

    // Tag each item with timestamp
    videoItems.forEach(item => {
      const info = getVideoInfo(item);
      item.dataset.sfTs = info.ts;
      item.dataset.sfIsShort = info.isShort;
    });

    // Sort by timestamp descending
    const sorted = [...videoItems].sort((a, b) =>
      parseInt(b.dataset.sfTs) - parseInt(a.dataset.sfTs)
    );

    const listEl = videoItems[0]?.parentElement;
    if (!listEl) return;

    // Re-append in sorted order with time window + shorts filter
    sorted.forEach(item => {
      const ts      = parseInt(item.dataset.sfTs);
      const isShort = item.dataset.sfIsShort === 'true';

      let hide = false;
      if (ts > 0 && ts < cutoff) hide = true;
      if (hideShorts && isShort) hide = true;

      item.style.display = hide ? 'none' : '';
      item.style.opacity = '';
      item.classList.remove('sf-watched');
      item.querySelector('.sf-watched-badge')?.remove();
      hide ? hidden++ : shown++;

      listEl.appendChild(item);
    });

    // Apply keyword mute
    const mutedCount = await applyKeywordMute(sorted);
    hidden += mutedCount;
    shown -= mutedCount;

    // Apply duration filter
    const durationFiltered = await applyDurationFilter(sorted);
    hidden += durationFiltered;
    shown -= durationFiltered;

    // Apply watched state (grey out or hide)
    await applyWatchedState(sorted, hideWatched);

    // Attach click listeners for tracking watched videos
    attachWatchedListeners(sorted);

    // Inject bookmark buttons for Watch Later
    injectBookmarkButtons(sorted);

    // Calm mode
    container.querySelectorAll(SEL.thumbnail).forEach(thumb => {
      thumb.style.display = calmMode ? 'none' : '';
    });

    // Persist stats for popup
    chrome.storage.local.set({ hiddenCount: hidden, todayCount: shown });

    // Inject control bar
    injectControlBar(container, cfg, { shown, hidden });

    // Set up infinite scroll observer
    setupFeedObserver(listEl);

  } finally {
    isApplying = false;
  }
}

// ─── Infinite scroll handling ───────────────────────────────────────────────
// YouTube lazy-loads feed items as the user scrolls. We watch for new items
// and re-apply SubFeed when they appear.

let feedObserver = null;

function setupFeedObserver(listEl) {
  if (feedObserver) feedObserver.disconnect();

  let debounceTimer = null;
  feedObserver = new MutationObserver((mutations) => {
    const hasNewItems = mutations.some(m => m.addedNodes.length > 0);
    if (!hasNewItems) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applySubFeed();
    }, 500);
  });

  feedObserver.observe(listEl, { childList: true });
}

// ─── SPA navigation watcher ──────────────────────────────────────────────────

let lastUrl = location.href;

const navObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (feedObserver) feedObserver.disconnect();
    setTimeout(() => applySubFeed(), 1200);
  }
});

navObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener('yt-navigate-finish', () => {
  setTimeout(applySubFeed, 800);
});

// ─── Initial run ─────────────────────────────────────────────────────────────

chrome.storage.local.get(['rawEnabled', 'timeWindow'], (data) => {
  const defaults = {};
  if (data.rawEnabled === undefined) defaults.rawEnabled = true;
  if (data.timeWindow === undefined) defaults.timeWindow = '7d';
  if (Object.keys(defaults).length > 0) {
    chrome.storage.local.set(defaults);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SUBFEED_REFRESH') {
    applySubFeed();
  }
});

applySubFeed();
