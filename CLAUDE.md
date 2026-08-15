# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm**. Node 22.

```bash
pnpm install              # install deps
pnpm start:dev           # run the `api` app in watch mode (default project)
pnpm start:debug         # watch mode with --inspect
pnpm build               # nest build (runs `prebuild` first — see Auto-generated index files)
pnpm lint                # eslint --fix across {src,apps,libs,test}
pnpm format              # prettier --write over apps/ and libs/
pnpm test                # jest (unit, *.spec.ts)
pnpm test:watch
pnpm test:cov            # coverage
```

`nest start`/`nest build` operate on the **`api`** project by default. To target the worker app: `nest start worker` (add `--watch` for dev) / `nest build worker`. The worker's compiled entry is `dist/apps/worker/apps/worker/src/main.js` (the path is nested because the worker transitively pulls `apps/api/.../wars/dto` in via `@app/clash-client` — see Tracking worker).

Run a single test file or pattern:

```bash
pnpm test path/to/file.spec.ts
pnpm test -- -t "describe or it name"
```

Tests live next to source as `*.spec.ts`; jest `roots` are `libs/` and `apps/`. `@app/*` path aliases are mapped in the jest config (`moduleNameMapper`) — keep that map in sync with `tsconfig.json` `paths` when adding a new lib.

## Architecture

This is a **NestJS monorepo** (`nest-cli.json`, `"monorepo": true`) backing the ClashPerk Discord bot's web/API services. It is the read/query and export layer over data primarily produced elsewhere (the Discord bot writes most collections; this service mostly reads, aggregates, and serves them).

### Projects (`nest-cli.json`)

- `apps/api` — the main HTTP application (default project, entry `apps/api/src/main.ts`).
- `apps/worker` — the **tracking worker** (the former standalone "tracking-service"). A clustered, Redis-pub/sub-driven poller that tracks Clash of Clans clans/players/wars/capital/rankings and writes to MongoDB/ClickHouse/Elasticsearch. See "Tracking worker" below.
- `libs/clash-client`, `libs/discord-oauth`, `libs/google-sheet` — Nest library projects.
- `libs/constants`, `libs/decorators`, `libs/dto`, `libs/helpers`, `libs/interceptors` — plain shared TS, imported via `@app/*` aliases.

Import shared code with the `@app/*` aliases (e.g. `import { Cache } from '@app/decorators'`), never via relative paths into `libs/`.

### Feature module convention (`apps/api/src/<feature>/`)

Each feature is a standard Nest triad: `*.module.ts`, `*.controller.ts`, `*.service.ts`, plus a `dto/` folder and sometimes a `services/` subfolder for helper services. Controllers are thin and delegate to services; services hold DB access and Clash API calls. Modules are registered in `apps/api/src/app.module.ts`. Features: `auth`, `clans`, `players`, `legends`, `wars`, `rosters`, `links`, `users`, `guilds`, `tasks`, `exports`, `metrics`, `webhook`.

### Data layer (`apps/api/src/db/`)

All data clients are `@Global()` modules providing **injection tokens**, not repository classes. Inject the raw driver via `@Inject(TOKEN)`:

- **Two MongoDB databases.** `MONGODB_TOKEN` (primary, app data) and `GLOBAL_MONGODB_TOKEN` (separate "global" clan/player dataset). Both are raw `mongodb` `Db` instances. Collections are referenced through the `Collections` enum; `db.collection(Collections.X)` is **strongly typed** via a `declare module 'mongodb'` augmentation mapping enum members to entity types in `db/collections/*.entity.ts`. When adding a collection, add the enum member, the entity, and the `CollectionRecords` mapping together.
- **ClickHouse** — `CLICKHOUSE_TOKEN` (`@clickhouse/client`), used for high-volume analytics (legend/battle logs, rankings).
- **Redis** — multiple ioredis clients: `REDIS_TOKEN` (main), `REDIS_PUB_TOKEN`/`REDIS_SUB_TOKEN` (pub/sub), and `GO_REDIS_TOKEN` (a separate Redis instance shared with a Go service, `GO_REDIS_URL`). Bull queues use `REDIS_URL` db **1**; the cache-manager store uses db **2**.

