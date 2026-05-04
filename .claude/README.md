# .claude — Project Configuration for Claude Code

This folder configures Claude Code's behavior when working on AI Workspace. Every file here exists to address a specific pattern identified in your Claude Code Insights report.

## File Map

```
.claude/
├── CLAUDE.md                      # Root project context — loaded every session
├── settings.json                  # Hooks + permissions (post-edit validation)
├── commands/                      # Slash commands — type /name to run
│   ├── phased.md                  # /phased — force phased build plan before coding
│   ├── investigate.md             # /investigate — verify env state before changes
│   ├── tdd.md                     # /tdd — test-driven workflow
│   └── self-heal.md               # /self-heal — autonomous deploy loop
├── skills/                        # Skills — Claude auto-invokes these by trigger
│   ├── deploy/SKILL.md            # Structured deploy + verification
│   ├── health-check/SKILL.md      # Lightweight status check
│   └── review-spec/SKILL.md       # Thorough first-pass spec review
└── agents/                        # Sub-agents — specialized contexts
    ├── infra-specialist.md        # Docker / Caddy / VPS
    ├── app-developer.md           # Node / Next / SQL
    └── code-reviewer.md           # Pre-ship bug audit
```

## How They Map to Your Friction Points

| Report finding | Fix in this folder |
|---|---|
| Claude assumes wrong paths on VPS | `CLAUDE.md` environment section + `/investigate` |
| Fictitious image tags / wrong configs | `/investigate` + `infra-specialist` agent |
| Marathon sessions accumulate bugs | `/phased` + `/tdd` commands |
| Late-surfacing bugs (BigInt, timestamps) | `code-reviewer` agent + `settings.json` hooks |
| SWC SIGBUS rediscovered every session | `CLAUDE.md` known-quirks list |
| Post-deploy issues found manually | `skills/deploy` + `skills/health-check` |
| Spec reviews miss integrations on first pass | `skills/review-spec` |

## Daily Usage

- **Starting a feature:** type `/phased` first. Claude proposes phases, you approve, it builds.
- **Starting infrastructure work:** type `/investigate` first. Claude verifies state before acting.
- **Deploying:** the `deploy` skill auto-triggers on words like "deploy" or "ship." No command needed.
- **Before committing:** invoke the `code-reviewer` agent to audit the diff.
- **Server feels off:** type something like "check the stack" — the `health-check` skill auto-triggers.
- **Something's broken and you want it fixed hands-off:** type `/self-heal`.

## Maintenance

Update `CLAUDE.md` whenever you discover a new platform quirk or change a deployment assumption. The goal is that Claude never has to rediscover a problem it already caused once.

The hooks in `settings.json` will run automatically after every edit. If one becomes noisy, edit it — don't let it train you to ignore output.
