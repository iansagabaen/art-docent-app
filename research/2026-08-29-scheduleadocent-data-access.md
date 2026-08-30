# scheduleadocent.com — data access investigation

**Date:** 2026-08-29
**Goal:** Get the Art Docent lesson schedule out of scheduleadocent.com into a Google Sheet
(columns: Day | Date | Time | Length (min) | Lesson | Teacher | School | Grade | Lead | Assist | Assist 2 | Notes to Docent),
as a repeatable pipeline rather than hand-formatting.
**Method:** Read-only inspection of the logged-in app in Claude Browser (network log, page runtime, IndexedDB cache). No forms submitted, nothing saved.

---

## TL;DR

- scheduleadocent.com ("Docent Scheduler Pro") is a **Next.js SPA with no first-party lesson API**. The browser reads lessons **directly from Google Cloud Firestore** (Firebase project `studio-3753607359-13f40`) using the Firebase Web SDK.
- Auth is **Firebase Auth**. Requests to Firestore carry a short-lived **ID token** (`Authorization: Bearer <JWT>`, ~1 hour). A long-lived **refresh token** mints new ID tokens.
- The lesson document is **self-contained** — it already embeds course name, teacher name, school name, grade, duration, start/end time, and staffing (names included). No joins needed to fill the target sheet.
- **Recommended pipeline: Option A** — a small Node script (`scripts/fetch-schedule.js`, written as part of this task) that calls the Firestore REST `runQuery` endpoint with a token exported from the browser, normalizes rows, and writes to the Sheet via the Google Sheets API. Runner-up: **Option B** (run the same fetch inside the logged-in browser tab) if App Check turns out to block external calls.
- The Sheet stays the source of truth for the existing Zapier → calendar automation; this pipeline only refreshes the Sheet.

---

## 1. What the page does

Open tab: `https://scheduleadocent.com/programs/art-docents/lessons/search?from=2026-08-29T07%3A00%3A00.000Z`

- Server returns an HTML shell that shows "Verifying session…", then hydrates client-side.
- All dynamic navigation is React Server Component (`?_rsc=…`) payloads — **HTML/RSC streams, not JSON**. Not a usable data API.
- The results list ("Showing 1–20 of 732 lessons found", "Page 1 of 37") is rendered from **Firestore query listeners** set up by the client SDK, not from any XHR to a scheduleadocent endpoint.
- The `from=<ISO8601>` URL param maps **directly** to a Firestore `date >=` filter. There is **no `to=` param in the URL**; the client supplies an upper bound internally (observed queries use `date <= 2027-…`). Day-of-week chips and the other filters are additional Firestore `where` clauses / client-side filters.

### Network calls seen on load

| Request | Verdict |
|---|---|
| `GET /_next/static/...` chunks | app JS/CSS |
| `GET /programs/art-docents/lessons/search?...&_rsc=…` | RSC stream (markup), not data |
| `GET /programs/art-docents/lessons/lesson-<id>?_rsc=…` | RSC prefetch of detail pages on hover |
| `GET /api/static-data` | **the only `/api/*` route.** Returns `{"error":"Unauthorized"}` on a plain browser GET → it is server-side and gated by a bearer token the client attaches, not a cookie. Content unknown (likely static config/branding, not lessons). |
| `GET /api/lessons?...` (probe) | **404** (HTML) — route does not exist |
| `firestore.googleapis.com` | (not re-captured in the log window, but the Firestore client is unambiguously present — see §2) |

### Probes for a clean/public API — all negative

| URL | Result |
|---|---|
| `/robots.txt` | 404 (SPA fallback) |
| `/api/lessons?programId=art-docents` | 404 (SPA fallback) |
| `/api/static-data` | 200 `{"error":"Unauthorized"}` (auth-gated, not lessons) |
| Export / Download button on the search page | **none** (checked the toolbar, column headers, and the per-row `…` menu) |
| `/sitemap.xml`, `/api/docs`, `/graphql`, `/openapi.json`, `/swagger.json` | not formally fetched; given the SPA 404 behavior above they will all fall through to the SPA 404. No GraphQL client or OpenAPI reference anywhere in the runtime. |

