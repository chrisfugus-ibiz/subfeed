// SubFeed — background/service-worker.js
// Handles remote config polling and kill switch

const CONFIG_URL = 'https://chrisfugus-ibiz.github.io/subfeed-config/config.json';
const CONFIG_POLL_MINUTES = 240; // every 4 hours

// ─── On install: open onboarding + set defaults ──────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.local.set({
      rawEnabled:  true,
      timeWindow:  '7d',
      calmMode:    false,
      hideShorts:  true,
      killSwitch:  false,
      installedAt: Date.now()
    });

    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding/onboarding.html')
    });

    // Fetch config immediately on install
    fetchRemoteConfig();
  }

  if (details.reason === 'update') {
    fetchRemoteConfig();
  }
});

// ─── Scheduled config fetch ──────────────────────────────────────────────────

chrome.alarms.create('fetchConfig', {
  periodInMinutes: CONFIG_POLL_MINUTES
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchConfig') {
    fetchRemoteConfig();
  }
});

// ─── Version comparison ─────────────────────────────────────────────────────

function isVersionBelow(current, minimum) {
  const a = current.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) < (b[i] || 0)) return true;
    if ((a[i] || 0) > (b[i] || 0)) return false;
  }
  return false;
}

// ─── Remote config fetcher ───────────────────────────────────────────────────

async function fetchRemoteConfig() {
  try {
    const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!res.ok) return;

    const cfg = await res.json();

    // Validate expected shape before writing
    const update = {};

    if (typeof cfg.killSwitch === 'boolean') {
      update.killSwitch = cfg.killSwitch;
    }

    if (cfg.features && typeof cfg.features === 'object') {
      update.remoteFeatures = cfg.features;
    }

    if (cfg.notice && typeof cfg.notice === 'string') {
      update.notice = cfg.notice;
    } else {
      update.notice = null;
    }

    if (cfg.minVersion && typeof cfg.minVersion === 'string') {
      update.minVersion = cfg.minVersion;
      // Check if current version is below minimum
      const current = chrome.runtime.getManifest().version;
      if (isVersionBelow(current, cfg.minVersion)) {
        update.notice = `SubFeed v${cfg.minVersion}+ is required. Please update your extension.`;
      }
    }

    if (Object.keys(update).length > 0) {
      await chrome.storage.local.set(update);
      console.log('SubFeed: remote config updated', update);
    }

  } catch (err) {
    // Fail silently — last known config stays active
    console.warn('SubFeed: remote config fetch failed, using cached config', err.message);
  }
}

// ─── Message handler (from popup or content scripts) ─────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_CONFIG') {
    chrome.storage.local.get(null, (data) => {
      sendResponse({ success: true, config: data });
    });
    return true; // async response
  }

  if (msg.type === 'FORCE_CONFIG_REFRESH') {
    fetchRemoteConfig().then(() => sendResponse({ success: true }));
    return true;
  }
});
