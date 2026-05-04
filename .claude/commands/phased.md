---
description: Break the current task into verifiable phases before executing
---

Before writing any code for this task, do the following:

1. Restate my goal in one sentence.
2. Propose 3-7 phases that decompose the work. Each phase must be independently verifiable. A good phase has a clear start state, a clear end state, and a 1-line acceptance check I can run myself.
3. For each phase, list the files you expect to create or modify and the specific verification command (e.g., `curl localhost:4000/health`, `docker logs api --tail 20`, `npm run build`).
4. Identify the single phase with the highest risk of breaking something else, and explain why.
5. Stop. Do not implement anything yet.

I will reply with "proceed with phase 1" or with changes to your plan.

This workflow exists because marathon single-session builds (270+ files) accumulate bugs that surface late. Phased verification catches them at each layer instead of at the end.
