---
description: Autonomous deploy-diagnose-fix loop — attempts up to 5 cycles per failing service
---

Deploy the docker-compose stack autonomously. Your mission is to bring every service to a healthy state without asking me for help during the loop.

**Cycle steps (repeat per failing service, up to 5 times):**

1. `docker compose up -d` if containers aren't running yet
2. `docker compose ps` to identify unhealthy or exited services
3. For each failing service:
   - `docker logs <n> --tail 50` to gather evidence
   - Diagnose the root cause. Look for: port conflicts (`EADDRINUSE`), permission/UID mismatches (`permission denied`), missing env vars (`undefined is not a function`, `null reference`), wrong image tags (`pull access denied`, `manifest unknown`), base URL misconfigurations, Redis/Postgres hostname resolution, read-only mount issues, SWC SIGBUS (use WASM fallback)
   - Apply the smallest possible fix. Prefer editing `.env.example` or `docker-compose.yml` over container-level hacks.
   - `docker compose up -d <service>` to restart just that service
   - Wait 10 seconds, then re-check health

4. Log every cycle: what failed, what you diagnosed, what you tried, what happened.

**Stop conditions:**
- All services healthy → report success
- 5 cycles on one service → stop that loop and report the service as needing human intervention
- Any request for destructive action (volume delete, schema reset) → stop and ask me

**Final report format:**
- Services that came up clean (list)
- Services that required fixes (list with 1-line description of the fix applied)
- Services that need human intervention (list with the last error observed)
- Any changes you made to files that I should review before committing

Do not mark success until `docker compose ps` shows every service `healthy` or `running`, and `curl http://localhost:4000/health` returns 200.
