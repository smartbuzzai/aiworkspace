---
description: Test-driven implementation workflow — tests first, code second, iterate to green
---

Follow this workflow strictly for the feature I am about to describe.

**Phase 1 — Spec**
Restate the feature in your own words. List the specific behaviors that must work.

**Phase 2 — Test design**
Before writing implementation code, write a test file that covers:
- API endpoint contracts — correct status codes, response shapes, validation errors
- Serialization edge cases — BigInt, TIMESTAMPTZ, UUIDs, null fields
- Dependency injection correctness — every service the route needs is actually passed in
- Auth middleware — both 401 (unauthenticated) and 200 (authenticated) paths
- Boundary conditions — empty arrays, missing optional fields, oversized inputs

Save the test file. Confirm it fails (red).

**Phase 3 — Implementation**
Write the minimum code to make each test pass. One test at a time.

**Phase 4 — Run tests**
Show the test output. For each failure, read the error, fix the code, rerun.

**Phase 5 — Report**
Summarize what broke and how you fixed it. Identify any test cases that revealed a design flaw in the original spec.

This exists because the bug classes that bit us hardest — BigInt serialization, timestamp precision, Express route ordering, wrong dependency injection — are all catchable by tests. Red-green-refactor keeps the debugging loop inside your head instead of dumping it on me at runtime.
