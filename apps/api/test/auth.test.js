import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp, createTestUser, cleanup } from "./helpers.js";

describe("Auth routes", () => {
  let app, query, db;

  before(async () => {
    ({ app, query, db } = await buildApp());
  });

  after(async () => {
    await app.close();
    await db.end();
  });

  it("POST /auth/request — issues a magic link", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/request",
      payload: { email: `authtest-${Date.now()}@test.local` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
  });

  it("POST /auth/verify — rejects invalid token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/verify",
      payload: { token: "invalid_token_that_does_not_exist_at_all" },
    });
    assert.equal(res.statusCode, 400);
  });

  it("GET /auth/me — returns user with valid session", async () => {
    const { user, cookie } = await createTestUser(query);

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.user.email, user.email);

    await cleanup(query, user.id);
  });

  it("GET /auth/me — rejects without cookie", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
    });
    assert.equal(res.statusCode, 401);
  });

  it("GET /auth/sessions — lists active sessions", async () => {
    const { user, cookie } = await createTestUser(query);

    const res = await app.inject({
      method: "GET",
      url: "/auth/sessions",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert(Array.isArray(body.sessions));
    assert(body.sessions.length >= 1);
    assert(body.sessions.some(s => s.is_current));

    await cleanup(query, user.id);
  });

  it("POST /auth/logout — clears session", async () => {
    const { user, cookie } = await createTestUser(query);

    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);

    // Session should now be invalid
    const res2 = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie },
    });
    assert.equal(res2.statusCode, 401);

    await cleanup(query, user.id);
  });
});
