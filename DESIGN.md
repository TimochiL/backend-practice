# Backend Practice Platform: Design

Status: draft v3 (2026-10-13): Better Auth replaces Auth.js; versions pinned (§14); dev container environment (§15); sandbox file streaming (§6.2)
Reference material: [product-references.md](product-references.md)

## 1. Goals

| # | Who | Need |
|---|-----|------|
| G1 | User | Pick a framework (Node.js, Django or Spring Boot) and land in a HackerRank-style project IDE. |
| G2 | User | Work through an endless chain of problems. "Next problem" gives a different problem with a similar premise, and it unlocks only after every test passes. |
| G3 | User | Track progress and revisit past problems: active time, completion date, framework, every submission with its files and per-test results, and a "Generate similar" button. |
| G4 | User | An account (GitHub or Google sign-in) so progress and drafts follow them across devices. |
| G5 | Developer | Write **templates** that label problem fields and outline test cases, so a cheap LLM only fills in the blanks. |
| G6 | Developer | Store and cache repo files once, including files that are identical across many problems. |

**Constraint:** free services only. Free tiers are acceptable. Their limits are listed in §11.

**Non-goals for the MVP:** interactive terminal, a long-running app preview, MySQL parity for Spring Boot, proctoring, and multiplayer.

## 2. Architecture

Everything runs on one Oracle Cloud Always Free ARM VM (4 OCPU, 24 GB RAM, up to 200 GB block storage) under Docker Compose.

```
Browser ──HTTPS──> caddy ──> web (Next.js: UI + API routes, Better Auth)
                                  │  inserts jobs / reads results
                                  ▼
                              postgres  <── jobs table (FOR UPDATE SKIP LOCKED)
                                  ▲               ▲
                    runner worker ┘               └ generator worker ──> Gemini API (free tier)
                         │ docker run (one-shot sandbox)
                         ▼
             bp-node / bp-django / bp-spring images (deps pre-baked, --network none)
                    /data/blobs  (content-addressed file store, shared volume)
```

| Service | Role |
|---------|------|
| `caddy` | TLS termination with automatic HTTPS, and reverse proxy to `web`. |
| `web` | Next.js App Router. Serves pages and API routes, handles Better Auth sessions, enqueues jobs, and reads results. Never runs user code. |
| `postgres` | All relational data and the job queue. |
| `runner` | Claims `run`, `submit` and `verify` jobs, materializes a workspace, runs a sandbox container, parses JUnit XML, and writes results. It is the **only** service with the Docker socket. |
| `generator` | Claims `generate` jobs and keeps the problem pool topped up. It calls the LLM, validates, renders, and enqueues `verify` jobs. |
| sandbox images | One per framework, with dependencies pre-installed so runs need no network. |

**Why Postgres as the queue:** one less service to run, and job state sits in the same transaction as the data it changes. Workers claim jobs with:

```sql
UPDATE jobs SET status='running', locked_at=now(), attempts=attempts+1
WHERE id = (
  SELECT id FROM jobs
  WHERE status='queued' AND type = ANY($1)
  ORDER BY priority DESC, created_at
  FOR UPDATE SKIP LOCKED LIMIT 1
) RETURNING *;
```

The browser polls a status endpoint (§8), so no request ever waits on a test run.

## 3. Repo layout

npm workspaces monorepo:

```
apps/web/              Next.js (pages, API routes, Better Auth)
services/runner/       sandbox job worker
services/generator/    LLM slot-filling + verification worker
packages/core/         shared types, manifest + BlobStore, template renderer, JUnit parser
packages/db/           Drizzle schema + migrations
templates/
  base-repos/<framework>/<version>/     shared skeleton projects
  problems/<framework>/<template-id>/   problem templates (see §4)
sandbox-images/{node,django,spring}/Dockerfile
infra/                 docker-compose.yml, Caddyfile, backup script
.devcontainer/         dev environment (see §15)
.github/workflows/     CI (dev container image build)
```

Templates are git-versioned files. A sync script upserts them into the `templates` and `base_repos` tables and the blob store.

## 4. Template system

### 4.1 Principle

**The LLM never writes code.** It fills **slots**, a small JSON object validated against the template's JSON Schema. Deterministic rendering produces every file and every test. That keeps generation cheap (small outputs that fit free-tier quotas) and reliable: a bad output fails validation or verification and is thrown away.

### 4.2 Template folder

