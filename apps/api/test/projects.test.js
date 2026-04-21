import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { buildApp, createTestUser, cleanup } from "./helpers.js";

describe("Projects CRUD", () => {
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

  let projectId;

  it("POST /projects — creates a project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/projects",
      headers: { cookie },
      payload: { name: "Website Redesign", stage: "discovery", color: "#10b981" },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.project.name, "Website Redesign");
    assert.equal(body.project.stage, "discovery");
    projectId = body.project.id;
  });

  it("GET /projects — lists active projects with task counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/projects",
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    const proj = body.projects.find(p => p.id === projectId);
    assert(proj);
    assert.equal(proj.task_count, "0");
  });

  it("PATCH /projects/:id — updates stage and progress", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/projects/${projectId}`,
      headers: { cookie },
      payload: { stage: "in_progress", progress: 40 },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().project.stage, "in_progress");
    assert.equal(res.json().project.progress, 40);
  });

  it("POST /tasks — creates a task linked to project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/tasks",
      headers: { cookie },
      payload: { title: "Design mockup", project_id: projectId, priority: "high" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().task.project_id, projectId);

    // Verify task count incremented
    const proj = await app.inject({
      method: "GET",
      url: "/projects",
      headers: { cookie },
    });
    const p = proj.json().projects.find(p => p.id === projectId);
    assert.equal(p.task_count, "1");
  });

  it("DELETE /projects/:id — archives (soft delete)", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}`,
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);

    // Should not appear in active list
    const list = await app.inject({
      method: "GET",
      url: "/projects",
      headers: { cookie },
    });
    assert(!list.json().projects.some(p => p.id === projectId));
  });
});
