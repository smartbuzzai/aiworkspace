import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp, createTestUser, cleanup } from "./helpers.js";

describe("Contacts CRUD", () => {
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

  let contactId;

  it("POST /contacts — creates a contact", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/contacts",
      headers: { cookie },
      payload: {
        name: "Jane Doe",
        email: "jane@example.com",
        company: "Acme Inc",
        role: "CEO",
        status: "hot",
        score: 85,
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.contact.name, "Jane Doe");
    assert.equal(body.contact.status, "hot");
    assert.equal(body.contact.score, 85);
    contactId = body.contact.id;
  });

  it("GET /contacts — lists contacts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/contacts",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    assert(res.json().contacts.some(c => c.id === contactId));
  });

  it("GET /contacts?q= — searches contacts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/contacts?q=Jane",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    assert(res.json().contacts.some(c => c.name === "Jane Doe"));
  });

  it("GET /contacts/:id — returns contact with interactions", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/contacts/${contactId}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.contact.id, contactId);
    assert(Array.isArray(body.interactions));
  });

  it("PATCH /contacts/:id — updates a contact", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/contacts/${contactId}`,
      headers: { cookie },
      payload: { company: "New Corp", score: 90 },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().contact.company, "New Corp");
    assert.equal(res.json().contact.score, 90);
  });

  it("DELETE /contacts/:id — removes a contact", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/contacts/${contactId}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
  });
});