```
templates/problems/node/rest-crud-validation/
  template.json          metadata, slot schema, prompt stems, test outlines
  files/                 Mustache templates for starter files + README statement
  tests/                 per-kind test renderers (Mustache) for the framework's test runner
  solution/              reference solution templates (verification only, never served)
```

### 4.3 `template.json` (abridged example)

```json
{
  "id": "node.rest-crud-validation",
  "version": 1,
  "framework": "node",
  "category": "rest-crud-validation",
  "difficulty": "easy",
  "baseRepo": "node-express@1",
  "prompt": {
    "system": "You fill JSON slots for a backend coding exercise. Output only JSON matching the schema.",
    "stems": [
      "Invent a realistic business theme (not e-commerce if the last theme was e-commerce).",
      "The API manages one resource called {{resourceName}} for a {{theme}} business.",
      "Give 3-5 fields; at least one required string, one unique field, one numeric field with a min/max."
    ]
  },
  "slots": {
    "type": "object",
    "required": ["theme", "resourceName", "resourcePath", "fields", "filterField", "storyText", "sampleRecords"],
    "properties": {
      "theme":        { "type": "string", "maxLength": 40 },
      "resourceName": { "type": "string", "pattern": "^[A-Z][a-zA-Z]{2,20}$" },
      "resourcePath": { "type": "string", "pattern": "^[a-z][a-z-]{2,30}$" },
      "fields": {
        "type": "array", "minItems": 3, "maxItems": 5,
        "items": {
          "type": "object",
          "required": ["name", "type", "required"],
          "properties": {
            "name":     { "type": "string", "pattern": "^[a-z][a-zA-Z]{1,20}$" },
            "type":     { "enum": ["string", "integer", "number", "boolean"] },
            "required": { "type": "boolean" },
            "unique":   { "type": "boolean" },
            "min":      { "type": "number" },
            "max":      { "type": "number" }
          }
        }
      },
      "filterField":   { "type": "string" },
      "storyText":     { "type": "string", "maxLength": 600 },
      "sampleRecords": { "type": "array", "minItems": 2, "maxItems": 4, "items": { "type": "object" } }
    }
  },
  "semanticChecks": ["fieldNamesUnique", "filterFieldExists", "hasRequiredString", "hasUniqueField", "minLessThanMax", "sampleRecordsMatchFields"],
  "testOutlines": [
    { "id": "T01", "kind": "create_valid",           "visibility": "visible", "targetsTask": true,  "stem": "creates a {{resourceName}} and returns 201" },
    { "id": "T02", "kind": "list_all",               "visibility": "visible", "targetsTask": false, "stem": "lists all {{resourceName}} records" },
    { "id": "T03", "kind": "missing_required_field", "visibility": "hidden",  "targetsTask": true,  "stem": "rejects a {{resourceName}} without a required field with 400" },
    { "id": "T04", "kind": "blank_string",           "visibility": "hidden",  "targetsTask": true,  "stem": "rejects blank strings with 400" },
    { "id": "T05", "kind": "out_of_range",           "visibility": "hidden",  "targetsTask": true,  "stem": "rejects numeric fields outside [min, max] with 400" },
    { "id": "T06", "kind": "duplicate_unique",       "visibility": "hidden",  "targetsTask": true,  "stem": "rejects duplicate unique values with 409" },
    { "id": "T07", "kind": "filter_by_field",        "visibility": "visible", "targetsTask": true,  "stem": "filters by {{filterField}} via query string" }
  ],
  "files": {
    "src/models/{{resourceName}}.js": { "from": "files/model.js.mustache",  "mode": "editable" },
    "src/routes/{{resourcePath}}.js": { "from": "files/route.js.mustache",  "mode": "editable" },
    "README.md":                      { "from": "files/README.md.mustache", "mode": "readonly" }
  }
}
```

The `kind` of each test outline maps to a renderer in `tests/<kind>.mustache`. One kind library per framework can be shared across templates. Every rendered test name is prefixed with its outline id, e.g. `[T03] rejects a Book without a required field with 400`, so results map back to outlines in every framework.

### 4.4 Generation pipeline (generator worker)

