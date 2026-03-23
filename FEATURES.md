# SubFeed — Feature Roadmap & Specifications

> Complete feature breakdown for all planned SubFeed capabilities.  
> Use this document in Cursor as your build reference for each feature.

---

## Table of Contents

1. [Phase 1 — Core (Shipped)](#phase-1--core-shipped)
2. [Phase 2 — Retention Features](#phase-2--retention-features)
3. [Phase 3 — Power User Features](#phase-3--power-user-features)
4. [Phase 4 — Monetization Layer](#phase-4--monetization-layer)
5. [Phase 5 — Platform Expansion](#phase-5--platform-expansion)
6. [Monetization Strategy](#monetization-strategy)
7. [Technical Dependencies Map](#technical-dependencies-map)

---

## Phase 1 — Core (Shipped)

### ✅ 1.1 Chronological Feed Sort
**Status:** Done  
**What it does:** Re-sorts the YouTube subscription feed into strict reverse-chronological order (newest first) by parsing relative time strings from the DOM.  
**Key file:** `content/inject.js` → `applySubFeed()`  
**Storage keys:** `rawEnabled`, `timeWindow`

---

### ✅ 1.2 Time Window Filter
**Status:** Done  
**What it does:** Shows only videos uploaded within a selected window — 24h, 3 days, 7 days, or all time.  
**Key file:** `content/inject.js` → `TIME_WINDOWS` constant  
**Storage keys:** `timeWindow`

---

### ✅ 1.3 Calm Mode
**Status:** Done  
**What it does:** Hides all `ytd-thumbnail` elements, leaving a clean text-only feed with no visual clickbait.  
**Key file:** `content/inject.js`, `content/styles.css`  
**Storage keys:** `calmMode`

---

### ✅ 1.4 Hide Shorts
**Status:** Done  
**What it does:** Detects and hides YouTube Shorts from the subscription feed using the overlay style attribute.  
**Key file:** `content/inject.js` → `getVideoInfo()`  
**Storage keys:** `hideShorts`

---

### ✅ 1.5 Remote Kill Switch
**Status:** Done  
**What it does:** Service worker polls `config.json` on GitHub Pages every 4 hours. `killSwitch: true` disables the extension globally without a store update.  
**Key file:** `background/service-worker.js`  
**Storage keys:** `killSwitch`, `remoteFeatures`, `notice`

---

## Phase 2 — Retention Features

### 🔲 2.1 Mark as Watched
**Priority:** High  
**Build time:** 1 day  
**Effort:** Very low — no API needed  
**Impact:** Users return daily knowing exactly where they left off

#### What it does
When a user clicks a video link in the SubFeed feed, the video ID is recorded in `chrome.storage.local`. On the next feed load, watched videos receive a subtle visual treatment (greyed out, with a small "watched" indicator). A toggle in the popup allows users to show/hide watched videos.

#### User story
> "I open my feed in the morning, watch 5 videos, close my laptop. When I come back in the evening, I can immediately see exactly which videos I haven't watched yet."

#### Technical implementation

```js
// content/inject.js additions

// On video click — record as watched
function attachWatchedListeners(videoItems) {
  videoItems.forEach(item => {
    const link = item.querySelector('a#video-title, a.yt-simple-endpoint');
    if (!link) return;
    link.addEventListener('click', async () => {
      const videoId = extractVideoId(link.href);
      if (!videoId) return;
      const { watchedIds = [] } = await chrome.storage.local.get('watchedIds');
      if (!watchedIds.includes(videoId)) {
        watchedIds.push(videoId);
        // Cap at 2000 entries to avoid storage limits
        const trimmed = watchedIds.slice(-2000);
        await chrome.storage.local.set({ watchedIds: trimmed });
      }
    });
  });
}

// On feed render — apply watched styling
async function applyWatchedState(videoItems) {
  const { watchedIds = [], hideWatched = false } = 
    await chrome.storage.local.get(['watchedIds', 'hideWatched']);
  
  videoItems.forEach(item => {
    const link = item.querySelector('a#video-title, a.yt-simple-endpoint');
    const videoId = extractVideoId(link?.href);
    
    if (videoId && watchedIds.includes(videoId)) {
      if (hideWatched) {
        item.style.display = 'none';
      } else {
        item.style.opacity = '0.45';
        item.classList.add('sf-watched');
        // Inject small "watched" badge
        injectWatchedBadge(item);
      }
    }
  });
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
```

#### CSS additions (`content/styles.css`)
```css
.sf-watched { position: relative; }
.sf-watched-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0,0,0,0.65);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  z-index: 10;
  letter-spacing: 0.3px;
}
```

#### Popup additions
- Toggle: "Hide watched videos" (on/off)
- Button: "Clear watch history" (clears `watchedIds` from storage)
- Stat: "X watched today" in the stats row

#### Storage keys added
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `watchedIds` | string[] | `[]` | Array of watched video IDs (capped at 2000) |
| `hideWatched` | boolean | `false` | Whether to hide or just grey out watched |

---

### 🔲 2.2 Watch Later List
**Priority:** High  
**Build time:** 2–3 days  
**Effort:** Low — no API needed  
**Impact:** Turns SubFeed into a reading list, not just a feed viewer

#### What it does
A bookmark icon appears on hover over each video card in the feed. Clicking it saves the video (title, channel, thumbnail URL, video ID, timestamp) to a local watch-later list. The list is accessible from a dedicated tab in the popup.

#### User story
> "I'm at work browsing my feed quickly. I see a 40-minute tutorial I want to watch tonight. I bookmark it in SubFeed. Later I open SubFeed and go straight to my saved list."

#### Technical implementation

```js
// Inject bookmark button on each video card
function injectBookmarkButton(item, videoData) {
  const existing = item.querySelector('.sf-bookmark-btn');
  if (existing) return;

  const btn = document.createElement('button');
  btn.className = 'sf-bookmark-btn';
  btn.title = 'Save to SubFeed Watch Later';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2h10v11l-5-3-5 3V2z" stroke="currentColor" stroke-width="1.5" 
          stroke-linejoin="round"/>
  </svg>`;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await saveToWatchLater(videoData);
    btn.classList.add('sf-bookmarked');
  });

  // Check if already saved
  chrome.storage.local.get('watchLater', ({ watchLater = [] }) => {
    if (watchLater.some(v => v.id === videoData.id)) {
      btn.classList.add('sf-bookmarked');
    }
  });

  item.style.position = 'relative';
  item.appendChild(btn);
}

async function saveToWatchLater(videoData) {
  const { watchLater = [] } = await chrome.storage.local.get('watchLater');
  if (watchLater.some(v => v.id === videoData.id)) return; // already saved
  watchLater.unshift({ ...videoData, savedAt: Date.now() });
  await chrome.storage.local.set({ watchLater });
}

async function removeFromWatchLater(videoId) {
  const { watchLater = [] } = await chrome.storage.local.get('watchLater');
  await chrome.storage.local.set({ 
    watchLater: watchLater.filter(v => v.id !== videoId) 
  });
}
```

#### Popup Watch Later tab
The popup gets a second tab: "Watch Later". It shows a scrollable list of saved videos (max 10 visible, scrollable), each with title, channel name, and a "Remove" button. Clicking a video opens it in a new tab.

#### Storage keys added
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `watchLater` | object[] | `[]` | Array of saved video objects: `{id, title, channel, thumbnail, url, savedAt}` |

---

### 🔲 2.3 Channel Grouping
**Priority:** High  
**Build time:** 1–2 weeks  
**Effort:** Medium — requires YouTube OAuth  
**Impact:** The single feature that separates SubFeed from every competitor

#### What it does
Users organise their subscriptions into named groups (e.g. "Tech", "Music", "News"). The SubFeed control bar shows group filter pills. Clicking a group shows only videos from channels in that group.

#### User story
> "I follow 180 channels. On my morning commute I only want Tech and News. At the gym I want Music. I've set up my groups once and now switch between them with one click."

#### Technical implementation — full spec

**Step 1: Fetch subscriptions via YouTube Data API**

```js
// Requires user to grant: youtube.readonly OAuth scope
// content/channel-groups.js

async function fetchUserSubscriptions(accessToken) {
  const subs = [];
  let pageToken = '';
  
  do {
    const url = `https://www.googleapis.com/youtube/v3/subscriptions?` +
      `part=snippet&mine=true&maxResults=50&pageToken=${pageToken}` +
      `&access_token=${accessToken}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    data.items?.forEach(item => {
      subs.push({
        id:        item.snippet.resourceId.channelId,
        name:      item.snippet.title,
        thumbnail: item.snippet.thumbnails?.default?.url || ''
      });
    });
    
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  
  return subs;
}
```

**Step 2: Store groups locally**

```js
// Group data structure in chrome.storage.local
{
  channelGroups: [
    {
      id: 'group_abc123',
      name: 'Tech',
      color: '#1D9E75',
      channelIds: ['UCxxxxxx', 'UCyyyyyy', 'UCzzzzzz'],
      createdAt: 1714000000000
    },
    {
      id: 'group_def456', 
      name: 'Music',
      color: '#378ADD',
      channelIds: ['UCaaaaaa', 'UCbbbbbb']
    }
  ],
  activeGroup: null  // null = show all groups
}
```

**Step 3: Filter feed by active group**

```js
// In applySubFeed() — add group filter after time window filter
async function applyGroupFilter(videoItems) {
  const { channelGroups = [], activeGroup } = 
    await chrome.storage.local.get(['channelGroups', 'activeGroup']);
  
  if (!activeGroup) return videoItems; // no filter active
  
  const group = channelGroups.find(g => g.id === activeGroup);
  if (!group) return videoItems;
  
  return videoItems.filter(item => {
    const channelLink = item.querySelector('ytd-channel-name a, #channel-name a');
    const channelId   = channelLink?.href?.split('/channel/')?.[1]?.split('/')?.[0];
    return channelId && group.channelIds.includes(channelId);
  });
}
```

**Step 4: Group manager UI**

A dedicated options page (`options/groups.html`) where users:
- See all their subscriptions fetched from YouTube
- Drag channels into groups
- Create, rename, delete, and reorder groups
- Assign a colour to each group

The control bar in the feed gets group pills next to the time window pills:
```
[SubFeed LIVE]  Show: [24h] [3d] [7d] [All]  |  [Calm] [Hide Shorts]
Groups: [All] [Tech ×3] [Music ×2] [News ×5]
```

#### OAuth setup in manifest.json
```json
{
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/youtube.readonly"]
  },
  "permissions": ["identity"]
}
```

#### Storage keys added
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `channelGroups` | object[] | `[]` | Array of group objects |
| `activeGroup` | string\|null | `null` | ID of currently active group filter |
| `allSubscriptions` | object[] | `[]` | Cached subscription list from YouTube API |
| `subsLastFetched` | number | `0` | Timestamp of last API fetch (refresh every 24h) |

---

### 🔲 2.4 Keyword Mute
**Priority:** High  
**Build time:** 1 day  
**Effort:** Very low — no API needed  
**Impact:** Reduces feed noise dramatically — huge quality-of-life win

#### What it does
Users add words or phrases to a mute list. Any video whose title contains a muted keyword is hidden from the feed. Case-insensitive. Supports exact phrases ("world cup") and single words ("drama").

#### User story
> "Every time there's a major news event I don't care about, my feed fills with reaction videos. I mute 'reaction', 'responds to', and 'drama' and my feed is clean again."

#### Technical implementation

```js
// In applySubFeed() — add after time window filter
async function applyKeywordMute(videoItems) {
  const { mutedKeywords = [] } = await chrome.storage.local.get('mutedKeywords');
  if (mutedKeywords.length === 0) return videoItems;
  
  const patterns = mutedKeywords.map(k => k.toLowerCase().trim());
  
  return videoItems.filter(item => {
    const title = item.querySelector('#video-title')
      ?.textContent?.toLowerCase() || '';
    return !patterns.some(kw => title.includes(kw));
  });
}
```

#### Popup UI additions
- Text input: "Mute keyword or phrase" + Add button
- List of active muted keywords, each with an × remove button
- Count: "14 videos hidden by mute filters today"

#### Storage keys added
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mutedKeywords` | string[] | `[]` | List of muted keyword strings |
| `mutedCount` | number | `0` | Running count of muted videos (reset daily) |

---

### 🔲 2.5 Unwatched Only Filter
**Priority:** Medium  
**Build time:** Half a day  
**Effort:** Very low — depends on 2.1  
**Dependency:** Requires Mark as Watched (2.1) to be built first

#### What it does
A toggle in the control bar and popup: "Unwatched only". When active, any video already in the user's watched history is hidden from the feed, leaving a pure queue of content they haven't seen yet.

#### Technical implementation
```js
// Extends applyWatchedState() from feature 2.1
async function applyUnwatchedFilter(videoItems) {
  const { watchedIds = [], unwatchedOnly = false } = 
    await chrome.storage.local.get(['watchedIds', 'unwatchedOnly']);
  
  if (!unwatchedOnly) return videoItems;
  
  return videoItems.filter(item => {
    const link = item.querySelector('a#video-title');
    const videoId = extractVideoId(link?.href);
    return !videoId || !watchedIds.includes(videoId);
  });
}
```

---

## Phase 3 — Power User Features

### 🔲 3.1 Duration Filter
**Priority:** Medium  
**Build time:** 2 days  
**Effort:** Low — no API needed

#### What it does
A min/max duration slider in the control bar. Users set a range (e.g. 5–20 minutes) and only videos within that range appear. Perfect for commuters who want "under 15 minutes" or focused learners who want "over 30 minutes".

#### Technical implementation
```js
function getVideoDurationSeconds(item) {
  const durationEl = item.querySelector(
    'ytd-thumbnail-overlay-time-status-renderer span, .ytd-thumbnail-overlay-time-status-renderer'
  );
  if (!durationEl) return null;
  
  const text = durationEl.textContent.trim(); // "12:34" or "1:23:45"
  const parts = text.split(':').map(Number);
  
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

// Filter application
function applyDurationFilter(videoItems, minSecs, maxSecs) {
  return videoItems.filter(item => {
    const dur = getVideoDurationSeconds(item);
    if (dur === null) return true; // keep if duration unknown (e.g. live streams)
    return dur >= minSecs && dur <= maxSecs;
  });
}
```

#### Control bar UI
Two inputs added below the main control bar row:
```
Duration: [  5 min ] ──────●──────────── [ 120 min ]
```

---

### 🔲 3.2 Channel Health Dashboard
**Priority:** Medium  
**Build time:** 3–4 days  
**Effort:** Medium — uses local data only

#### What it does
A stats view (accessible from the popup or options page) showing:
- Channels sorted by days since last upload
- Average upload frequency per channel
- Channels where the user has watched 0 of the last 10 videos
- "Inactive channels" — haven't uploaded in 30+ days

Helps users clean up dead subscriptions they've forgotten about.

#### Data source
Built entirely from feed data already collected locally. No API calls needed. Each time SubFeed processes the feed, it records channel activity into a local channel stats store.

```js
// Called during feed processing
async function updateChannelStats(videoItems) {
  const { channelStats = {} } = await chrome.storage.local.get('channelStats');
  const now = Date.now();
  
  videoItems.forEach(item => {
    const info = getVideoInfo(item);
    if (!info.channel) return;
    
    if (!channelStats[info.channel]) {
      channelStats[info.channel] = {
        name:          info.channel,
        lastSeen:      0,
        uploadCount:   0,
        watchedCount:  0
      };
    }
    
    const stat = channelStats[info.channel];
    if (info.ts > stat.lastSeen) stat.lastSeen = info.ts;
    stat.uploadCount++;
  });
  
  await chrome.storage.local.set({ channelStats });
}
```

---

### 🔲 3.3 Daily Digest Email
**Priority:** High (for retention)  
**Build time:** 1–2 weeks  
**Effort:** High — requires backend  
**Architecture change:** This is the first feature that needs a server

#### What it does
Users opt in with their email address. Every morning at a chosen time, they receive an email listing every new video uploaded in the last 24 hours by channels they follow. No YouTube app needed. Works even if the user doesn't open their browser.

#### Architecture

```
User opts in with email → stored in SubFeed backend DB
                             │
                    Cron job runs at 6am daily
                             │
                    Fetches subscriptions via YouTube Data API
                    for each opted-in user
                             │
                    Builds digest HTML email
                             │
                    Sends via Resend / SendGrid (free tier)
                             │
                    User receives clean email digest
```

#### Backend options (free tier friendly)
- **Supabase** — database + edge functions (free tier: 50k rows, 500k function calls/month)
- **Resend** — email sending (free tier: 3,000 emails/month)
- **Vercel** — cron jobs (free tier: 1 cron job)

#### Extension changes
Popup gets an "Email digest" section:
- Email input field
- Time preference (6am, 7am, 8am local time)
- Opt-in checkbox with privacy note

#### Privacy note to users
> "Your email is used only to send your daily digest. It is never shared, sold, or used for marketing. Unsubscribe any time from the digest email or this settings panel."

---

### 🔲 3.4 Export Watch List
**Priority:** Low  
**Build time:** Half a day  
**Effort:** Very low

#### What it does
A button in the popup: "Export Watch Later as CSV". Downloads a CSV file with: video title, channel name, video URL, date saved. Useful for power users who want to manage their list in a spreadsheet or back it up.

```js
function exportWatchLater(watchLater) {
  const headers = ['Title', 'Channel', 'URL', 'Saved At'];
  const rows = watchLater.map(v => [
    `"${v.title.replace(/"/g, '""')}"`,
    `"${v.channel}"`,
    `"https://youtube.com/watch?v=${v.id}"`,
    `"${new Date(v.savedAt).toISOString()}"`
  ]);
  
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url,
    filename: `subfeed-watchlater-${Date.now()}.csv`
  });
}
```

---

### 🔲 3.5 Firefox Port
**Priority:** Medium  
**Build time:** 1–3 days  
**Effort:** Low — mostly manifest changes

#### What it does
SubFeed published on Firefox Add-ons (addons.mozilla.org). Firefox uses Manifest V2 (with MV3 support improving). Core code is identical — only the manifest and some API calls differ.

#### Key differences
| Feature | Chrome MV3 | Firefox MV2 |
|---------|-----------|-------------|
| Background script | Service worker | Persistent background script |
| `chrome.*` APIs | `chrome.*` | `browser.*` (with `chrome.*` compat shim) |
| Submission fee | $5 one-time | Free |
| Review time | 3–7 days | 1–3 days |

#### Implementation
```js
// Add compatibility shim at top of all JS files
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
// Then use browserAPI.storage.local.get() everywhere
```

---

## Phase 4 — Monetization Layer

### 🔲 4.1 SubFeed Pro
**Priority:** High  
**Build time:** 1 week (licensing logic)  
**See:** [Monetization Strategy](#monetization-strategy) section

#### Pro-gated features (suggested)
| Feature | Free | Pro |
|---------|------|-----|
| Chronological sort | ✅ | ✅ |
| Time window filter | ✅ | ✅ |
| Calm mode | ✅ | ✅ |
| Hide Shorts | ✅ | ✅ |
| Mark as watched | ✅ | ✅ |
| Keyword mute | ✅ (3 keywords) | ✅ Unlimited |
| Watch Later list | ✅ (10 videos) | ✅ Unlimited |
| Channel grouping | ❌ | ✅ |
| Duration filter | ❌ | ✅ |
| Daily digest email | ❌ | ✅ |
| Export watch list | ❌ | ✅ |
| Cross-device sync | ❌ | ✅ |
| Priority support | ❌ | ✅ |

---

### 🔲 4.2 Cross-Device Sync
**Priority:** Medium (Pro only)  
**Build time:** 1 week  
**Effort:** Medium — needs backend

#### What it does
Watch Later list, watched history, channel groups, and muted keywords sync across the user's devices (e.g. work laptop + home PC). Uses `chrome.storage.sync` for lightweight data, or Supabase for larger datasets.

```js
// chrome.storage.sync has 100KB limit — enough for most users
// For Watch Later lists > 100 items, use Supabase with user ID

async function syncToCloud(userId, data) {
  await supabase
    .from('user_data')
    .upsert({ user_id: userId, data: JSON.stringify(data) });
}
```

---

## Phase 5 — Platform Expansion

### 🔲 5.1 SubFeed for Twitter/X
**Status:** Planned  
**API:** Twitter API v2 — `reverse_chronological_timeline` endpoint  
**Cost:** Basic tier $100/month — viable once revenue covers it  
**Architecture:** New content script targeting `twitter.com` and `x.com`

---

### 🔲 5.2 SubFeed for LinkedIn
**Status:** Planned  
**API:** LinkedIn Partner API — application required  
**Architecture:** DOM-based content script (no official feed API for indie devs)  
**Strategy:** Build audience on YouTube + Twitter first, use install count as leverage for LinkedIn partner application

---

### 🔲 5.3 SubFeed Web App
**Status:** Planned  
**URL:** `subfeed.app`  
**Stack:** Next.js + YouTube Data API v3 + Supabase  
**Why:** Breaks the Chrome-only ceiling. Opens Safari, Firefox, mobile, and corporate markets.

#### Core feature
User pastes YouTube channel URLs (or signs in with Google). SubFeed builds a clean chronological feed using the YouTube Data API. No browser extension required. Works on any device.

#### Monetization
$3/month or $1/month (see below). Handled via Paddle or Lemon Squeezy — both support global payouts including M-Pesa and Africa-region bank accounts.

---

## Monetization Strategy

### The $1/month Model

At $1/month you are competing on zero friction. There is no mental "is it worth it" calculation — a user decides in under 3 seconds. The economics work because of volume, not margin.

**Conversion math:**

| Installs | Conversion rate | Subscribers | Monthly revenue |
|----------|----------------|-------------|-----------------|
| 5,000 | 2% | 100 | $100/month |
| 20,000 | 2% | 400 | $400/month |
| 50,000 | 3% | 1,500 | $1,500/month |
| 100,000 | 3% | 3,000 | $3,000/month |
| 500,000 | 2% | 10,000 | $10,000/month |

At 100,000 installs (very achievable for a well-reviewed extension in 12–18 months), $3,000/month is $36,000/year from a single feature gate — for a product with zero server costs on the free tier.

---

### How to Accept $1/month Payments

#### Option 1 — Lemon Squeezy (Recommended for Kenya)
**URL:** lemonsqueezy.com  
**Payout:** International wire transfer (SWIFT) to Kenyan bank account  
**Fees:** 5% + $0.50 per transaction  
**At $1:** You receive ~$0.45 per subscriber per month after fees  
**Minimum payout:** $50  
**Setup:** Create product → set price → embed checkout link in extension popup  

Best choice because:
- Handles VAT/tax globally (you don't deal with tax compliance per country)
- Simple API for checking license keys
- Payouts via SWIFT work with most Kenyan banks (KCB, Equity, Co-op)

#### Option 2 — Paddle
**URL:** paddle.com  
**Payout:** Wire transfer  
**Fees:** 5% + $0.50  
**Note:** More complex setup, better for higher volume ($10K+/month)

#### Option 3 — Gumroad
**URL:** gumroad.com  
**Payout:** PayPal or bank transfer  
**Fees:** 10% flat  
**At $1:** You receive ~$0.90 per subscriber  
**Best for:** Simple one-time payments (not ideal for subscriptions)

#### Option 4 — Ko-fi / Buy Me a Coffee
**URL:** ko-fi.com  
**Payout:** PayPal or Stripe  
**Fees:** 0% (Ko-fi takes nothing on the free plan)  
**Best for:** Voluntary "tip" model — users pay what they want  
**Note:** Lower conversion than a paywall but zero friction and zero fees

#### Option 5 — Stripe (DIY)
**URL:** stripe.com  
**Payout:** Bank transfer (Stripe supports Kenya via Stripe Atlas)  
**Fees:** 2.9% + $0.30  
**At $1:** You receive ~$0.67 per subscriber  
**Complexity:** High — you manage the subscription logic yourself  
**Best for:** When you have a backend (Phase 4+)

---

### Recommended Payment Stack for SubFeed at Launch

```
Phase 1–3 (0–10K users):     Ko-fi "Support SubFeed" button in popup
                               → Voluntary, zero friction, builds goodwill

Phase 4 (10K+ users):         Lemon Squeezy subscription at $1/month
                               → Gate Pro features behind license key check
                               → Payouts via SWIFT to Kenyan bank

Phase 5 (100K+ users):        Stripe or Paddle
                               → Full billing infrastructure
                               → Consider raising price to $2–3/month
```

---

### License Key Implementation (Lemon Squeezy)

When a user pays, Lemon Squeezy gives them a license key. They enter it in the SubFeed popup to unlock Pro features. The extension validates the key against the Lemon Squeezy API.

```js
// popup/popup.js — license validation
async function validateLicense(licenseKey) {
  const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: licenseKey })
  });
  
  const data = await res.json();
  
  if (data.valid) {
    await chrome.storage.local.set({
      isPro: true,
      licenseKey,
      licenseValidated: Date.now()
    });
    return true;
  }
  return false;
}

// Re-validate license every 7 days (background service worker)
async function periodicLicenseCheck() {
  const { licenseKey, licenseValidated } = 
    await chrome.storage.local.get(['licenseKey', 'licenseValidated']);
  
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (!licenseKey) return;
  if (Date.now() - licenseValidated < sevenDays) return;
  
  const valid = await validateLicense(licenseKey);
  if (!valid) {
    await chrome.storage.local.set({ isPro: false });
  }
}
```

---

## Technical Dependencies Map

```
Feature                  Depends On              API Needed
─────────────────────────────────────────────────────────────
Mark as watched          —                       None
Watch Later list         —                       None
Keyword mute             —                       None
Duration filter          —                       None
Unwatched only           Mark as watched         None
Export watch list        Watch Later list        downloads permission
Channel grouping         —                       YouTube Data API v3
Channel health           Mark as watched         None
Daily digest             Channel grouping        YouTube API + Backend
Cross-device sync        Watch Later, Groups     Supabase / Backend
SubFeed Pro              All Phase 2+3 features  Lemon Squeezy API
Firefox port             Core v1                 None
Web app                  —                       YouTube API + Next.js
```

---

## Build Priority Order (Recommended)

If you're building solo, build in this order to maximise user value per day of effort:

1. **Mark as watched** (1 day) — instant daily value
2. **Keyword mute** (1 day) — immediate quality-of-life improvement
3. **Unwatched only filter** (0.5 day) — builds on #1
4. **Watch Later list** (2 days) — turns SubFeed into a daily habit
5. **Duration filter** (2 days) — power user favourite
6. **Channel grouping** (1–2 weeks) — the moat feature
7. **Ko-fi button** (1 hour) — start collecting voluntary support
8. **Channel health dashboard** (3 days) — engaging, shareable
9. **Daily digest** (2 weeks) — requires backend investment
10. **SubFeed Pro + Lemon Squeezy** (1 week) — first real revenue

---

*SubFeed Feature Spec v1.0 — Built by Chris*  
*Last updated: 2026*  
*For questions: github.com/YOUR_USERNAME/subfeed/discussions*