### Auth & authorization (`apps/api/src/auth/`)

- **JWT** via passport (`JwtStrategy`, strategy name `jwt`). Tokens accepted from `Authorization: Bearer` or `x-access-token` header. `validate()` calls `AuthService.revalidateJwtUser`, which rejects blocked users (Redis `USER_BLOCKED:*`) unless they are ADMIN.
- **`JwtAuthGuard`** is the standard controller guard. It also supports a **master API key bypass**: a request carrying the correct `x-api-key` (header/query/cookie) is authenticated as a synthetic `fallbackUser`, optionally impersonating `x-user-id`. The `@Public()` decorator skips auth entirely.
- **`ApiKeyGuard`** (separate from the bypass) protects internal endpoints like `/tasks` — requires `x-api-key` to equal `API_KEY`.
- **`RolesGuard`** + `@Roles(...)` enforce `UserRoles`; ADMIN bypasses all checks. It also enforces **per-guild access**: if a request carries a `guildId` (param/body/query) not in the JWT's `guildIds`, it throws `GUILD_ACCESS_FORBIDDEN`.
- Login flows: passkey login, Cloudflare **Turnstile** login, Discord-OAuth-backed token generation, and short-lived **handoff tokens** (Redis-stored, used to hand a Discord bot user off to the web app).

### Cross-cutting decorators & interceptors

- `@Cache(seconds)` (`@app/decorators`) — **production-only** HTTP response caching via `HttpCacheInterceptor` (cache-manager → Redis db 2) plus `Cache-Control` headers. In non-prod it just sets `no-cache`. Cache key is the URL (GET) or path+body-hash. A user's `cacheMultiplier` can extend TTL.
- `@CronTab(cronTime, { monitor })` (`@app/decorators`) — wraps `@nestjs/schedule` `Cron` + Sentry cron monitoring, fixed to UTC. **Cron jobs are disabled in production unless `CRONJOB_ENABLED=1`** (`Config.CRON_ENABLED`).
- Global: `HttpTimeoutInterceptor`, `SentryUserInterceptor`, `HttpExceptionsFilter`, `HttpLoggingMiddleware`, and a custom logger. Errors are normalized to `ErrorResponseDto` with `ErrorCodes` (`@app/dto`).

### Clash of Clans API (`libs/clash-client`)

`ClashClientService` wraps `clashofclans.js`. Methods come in two flavors: nullable (`getClan` returns `null` on miss) and `*OrThrow` (throws `NotFoundException`). `KeyGenService` auto-generates API keys at startup from a developer account (`DEV_ACCOUNT_EMAIL`/`DEV_ACCOUNT_PASSWORD`) when present, otherwise falls back to `CLASH_API_TOKENS`. Player/clan tags follow `TAG_REGEX` (`@app/constants`).

### API surface & docs

- Versioned URI routing (`/v1`, `/v2`) enabled globally; default versions are `1` and `2`.
- Swagger UI at **`/docs`** (JSON at `/docs/json`). Routes flagged `x-internal` are hidden from the public document unless the request presents the API key; `@ApiExcludeTypings()` / `x-typings-ignored` further filter the generated typings doc. Use `@ApiExcludeRoute()` for internal-only endpoints (e.g. `/tasks`).

### Tracking worker (`apps/worker`)

A separate Nest application, **not** an HTTP API in spirit — it exposes only `/`, `/health`, `/metrics` and otherwise runs background pollers.