1. **Trigger.** Either the pool for a `(framework, template)` drops below its target (default 3), or a user requests "Generate similar" (a high-priority `generate` job).
2. **Prompt.** Render the stems with recent-theme hints (to avoid repeats) and call the LLM with the slot JSON Schema as structured output.
3. **Validate.** Check the output with Ajv against `slots`, then run the `semanticChecks`. On failure, retry up to 3 times with the error appended to the prompt, then record a `rejected` problem with the reason.
4. **Render.** Mustache renders the starter files, visible tests, hidden tests and solution. New content goes into the blob store.
5. **Verify (quality gate).** Enqueue two `verify` jobs:
   - the reference solution plus all tests must pass **100%**
   - the unmodified starter plus all tests must **fail every outline with `targetsTask: true`**
6. **Publish.** If both checks pass, set `status = 'ready'`. The solution manifest is kept for admins only.

`LlmProvider` is an interface (`generateSlots(prompt, schema) → unknown`). Gemini is the first implementation, and Ollama, Groq or another provider is one new file.

### 4.5 Problem selection

- **Next problem:** a `ready` problem in the same framework that the user has not seen. It prefers a template the user hasn't done recently, and otherwise uses the same template with new slots. The premise stays similar (same genre of task) while the problem itself is new.
- **Generate similar** (from history): the same template and a fresh slot fill. It is served from the pool if one is available, otherwise generated on demand, and the UI shows "generating…".

## 5. Files and caching

### 5.1 Blob store

- Content-addressed: `sha256(content)` → `/data/blobs/sha256/<first-2-hex>/<hash>`.
- `BlobStore` interface: `put(bytes) → hash`, `get(hash)`, `has(hash)`. Local disk comes first, and a Cloudflare R2 implementation (free tier) can be swapped in later.
- The `blobs(hash, size, created_at)` table records what exists, for garbage collection later.
- A `package.json` shared by 10,000 problems is stored **once**.

### 5.2 Manifests

One primitive used everywhere:

```ts
type Mode = "editable" | "readonly" | "hidden";
type ManifestEntry = { path: string; hash: string; mode: Mode };
type Manifest = ManifestEntry[];   // sorted by path
```

- **Problem workspace** = base-repo manifest overlaid with the problem's rendered manifest. A later layer wins on path collision.
- **Submission** = the manifest of the user's editable files at the moment of the attempt. Unchanged files reuse existing hashes, so only edited files create new blobs.
- History diffs compare a submission manifest with the starter manifest by hash.

### 5.3 Caching layers

| Layer | What | How |
|-------|------|-----|
| Browser | file contents | `GET /api/blobs/:hash` returns `Cache-Control: public, max-age=31536000, immutable` and `ETag: <hash>`. Shared base-repo files download once per browser. Hidden blobs require authorization and are served `private`. |
| Sandbox image | dependencies | Each image pre-installs one base repo version's deps (`node_modules`, pip site-packages, `~/.m2`). Base repo version bump = image tag bump. |
| Runner disk | materialized base repos | LRU cache of `base-repo@version` directories. Each run copies that directory and writes only the problem and submission overlay. |

## 6. Execution sandbox (security-sensitive)

### 6.1 Container settings (every job)

```
docker run -i --rm --network none --read-only \
  --tmpfs /work:rw,size=256m --tmpfs /tmp:rw,size=64m \
  --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 256 --memory 1g --cpus 1 \
  bp-<framework>:<version> bp-run      # workspace tar on stdin (§6.2)
```

- The Spring Boot image gets `--memory 1536m` and a 120 s timeout. The others get 60 s. On timeout the runner kills the container and records `timeout`.
- Runner concurrency is 2 sandboxes at a time.
- gVisor (`--runtime runsc`, free) is a later hardening option (step 17).

### 6.2 Moving files in and out: streams, never bind mounts

The runner **never bind-mounts host folders** into a sandbox. All files move through the container's standard streams:

| Stream | Content |
|--------|---------|
| stdin | A tar of the assembled workspace (base repo + problem overlay + user files + hidden tests when allowed). It is unpacked into the `/work` tmpfs. |
| stdout | A tar of `/work/out/` only: `junit.xml` plus any result files. |
| stderr | Install, build and test logs, captured and truncated (§6.4). |

A small entrypoint baked into each sandbox image (`bp-run`) does `tar -x -C /work`, runs the framework's test command with its output sent to stderr, then `tar -c -C /work/out .` to stdout. The runner runs it with `docker run -i …` (§6.1 flags), writes the tar to stdin, and reads at most 8 MB from stdout before killing the container.