**Conclusion:** there is no documented API and no CSV export. Firestore is the data source.

---

## 2. The real data source: Firestore

Evidence from the page runtime / storage (read-only):

- `localStorage` keys: `firestore_clients_firestore/[DEFAULT]/studio-3753607359-13f40/…`, `firestore_targets_…`, `firestore_online_state_…`, plus `activeProgram`, `activeRole`, `_grecaptcha`.
- `indexedDB.databases()`: `firestore/[DEFAULT]/studio-3753607359-13f40/main` (the offline persistence store), plus `firebaseLocalStorageDb`, `firebase-app-check-database`, `firebase-installations-database`, `firebase-heartbeat-database`.
- The `firebase-app-check-database` + `_grecaptcha` mean **Firebase App Check (reCAPTCHA provider) is configured**. Whether it is *enforced* for Firestore was not confirmed (see Risks).

**Firebase project id:** `studio-3753607359-13f40` (the `studio-…` prefix = built with Firebase Studio).
**Firestore REST base:** `https://firestore.googleapis.com/v1/projects/studio-3753607359-13f40/databases/(default)/documents`

### Collections (counts from the local cache, not authoritative totals)

| Path | Cached docs | Notes |
|---|---|---|
| `programs/art-docents` | 1 | program config: `assignmentRoles`, branding, `contractYear`, etc. |
| `programs/art-docents/lessons` | 658 | **the schedule** — one doc per scheduled lesson |
| `programs/art-docents/courses` | 93 | lesson catalog (curriculum, materials, `requiredAssignments` template) |
| `programs/art-docents/members` | 95 | docents/volunteers (name, email, phone, schools, experience) |
| `programs/art-docents/tags` | 18 | lesson tags (e.g. "Drawing", "Printmaking") |
| `programs/art-docents/feedback` | — | per-lesson feedback (queried by `lessonId`) |
| `districts/district-2/members` | 497 | district-level member records |
| `districts/district-2/dailySchedules` | 80 | school bell schedules |
| `districts/district-2/scheduleTemplates` | 11 | |
| `roles` | 6 | Admin, DocentVolunteer, Teacher, DistrictManager, ProgramManager, Test |
| `users`, `settings/global_branding` | 1 each | |

### Firestore queries the app actually runs (from the cached `targets` store)

- Search page (target 36):
  `collection lessons | where status == "active" AND date >= <from> | orderBy date asc, startTime asc, __name__ asc | limit 21`
  → paginated 20–21 at a time; `732 / 20 ≈ 37 pages` matches the UI.
- "Fully staffed = false" variants (targets 14/44) for the "needs volunteers" views.
- Per-course: `where courseId == <id> AND status == "active" AND date between <lo> and <hi>`.
- My schedule: `where volunteerIds array-contains <myUid> AND date between …`.

