#!/usr/bin/env node
/**
 * fetch-schedule.js
 * -----------------
 * Pull the Art Docent lesson schedule out of scheduleadocent.com and print it as
 * CSV whose columns match the target Google Sheet:
 *
 *   Day | Date | Time | Length (min) | Lesson | Teacher | School | Grade | Lead | Assist | Assist 2 | Notes to Docent
 *
 * BACKGROUND (see research/2026-08-29-scheduleadocent-data-access.md for the full write-up)
 * ------------------------------------------------------------------------------------------
 * scheduleadocent.com is a Next.js SPA backed by Google Cloud Firestore
 * (Firebase project id: studio-3753607359-13f40). There is NO first-party REST/JSON
 * API for lessons. The browser talks straight to Firestore over its REST/gRPC-web
 * channel using a short-lived Firebase Auth **ID token** (a ~1 hour JWT) as
 * `Authorization: Bearer <token>`. A long-lived **refresh token** can mint new ID
 * tokens indefinitely (until the user signs out / changes password / it is revoked).
 *
 * This script therefore hits the Firestore REST endpoint directly:
 *
 *   POST https://firestore.googleapis.com/v1/projects/studio-3753607359-13f40/databases/(default)/documents/programs/art-docents:runQuery?key=<API_KEY>
 *   Authorization: Bearer <ID_TOKEN>
 *
 * The lesson document is self-contained for spreadsheet purposes: it carries
 * courseName, teacherName, schoolName, grade, duration, startTime/endTime, and the
 * staffing (assignedVolunteers + volunteerNames), so no joins are required.
 *
 * CREDENTIALS (environment variables)
 * -----------------------------------
 *   SAD_ID_TOKEN      Firebase ID token (Bearer JWT). Required for a live run unless
 *                     SAD_REFRESH_TOKEN + SAD_API_KEY are supplied. Lifetime ~1 hour.
 *   SAD_REFRESH_TOKEN Firebase refresh token. If set (with SAD_API_KEY), the script
 *                     exchanges it for a fresh ID token before querying. Long-lived.
 *   SAD_API_KEY       Firebase Web API key (the `apiKey` from the app's firebaseConfig).
 *                     Needed for the token refresh call and appended as ?key= on the
 *                     Firestore request.
 *   SAD_COOKIE        Optional. Raw Cookie header string from a logged-in browser
 *                     session. Only used as a fallback transport and for any
 *                     `/api/*` Next.js route that accepts cookie auth; the Firestore
 *                     path ignores it. Kept for parity with other scrapers.
 *
 * HOW TO GET THE TOKENS (one-time, ~1 min, no admin access needed)
 * ---------------------------------------------------------------
 *   1. Log in to https://scheduleadocent.com in Chrome.
 *   2. DevTools (Cmd+Opt+I) -> Application -> IndexedDB ->
 *      firebaseLocalStorageDb -> firebaseLocalStorageDb.
 *   3. Open the row whose key contains "firebase:authUser". In `value`:
 *        - apiKey                       -> SAD_API_KEY
 *        - stsTokenManager.accessToken  -> SAD_ID_TOKEN
 *        - stsTokenManager.refreshToken -> SAD_REFRESH_TOKEN
 *   4. Export them:
 *        export SAD_API_KEY='AIza...'
 *        export SAD_REFRESH_TOKEN='AMf-...'
 *      (SAD_ID_TOKEN optional if refresh token + api key are set.)
 *
 * USAGE
 * -----
 *   node scripts/fetch-schedule.js --help
 *   node scripts/fetch-schedule.js --from 2026-09-01 --to 2027-06-30 > schedule.csv
 *   node scripts/fetch-schedule.js --from 2026-09-01 --to 2027-06-30 --json
 *   node scripts/fetch-schedule.js --dry-run           # no network; show the plan
 *
 * EXIT CODES: 0 ok, 1 usage error, 2 missing credentials, 3 HTTP/auth failure.
 */