**Why:**
- **Paths resolve on the wrong machine.** A bind mount names a path *on the Docker host*. The runner itself runs in a container: the production compose `runner` service, or the dev container in development (§15). A folder it creates at `/tmp/job-123` doesn't exist on the host, so a bind mount would silently mount an empty or wrong folder.
- **Identical everywhere.** Streaming behaves the same on Linux, macOS and Windows hosts, and from inside any container.
- **Smaller attack surface.** User code never sees a host path, and nothing it writes outlives the container. `/work` is tmpfs and the root filesystem is read-only.
- **No cleanup.** There are no temp folders to garbage-collect on the host, and `docker cp` isn't needed (it can't read a tmpfs after the container exits anyway).

### 6.3 Input rules

- A user submission may contain **only paths whose mode is `editable`** in the problem manifest. Anything else is rejected.
- Paths must be relative and normalized, with no `..`, no leading `/`, no backslashes, no NUL, and no symlinks. Limits: per file ≤ 256 KB, total ≤ 2 MB, ≤ 200 files.
- The runner always writes canonical `readonly` files last, so a user cannot override them. `hidden` test files are added **only** for `submit` and `verify` jobs.

### 6.4 Test commands and result format

All stacks emit JUnit XML, which is parsed by one parser in `packages/core`.

| Framework | Test command | Reporter | Test DB |
|-----------|--------------|----------|---------|
| Node | `npx jest --ci` | jest-junit | SQLite in-memory |
| Django | `pytest --junitxml=/work/out/junit.xml` | pytest-django | SQLite |
| Spring Boot | `mvn -o -q test` | Surefire XML | H2 in-memory |

`bp-run` makes sure the JUnit XML ends up in `/work/out/`, e.g. by copying Surefire's `target/surefire-reports/*.xml` there. Logs (stderr) are captured and truncated to 64 KB for display.

### 6.5 Abuse limits

Each user can have one active `run`/`submit` job at a time and at most 60 per hour. `web` enforces this before inserting a job.

## 7. Data model (Drizzle / Postgres)

```
user(id, name, email, email_verified, image, role['user'|'admin'], created_at, updated_at)
session(...), account(...), verification(...)       -- Better Auth core schema (CLI-generated Drizzle)

blobs(hash PK, size, created_at)
base_repos(id PK 'node-express@1', framework, version, manifest jsonb, image_tag)
templates(id, version, framework, category, difficulty, spec jsonb, PK(id, version))

problems(id, template_id, template_version, framework, slots jsonb, title, statement_md,
         starter_manifest jsonb, visible_test_manifest jsonb, hidden_test_manifest jsonb,
         solution_manifest jsonb, status['generating'|'verifying'|'ready'|'rejected'],
         reject_reason, created_at)

problem_sessions(user_id, problem_id, started_at, last_heartbeat_at, active_ms,
                 attempts, completed_at, PK(user_id, problem_id))
drafts(user_id, problem_id, manifest jsonb, updated_at, PK(user_id, problem_id))

submissions(id, user_id, problem_id, kind['run'|'submit'], manifest jsonb,
            status['queued'|'running'|'done'|'error'|'timeout'],
            passed, total, output_excerpt, created_at, finished_at)
test_results(submission_id, test_id, name, visibility, passed, duration_ms, message)

jobs(id, type['run'|'submit'|'verify'|'generate'], priority, payload jsonb,
     status['queued'|'running'|'done'|'failed'], attempts, locked_at, error,
     created_at, finished_at)
```

### Rules the server enforces

- **Time spent.** While the IDE tab is visible, the client sends a heartbeat every 30 s. The server adds `min(now − last_heartbeat_at, 45 s)` to `active_ms`. `started_at` and `completed_at` give wall-clock timestamps.
- **Completion.** The first `submit` with `passed == total` sets `completed_at`.
- **Next-problem gate.** `POST /api/practice/:framework/next` returns 403 unless the current problem's session has `completed_at`.
- **Hidden-test reveal.** Hidden test names, code and messages are returned only when `completed_at` is set. Before that, a submission shows only "Hidden tests: 3 / 5 passed".
- **Stale jobs.** A `running` job with `locked_at` older than its timeout plus a margin goes back to `queued`, until `attempts = 3`, after which it is marked `failed`.

## 8. API (Next.js route handlers)

All routes require a session except Better Auth's own handler at `/api/auth/*`, which covers sign-in, the OAuth callbacks and sign-out. Each route handler checks the session itself via `auth.api.getSession({ headers })`, and never relies on middleware alone.

