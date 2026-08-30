# Art Docent — iPhone shows an old version of the site

**Date:** 2026-08-29
**Status:** Fixed and deployed (commit `1db564b`, live on https://eloquent-horse-a1ede7.netlify.app/)

---

## Symptom

The deployed site rendered the current build on desktop browsers, but on the
user's iPhone the same URL kept showing an **older** version — specifically,
class dates without the new weekday prefix (`September 11, 2026` instead of
`Friday, September 11, 2026`).

## Root cause

The hand-rolled service worker at `public/sw.js` used a **cache-first strategy
for navigations** and precached the app shell (`/` and `/index.html`) into a
**fixed cache name** (`art-docent-v1`):

```js
const CACHE_NAME = 'art-docent-v1'
const urlsToCache = ['/', '/index.html', '/manifest.json']
// install: cache.addAll(urlsToCache)
// fetch:  caches.match(request).then(r => r ? r : fetch(request))   // cache-first
```

Consequences:

1. Once the service worker was registered (iOS Safari, and especially an
   "Add to Home Screen" install), every navigation was answered from cache.
   The cached `index.html` still pointed at the **pre-weekday JS bundle hash**,
   so the phone stayed frozen on that build across subsequent Netlify deploys.
2. `CACHE_NAME` never changed, so the `activate` handler's "delete caches that
   aren't current" logic never actually deleted anything.
3. No `self.skipWaiting()` / `self.clients.claim()`, and no update-on-navigation
   logic, so a newly deployed service worker would sit in "waiting" forever
   behind the old one — the classic "iPhone stuck on old version" pattern.

Desktop browsers that never registered the service worker went straight to
Netlify's edge and always got the current HTML, which is why only mobile was
affected.

### Evidence

**HTTP headers were already correct** — the service worker, not headers, was the
mechanism. Root document and `sw.js` before the fix:

```
$ curl -sS -D - -o /dev/null https://eloquent-horse-a1ede7.netlify.app/
HTTP/2 200
cache-control: public,max-age=0,must-revalidate
content-type: text/html; charset=UTF-8
etag: "542d09bc4565056691ee68bae47c9632-ssl"

$ curl -sS -D - https://eloquent-horse-a1ede7.netlify.app/sw.js
HTTP/2 200
cache-control: public,max-age=0,must-revalidate
content-type: application/javascript; charset=UTF-8
```

Hashed assets, however, were served only `max-age=0, must-revalidate` (no
`immutable`) — a minor efficiency issue, addressed as part of the fix:

```
$ curl -sS -D - -o /dev/null .../assets/index-Vp9jSvrA.js   # BEFORE
cache-control: public,max-age=0,must-revalidate
```

**The deploy itself was current.** The live JS bundle
(`/assets/index-Vp9jSvrA.js`) already contained `toLocaleDateString(... {weekday:'long'} ...)`
and a locally rebuilt `dist/` produced the identical hash. So the deploy was
not behind — the problem was 100% client-side caching.

**Repro in mobile emulation (Claude Browser, 375x812, mobile UA):** on a browser
profile that already had the old `art-docent-v1` service worker, the first load
served the stale shell (`/assets/index-CrJrfKpk.js` in the network log); after
the new service worker installed and claimed the page, a `controllerchange`
reload fetched the fresh `/assets/index-Vp9jSvrA.js` and the weekday-prefixed
dates rendered. Post-fix `caches.keys()` returned only `["art-docent-v2"]` and
`navigator.serviceWorker.controller` pointed at the new network-first script.

## Fix applied

### `public/sw.js` (rewritten)
- **Network-first for navigations / HTML**: always fetch the shell from the
  network when online; the cache is only an offline fallback. This guarantees a
  new deploy is picked up on the next online load.
- **Cache-first only for `/assets/*`** content-hashed files (safe — names change
  every build). JSON stays network-only (unchanged behaviour).
- Added `self.skipWaiting()` (install) and `self.clients.claim()` (activate).
- Bumped `CACHE_NAME` to `art-docent-v2` so the old `art-docent-v1` cache
  (holding the stale shell) is deleted on activate.

### `index.html`
Added a one-time reload when an updated service worker takes control:

```js
let reloadedForUpdate = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (reloadedForUpdate) return;
  reloadedForUpdate = true;
  window.location.reload();
});
```

### `netlify.toml`
Made caching explicit (previously relying on Netlify defaults):

| Path          | Cache-Control                              |
|---------------|--------------------------------------------|
| `/index.html` | `public, max-age=0, must-revalidate`       |
| `/sw.js`      | `public, max-age=0, must-revalidate`       |
| `/assets/*`   | `public, max-age=31536000, immutable`      |

## Before / after — live headers

| Resource                     | Before                                | After                                        |
|------------------------------|---------------------------------------|----------------------------------------------|
| `/`                          | `public,max-age=0,must-revalidate`    | `public,max-age=0,must-revalidate` (unchanged) |
| `/sw.js`                     | `public,max-age=0,must-revalidate`    | `public,max-age=0,must-revalidate` (unchanged); body is now the network-first SW (`content-length` 1402 → 2547) |
| `/assets/index-Vp9jSvrA.js`  | `public,max-age=0,must-revalidate`    | `public,max-age=31536000,immutable`          |

Deploy verified live: the served `/` HTML now contains the `controllerchange`
snippet and references `/assets/index-Vp9jSvrA.js`, matching the local build.

## What the user must do on their iPhone (one time)

The fix repairs **future** loads, but the phone may still be holding the old
`art-docent-v1` service worker and cache once. Pick whichever applies:

- **Opened in Safari (not installed to Home Screen):**
  Just open the site again while online. The new `sw.js` will install, activate
  immediately (`skipWaiting`), take control, and the page will auto-reload once
  onto the current version. If it still looks old after that, pull-to-refresh
  once more. Guaranteed clean slate: iOS **Settings → Safari → Advanced →
  Website Data → search "eloquent-horse" → swipe to delete**, then reopen.

- **Installed as a Home Screen app ("Add to Home Screen"):**
  An installed PWA can hold its old service worker more stubbornly. Open it once
  online and give it a few seconds / one manual pull-to-refresh — it should
  self-heal. If it doesn't, **delete the Home Screen icon and re-add it** from
  Safari (Share → Add to Home Screen). No data is lost; the schedule and stats
  are re-fetched live.

After this one-time step, every future deploy will show up on the next launch
with no manual action.

## Prevention / residual risk

- The service worker is now **network-first for the shell**, so a stale shell
  can only be served when the device is fully offline — and even then it is
  replaced on the next online load.
- `controllerchange` + `skipWaiting` + `clients.claim` means new deploys
  propagate to returning visitors within one reload, without clearing Safari.
- Bumping `CACHE_NAME` on any future breaking change to the SW's cache contents
  remains the manual step to remember (there is no build-time cache versioning).
  A more permanent option would be `vite-plugin-pwa` with
  `registerType: 'autoUpdate'`, which auto-generates a hashed precache manifest;
  not adopted here to keep the change minimal and dependency-free.
- Hashed `/assets/*` are now `immutable` for a year. This is only safe because
  Vite fingerprints every asset filename per build — do not point non-hashed
  files at `/assets/`.

## Commits

- `1db564b` — Fix iOS stale-cache: network-first service worker + shell cache headers
  (`public/sw.js`, `index.html`, `netlify.toml`, rebuilt `dist/`)
- This document committed as a follow-up (specific-file add).
