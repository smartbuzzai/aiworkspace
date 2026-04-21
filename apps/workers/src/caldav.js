// ═══════════════════════════════════════════════════════════════
//  CalDAV Sync — two-way mirror between Postgres events
//  and Radicale collections.
//
//  Each user gets a collection at: /{userId}/default/
//  Events are VEVENT entries in iCalendar format.
// ═══════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from "uuid";

const CALDAV = process.env.CALDAV_HOST || "http://radicale:5232";

// ─── iCalendar serialization ──────────────────────────────────
function toICSDate(d) {
  // YYYYMMDDTHHMMSSZ
  return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
}

function escapeICS(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function eventToVEVENT(ev) {
  const uid = ev.caldav_uid || ev.id;
  const now = toICSDate(new Date());
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(ev.starts_at)}`,
    `DTEND:${toICSDate(ev.ends_at)}`,
    `SUMMARY:${escapeICS(ev.title)}`
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escapeICS(ev.description)}`);
  if (ev.location)    lines.push(`LOCATION:${escapeICS(ev.location)}`);
  if (ev.recurrence_rule) lines.push(`RRULE:${ev.recurrence_rule}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function wrapCalendar(vevent) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Workspace//EN",
    vevent,
    "END:VCALENDAR"
  ].join("\r\n");
}

// ─── Collection bootstrap ─────────────────────────────────────
async function ensureCollection(userId) {
  const path = `/${userId}/default/`;
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<create xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <set>
    <prop>
      <resourcetype><collection/><C:calendar/></resourcetype>
      <displayname>Workspace</displayname>
      <C:supported-calendar-component-set>
        <C:comp name="VEVENT"/>
      </C:supported-calendar-component-set>
    </prop>
  </set>
</create>`;
  await fetch(`${CALDAV}${path}`, {
    method: "MKCOL",
    headers: { "Content-Type": "application/xml" },
    body
  }).catch(() => {}); // 405 if already exists — ignore
}

// ─── Push one event ───────────────────────────────────────────
export async function pushEvent(userId, event) {
  await ensureCollection(userId);
  const uid = event.caldav_uid || event.id;
  const ics = wrapCalendar(eventToVEVENT({ ...event, caldav_uid: uid }));
  const path = `/${userId}/default/${uid}.ics`;
  const r = await fetch(`${CALDAV}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
    body: ics
  });
  if (!r.ok && r.status !== 201 && r.status !== 204) {
    throw new Error(`CalDAV PUT failed: ${r.status}`);
  }
  return uid;
}

export async function deleteEvent(userId, caldavUid) {
  const path = `/${userId}/default/${caldavUid}.ics`;
  await fetch(`${CALDAV}${path}`, { method: "DELETE" }).catch(() => {});
}

// ─── Pull events from CalDAV into Postgres ────────────────────
//  Uses PROPFIND to list, then GET each .ics file.
//  Parses VEVENT and upserts into events table.
// ─────────────────────────────────────────────────────────────
export async function pullEvents(userId, db) {
  await ensureCollection(userId);
  const path = `/${userId}/default/`;

  const propfindBody = `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:"><prop><getetag/></prop></propfind>`;

  const listRes = await fetch(`${CALDAV}${path}`, {
    method: "PROPFIND",
    headers: { "Content-Type": "application/xml", "Depth": "1" },
    body: propfindBody
  });
  if (!listRes.ok) return 0;

  const xml = await listRes.text();
  // Cheap extraction — Radicale returns <href>/user/default/uid.ics</href>
  const hrefs = [...xml.matchAll(/<(?:\w+:)?href[^>]*>([^<]+\.ics)<\/(?:\w+:)?href>/g)]
    .map(m => m[1]);

  let synced = 0;
  for (const href of hrefs) {
    try {
      const res = await fetch(`${CALDAV}${href}`);
      if (!res.ok) continue;
      const ics = await res.text();
      const parsed = parseVEVENT(ics);
      if (!parsed) continue;

      await db.query(
        `INSERT INTO events
           (user_id, title, description, location, starts_at, ends_at, caldav_uid)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [userId, parsed.summary, parsed.description, parsed.location,
         parsed.dtstart, parsed.dtend, parsed.uid]
      );
      synced++;
    } catch (err) {
      console.warn("caldav pull item failed:", err.message);
    }
  }
  return synced;
}

// ─── Minimal VEVENT parser (no external deps for tiny footprint) ───
function parseVEVENT(ics) {
  // Unfold lines: RFC 5545 says continuation lines start with space/tab
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const ev = {};
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; continue; }
    if (line === "END:VEVENT")   { inEvent = false; continue; }
    if (!inEvent) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const val = line.slice(idx + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "UID")         ev.uid = val;
    if (key === "SUMMARY")     ev.summary = val.replace(/\\,/g, ",").replace(/\\n/g, "\n");
    if (key === "DESCRIPTION") ev.description = val.replace(/\\,/g, ",").replace(/\\n/g, "\n");
    if (key === "LOCATION")    ev.location = val.replace(/\\,/g, ",");
    if (key === "DTSTART")     ev.dtstart = icsDateToISO(val);
    if (key === "DTEND")       ev.dtend = icsDateToISO(val);
  }
  return ev.uid && ev.dtstart && ev.dtend && ev.summary ? ev : null;
}

function icsDateToISO(s) {
  // Matches YYYYMMDDTHHMMSSZ or YYYYMMDD
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);
  if (!m) return null;
  const [, y, mo, d, h="00", mi="00", se="00"] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}Z`).toISOString();
}