| Method & path | Purpose |
|---------------|---------|
| `POST /api/practice/:framework/next` | Assign the next problem (gate in §7). Returns `{ problemId }`. |
| `GET  /api/problems/:id` | Statement, merged manifest (minus `hidden` unless completed), and the user's draft. |
| `GET  /api/blobs/:hash` | File content (immutable caching, §5.3). |
| `PUT  /api/problems/:id/draft` | Autosave editable files (debounced client-side). |
| `POST /api/problems/:id/heartbeat` | Active-time tracking. |
| `POST /api/problems/:id/submissions` | `{ kind: 'run'|'submit', files: { path: content } }` → `{ submissionId }`. |
| `GET  /api/submissions/:id` | Status plus per-test results (with the hidden-test rule applied). |
| `POST /api/problems/:id/similar` | Enqueue a "Generate similar" job → `{ jobId }`. |
| `GET  /api/jobs/:id` | Generation job status → `{ status, problemId? }`. |
| `GET  /api/history` | The user's problem sessions with aggregates (filters: framework, completed). |
| `GET  /api/history/:problemId` | Submission timeline with manifests and results. |

All request bodies are validated (Ajv or hand-written guards) before use.

## 9. Pages

| Route | Content |
|-------|---------|
| `/` | Framework picker (three cards). Signed-out users see the sign-in buttons. |
| `/practice/[framework]` | Resolves the current unfinished problem, or calls `next`, then redirects. |
| `/problems/[id]` | IDE layout: statement panel · file tree (readonly 🔒 / hidden badges) · Monaco editor · **Run tests** (visible only) · **Submit** (all) · results panel · **Next problem** (disabled until passed). |
| `/history` | Table: problem title, framework, category, completed date, active time, attempts, best score. |
| `/history/[problemId]` | Submission timeline. Each entry has read-only file views, a diff against the starter, and per-test results, with all tests revealed after a pass. Includes the **Generate similar** button. |
| `/settings` | Connected sign-in methods (GitHub and Google) with **Connect** and **Disconnect** buttons (§10). |
| `/admin` | Role-gated: templates, pool levels per template, rejected generations with reasons. |

## 10. Authentication

We use **Better Auth**. It's open source and runs inside `web`, so there is no hosted auth service or cost. Auth.js was considered and dropped: since Sept 2025 it has been in security-only maintenance under the Better Auth team, its v5 never left beta, and its README points new projects to Better Auth.

**Setup**
- **Sign-in:** GitHub and Google OAuth (both free) are the only sign-in methods. Email/password stays disabled, so we never store credentials.
- **Wiring:** `apps/web/lib/auth.ts` creates the server instance with the Drizzle adapter (`provider: "pg"`), and `app/api/auth/[...all]/route.ts` mounts its handler. Better Auth's CLI generates the Drizzle schema for the core tables into `packages/db`.
- **Sessions:** stored in the database, behind an `httpOnly`, `Secure`, `SameSite=Lax` session cookie. A user signing in on a new device gets a new session row, so progress follows the account rather than the device.
- **Roles:** `role` is a `user.additionalFields` entry with default `'user'` and `input: false`, so a client can never set it during sign-up. Admins are promoted manually in the DB.
- **Account linking:** both modes are enabled explicitly in config, never by relying on library defaults.
  - **Auto-link:** a sign-in from GitHub or Google whose email matches an existing user joins that user, but only if the provider reports the email as **verified**. Only `github` and `google` are trusted providers, and adding a provider later does not make it trusted.
  - **Manual link:** a signed-in user can connect the other provider from `/settings`. This covers GitHub and Google emails that differ. Because it requires an existing session, nothing is matched by email.
  - **Unlink:** allowed only if the user would still have at least one sign-in method left.
  - **Accepted risks:** recycled email addresses, a compromised provider account reaching a linked account, and reliance on each provider's "verified" flag. These are acceptable for practice data with no payments or private information.
- **Rate limiting:** Better Auth's built-in limiter is on for the `/api/auth/*` routes.

**Environment variables** (never committed; `.env.example` lists the names only): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

## 11. Free-tier limits and risks