So a full pull is just: **`lessons` where `date` in [rangeStart, rangeEnd]` (optionally `status == "active"`), `orderBy date`.** That is exactly what `scripts/fetch-schedule.js` issues.

---

## 3. The lesson document shape

Union of fields across the 658 cached lesson docs (frequency = how many docs have the field):

```
id, courseId, courseName, teacherId, teacherName, schoolId, schoolName,
date, dayOfWeek, startTime, endTime, duration, status,
grade {name, nameInWords, order}, gradeIds[],
lessonLocationId, lessonLocationName, meetingLocationId, meetingLocationName,
locations[], locationNote, roomLimit,
districtId, programId, programName,
requiredAssignments[ {id, name, count, equivalentRoleIds[]} ],   // per-lesson role template
neededRoleIds[], totalRequiredVolunteers, isFullyStaffed,
assignedVolunteers { <assignmentRoleId>: [uid, ...] },           // who is booked, by role
volunteerIds[uid],
volunteerNames { <uid>: "Full Name" },                           // uid -> display name (embedded!)
volunteerAvatars (108/658), coLeads (3/658), subRequestedBy (14/658),
notes (17/658), locationNote,
tagIds[], tagNames[],
materialsPickedUp, materialsReturned,
createdAt, createdBy, createdByName, modifiedAt, modifiedBy, modifiedByName,
cancelledByUid (9/658), rescheduledFromId (6/658),
notifyTeacherOnCreate / notifyTeacherOnCancel / notifyTeamOnCancel (rare),
_matchedTagGroupIndices (client-added)
```

### Sample record (trimmed to one, a staffed lesson)

```json
{
  "id": "lesson-1786136683913",
  "courseId": "K0P8TS4L",
  "courseName": "Cityscape",
  "teacherId": "yI3bC8qDksYm51MmFS7L",
  "teacherName": "CJ Evenhuis",
  "schoolId": "school-3",
  "schoolName": "Covington",
  "date": "2027-01-08T21:15:00Z",
  "dayOfWeek": 5,
  "startTime": "13:15",
  "endTime": "14:30",
  "duration": 75,
  "status": "active",
  "grade": { "name": "4", "nameInWords": "Fourth Grade", "order": 4 },
  "lessonLocationName": "Room 20",
  "isFullyStaffed": true,
  "totalRequiredVolunteers": 1,
  "requiredAssignments": [
    { "id": "asg-1763399189202", "name": "Lead",    "count": 1 },
    { "id": "asg-1763399200813", "name": "Assist",  "count": 0 },
    { "id": "asg-1779210076985", "name": "Co-Lead", "count": 0 }
  ],
  "assignedVolunteers": { "asg-1763399189202": ["0FECkVxrCLg9EumydcqM"] },
  "volunteerIds": ["0FECkVxrCLg9EumydcqM"],
  "volunteerNames": { "0FECkVxrCLg9EumydcqM": "Ian Sagabaen" },
  "tagNames": ["Drawing"],
  "notes": undefined
}
```

**Key mechanics**

- `date` is the canonical **start instant in UTC**. `startTime` / `endTime` are **local (America/Los_Angeles) wall-clock strings**, 24h. `21:15Z` == `13:15` PST. ✔ consistent.
- `dayOfWeek`: 0 = Sunday … 5 = Friday. (Or just derive the weekday from `date` in the LA timezone — the script does this.)
- Staffing role ids are **per-lesson** (`requiredAssignments[].id` → `.name`). Observed globally:
  `asg-1763399189202 = Lead`, `asg-1763399200813 = Assist`, `asg-1779210076985 = Co-Lead`.
  Resolve names via `assignedVolunteers[roleId] → uid → volunteerNames[uid]`. No `members` lookup required.
- `notes` = the teacher's "notes to docent" (only 6 lessons in the target range have one). `locationNote` is a second, rarer free-text field.

---

## 4. Field → spreadsheet-column mapping

| Sheet column | Source | Transform | Gap? |
|---|---|---|---|
| **Day** | `date` | weekday of `date` rendered in `America/Los_Angeles` (or map `dayOfWeek`) | ok |
| **Date** | `date` | calendar date in `America/Los_Angeles` (`YYYY-MM-DD`) | ok |
| **Time** | `startTime`, `endTime` | `"1:15 PM - 2:30 PM"` (12h, from the 24h local strings) | ok |
| **Length (min)** | `duration` | integer, as-is | ok |
| **Lesson** | `courseName` | as-is | ok |
| **Teacher** | `teacherName` | as-is | ok |
| **School** | `schoolName` (+ `lessonLocationName`) | `"Covington, Room 20"` | ok — decide if room belongs here or is dropped |
| **Grade** | `grade.name` (fallback `grade.nameInWords`) | `"4"` or `"K"` | ok |
| **Lead** | `assignedVolunteers[<Lead role id>]` → `volunteerNames` | join multiple with `; ` | ok |
| **Assist** | `assignedVolunteers[<Assist role id>]` → `volunteerNames`, **1st name** | | ok |
| **Assist 2** | same array, **2nd name** (3rd+ appended) | | ⚠ **no dedicated field** — "Assist 2" is just the 2nd element of the Assist array. If a lesson ever needs 3+ assists they collapse into this cell. |
| **Notes to Docent** | `notes` (+ `locationNote`) | join with ` \| ` | ⚠ populated on only ~6 of ~730 lessons; usually blank |
| *(not in sheet)* | `Co-Lead` assignees | script currently appends them to **Lead** as `"Name (Co-Lead)"` | decision needed — Co-Lead is a real role here; sheet has no column for it |
| *(not in sheet)* | `status`, `isFullyStaffed`, `tagNames`, `courseId`, lesson `id` | carried as `_`-prefixed helper fields in `--json` mode; not emitted to CSV | fine |

**Every target column has a clean source.** The only real gaps are structural: "Assist 2" is positional (not its own field), and there is no home for the **Co-Lead** role.

---

## 5. Pipeline options

### Option A — standalone Node script + Google Sheets API  ✅ RECOMMENDED

Node script (no browser) → Firestore REST `runQuery` with an exported Firebase token → normalize → write to the Sheet with `googleapis`.

- **Endpoint:** `POST https://firestore.googleapis.com/v1/projects/studio-3753607359-13f40/databases/(default)/documents/programs/art-docents:runQuery?key=<API_KEY>`
  Header: `Authorization: Bearer <ID_TOKEN>`
  Body: structured query, `lessons` where `date` in range (+ `status == "active"`), `orderBy date`.
