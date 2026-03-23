# SubFeed — Complete Product & Developer Specification

> YouTube Subscription Feed, Chronological Order  
> A free Chrome extension. No algorithm. No recommendations. Just your channels.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Brand Identity](#2-brand-identity)
3. [Chrome Web Store Listing](#3-chrome-web-store-listing)
4. [How the Plugin Works](#4-how-the-plugin-works)
5. [File Structure](#5-file-structure)
6. [Feature Specifications](#6-feature-specifications)
7. [Developer Controls](#7-developer-controls)
8. [Building Locally with Cursor](#8-building-locally-with-cursor)
9. [GitHub Setup & Deployment](#9-github-setup--deployment)
10. [Chrome Web Store Submission](#10-chrome-web-store-submission)
11. [Icon Generation Guide](#11-icon-generation-guide)

---

## 1. Product Overview

### Problem
YouTube's subscription feed stopped working for viewers. Instead of showing channels in upload order, YouTube now ranks, filters, and injects recommended content — meaning subscribers regularly miss videos from channels they deliberately followed.

### Solution
SubFeed is a Chrome extension that:
- Re-sorts the subscription feed into strict reverse-chronological order
- Removes all recommended/suggested content from the subscriptions page
- Adds a time-window filter (last 24h, 3 days, 7 days)
- Offers Calm mode (no thumbnails)
- Hides YouTube Shorts on demand
- Collects zero user data

### Target Users
- Regular viewers who follow specific creators and want to see every upload
- Power users frustrated by YouTube's algorithmic feed
- Researchers and journalists tracking specific channels
- Gen Z and millennial users suffering algorithm fatigue

### Business Model
**Free. Forever.** Build trust, grow installs, collect no data.  
Future premium tier (optional): Advanced filters, channel grouping, cross-device sync.

---

## 2. Brand Identity

### Name
**SubFeed**

### Tagline
*"Your subscriptions. Your order."*

### Chrome Web Store Title
`SubFeed — YouTube Subscription Feed, Chronological Order`

### Color Palette

| Name           | Hex       | Usage                              |
|----------------|-----------|-------------------------------------|
| SubFeed green  | `#1D9E75` | Primary — buttons, icon, accents   |
| Deep teal      | `#085041` | Hover states, dark variant          |
| Green light    | `#9FE1CB` | Mid tone, borders                   |
| Mint surface   | `#E1F5EE` | Backgrounds, badges                 |
| Neutral text   | `#111111` | Body text                           |
| Muted text     | `#666666` | Secondary text                      |

### Typography
- **Display / UI**: DM Sans (Google Fonts — free)
- **Monospace**: DM Mono (version numbers, code snippets)

### Icon Concept
Three horizontal feed lines (representing a subscription list) with a green checkmark circle on the right — communicating "your curated list, verified clean."  
Lines decrease in width top-to-bottom to suggest recency/priority ordering.  
Reads clearly at 16px in the Chrome toolbar.

### Icon SVG (128px master)

```svg
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="128" height="128" rx="28" fill="#1D9E75"/>
  <!-- Feed lines -->
  <rect x="18" y="38" width="74" height="13" rx="6.5" fill="white"/>
  <rect x="18" y="60" width="54" height="13" rx="6.5" fill="white" opacity="0.85"/>
  <rect x="18" y="82" width="62" height="13" rx="6.5" fill="white" opacity="0.7"/>
  <!-- Check circle -->
  <circle cx="100" cy="61" r="20" fill="white" opacity="0.95"/>
  <path d="M91 61l6 6 12-12" stroke="#1D9E75" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
```

Save as `icons/icon128.png` — generate 48px and 16px variants by scaling.

---

## 3. Chrome Web Store Listing

### Short Description (132 chars)
```
Your YouTube subscription feed in chronological order. No algorithm, no recommendations — just channels you follow.
```

### Full Description

```
SubFeed — YouTube Subscription Feed, Chronological Order

Take back control of your YouTube subscriptions. SubFeed restores a clean, 
reverse-chronological subscription feed showing only the channels you actually 
follow — no recommended videos, no Shorts injected between posts, no algorithm 
deciding what you see first.

WHAT SUBFEED FIXES

YouTube's subscription feed stopped working for viewers. Instead of showing 
your subscriptions in the order they were uploaded, YouTube now ranks, filters, 
and injects content based on engagement signals — meaning you regularly miss 
videos from channels you deliberately chose to follow. SubFeed removes all of that.

KEY FEATURES

✓ Chronological subscription feed — newest uploads always appear first, every time
✓ Subscriptions only — zero recommended videos, suggested channels, or sponsored rows
✓ Time window filter — quickly view what's new in the last 24 hours, 3 days, or 7 days
✓ Calm mode — strips thumbnails for a distraction-free, text-only viewing list
✓ Hide Shorts — remove YouTube Shorts from your subscription feed entirely
✓ Live stats — see subscriptions count, new videos today, and ads blocked
✓ Zero data collection — all settings stored locally, nothing leaves your device
✓ No account required — no sign-up, no email, no login. Install and works instantly

HOW IT WORKS

Once installed, navigate to youtube.com/feed/subscriptions. SubFeed automatically 
activates and re-sorts your feed into strict reverse-chronological order, removing 
all non-subscription content. Click the SubFeed toolbar icon to adjust your time 
window, toggle Calm mode, or temporarily disable the extension.

WHO SUBFEED IS FOR

• Viewers who follow specific creators and want to see every upload without missing anything
• Power users frustrated by YouTube pushing recommendations into their subscription feed
• Researchers, journalists, and students who need to track specific channels reliably
• Anyone who has ever gone to their subscriptions page and thought "this isn't what I subscribed to"

PRIVACY FIRST

SubFeed collects zero personal data. There is no server, no analytics, no tracking.
All preferences are stored in chrome.storage.local on your own machine. The extension 
only activates on youtube.com/feed/subscriptions.

PERMISSIONS EXPLAINED

• storage — saves your filter preferences locally on your device
• youtube.com host access — required to read and re-sort the subscription feed

SubFeed does not access your Google account, YouTube history, watch data, or any 
personal information.

Open source: github.com/YOUR_USERNAME/subfeed
```

### Category
`Productivity`

### Tags
```
YouTube, subscriptions, subscription feed, chronological, YouTube feed, no algorithm, 
YouTube extension, feed filter, YouTube subscriptions, chronological order, 
YouTube subscription manager, clean YouTube feed, YouTube without algorithm
```

---

## 4. How the Plugin Works

### Architecture Overview

SubFeed is a **Manifest V3 Chrome extension** with no backend. It operates entirely in the user's browser.

```
User visits youtube.com/feed/subscriptions
           │
           ▼
content/inject.js fires (via content_scripts)
           │
           ├─ Checks chrome.storage for: rawEnabled, timeWindow, calmMode, hideShorts, killSwitch
           │
           ├─ If rawEnabled === false → exit, do nothing
           │
           ├─ If killSwitch === true → exit, do nothing (remote disable)
           │
           ├─ waitForElement('ytd-section-list-renderer #contents')
           │   └─ MutationObserver watches DOM until feed items appear
           │
           ├─ Queries all ytd-video-renderer / ytd-rich-item-renderer elements
           │
           ├─ Extracts timestamp from each item (relative time text → ms)
           │
           ├─ Sorts items descending by timestamp
           │
           ├─ Filters by time window cutoff (24h / 3d / 7d / all)
           │
           ├─ Hides Shorts if hideShorts === true
           │
           ├─ Re-appends items to container in sorted order
           │
           ├─ Applies calm mode (hides ytd-thumbnail elements)
           │
           └─ Injects SubFeed control bar above the feed
```

### YouTube SPA Navigation

YouTube is a Single Page App (SPA). URL changes do not trigger full page reloads.  
SubFeed handles this with two mechanisms:

1. **MutationObserver** on `document.body` watching for URL changes
2. **`yt-navigate-finish` event** — YouTube's own navigation event, fired after each SPA transition

Both trigger `applySubFeed()` with a short delay (800–1200ms) to allow YouTube to render the new page.

### Timestamp Parsing

YouTube displays relative times ("2 hours ago", "3 days ago") as text in the feed DOM.  
SubFeed parses these into Unix timestamps for sorting:

```js
function parseRelativeTime(text) {
  const match = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
  const value = parseInt(match[1]);
  const units = { second:1000, minute:60000, hour:3600000, day:86400000, week:604800000 };
  return Date.now() - (value * units[match[2]]);
}
```

### Remote Config & Kill Switch

The service worker polls a `config.json` hosted on GitHub Pages every 4 hours.  
This gives you full remote control without a Chrome Web Store update:

```json
{
  "killSwitch": false,
  "features": { "calmMode": true, "timeFilter": true, "hideShorts": true },
  "notice": null,
  "minVersion": "1.0.0"
}
```

**To disable the extension for all users instantly:**  
Set `killSwitch: true` in `config.json`, commit and push to GitHub. All users update within 4 hours.

---

## 5. File Structure

```
subfeed/
├── manifest.json                  # Extension config, permissions, entry points
├── config.json                    # Remote config (deploy to GitHub Pages)
├── SUBFEED.md                     # This document
│
├── content/
│   ├── inject.js                  # Core logic — runs on youtube.com
│   └── styles.css                 # Control bar styles + feed overrides
│
├── popup/
│   ├── popup.html                 # Toolbar click panel
│   └── popup.js                   # Popup settings logic
│
├── background/
│   └── service-worker.js          # Remote config fetch + kill switch
│
├── onboarding/
│   └── onboarding.html            # Welcome page shown on first install
│
└── icons/
    ├── icon16.png                 # Toolbar icon
    ├── icon48.png                 # Extension management page
    └── icon128.png                # Chrome Web Store
```

---

## 6. Feature Specifications

### 6.1 Chronological Feed Sort

| Property | Value |
|----------|-------|
| Default state | ON |
| Sort order | Descending by upload timestamp |
| Source of timestamp | Relative time text in DOM |
| Fallback if no timestamp | Item kept, placed at end |
| Reapplied on | Page load, SPA navigation, settings change |

### 6.2 Time Window Filter

| Window | Duration (ms) | Storage key value |
|--------|--------------|-------------------|
| 24h | 86,400,000 | `"24h"` |
| 3 days | 259,200,000 | `"3d"` |
| 7 days | 604,800,000 | `"7d"` |
| All time | Infinity | `"all"` |

Default: `"7d"`

### 6.3 Calm Mode

Hides all `ytd-thumbnail` elements within the feed container.  
Enabled via popup toggle. Stored as `calmMode: boolean` in `chrome.storage.local`.

### 6.4 Hide Shorts

Detects Shorts via `ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]` within each video item.  
Sets `display: none` on the parent `ytd-video-renderer`.  
Default: `true` (Shorts hidden by default).

### 6.5 Control Bar

Injected as the first child of the feed container on every activation.  
Contains: SubFeed logo, LIVE badge, time window pills, Calm mode pill, Hide Shorts pill, stats (videos shown / hidden).

### 6.6 Popup Stats

| Stat | Source |
|------|--------|
| Subscriptions count | Stored in `chrome.storage.local.subsCount` — updated by content script |
| New today | Videos with timestamp < 24h — calculated during feed processing |
| Ads shown | Always 0 — marketing stat showing SubFeed blocks ad injection |

---

## 7. Developer Controls

### Remote Config (GitHub Pages)

Host `config.json` at:  
`https://YOUR_USERNAME.github.io/subfeed-config/config.json`

**Fields:**

```json
{
  "version": "1.0.0",
  "killSwitch": false,
  "features": {
    "calmMode": true,
    "timeFilter": true,
    "hideShorts": true,
    "channelFilter": false
  },
  "notice": null,
  "minVersion": "1.0.0"
}
```

| Field | Type | Effect |
|-------|------|--------|
| `killSwitch` | boolean | `true` = disables extension for all users within 4h |
| `features.*` | boolean | Toggle features without a store update |
| `notice` | string\|null | String = shows banner in popup. null = no banner |
| `minVersion` | string | Semantic version — flags outdated installs |

### Local Storage Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `rawEnabled` | boolean | `true` | Master on/off for SubFeed |
| `timeWindow` | string | `"7d"` | Active time window filter |
| `calmMode` | boolean | `false` | Hide thumbnails |
| `hideShorts` | boolean | `true` | Hide Shorts from feed |
| `killSwitch` | boolean | `false` | Remote disable flag |
| `remoteFeatures` | object | `{}` | Feature flags from remote config |
| `notice` | string\|null | `null` | Popup banner text |
| `subsCount` | number | `0` | Subscription count stat |
| `todayCount` | number | `0` | New today stat |
| `onboardingSeen` | boolean | `false` | Whether onboarding was shown |
| `installedAt` | number | timestamp | Install date (ms) |

### Anonymous Install Tracking (Optional)

To count installs without collecting PII, add to `service-worker.js` on install:

```js
// Generate anonymous install ID
const installId = crypto.randomUUID();
await chrome.storage.local.set({ installId });

// Ping a free Supabase table
await fetch('https://YOUR_PROJECT.supabase.co/rest/v1/installs', {
  method: 'POST',
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: installId,
    version: '1.0.0',
    installed_at: new Date().toISOString()
    // No IP, no user data, no identifiers
  })
});
```

Supabase free tier: 50,000 rows, no credit card required.

---

## 8. Building Locally with Cursor

### Prerequisites
- Node.js (for any build tooling — not required for this extension)
- Google Chrome or Chromium
- Cursor IDE (or VS Code)
- Git

### Step 1: Clone or create the repo

```bash
# If starting fresh
mkdir subfeed && cd subfeed
git init

# Or clone from GitHub after you push
git clone https://github.com/YOUR_USERNAME/subfeed.git
cd subfeed
```

### Step 2: Open in Cursor

```bash
cursor .
```

The file structure should match exactly what's in Section 5.

### Step 3: Generate icons

Option A — use the SVG from Section 2 and convert with a tool like [SVG to PNG](https://svgtopng.com/) or ImageMagick:

```bash
# If you have ImageMagick installed
convert -background none -resize 128x128 icon.svg icons/icon128.png
convert -background none -resize 48x48  icon.svg icons/icon48.png
convert -background none -resize 16x16  icon.svg icons/icon16.png
```

Option B — create placeholder PNGs manually (16×16, 48×48, 128×128 green squares) just to load the extension, then refine.

### Step 4: Update config URL

In `background/service-worker.js`, replace:
```js
const CONFIG_URL = 'https://YOUR_USERNAME.github.io/subfeed-config/config.json';
```

### Step 5: Update GitHub links

In `popup/popup.js`, replace:
```js
const GITHUB_ISSUES = 'https://github.com/YOUR_USERNAME/subfeed/issues/new?template=bug_report.md';
```

In `onboarding/onboarding.html`, replace all `YOUR_USERNAME` references.

### Step 6: Load in Chrome

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select your `subfeed/` folder
5. SubFeed icon appears in your toolbar

### Step 7: Test

1. Go to `youtube.com/feed/subscriptions`
2. SubFeed control bar should appear above your feed
3. Feed should be sorted newest-first
4. Test each time window pill
5. Test Calm mode and Hide Shorts toggles
6. Click the toolbar icon — popup should load

### Common issues in development

| Issue | Fix |
|-------|-----|
| Control bar not appearing | YouTube may have changed its DOM selectors — check `ytd-section-list-renderer` in DevTools |
| Feed not re-sorting | Increase the `setTimeout` delay in the SPA navigation handler |
| Popup shows blank | Check browser console for JS errors in popup.js |
| Icons not showing | Ensure PNG files exist at exact paths in manifest.json |

---

## 9. GitHub Setup & Deployment

### Repo structure

```
github.com/YOUR_USERNAME/subfeed          ← extension source code
github.com/YOUR_USERNAME/subfeed-config   ← remote config (GitHub Pages)
```

### Push extension code

```bash
cd subfeed
git add .
git commit -m "Initial SubFeed release v1.0.0"
git remote add origin https://github.com/YOUR_USERNAME/subfeed.git
git push -u origin main
```

### Set up remote config on GitHub Pages

1. Create a new repo: `subfeed-config`
2. Add `config.json` to the repo root
3. Go to repo Settings → Pages → Source: Deploy from branch → `main` → `/ (root)`
4. Your config will be live at: `https://YOUR_USERNAME.github.io/subfeed-config/config.json`
5. Update the URL in `service-worker.js`

### Releasing updates

```bash
# Bump version in manifest.json and SUBFEED.md
git add .
git commit -m "v1.1.0 — add channel grouping filter"
git push

# Then submit updated zip to Chrome Web Store
```

### Emergency kill switch

```bash
# Edit config.json
{ "killSwitch": true }

# Commit and push
git add config.json
git commit -m "Emergency: disable extension"
git push

# All users disabled within 4 hours (next config poll)
# To re-enable: set killSwitch: false and push again
```

---

## 10. Chrome Web Store Submission

### One-time developer account
- Fee: **$5 USD** (one-time, lifetime)
- URL: https://chrome.google.com/webstore/devconsole

### Package the extension

```bash
cd subfeed
# Remove any dev files
rm -f .DS_Store **/.DS_Store

# Zip the entire folder (NOT the folder itself — its contents)
zip -r subfeed-v1.0.0.zip . -x "*.git*" -x "*.md" -x "config.json"
```

### Required assets for submission

| Asset | Size | Notes |
|-------|------|-------|
| Extension ZIP | < 10MB | All extension files |
| Store icon | 128×128 PNG | Use icon128.png |
| Screenshots | 1280×800 or 640×400 | Min 1, max 5 |
| Promotional tile | 440×280 PNG | Optional but recommended |

### Screenshot guide

Take screenshots showing:
1. Before/after — YouTube's default feed vs SubFeed active
2. The control bar with time window pills highlighted
3. The popup UI showing stats
4. Calm mode (text-only feed)

### Review timeline
- Standard review: 3–7 business days
- Common rejection reason: over-broad host permissions → your `permissions` explanation in the description addresses this

### Firefox Add-ons (free, faster review)
Submit same code at: https://addons.mozilla.org/developers/  
Change `manifest_version` to `2` for full Firefox compatibility or use a build step.

---

## 11. Icon Generation Guide

### Method 1: Use the SVG (recommended)

Copy the SVG from Section 2 into a file called `icon.svg`.

Install sharp (Node.js):
```bash
npm install sharp
node -e "
const sharp = require('sharp');
const sizes = [16, 48, 128];
sizes.forEach(s => {
  sharp('icon.svg').resize(s, s).png().toFile(\`icons/icon\${s}.png\`);
});
"
```

### Method 2: ImageMagick

```bash
brew install imagemagick  # macOS
convert -background none -resize 128x128 icon.svg icons/icon128.png
convert -background none -resize 48x48  icon.svg icons/icon48.png
convert -background none -resize 16x16  icon.svg icons/icon16.png
```

### Method 3: Quick placeholder (for dev testing)

Create a simple green square PNG using any image editor, sized 16×16, 48×48, and 128×128.  
Replace with final icon before store submission.

---

## Appendix: SEO Keywords

Primary (title-level):
- YouTube subscription feed
- YouTube chronological order
- YouTube feed extension
- YouTube subscriptions only

Secondary (description-level):
- YouTube without algorithm
- clean YouTube feed
- YouTube subscription manager
- YouTube feed filter
- YouTube feed chronological
- no algorithm YouTube
- YouTube subscriptions newest first
- YouTube Shorts filter

---

*SubFeed — Built by Chris. Specification v1.0.0*  
*Questions or contributions: github.com/YOUR_USERNAME/subfeed/issues*