| Service | Limit or risk | Mitigation |
|---------|---------------|------------|
| Oracle Always Free A1 VM | ARM capacity is often unavailable at sign-up. Idle Always Free instances can be reclaimed. | Retry provisioning across regions and availability domains. Real usage plus the generator keep the VM above the idle threshold. Nightly backups (step 16). |
| Gemini free tier | Per-minute and per-day request caps. Free-tier prompts may be used by Google to improve products. | Small slot-only prompts, a pre-generated pool, and no user data in prompts. The `LlmProvider` interface allows switching. |
| Single VM | No redundancy. | Accepted for the MVP. Services are split so they can be moved later. |
| Docker socket in runner | Compromising the runner compromises the host. | The runner never executes user input itself. Hardened sandboxes, with gVisor later. |

## 12. Build plan

Each step is reviewed before the next begins.

1. DESIGN.md (this document)
2. Scaffold: npm workspaces, Next.js app, shared tsconfig, local Postgres via compose
3. Drizzle schema + first migration
4. Better Auth (GitHub + Google) + protected-route helper + account linking and `/settings` ⚠
5. Blob store + manifests + path validation, with unit tests ⚠
6. Node sandbox image + `node-express@1` base repo
7. Runner worker: claim → materialize → hardened `docker run` → JUnit parse ⚠
8. Template renderer + first Node template, seeded with hand-written slots
9. IDE page: file tree, Monaco, run/submit, polling, draft autosave
10. Framework picker + server-side next-problem gate
11. Progress: heartbeat, history list, attempt detail, hidden-test reveal
12. Generator: Gemini provider, Ajv + semantic checks, rendering, verification gate, pool top-up
13. Generate similar
14. Django image, base repo and template
15. Spring Boot image, base repo and template
16. Deploy to Oracle VM: Caddy, production compose, backups ⚠
17. Hardening: rate limits, gVisor, admin page

## 13. Verification

- **Unit:** path validation (traversal, absolute paths, symlinks, size limits), manifest overlay order, JUnit parser fixtures from all three stacks, template rendering snapshots, Ajv and semantic slot checks.
- **Runner:**
  - the seeded problem's solution scores N/N
  - the starter fails its targeted tests
  - an infinite loop gives `timeout`
  - an outbound HTTP call fails
  - a submitted readonly path is rejected
  - results are identical when the runner runs from the dev container and from the production `runner` service (§6.2)
- **End-to-end (local compose):**
  1. Sign in, pick Node, and fail a submit. "Next problem" stays disabled.
  2. Pass a submit. "Next problem" enables, and history shows the timestamp, active time and all tests.
  3. Sign in from a second browser. The draft and history are there.
  4. Click "Generate similar". A new problem appears after verification.
  5. Sign in with GitHub, then with Google using the same verified email. Both land on one account. Connect a provider whose email differs from `/settings`. Try to disconnect the last remaining provider, which should be refused.
- **Generator:** 10 generations per template, recording the accept/reject rate and the reasons for rejection.

## 14. Pinned versions

Checked against npm, PyPI, Maven Central, nodejs.org and Docker Hub on 2026-10-13. Every dependency is pinned exactly (no `^`/`~`). Sandbox runtimes follow the HackerRank environments in [product-references.md](product-references.md), using the latest patch release of each line.

### 14.1 Host and services

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js (dev container, `web`, workers) | 24.21.0 LTS | Supported to Apr 2028. npm 11.19.0 ships with it. Revisit after Node 26 enters LTS (late Oct 2026). |
| PostgreSQL | 18.6 (`postgres:18.6` image) | Supported to Nov 2030. |
| Docker Desktop (developer machines) | 28+ | The only host requirement besides Git and an editor (§15). |

### 14.2 Platform packages

| Package | Version | Notes |
|---------|---------|-------|
| next | 16.4.0 | Requires Node ≥ 20.9.0. |
| react, react-dom | 19.3.0 | |
| typescript | 5.9.3 | 7.x (the native compiler) is out, but its compatibility with Next.js and drizzle-kit is unverified. |
| better-auth | 1.7.7 | Supports Next 16 and drizzle-orm ^0.45.2. |
| drizzle-orm / drizzle-kit | 0.45.4 / 0.31.11 | |
| pg | 8.23.1 | |
| @monaco-editor/react | 4.7.0 | |
| @google/genai | 2.29.1 | |
| ajv | 8.20.0 | |
| mustache | 4.2.0 | |
| fast-xml-parser | 5.11.2 | |

### 14.3 Sandbox images

