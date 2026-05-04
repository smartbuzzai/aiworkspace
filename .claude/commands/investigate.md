---
description: Investigate actual state before proposing changes (no assumptions)
---

Before proposing any change, run these investigation commands and report results. Do not skip any.

1. **Where am I:** `pwd && whoami && hostname`
2. **What's running:** `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'`
3. **Compose state:** `docker compose ps`
4. **Relevant files exist:** `ls -la <paths mentioned in my request>`
5. **Current content of relevant files:** `cat` or `head -50` on each
6. **Recent errors:** `docker logs <service> --tail 30` for any service related to my request
7. **Config validity:** `docker compose config --quiet`

After all seven steps, propose your plan. The plan must reference actual observed state, not assumptions about what "should" be there.

This exists because you have previously assumed wrong paths (/opt/hermes vs /root/.hermes), assumed containers weren't running when they were, and proposed fictitious image tags. Investigation eliminates that class of error.
