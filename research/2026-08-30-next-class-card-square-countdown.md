# Next-class card: square layout + days-until countdown

**Date:** 2026-08-30
**File touched:** `src/App.jsx` (only the `isNext` / first Upcoming Classes card)
**Deploy:** pushed to `main` -> Netlify auto-deploy -> https://eloquent-horse-a1ede7.netlify.app/
**Build bundle:** `dist/assets/index-DjLPVrRV.js` (was `index-Vp9jSvrA.js`)

---

## What changed

Two visual/behavioral changes, scoped strictly to the highlighted first card
(`const isNext = idx === 0`). All other cards render exactly as before.

### 1. The highlighted card is now a perfect square

The card style object gained an `isNext`-only spread:

```jsx
style={{
  background: isNext ? '#d946a6' : '#374151',
  borderRadius: '0.5rem',
  padding: '1rem',
  color: '#fff',
  border: isNext ? 'none' : '0.5px solid #4b5563',
  transform: isNext ? 'scale(1.02)' : 'scale(1)',
  boxShadow: isNext ? '0 4px 12px rgba(217, 70, 166, 0.3)' : 'none',
  ...(isNext
    ? {
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'auto',
      }
    : {}),
}}
```

- `aspectRatio: '1 / 1'` makes rendered height equal width. The card sits in a
  `maxWidth: 720px` centered container, so the square is ~720x720 on desktop and
  ~viewport-width on mobile (375x375 at the 375px test width) - expected.
- `display/flexDirection/justifyContent` vertically center the content block
  inside the tall square.
- `overflow: 'auto'` is a safety net so nothing is clipped if content ever grows
  past the square at very narrow widths. In practice the content (date line,
  countdown, lesson, teacher, leads) is far shorter than the square, so no
  scrollbar appears and no font-size reduction was needed.
- Pink background, radius, shadow, and `scale(1.02)` are unchanged.

### 2. Days-until countdown line on the highlighted card

Computed inside the `.map()` callback, `isNext` only:

```jsx
const isNext = idx === 0

// Days until this class: compare today (or testDate) and class date, both at local midnight
let daysUntil = null
if (isNext) {
  const countdownToday = getTodayDate()
  countdownToday.setHours(0, 0, 0, 0)
  const countdownClassDate = new Date(cls['Date'])
  if (!isNaN(countdownClassDate.getTime())) {
    countdownClassDate.setHours(0, 0, 0, 0)
    daysUntil = Math.round((countdownClassDate - countdownToday) / (1000 * 60 * 60 * 24))
  }
}
const countdownLabel =
  daysUntil === null || daysUntil < 0
    ? null
    : daysUntil === 0
    ? 'Today'
    : daysUntil === 1
    ? 'Tomorrow'
    : `in ${daysUntil} days`
```

Rendered right below the existing date/time line:

```jsx
<div style={{ fontSize: '0.875rem', opacity: isNext ? 0.9 : 0.7, marginBottom: '0.25rem' }}>
  {formatDateNoLeadingZero(cls['Date'])} • {cls['Time']}
</div>
{isNext && countdownLabel && (
  <div style={{ fontSize: '1.5rem', fontWeight: '700', lineHeight: 1.1, marginBottom: '0.5rem', color: '#fff' }}>
    {countdownLabel}
  </div>
)}
```

## How the day math works

- `getTodayDate()` is the file's existing helper: returns `new Date(testDate)`
  when the `?testDate=` URL param is present and valid, otherwise `new Date()`.
  So the countdown is testable and always recomputes from the live clock on
  every render (no hardcoded number).
