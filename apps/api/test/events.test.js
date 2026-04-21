import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp, createTestUser, cleanup } from "./helpers.js";

describe("Events CRUD", () => {
  let app, query, db, user, cookie;

  before(async () => {
    ({ app, query, db } = await buildApp());
    ({ user, cookie } = await createTestUser(query));
  });

  after(async () => {
    await cleanup(query, user.id);
    await app.close();
    await db.end();
  });

  let eventId;
  const tomorrow = new Date(Date.now() + 86400000);
  const startsAt = new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString();
  const endsAt = new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString();

  it("POST /events — creates an event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/events",
      headers: { cookie },
      payload: {
        title: "Team standup",
        starts_at: startsAt,
        ends_at: endsAt,
        location: "Zoom",
        event_type: "meeting",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.event.title, "Team standup");
    assert.equal(body.event.location, "Zoom");
    assert.equal(body.event.event_type, "meeting");
    eventId = body.event.id;
  });

  it("GET /events — lists events", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/events",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    assert(res.json().events.some(e => e.id === eventId));
  });

  it("GET /events?from=&to= — filters by date range", async () => {
    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await app.inject({
      method: "GET",
      url: `/events?from=${from}&to=${to}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    assert(res.json().events.some(e => e.id === eventId));
  });

  it("PATCH /events/:id — updates an event", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/events/${eventId}`,
      headers: { cookie },
      payload: { title: "Updated standup", location: "Office" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().event.title, "Updated standup");
    assert.equal(res.json().event.location, "Office");
  });

  it("DELETE /events/:id — removes an event", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/events/${eventId}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);

    const list = await app.inject({
      method: "GET",
      url: "/events",
      headers: { cookie },
    });
    assert(!list.json().events.some(e => e.id === eventId));
  });
});
