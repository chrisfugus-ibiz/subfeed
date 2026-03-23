// SubFeed — popup/popup.js

const SUBFEED_VERSION = '1.1.0';
const YT_SUBS_URL = 'https://www.youtube.com/feed/subscriptions';
const GITHUB_ISSUES = 'https://github.com/chrisfugus-ibiz/subfeed/issues/new?template=bug_report.md';
const ONBOARDING_URL = chrome.runtime.getURL('onboarding/onboarding.html');

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  document.getElementById('version-label').textContent = `v${SUBFEED_VERSION}`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isOnYT = tab?.url?.includes('youtube.com');

  if (isOnYT) {
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('not-on-yt').style.display = 'none';

    const onSubs = tab?.url?.includes('/feed/subscriptions');
    document.getElementById('header-sub').textContent = onSubs
      ? 'Subscriptions feed active'
      : 'youtube.com';
  } else {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('not-on-yt').style.display = 'block';
    document.getElementById('header-sub').textContent = 'Not on YouTube';
  }

  await loadSettings();
  await loadMutedKeywords();
  await loadWatchLater();
  setupListeners();
  checkNotice();
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ─── Load settings from storage ─────────────────────────────────────────────

async function loadSettings() {
  const cfg = await chrome.storage.local.get([
    'rawEnabled', 'timeWindow', 'calmMode', 'hideShorts', 'hideWatched',
    'subsCount', 'todayCount', 'hiddenCount', 'notice',
    'durationMin', 'durationMax'
  ]);

  // Enable toggle
  const enabledToggle = document.getElementById('toggle-enabled');
  enabledToggle.checked = cfg.rawEnabled !== false;

  // Status dot
  const statusDot = document.getElementById('header-status');
  if (enabledToggle.checked) statusDot.classList.add('active');

  // Time window pills
  const timeWindow = cfg.timeWindow || '7d';
  document.querySelectorAll('#time-pills .pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.window === timeWindow);
  });

  // Toggles
  document.getElementById('toggle-calm').checked = cfg.calmMode || false;
  document.getElementById('toggle-shorts').checked = cfg.hideShorts !== false;
  document.getElementById('toggle-watched').checked = cfg.hideWatched || false;

  // Duration filter
  document.getElementById('duration-min').value = cfg.durationMin || 0;
  document.getElementById('duration-max').value = cfg.durationMax || 0;

  // Stats
  document.getElementById('stat-subs').textContent   = cfg.subsCount   ?? '--';
  document.getElementById('stat-today').textContent  = cfg.todayCount  ?? '--';
  document.getElementById('stat-hidden').textContent = cfg.hiddenCount ?? '--';
}

// ─── Save and propagate changes ──────────────────────────────────────────────

async function saveSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('youtube.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'SUBFEED_REFRESH' }).catch(() => {});
  }
}

// ─── Muted Keywords ─────────────────────────────────────────────────────────

async function loadMutedKeywords() {
  const { mutedKeywords = [] } = await chrome.storage.local.get('mutedKeywords');
  renderMuteList(mutedKeywords);
}

function renderMuteList(keywords) {
  const container = document.getElementById('mute-list');
  if (keywords.length === 0) {
    container.innerHTML = '<span class="mute-empty">No muted keywords</span>';
    return;
  }
  container.innerHTML = keywords.map((kw, i) =>
    `<span class="mute-tag">${kw}<span class="mute-tag-x" data-idx="${i}">&times;</span></span>`
  ).join('');

  container.querySelectorAll('.mute-tag-x').forEach(x => {
    x.addEventListener('click', async () => {
      const { mutedKeywords = [] } = await chrome.storage.local.get('mutedKeywords');
      mutedKeywords.splice(parseInt(x.dataset.idx), 1);
      await chrome.storage.local.set({ mutedKeywords });
      renderMuteList(mutedKeywords);
      saveSetting('_refresh', Date.now()); // trigger refresh
    });
  });
}

async function addMutedKeyword() {
  const input = document.getElementById('mute-input');
  const keyword = input.value.trim();
  if (!keyword) return;

  const { mutedKeywords = [] } = await chrome.storage.local.get('mutedKeywords');
  if (mutedKeywords.includes(keyword.toLowerCase())) return;

  mutedKeywords.push(keyword.toLowerCase());
  await chrome.storage.local.set({ mutedKeywords });
  input.value = '';
  renderMuteList(mutedKeywords);
  saveSetting('_refresh', Date.now());
}

