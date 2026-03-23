# SubFeed — YouTube Subscription Feed, Chronological Order

> A free Chrome extension. No algorithm. No recommendations. Just your channels.

Take back control of your YouTube subscriptions. SubFeed restores a clean, reverse-chronological subscription feed showing only the channels you actually follow — no recommended videos, no Shorts injected between posts, no algorithm deciding what you see first.

---

## What SubFeed Fixes

YouTube's subscription feed stopped working for viewers. Instead of showing your subscriptions in the order they were uploaded, YouTube now ranks, filters, and injects content based on engagement signals — meaning you regularly miss videos from channels you deliberately chose to follow. SubFeed removes all of that.

---

## Key Features

- **Chronological subscription feed** — newest uploads always appear first, every time
- **Subscriptions only** — zero recommended videos, suggested channels, or sponsored rows
- **Time window filter** — quickly view what's new in the last 24 hours, 3 days, or 7 days
- **Mark as Watched** — videos you click are tracked locally and greyed out so you never lose your place
- **Unwatched Only mode** — toggle to hide watched videos entirely, showing a clean queue of new content
- **Keyword Mute** — add words or phrases to mute list; any video with a matching title is hidden
- **Watch Later list** — bookmark videos from your feed with one click, access them from the popup
- **Duration Filter** — set min/max video length to show only videos in your preferred range
- **Calm mode** — strips thumbnails for a distraction-free, text-only viewing list
- **Hide Shorts** — remove YouTube Shorts from your subscription feed entirely
- **Live stats** — see videos showing, hidden count, and subscription stats in real time
- **Zero data collection** — all settings stored locally in your browser, nothing leaves your device
- **No account required** — no sign-up, no email, no login. Install and it works instantly

---

## How It Works

Once installed, navigate to [youtube.com/feed/subscriptions](https://www.youtube.com/feed/subscriptions). SubFeed automatically activates and re-sorts your feed into strict reverse-chronological order, removing all non-subscription content. Click the SubFeed toolbar icon to adjust your time window, toggle Calm mode, or temporarily disable the extension. Your preferences are saved automatically.

---

## Who SubFeed Is For

- Viewers who follow specific creators and want to see every upload without missing anything
- Power users frustrated by YouTube pushing recommendations into their subscription feed
- Researchers, journalists, and students who need to track specific YouTube channels reliably
- Anyone who has ever gone to their subscriptions page and thought "this isn't showing me what I subscribed to"

---

## Privacy First

SubFeed collects zero personal data. There is no server, no analytics, no tracking. All preferences are stored in `chrome.storage.local` on your own machine. The extension only activates on `youtube.com/feed/subscriptions` — it does not read, modify, or access any other website or page.

### Permissions Explained

| Permission | Why it's needed |
|---|---|
| `storage` | Saves your filter preferences (time window, calm mode) locally on your device |
| `youtube.com` host access | Required to read and re-sort the subscription feed DOM |

SubFeed does not access your Google account, YouTube history, watch data, or any personal information.

---

## Install

### Chrome Web Store
*Coming soon*

### Load Locally (Developer Mode)
1. Clone this repo: `git clone https://github.com/chrisfugus-ibiz/subfeed.git`
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `subfeed/` folder
5. Navigate to [youtube.com/feed/subscriptions](https://www.youtube.com/feed/subscriptions)

---

## Project Structure

```
subfeed/
  manifest.json              # Extension config (Manifest V3)
  config.json                # Remote config template
  content/
    inject.js                # Core logic — runs on youtube.com
    styles.css               # Control bar + feed override styles
  popup/
    popup.html               # Toolbar click panel
    popup.js                 # Popup settings logic
  background/
    service-worker.js        # Remote config polling + kill switch
  onboarding/
    onboarding.html          # Welcome page on first install
    onboarding.js            # Onboarding script
  icons/
    icon16.png               # Toolbar icon
    icon48.png               # Extension management page
    icon128.png              # Chrome Web Store listing
```

---

## Remote Config

SubFeed includes a remote config system hosted on GitHub Pages at [`chrisfugus-ibiz.github.io/subfeed-config/config.json`](https://chrisfugus-ibiz.github.io/subfeed-config/config.json). Every installed copy polls this file every 4 hours.

This gives you real-time control without a Chrome Web Store update:

| Field | Effect |
|---|---|
| `killSwitch` | `true` disables the extension for all users within 4 hours |
| `features.*` | Toggle individual features on/off without a store update |
| `notice` | String shows as a banner in every user's popup. `null` clears it |
| `minVersion` | Users below this version see an update prompt |

---

## Chrome Web Store Listing

### Category
Productivity

### Tags
YouTube, subscriptions, subscription feed, chronological, YouTube feed, no algorithm, YouTube extension, feed filter, YouTube subscriptions, chronological order, YouTube subscription manager, clean YouTube feed, YouTube without algorithm

### Developer Notes on the Store Description

**SEO structure:** The phrase "YouTube subscription feed" appears in the title, first sentence, and multiple times throughout — this is the highest-volume search term in this category based on competitor analysis. "Chronological order" appears in the title and body because it's the second most common search intent. "No algorithm" and "subscriptions only" are included because they're the emotional hook terms people use when searching out of frustration.

**Permissions section:** The permissions explanation in the store description is unusually detailed — this is intentional. Chrome Web Store's review team flags extensions with broad host permissions. A clear, honest explanation of why `youtube.com` access is needed reduces review friction and builds user trust. Extensions with transparent permission explanations consistently get better ratings because users feel safer installing them.

**"Who SubFeed is for" section:** Uses job-to-be-done framing rather than feature framing — this improves conversion on the store listing because it helps users self-identify rather than evaluate features.

---

## Roadmap

### Shipped (v1.1.0)
- Chronological feed sort
- Time window filter (24h / 3d / 7d / All)
- Calm mode (hide thumbnails)
- Hide Shorts
- Remote kill switch + feature flags via GitHub Pages
- Mark as Watched (click tracking + visual indicator)
- Unwatched Only filter
- Keyword Mute (hide videos by title keywords)
- Watch Later list (bookmark from feed, manage in popup)
- Duration Filter (min/max video length)
- Infinite scroll handling (new items sorted as they load)
- Selector resilience layer (centralized YouTube DOM selectors)

### Planned
- Channel Grouping — organize subscriptions into named groups, filter by group
- New upload notifications — browser notification when followed channels post
- Export Watch Later as CSV
- Firefox port
- Channel Health Dashboard — see inactive channels, upload frequency
- Daily Digest Email (requires backend)

### Future
- SubFeed Pro ($1/month) — unlimited keyword mutes, channel grouping, cross-device sync
- SubFeed Web App (subfeed.app) — works on any browser, no extension needed

---

## Contributors

<!-- Add yourself here! Format: | [Name](GitHub profile) | Role | -->
| Contributor | Role |
|---|---|
| [Chris](https://github.com/chrisfugus-ibiz) | Creator & maintainer |

Want to contribute? See below.

---

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/chrisfugus-ibiz/subfeed/issues).

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

MIT

---

*Built by Chris.*