- Both "today" and the class date are floored with `setHours(0, 0, 0, 0)` -
  the same normalization the existing upcoming-classes filter uses - then the
  difference in milliseconds is divided by one day and `Math.round`ed (round,
  not floor, so a DST hour shift can't produce an off-by-one).
- Label mapping: `0` -> `Today`, `1` -> `Tomorrow`, `n > 1` -> `in n days`,
  `n < 0` -> render nothing (guard; see note below).

## testDate cases

| URL | Banner shows | Countdown | Why |
|---|---|---|---|
| (no param) real date 2026-08-30 | - | **in 3 days** | Aug 30 -> Sep 2 = 3 days |
| `?testDate=2026-09-02T12:00:00` | Wed Sep 02 2026 | (Sep 2 class drops off list; card #1 becomes Sep 11 -> "in 9 days") | see note |
| `?testDate=2026-09-02` | Tue Sep 01 2026 | **Tomorrow** | `new Date("2026-09-02")` parses as UTC midnight = Sep 1 ~17:00 PDT; floored to Sep 1 -> Sep 2 - Sep 1 = 1 |
| `?testDate=2026-09-01T12:00:00` | Tue Sep 01 2026 | **Tomorrow** | Sep 1 local -> Sep 2 = 1 day |

Isolated verification of the label logic (node):

```
real Aug30                    -> {"d":3,"label":"in 3 days"}
testDate 2026-09-02 (UTC)     -> {"d":1,"label":"Tomorrow"}
testDate 2026-09-02T12:00:00  -> {"d":0,"label":"Today"}
testDate 2026-09-01T12:00:00  -> {"d":1,"label":"Tomorrow"}
```

### Note on the "Today" / negative branches

The Upcoming Classes list filter keeps only rows where
`classDate > today` (both at local midnight, strict `>`). The countdown uses the
identical midnight math, so any class still in the list is at least +1 day out -
`daysUntil` for card #1 is always >= 1 with live data. The `0` ("Today") and
`< 0` branches are therefore defensive guards: correct if the upstream filter
ever changes to `>=`, but not reachable for the first card today. Confirmed in
the browser: `?testDate=2026-09-02T12:00:00` pushes card #1 to the Sep 11 class
("in 9 days") because Sep 2 is no longer "upcoming". The label logic itself is
verified above in isolation. Plain `?testDate=2026-09-02` renders "Tomorrow"
(not "Today") because of the shared UTC-midnight parsing quirk in the existing
`getTodayDate()` helper - not something this change introduced, and out of scope
(only the `isNext` card was to be touched).

## Screenshots (described)

- **Before:** first card was a short auto-height pink rounded rectangle: date +
  time line, lesson name, `Teacher @ School (Grade N)`, leads/assists. No
  countdown.
- **After, desktop (~720px container):** first card is a ~720x720 pink square,
  content group vertically centered; order is date/time line, then a large bold
  **"in 3 days"** (1.5rem/700), then lesson, teacher line, leads. Cards 2..n
  below are unchanged - gray, auto height, no countdown.
- **After, mobile (375x812):** first card is a ~345px pink square (full column
  width), same centered content, **"in 3 days"** prominent and legible on pink.
  Subsequent cards unchanged.
- No console errors from the change. Pre-existing dev-only console noise
  (stats.json 404 -> CSV fallback, PDF listing unavailable, service-worker
  registration failing) is unrelated.

---

# 2026-08-30 (later pass): restyle the square so bigger text fills it

**File touched:** `src/App.jsx` (still only the `isNext` / first card)
**Build bundle:** `dist/assets/index-CwqeLou5.js` (was `index-DjLPVrRV.js`)
**Deploy:** commit `2bc186f` pushed to `main` -> Netlify -> live, hash verified
via `curl … | grep assets/index`.

## Why

The first pass made the card a square but the content stayed at its old small
sizes, vertically centered, leaving a big empty band above and below on both
desktop and mobile. This pass rebuilds the `isNext` card as a dedicated stacked
layout with a real size hierarchy that fills most of the square.

## How it's structured now

The `.map()` callback gets an early `if (isNext) { return (<square/>) }` branch
**before** the original `return (` - so every other card renders through the
exact same untouched code as before (verified: the diff is purely additive,
the old block is byte-for-byte unchanged).

Inside the branch, four `clamp()` size tokens drive the hierarchy (no media
queries - they scale with viewport width between the min and max):

| Token | Value | Used by |
|---|---|---|
| `heroSize`    | `clamp(2.75rem, 13vw, 8.5rem)`  | countdown ("in N days") - the hero |
| `lessonSize`  | `clamp(1.6rem, 7.5vw, 4.75rem)` | lesson name (bold; `<a>` when a PDF URL exists, else `<div>`) |
| `teacherSize` | `clamp(1.15rem, 5vw, 3.15rem)`  | teacher line and "@ School" line |
| `smallSize`   | `clamp(0.9rem, 3.6vw, 2rem)`    | abbreviated date line, Grade suffix, each lead/assist name |

Line order in the square (top to bottom, all inside the vertically-centered
flex column):

1. **Date line** - `smallSize`, `opacity 0.85`, `marginBottom 1.25rem`.
   Abbreviated form built with `toLocaleDateString`:
   `` `${d.toLocaleDateString('en-US',{weekday:'short'})} • ${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})} • ${cls['Time']}` `` ->
   e.g. **"Wed • Sep 2 • 12:45 PM"**. Falls back to
   `formatDateNoLeadingZero(cls['Date'])` if the date can't be parsed. Other
   cards still use `formatDateNoLeadingZero` unchanged.
2. **Countdown** - `heroSize`, `fontWeight 700`, `lineHeight 1.03`,
   `marginBottom 1.5rem`. Same `countdownLabel` logic as the first pass (day
   math untouched).
3. **Lesson** - `lessonSize`, `fontWeight 700`, `marginBottom 1.5rem`. PDF-link
   behavior preserved exactly: same `href` (`getPdfUrlForLesson(cls['Lesson'])`),
   `target="_blank"`, `rel="noopener noreferrer"`, and the mouseenter/leave
   opacity 0.9<->0.7 hover; plain `<div>` when there's no PDF URL.
4. **Teacher** - `teacherSize`, `opacity 0.95`, on its own line.
5. **"@ School"** - `teacherSize`, `opacity 0.8`, own line. If `cls['Grade']`
   is set, ` · Grade N` is appended in `smallSize`/`opacity 0.85` (subtle).
6. **Leads/assists** - `smallSize` container; `⚠️ No lead assigned` in
   `#fca5a5` when there's no lead; then each person on **its own `<div>`**
   (comma joining dropped for this card only). "Ian" highlight kept:
   `color '#fda4af'` + `fontWeight 600` when `person.isIan && ianIsLead`, else
   `#d1d5db`.

Container unchanged from the first pass except padding went `1rem` ->
`1.25rem 1.5rem`: still `background '#d946a6'`, `borderRadius 0.5rem`,
`boxShadow 0 4px 12px rgba(217,70,166,0.3)`, `transform scale(1.02)`,
`aspectRatio '1 / 1'`, flex column + `justifyContent center`, `overflow 'auto'`.

## Verification

- `npm run build` clean: `dist/assets/index-CwqeLou5.js` (156.22 kB), CSS hash
  unchanged.
- Live console after deploy: only the two benign pre-existing `[log]` lines
  (PDF listing / stats file fallback). No errors or warnings.
- `?testDate=2026-09-11` -> hero "Tomorrow"; `?testDate=2026-09-12` /
  `2026-09-15` -> "in 3 days" / "in 11 days". Layout holds in every case; the
  two-digit "in 11 days" still fits the mobile square.

## Screenshots (described)

- **Before this pass:** square card, small content clustered in a ~230px band
  in the vertical middle of a ~720px (desktop) / ~345px (mobile) square, with
  large empty pink margins top and bottom.
- **After, desktop (1280px viewport, ~720px square):** content fills ~80%+ of
  the square with modest padding. Top to bottom: muted "Wed • Sep 2 • 12:45 PM",
  then a very large bold **"in 3 days"** (the clear hero), then large bold
  **"Photography"**, then medium "Sydney Straight" and slightly-muted
  "@ Gardner Bullis · Grade 5", then small "Wendy Marti" / "Ian Sagabaen" each
  on their own line. Nothing clipped, no scrollbar. Cards 2..n unchanged (gray,
  auto height, comma-joined names, full weekday-date format).
- **After, mobile (375x812):** same hierarchy in a ~345px square, "in 3 days"
  dominant, all lines legible, no overflow.
- Post-deploy LIVE screenshots captured at desktop and mobile widths from
  `https://eloquent-horse-a1ede7.netlify.app/` - match the local dev render.

---

## 2026-08-30 — Tighten inter-line spacing on the `isNext` square

The stacked lines carried large `marginBottom` gaps that left the text block
looser than wanted. Reduced every inter-line gap to a uniform `0.15rem` and
tightened `lineHeight` so wrapped lines don't reintroduce the gap. `isNext`
square only; all other cards render through unchanged code. `justifyContent:
'center'` kept, so the now-shorter block stays vertically centered.

| Line | `marginBottom` before → after | `lineHeight` before → after |
|---|---|---|
| date line | `1.25rem` → `0.15rem` | `1.2` → `1.15` |
| countdown hero ("in N days") | `1.5rem` → `0.15rem` | `1.03` → `1.0` |
| lesson (`<a>` PDF link) | `1.5rem` → `0.15rem` | `1.1` → `1.05` |
| lesson (`<div>` no-PDF fallback) | `1.5rem` → `0.15rem` | `1.1` → `1.05` |
| teacher | `0.35rem` → `0.15rem` | `1.25` → `1.15` |
| "@ School · Grade" | `1.4rem` → `0.15rem` | `1.25` → `1.15` |
| leads/assists wrapper | (none) | `1.45` → `1.25` |

Unchanged: `clamp()` font sizes, `fontWeight`s, colors/opacities, PDF-link
behavior, the "Ian" highlight, the "⚠️ No lead assigned" warning (incl. its
`0.2rem` marginBottom), the square (`aspectRatio: '1 / 1'`), pink bg / radius /
shadow / `scale(1.02)` / `overflow: 'auto'`, card padding.

Verified: dev render at desktop + mobile (375×812) — lines now sit close
together, block still vertically centered, "in N days" still the clear hero,
nothing clipped. `?testDate=2026-09-11` ("Tomorrow") layout holds. Build clean.
