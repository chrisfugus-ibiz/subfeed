// SubFeed — popup/popup.js

const SUBFEED_VERSION = '1.0.0';
const YT_SUBS_URL = 'https://www.youtube.com/feed/subscriptions';
const GITHUB_ISSUES = 'https://github.com/chrisfugus-ibiz/subfeed/issues/new?template=bug_report.md';
const ONBOARDING_URL = chrome.runtime.getURL('onboarding/onboarding.html');

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  document.getElementById('version-label').textContent = `v${SUBFEED_VERSION}`;

  // Check if current tab is on YouTube subscriptions
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
  setupListeners();
  checkNotice();
}

// ─── Load settings from storage ─────────────────────────────────────────────

async function loadSettings() {
  const cfg = await chrome.storage.local.get([
    'rawEnabled', 'timeWindow', 'calmMode', 'hideShorts',
    'subsCount', 'todayCount', 'hiddenCount', 'notice'
  ]);

  // Enable toggle
  const enabledToggle = document.getElementById('toggle-enabled');
  enabledToggle.checked = cfg.rawEnabled !== false; // default true

  // Status dot
  const statusDot = document.getElementById('header-status');
  if (enabledToggle.checked) statusDot.classList.add('active');

  // Time window pills
  const timeWindow = cfg.timeWindow || '7d';
  document.querySelectorAll('#time-pills .pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.window === timeWindow);
  });

  // Calm mode
  document.getElementById('toggle-calm').checked = cfg.calmMode || false;

  // Hide Shorts
  document.getElementById('toggle-shorts').checked = cfg.hideShorts !== false; // default true

  // Stats
  document.getElementById('stat-subs').textContent   = cfg.subsCount   ?? '–';
  document.getElementById('stat-today').textContent  = cfg.todayCount  ?? '–';
  document.getElementById('stat-hidden').textContent = cfg.hiddenCount ?? '–';
}

// ─── Save and propagate changes ──────────────────────────────────────────────

async function saveSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });

  // Tell the active YouTube tab to re-apply
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('youtube.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'SUBFEED_REFRESH' }).catch(() => {
      // Tab may not have content script yet — ignore
    });
  }
}

// ─── Event listeners ────────────────────────────────────────────────────────

function setupListeners() {
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
