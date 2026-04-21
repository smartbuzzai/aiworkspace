import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp, createTestUser, cleanup } from "./helpers.js";

describe("Tasks CRUD", () => {
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

  let taskId;

  it("POST /tasks — creates a task", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      headers: { cookie },
      payload: { title: "Test task", priority: "high" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.task.title, "Test task");
    assert.equal(body.task.priority, "high");
    assert.equal(body.task.status, "open");
    taskId = body.task.id;
  });

  it("GET /tasks — lists tasks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/tasks",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert(Array.isArray(body.tasks));
    assert(body.tasks.some(t => t.id === taskId));
  });

  it("PATCH /tasks/:id — updates a task", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: { status: "done" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.task.status, "done");
    assert(body.task.completed_at); // should be set when status=done
  });

  it("PATCH /tasks/:id — rejects invalid priority", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/tasks/${taskId}`,
      headers: { cookie },
      payload: { priority: "urgent" },
    });
    assert(res.statusCode >= 400);
  });

  it("DELETE /tasks/:id — removes a task", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/tasks/${taskId}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);

    // Verify it's gone
    const list = await app.inject({
      method: "GET",
      url: "/tasks",
      headers: { cookie },
    });
    assert(!list.json().tasks.some(t => t.id === taskId));
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/tasks" });
    assert.equal(res.statusCode, 401);
  });
});