const PROJECT_ID = "studio-3753607359-13f40";
const PROGRAM_ID = "art-docents";
const TIMEZONE = "America/Los_Angeles";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const RUN_QUERY_URL = `${FIRESTORE_BASE}/programs/${PROGRAM_ID}:runQuery`;
const TOKEN_REFRESH_URL = "https://securetoken.googleapis.com/v1/token";

const TARGET_COLUMNS = [
  "Day",
  "Date",
  "Time",
  "Length (min)",
  "Lesson",
  "Teacher",
  "School",
  "Grade",
  "Lead",
  "Assist",
  "Assist 2",
  "Notes to Docent",
];

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { from: null, to: null, status: "active", json: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help": args.help = true; break;
      case "--from": args.from = argv[++i]; break;
      case "--to": args.to = argv[++i]; break;
      case "--status": args.status = argv[++i]; break;      // "active" (default) | "all"
      case "--json": args.json = true; break;
      case "--dry-run": args.dryRun = true; break;
      default:
        console.error(`Unknown argument: ${a}`);
        args._error = true;
    }
  }
  return args;
}

const HELP = `
fetch-schedule.js - export the scheduleadocent.com Art Docent schedule as CSV

USAGE
  node scripts/fetch-schedule.js [options]

OPTIONS
  --from <YYYY-MM-DD>   Start of date range (inclusive). Default: today.
  --to   <YYYY-MM-DD>   End of date range (inclusive).   Default: --from + 400 days.
  --status <active|all> Filter lesson status. Default: active.
  --json               Emit raw normalized row objects as JSON instead of CSV.
  --dry-run            Print the request plan and exit. No network, no credentials needed.
  -h, --help           Show this help.

ENVIRONMENT (credentials - see header comment for how to obtain)
  SAD_API_KEY          Firebase Web API key.
  SAD_REFRESH_TOKEN    Firebase refresh token (preferred; long-lived).
  SAD_ID_TOKEN         Firebase ID token (Bearer JWT; ~1h lifetime). Optional if
                       SAD_REFRESH_TOKEN + SAD_API_KEY are set.
  SAD_COOKIE           Optional logged-in Cookie header (fallback only).

OUTPUT COLUMNS
  ${TARGET_COLUMNS.join(" | ")}

EXAMPLES
  node scripts/fetch-schedule.js --dry-run
  node scripts/fetch-schedule.js --from 2026-09-01 --to 2027-06-30 > schedule.csv
`;

// ---------------------------------------------------------------------------
// date helpers
// ---------------------------------------------------------------------------
function isoDateOnly(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDateOnly(d);
}
function startOfDayUTC(dateStr) {
  return `${dateStr}T00:00:00.000Z`;
}
function endOfDayUTC(dateStr) {
  return `${dateStr}T23:59:59.999Z`;
}

const _dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" });
const _dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