// ─── Watch Later ────────────────────────────────────────────────────────────

async function loadWatchLater() {
  const { watchLater = [] } = await chrome.storage.local.get('watchLater');
  renderWatchLater(watchLater);
}

function renderWatchLater(items) {
  const container = document.getElementById('wl-list');
  if (items.length === 0) {
    container.innerHTML = '<div class="wl-empty">No saved videos.<br>Click the bookmark icon on any video in your feed.</div>';
    return;
  }

  container.innerHTML = items.map((v, i) => `
    <div class="wl-item">
      <img class="wl-thumb" src="${v.thumbnail || ''}" alt="">
      <div class="wl-info">
        <div class="wl-title" data-url="${v.url || `https://youtube.com/watch?v=${v.id}`}">${v.title}</div>
        <div class="wl-channel">${v.channel}</div>
      </div>
      <button class="wl-remove" data-idx="${i}">&times;</button>
    </div>
  `).join('');

  // Open video on title click
  container.querySelectorAll('.wl-title').forEach(el => {
    el.addEventListener('click', () => {
      chrome.tabs.create({ url: el.dataset.url });
    });
  });

  // Remove button
  container.querySelectorAll('.wl-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { watchLater = [] } = await chrome.storage.local.get('watchLater');
      watchLater.splice(parseInt(btn.dataset.idx), 1);
      await chrome.storage.local.set({ watchLater });
      renderWatchLater(watchLater);
    });
  });
}

// ─── Event listeners ────────────────────────────────────────────────────────

function setupListeners() {
  setupTabs();

  // Enable/disable toggle
  document.getElementById('toggle-enabled').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    await saveSetting('rawEnabled', enabled);
    const statusDot = document.getElementById('header-status');
    enabled ? statusDot.classList.add('active') : statusDot.classList.remove('active');
  });

  // Time window pills
  document.querySelectorAll('#time-pills .pill').forEach(pill => {
    pill.addEventListener('click', async () => {
      document.querySelectorAll('#time-pills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      await saveSetting('timeWindow', pill.dataset.window);
    });
  });

  // Calm mode
  document.getElementById('toggle-calm').addEventListener('change', async (e) => {
    await saveSetting('calmMode', e.target.checked);
  });

  // Hide Shorts
  document.getElementById('toggle-shorts').addEventListener('change', async (e) => {
    await saveSetting('hideShorts', e.target.checked);
  });

  // Unwatched only
  document.getElementById('toggle-watched').addEventListener('change', async (e) => {
    await saveSetting('hideWatched', e.target.checked);
  });

  // Keyword mute
  document.getElementById('mute-add').addEventListener('click', addMutedKeyword);
  document.getElementById('mute-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addMutedKeyword();
  });

  // Duration filter
  document.getElementById('duration-min').addEventListener('change', async (e) => {
    await saveSetting('durationMin', parseInt(e.target.value) || 0);
  });
  document.getElementById('duration-max').addEventListener('change', async (e) => {
    await saveSetting('durationMax', parseInt(e.target.value) || 0);
  });

  // Clear watched history
  document.getElementById('clear-watched').addEventListener('click', async () => {
    await chrome.storage.local.set({ watchedIds: [] });
    document.getElementById('clear-watched').textContent = 'Cleared!';
    setTimeout(() => {
      document.getElementById('clear-watched').textContent = 'Clear watched history';
    }, 2000);
    saveSetting('_refresh', Date.now());
  });

  // Go to YouTube button
  document.getElementById('go-to-yt')?.addEventListener('click', () => {
    chrome.tabs.create({ url: YT_SUBS_URL });
    window.close();
  });

  // Feedback link
  document.getElementById('feedback-link').addEventListener('click', () => {
    chrome.tabs.create({ url: GITHUB_ISSUES });
    window.close();
  });

  // Help / onboarding
  document.getElementById('open-onboarding').addEventListener('click', () => {
    chrome.tabs.create({ url: ONBOARDING_URL });
    window.close();
  });
}

// ─── Notice banner (from remote config) ─────────────────────────────────────

async function checkNotice() {
  const { notice } = await chrome.storage.local.get('notice');
  if (notice) {
    const banner = document.getElementById('notice-banner');
    banner.textContent = notice;
    banner.classList.add('show');
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
