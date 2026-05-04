# Review Spec

Use this skill when the user asks you to review, analyze, audit, or give feedback on a spec document, roadmap, PRD, build plan, or requirements file. Also trigger when the user uploads or links a document and asks "what do you think" or "anything missing."

The insights report flagged that first-pass spec reviews miss external integrations, cross-service communication, and third-party dependencies — the user had to re-prompt for these. This skill forces a complete pass on the first try.

## The Flow

### Step 1 — Read the full document
Do not summarize from the title, heading list, or introduction alone. Read the entire document before writing a single sentence of analysis.

### Step 2 — Classify the document type
One of: PRD, roadmap, technical spec, build plan, requirements, architecture doc, or RFC. The review dimensions vary by type but the checklist below applies to all of them.

### Step 3 — Apply this 10-point checklist to every spec

Do not skip any. If an item is not addressed in the spec, flag it as a gap.

1. **Scope boundaries** — what's in, what's out, what's deferred to a later version
2. **External integrations** — every third-party API, SaaS, protocol, OAuth provider, webhook consumer or producer
3. **Cross-service communication** — which internal services talk to each other, via what protocol, with what auth
4. **Data model** — entities, relationships, storage engine, migration path
5. **Auth and authz** — identity provider, session model, permission boundaries, multi-tenancy assumptions
6. **Failure modes** — what happens when a dependency is down, rate-limited, slow, or returns bad data
7. **Deployment constraints** — host OS, container runtime, resource limits, known platform quirks
8. **Secret management** — where secrets live, how they rotate, who has access
9. **Observability** — logs, metrics, traces, alerts, and who gets paged when
10. **Non-functional requirements** — latency targets, throughput, uptime, backup cadence, retention

### Step 4 — Apply project-specific checks for AI Workspace

If the spec touches this project, also verify:

- Compatible with Contabo VPS (6 vCPU, 16 GB RAM)
- No dependencies that would require a paid SaaS tier
- No LLM assumption other than Ollama or Groq free tier
- No SWC-dependent frontend tooling without a WASM fallback plan
- No self-hosted SMTP proposal
- Respects the existing `apps/{api,web,workers}` split

### Step 5 — Structure the output

Deliver the review in this shape:

**Summary** — 2-3 sentences on what the spec does well and its single biggest gap.

**Strengths** — 3-5 specific things done right. Cite section or line numbers.

**Gaps** — for each checklist item that's missing or underspecified:
- what's missing
- why it matters for this project
- what the spec should say instead

**Risks** — things that are in the spec but will fail in practice. Include the specific failure mode.

**Questions** — anything ambiguous that needs a decision before implementation starts.

### Step 6 — Do not

- Do not give vague feedback like "consider adding more detail." Name the exact section and the exact missing item.
- Do not rewrite the spec unless asked.
- Do not declare the spec "ready to build" unless every gap is either closed or explicitly accepted.