- **Auth durability:** ID token ~1 h. **Refresh token is long-lived** (until sign-out / password change / manual revoke) and exchanges for fresh ID tokens at
  `POST https://securetoken.googleapis.com/v1/token?key=<API_KEY>` with `grant_type=refresh_token`.
  Store the refresh token + API key once; the script self-refreshes each run. Realistically good for months of unattended weekly runs. If Ian signs in with Google SSO, `signInWithPassword` is **not** an option — the refresh-token path is the one that works.
- **Pros:** fully unattended once tokens are set; no browser; easy to run on a schedule (cron / GitHub Action / Zapier "Code" step); same script can `--json` for other consumers.
- **Cons:** token has to be grabbed from DevTools once (and re-grabbed if it is ever revoked); depends on the private Firestore schema staying stable; **if App Check is enforced for Firestore, a non-browser client is rejected** → fall back to Option B.

### Option B — fetch inside the logged-in Claude Browser tab

Run the same Firestore `runQuery` (or just read the SDK's in-memory results) via `javascript_tool` in the authenticated tab; dump CSV; paste into the Sheet or push with the Sheets API.

- **Pros:** the browser already holds a valid ID token **and a valid App Check token**, so it works even if App Check is enforced. Zero credential handling.
- **Cons:** not unattended — needs a logged-in browser session driven each time; more moving parts for a weekly cadence; brittle if run through the Claude harness (classifier blocks some cross-origin `fetch` / token reads, as seen during this investigation).
- Good **fallback / bootstrap**: use it to prove the query and to do the first import while Option A's token path is set up.

### Option C — manual CSV export from the site

**Not available.** No Export/Download control on the search page (or its row menu). Ruled out.

### Why A over B

The schedule changes throughout the year (lessons added, staffed, rescheduled, cancelled), so this wants to run **weekly, unattended**, feeding the Sheet that Zapier already watches. Option A is the only one that runs headless on a schedule. Option B stays in the toolbox as the App-Check fallback and for the first manual load.

---

## 6. Setup for Option A (recommended)

1. **One-time: get Firebase credentials from the browser.**
   - Log in to `https://scheduleadocent.com` in Chrome.
   - DevTools → Application → IndexedDB → `firebaseLocalStorageDb` → `firebaseLocalStorageDb`.
   - Open the row whose key contains `firebase:authUser`. From `value`:
     - `apiKey` → `SAD_API_KEY`
     - `stsTokenManager.refreshToken` → `SAD_REFRESH_TOKEN`
     - `stsTokenManager.accessToken` → `SAD_ID_TOKEN` (optional if the two above are set)
   ```bash
   export SAD_API_KEY='AIza...'
   export SAD_REFRESH_TOKEN='AMf-...'
   ```
2. **Dry run (no creds needed):**
   ```bash
   node scripts/fetch-schedule.js --from 2026-09-01 --to 2027-06-30 --dry-run
   ```
3. **Real pull to CSV:**
   ```bash
   node scripts/fetch-schedule.js --from 2026-09-01 --to 2027-06-30 > schedule.csv
   ```
   (or `--json` for objects.) If this returns HTTP 401/403, the token expired or App Check is enforced → refresh the token, or switch to Option B for that run.
4. **Write to the Sheet (next build step, not in this script yet):**
   - Create a Google Cloud service account, enable the Sheets API, share the target Sheet with the service account email as Editor.
   - Add a `--sheet <spreadsheetId> --tab <name>` mode to `fetch-schedule.js` that uses `googleapis` `spreadsheets.values.update` to overwrite the data range with header + rows. Keep the tab that Zapier watches as the write target so the calendar sync keeps working.
5. **Schedule:** wrap steps 3–4 in a weekly cron / GitHub Action / Zapier Code step. Keep `SAD_REFRESH_TOKEN` + `SAD_API_KEY` and the service-account JSON in that runner's secrets.

Provided now: **`scripts/fetch-schedule.js`** does steps 1–3 (fetch + normalize + CSV/JSON, with `--dry-run` and `--help`). The Sheets write (step 4) is the next task.

---

## 7. Open questions / risks

| Risk | Detail / mitigation |
|---|---|
| **App Check enforcement** | reCAPTCHA App Check is configured. If it is *enforced* for Firestore, the headless Option A `runQuery` gets `403`/`PERMISSION_DENIED`. **Not verified** (the investigation's cross-origin test calls were blocked by the Claude harness classifier, not by the site). First real run will tell. Fallback: Option B (browser has a valid App Check token). |
| **Token lifetime** | ID token ~1 h (script auto-refreshes). Refresh token is long-lived but dies on sign-out, password change, or admin revoke → re-grab from DevTools when a run starts failing auth. |
| **SSO / no password grant** | Ian's member email is a Gmail address → likely Google sign-in, so `accounts:signInWithPassword` won't work. The refresh-token exchange does. |
| **Private schema** | `programs/art-docents/lessons` is an internal Firestore schema with no stability contract. Field renames or a data-model change (e.g. staffing moved to a subcollection) would break normalization. Low frequency, but pin the script to observed field names and fail loudly. |
| **Terms of Service** | Automated reads of your own program's data via the app's own Firebase project. Reused the logged-in user's own credentials, read-only. Worth a quick check of scheduleadocent.com's ToS for anti-automation clauses before running on a schedule; if in doubt, Option B (in-browser) is clearly within normal use. |
| **Rate limits / cost** | Firestore bills per document read. ~730 docs/run × weekly ≈ trivial (well within free tier). `runQuery` may cap response size for very large ranges — if a full-year pull ever truncates, page with `offset` / `startAt` on `date`. |
| **Cache vs. reality** | The local IndexedDB cache used for this investigation held 658 lesson docs / 640 active in range, while the UI reports **732** from 2026-08-29. The cache is partial (only what listeners have loaded). A real `runQuery` over the date range returns the full set — don't treat 640 as the total. |
| **Timezone** | All formatting assumes `America/Los_Angeles`. Correct for this district (Los Altos). Hard-coded in the script. |
| **"Assist 2" / Co-Lead** | Positional Assist columns and the unmapped Co-Lead role (see §4). Decide desired sheet behavior before wiring the Sheets write. |

---

## 8. Artifacts from this task

- `scripts/fetch-schedule.js` — Node (ESM) proof-of-concept: `--help`, `--dry-run`, `--from/--to`, `--status`, `--json`; fetch + normalize + CSV. Verified it runs (help + dry-run + no-creds exit code 2). The normalization was also run against the real cached lesson data in-browser and produced correct rows (spot-checked against the UI).
- This document.
