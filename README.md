# clashperk-backend

The backend for ClashPerk — a **NestJS monorepo** (pnpm, Node 22) with two apps:

- **`apps/api`** — the HTTP API (default project). The read/query/export layer
  over data the Discord bot and trackers produce; serves the web dashboard, and
  the bot will move onto these endpoints over time. Versioned routing (`/v1`,
  `/v2`); Swagger UI at `/docs`.
- **`apps/worker`** — the tracking worker: a clustered, Redis-pub/sub-driven
  poller for clans/players/wars/capital/rankings, writing to
  MongoDB/ClickHouse/Elasticsearch and publishing changes to the bot over Redis.

Shared code lives in `libs/*` and is imported via `@app/*` aliases.
Remote: `clashperk/service-backend`.

## Develop

```bash
pnpm install
pnpm start:dev          # api app, watch mode
nest start worker --watch   # worker app
pnpm build              # runs the prebuild index generator, then nest build
pnpm lint               # eslint --fix (type-checked + module-boundary rules)
pnpm test               # vitest
```

Config is env (`.env` via `@nestjs/config`); required vars use
`configService.getOrThrow(...)` — JWT/cookie/API secrets, the datastore URLs
(dual `MONGODB_*` + `GLOBAL_MONGODB_*`, `GO_REDIS_URL`), `CLASH_API_*`, Discord,
Google and Turnstile credentials. See the CLAUDE.md for the full list.

## Notes

- Don't hand-edit `index.ts` barrel files — `scripts/make-index.ts` regenerates
  them on every build.
- `apps/api` and `apps/worker` must never import each other; `libs/**` must never
  import from `apps/**` (ESLint-enforced).
- Every PR bumps the `package.json` version (patch unless told otherwise).

See [CLAUDE.md](CLAUDE.md) for architecture, auth, data layer, and conventions.