- **Clustering**: `apps/worker/src/main.ts` manually forks the node `cluster` module (`numCPUs` = 4 in prod, 1 otherwise, from `@app/helpers`). Work is sharded across forks by `isValidWorker(uniqueId)` (`id % numCPUs === cluster.worker.id - 1`). Every fork runs its own schedulers/loops.
- **Event-driven**: built on `@nestjs/event-emitter` (`EventEmitter2` is re-exported as `Emitter` in `util/emitter.ts`; `@OnEvent` handlers everywhere). The `WorkerEvents` enum (in `@app/constants`) is the in-process event contract.
- **Redis pub/sub integration boundary**: subscribes to `RedisChannels.CLAN_ADDED`/`CLAN_REMOVED` and publishes all `*_UPSTREAM` events to `RedisChannels.UPSTREAM_FEED` (consumed by the Discord bot). `RedisChannels`, `Flags` op-codes, and `WarType` values are a cross-process payload contract — never change their values.
- **App-private datastores**: the worker has its **own** `apps/worker/src/db` (do not reuse `apps/api/src/db`). It adds an **Elasticsearch** client (`ELASTIC_TOKEN`, `clan_event_logs`/`clan_member_event_logs` indices) that the api has no concept of, and its own `Collections` enum (~30 members the api lacks: `CLANS`, `WARS`, `*_RANKS`, `PLAYER_SEASONS`, `*_LOGS`, `REMINDERS`, etc.). It uses the same Mongo/ClickHouse/Redis env vars as the api but does **not** use `GO_REDIS`.
- **Tracking is gated by env flags** (each `=== '1'`): `CLAN_TRACKING`, `PLAYER_TRACKING`, `WAR_TRACKING`, `CAPITAL_TRACKING`, `RANKING_TRACKING`; `DEBUG` toggles verbose logs. Extra env the api doesn't need: `ES_HOST`, `ES_PASSWORD`, `ES_CA_CRT`, `SENTRY_DSN`.
- **Shared libs**: the worker consumes the same `@app/*` libs as the api. `Season` (with override-window logic) is the single source of truth in `@app/clash-client` — both apps must agree on the current `seasonId` since they read/write the same season-keyed documents. The worker keeps a self-contained `HttpLoggingMiddleware` under `apps/worker/src/util` rather than the api-coupled one in `@app/interceptors`.

## Auto-generated index files (important)

`scripts/make-index.ts` runs automatically as the **`prebuild`** step. It **regenerates every `index.ts`** (barrel file) under `src/` and `libs/` in any directory that already contains an `index.ts`, exporting all sibling `.ts` files. Consequences:

- Do **not** hand-edit `index.ts` barrel files — changes are overwritten on the next `build`. Add/rename the actual source file instead and the export is picked up.
- A new directory only gets a barrel if you create an initial `index.ts` in it.

## Module boundaries (ESLint-enforced)

Three layers — `apps/api`, `apps/worker`, `libs` — with directed import rules enforced by a custom flat-config rule (`boundaries/no-cross-layer-import` in `eslint.config.mjs`):

- `apps/api` and `apps/worker` are **independent services** and must never import each other. Share code through a lib (`@app/*`).
- `libs/**` must never import from `apps/**` (libraries are lower-level shared code). If a lib needs something from an app, move that code into a lib instead — e.g. `UserRoles` lives in `@app/dto` and entities in `@app/collections` precisely so `libs/collections` stays app-free.

Only relative imports can cross these boundaries (apps have no `@app/*` alias), so the rule resolves each relative import to an absolute path and classifies both ends. Violations are errors.

## Conventions & gotchas

- TZ is forced to UTC at process start (`main.ts`); all cron/scheduling assumes UTC.
- TypeScript is `nodenext` module/resolution and only **partially strict** (`strictNullChecks` on; `noImplicitAny`, `strictPropertyInitialization`, `strictBindCallApply` off). ESLint runs **type-checked** rules; `*.controller.ts` files additionally require explicit return types on every method.
- Config comes from `.env` (loaded via `dotenv` + `@nestjs/config`, global). Prefer `configService.getOrThrow(...)` for required vars (the established pattern). Required keys include the JWT/cookie/API secrets, the three datastores' URLs (note the dual `MONGODB_*` and `GLOBAL_MONGODB_*`, plus `GO_REDIS_URL`), `CLASH_API_*`, Discord, Google, and Cloudflare Turnstile credentials.
- Deployment: multi-stage `Dockerfile` (pnpm build → prod prune), shipped to ECR and run via `docker-compose.yml`. Sentry is initialized first thing in `main.ts` via `sentry.instrument.ts`.