function laWeekday(iso) {
  try { return _dowFmt.format(new Date(iso)); } catch { return ""; }
}
function laDate(iso) {
  try {
    const p = _dateFmt.formatToParts(new Date(iso)).reduce((o, x) => (o[x.type] = x.value, o), {});
    return `${p.year}-${p.month}-${p.day}`;
  } catch { return ""; }
}
// "13:15" -> "1:15 PM"
function to12h(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm || "";
  let [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

// ---------------------------------------------------------------------------
// Firestore typed-value decoder
// ---------------------------------------------------------------------------
function decodeValue(v) {
  if (v == null) return null;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("mapValue" in v) {
    const out = {};
    const f = (v.mapValue && v.mapValue.fields) || {};
    for (const k of Object.keys(f)) out[k] = decodeValue(f[k]);
    return out;
  }
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(decodeValue);
  return null;
}
function decodeDocument(doc) {
  const out = { _name: doc.name };
  const f = doc.fields || {};
  for (const k of Object.keys(f)) out[k] = decodeValue(f[k]);
  return out;
}

// ---------------------------------------------------------------------------
// structured query builder
// ---------------------------------------------------------------------------
function buildStructuredQuery({ fromISO, toISO, status }) {
  const filters = [
    { fieldFilter: { field: { fieldPath: "date" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: fromISO } } },
    { fieldFilter: { field: { fieldPath: "date" }, op: "LESS_THAN_OR_EQUAL", value: { timestampValue: toISO } } },
  ];
  if (status && status !== "all") {
    filters.push({ fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: status } } });
  }
  return {
    structuredQuery: {
      from: [{ collectionId: "lessons", allDescendants: false }],
      where: { compositeFilter: { op: "AND", filters } },
      orderBy: [
        { field: { fieldPath: "date" }, direction: "ASCENDING" },
        { field: { fieldPath: "__name__" }, direction: "ASCENDING" },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------
async function refreshIdToken(apiKey, refreshToken) {
  const res = await fetch(`${TOKEN_REFRESH_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }
  return body.id_token || body.access_token;
}

async function resolveIdToken() {
  const { SAD_ID_TOKEN, SAD_REFRESH_TOKEN, SAD_API_KEY } = process.env;
  if (SAD_REFRESH_TOKEN && SAD_API_KEY) {
    process.stderr.write("Refreshing ID token from refresh token...\n");
    return await refreshIdToken(SAD_API_KEY, SAD_REFRESH_TOKEN);
  }
  if (SAD_ID_TOKEN) return SAD_ID_TOKEN;
  return null;
}

// ---------------------------------------------------------------------------
// fetch + normalize
// ---------------------------------------------------------------------------
async function runQuery({ idToken, apiKey, structuredQuery, cookie }) {
  const url = apiKey ? `${RUN_QUERY_URL}?key=${encodeURIComponent(apiKey)}` : RUN_QUERY_URL;
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(structuredQuery) });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Firestore runQuery failed (HTTP ${res.status}): ${text.slice(0, 500)}`);
    err.httpStatus = res.status;
    throw err;
  }
  let arr;
  try { arr = JSON.parse(text); } catch (e) { throw new Error(`Could not parse Firestore response: ${e.message}`); }
  return (Array.isArray(arr) ? arr : [])
    .filter((entry) => entry && entry.document)
    .map((entry) => decodeDocument(entry.document));
}

function roleIdByName(requiredAssignments, re) {
  const hit = (requiredAssignments || []).find((a) => a && re.test(String(a.name || "")));
  return hit ? hit.id : null;
}

function namesForRole(lesson, roleId) {
  if (!roleId) return [];
  const assigned = (lesson.assignedVolunteers && lesson.assignedVolunteers[roleId]) || [];
  const nameMap = lesson.volunteerNames || {};
  return assigned.map((uid) => nameMap[uid] || uid);
}

function normalizeLesson(lesson) {
  const ra = lesson.requiredAssignments || [];
  const leadRole = roleIdByName(ra, /^lead$/i) || roleIdByName(ra, /lead/i);
  const coLeadRole = roleIdByName(ra, /co-?lead/i);
  const assistRole = roleIdByName(ra, /assist/i);

  const leads = namesForRole(lesson, leadRole);
  const coLeads = namesForRole(lesson, coLeadRole).filter((n) => !leads.includes(n));
  const assists = namesForRole(lesson, assistRole);

  const grade =
    (lesson.grade && (lesson.grade.name || lesson.grade.nameInWords)) ||
    (Array.isArray(lesson.gradeIds) ? lesson.gradeIds.join(", ") : "") ||
    "";

  const school = [lesson.schoolName, lesson.lessonLocationName].filter(Boolean).join(", ");

  const notes = [lesson.notes, lesson.locationNote].filter(Boolean).join(" | ");

  return {
    Day: laWeekday(lesson.date),
    Date: laDate(lesson.date),
    Time: `${to12h(lesson.startTime)} - ${to12h(lesson.endTime)}`,
    "Length (min)": lesson.duration != null ? lesson.duration : "",
    Lesson: lesson.courseName || "",
    Teacher: lesson.teacherName || "",
    School: school,
    Grade: grade,
    Lead: [...leads, ...coLeads.map((n) => `${n} (Co-Lead)`)].join("; "),
    Assist: assists[0] || "",
    "Assist 2": assists.slice(1).join("; "),
    "Notes to Docent": notes,
    _id: lesson.id || (lesson._name || "").split("/").pop(),
    _status: lesson.status || "",
    _dateISO: lesson.date || "",
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows) {
  const lines = [TARGET_COLUMNS.map(csvCell).join(",")];
  for (const r of rows) lines.push(TARGET_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP); return 0; }
  if (args._error) { process.stderr.write(HELP); return 1; }

  const from = args.from || isoDateOnly(new Date());
  const to = args.to || addDays(from, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    process.stderr.write(`--from / --to must be YYYY-MM-DD (got from=${from} to=${to})\n`);
    return 1;
  }
  const fromISO = startOfDayUTC(from);
  const toISO = endOfDayUTC(to);
  const structuredQuery = buildStructuredQuery({ fromISO, toISO, status: args.status });

  if (args.dryRun) {
    process.stderr.write(
      [
        "DRY RUN - no network call made.",
        "",
        `Endpoint : POST ${RUN_QUERY_URL}?key=<SAD_API_KEY>`,
        `Auth     : Authorization: Bearer <ID token from SAD_ID_TOKEN or refreshed via SAD_REFRESH_TOKEN>`,
        `Range    : ${fromISO}  ..  ${toISO}  (America/Los_Angeles calendar dates ${from} .. ${to})`,
        `Status   : ${args.status}`,
        `Output   : ${args.json ? "JSON rows" : "CSV"} with columns -> ${TARGET_COLUMNS.join(" | ")}`,
        "",
        "Structured query:",
        JSON.stringify(structuredQuery, null, 2),
        "",
        "Set SAD_API_KEY + SAD_REFRESH_TOKEN (or SAD_ID_TOKEN) and drop --dry-run to run for real.",
        "",
      ].join("\n") + "\n"
    );
    return 0;
  }

  const apiKey = process.env.SAD_API_KEY || null;
  const cookie = process.env.SAD_COOKIE || null;
  let idToken;
  try {
    idToken = await resolveIdToken();
  } catch (e) {
    process.stderr.write(`Auth error: ${e.message}\n`);
    return 3;
  }
  if (!idToken && !cookie) {
    process.stderr.write(
      "Missing credentials. Set SAD_REFRESH_TOKEN + SAD_API_KEY (preferred) or SAD_ID_TOKEN.\n" +
      "Run with --dry-run to see the request plan, or --help for how to obtain tokens.\n"
    );
    return 2;
  }

  let docs;
  try {
    docs = await runQuery({ idToken, apiKey, structuredQuery, cookie });
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    if (e.httpStatus === 401 || e.httpStatus === 403) {
      process.stderr.write(
        "Hint: 401/403 usually means the ID token expired (~1h) or Firebase App Check is enforced\n" +
        "for Firestore. Refresh SAD_ID_TOKEN, or fall back to running the query in the logged-in\n" +
        "browser tab (see research doc, Option B).\n"
      );
    }
    return 3;
  }

  const rows = docs.map(normalizeLesson).sort((a, b) => String(a._dateISO).localeCompare(String(b._dateISO)));
  process.stderr.write(`Fetched ${docs.length} lesson record(s); emitting ${rows.length} row(s).\n`);

  if (args.json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
  } else {
    process.stdout.write(toCSV(rows));
  }
  return 0;
}

main()
  .then((code) => process.exit(code || 0))
  .catch((e) => { process.stderr.write(`Unexpected error: ${e && e.stack || e}\n`); process.exit(1); });