| Image | Runtime | Packages |
|-------|---------|----------|
| `bp-node` | Node 24.21.0 | express 5.3.0, jest 30.5.2, jest-junit 17.0.0, supertest 7.3.1, better-sqlite3 13.0.3 (native, compiled at image build) |
| `bp-django` | Python 3.13 | Django 5.2.18 (LTS, supported to Apr 2028), djangorestframework 3.18.3, pytest 9.1.1, pytest-django 4.14.0 |
| `bp-spring` | Java 25 LTS, Maven 3.9.16 | Spring Boot 4.1.1 (4.0's free support ends 2026-12-31). H2 and JUnit 5 versions come from Boot's dependency management. |

The exact patch versions of the image base tags (Python 3.13.x, Temurin 25.x) are pinned when each Dockerfile is written (steps 6, 14 and 15).

### 14.4 Dev environment and CI

| Component | Version | Notes |
|-----------|---------|-------|
| Dev container base image | `node:24.21.0-trixie` | Debian 13. npm 11.19.0 is bundled. |
| docker-outside-of-docker feature | 1.10.1 | Locked by digest in `.devcontainer/image/devcontainer-lock.json`. |
| Docker CLI (in the dev container) | 29.9.0 | Docker CE packages (`moby: false`; Moby has no trixie builds). |
| Compose plugin (in the dev container) | not pinned | Whatever is current at image build. Each image tag is built once and never overwritten, so a given tag is still reproducible. |
| Dev image | `ghcr.io/timochil/backend-practice-dev:1` | Public. Tag set in `.devcontainer/devcontainer.json`. |
| @devcontainers/cli | 0.89.0 | Local image test builds only, via `npx` (not a project dependency). |
| GitHub Actions | checkout 7.0.1, setup-qemu 4.4.0, setup-buildx 4.4.1, login 4.6.0, devcontainers/ci 0.3.1900000450 | Pinned to commit SHAs in the workflow. |

## 15. Development environment

All development happens in a **dev container** (`.devcontainer/`). Contributors need only Git, Docker and a dev-container-capable editor. Setup steps for people are in [SETUP.md](SETUP.md). This section records the design decisions.

### 15.1 Image and configs

- **Two configs, one image.**
  - `.devcontainer/devcontainer.json` (what developers open) only names the published image.
  - `.devcontainer/image/` (Dockerfile + `devcontainer.json`) is the single source of truth for the image's contents. Its settings (non-root `node` user, port 3000, extensions, the Docker feature's mounts and entrypoint) are baked into the image's `devcontainer.metadata` label, so the developer config needs nothing else.
- **CI** (`.github/workflows/devcontainer-image.yml`) builds `linux/amd64` + `linux/arm64` and pushes to GHCR. A separate job then verifies both platforms were published.
- **Immutable tags.** CI refuses to push a tag that already exists. Any change to the image needs a new tag in the developer config, committed alongside it. That gives a reproducible environment per tag, rollback by changing the tag back, and no silent drift from rebuilds.

### 15.2 Docker from inside the dev container

The dev container uses the **host's** Docker daemon (docker-outside-of-docker). Anything it starts, such as Postgres via compose or the code sandboxes, is a *sibling* container on the host, not a child. Consequences:

1. **No host-path bind mounts from inside the dev container.** Docker resolves mount paths on the host, where `/workspaces/backend-practice/...` doesn't exist.
   - Compose files use **named volumes only**, e.g. `pgdata:/var/lib/postgresql/data`, never `./data:/…`.
   - The runner streams files to sandboxes (§6.2).
2. **Networking.** `localhost` inside the dev container is the dev container itself, not the host or compose services. How the app reaches Postgres in development (publishing the port and connecting via `host.docker.internal`, or attaching the dev container to the compose network) is decided in build step 2. On Linux hosts, `host.docker.internal` needs `--add-host=host.docker.internal:host-gateway`.
3. **Security.** Code running in the dev container controls the host's Docker, including other projects' containers. This is accepted for trusted repo code and documented for contributors in SETUP.md.

### 15.3 Dev vs production layout

| | Development | Production (§2) |
|---|---|---|
| `web`, `runner`, `generator` | Run directly in the dev container (npm scripts) | Compose services |
| Postgres | Compose service, started from the dev container | Compose service |
| Sandboxes | Sibling containers on the developer's Docker | Sibling containers on the VM's Docker |
| Docker access for the runner | The dev container's host socket | The `runner` service's mounted socket |

In both columns the runner is a container talking to the host daemon, which is why §6.2's streaming rule covers both.

