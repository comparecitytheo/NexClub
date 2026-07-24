# NexLink

A multi-tenant, lead-sharing CRM for a business club. Members send leads to
each other; recipients work them through a Kanban pipeline. Built on Next.js
(App Router), TypeScript, Prisma + PostgreSQL, Auth.js, Cloudinary storage, and
the Claude API.

The tenant boundary is the **Organization**. Every business record carries an
`organizationId`. The club runs as a single organization today, but the schema
and queries are tenant-ready so additional clubs can be added without rework.

## Requirements

- Node.js 20+
- A managed PostgreSQL database (Neon, Supabase, or RDS)

## Setup

```bash
# 1. Install dependencies (React 19 needs legacy peer resolution)
npm install --legacy-peer-deps

# 2. Configure environment
cp .env.example .env
#    Fill in DATABASE_URL and DIRECT_URL, then generate an auth secret:
npx auth secret        # writes AUTH_SECRET into .env

# 3. Generate the Prisma client
npm run db:generate

# 4. Create the schema and load seed data
npm run db:migrate     # name the migration e.g. "init"
npm run db:seed

# 5. Run it
npm run dev            # http://localhost:3000
```

Inspect the seeded data any time with `npm run db:studio`.

## Demo accounts

All accounts use the password **`Password123!`**.

| Role          | Email                  |
| ------------- | ---------------------- |
| Super Admin   | owner@valetcrm.test    |
| Admin         | admin@valetcrm.test    |
| Manager       | priya@valetcrm.test    |
| Sales Rep     | marcus@valetcrm.test   |
| Sales Rep     | sophie@valetcrm.test   |
| Support Agent | daniel@valetcrm.test   |

## Scripts

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start the dev server                         |
| `npm run build`      | Generate client + production build           |
| `npm run db:migrate` | Create/apply a dev migration                 |
| `npm run db:deploy`  | Apply migrations in production               |
| `npm run db:seed`    | Load seed data                               |
| `npm run db:reset`   | Drop, re-migrate, and re-seed                |
| `npm run db:studio`  | Open Prisma Studio                           |
| `npm run typecheck`  | Type-check without emitting                  |
| `npm test`           | Run the unit test suite (Vitest)             |
| `npm run test:watch` | Run tests in watch mode                      |
| `npm run test:coverage` | Run the suite with a coverage report      |

## Testing

Unit tests run on [Vitest](https://vitest.dev).

```bash
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage
```

The suite covers the pure logic that the rest of the app leans on: currency and
date formatting, CSV import/export round-tripping, the deal close-state helper,
the lead/deal/task label maps, notification and audit link routing, and the
shared Zod field validators. Two suites — `rbac` and the full entity schemas —
reference the generated Prisma client, so run `npm run db:generate` once before
`npm test` if you have not built the client yet. CI does this automatically.

## Deployment

The app runs anywhere Next.js does. Two paths are set up out of the box.

**Vercel (recommended).** Connect the repository, add a managed Postgres
database (Neon, Supabase, or RDS), and set the environment variables from
`.env.example` in the project settings. The build command is
`prisma generate && next build` (already wired in `package.json` and
`vercel.json`), and `postinstall` regenerates the Prisma client on every
deploy. Run migrations against the production database once per release:

```bash
npx prisma migrate deploy
```

Seeding is optional and usually only done once for a fresh database
(`npm run db:seed`).

**Docker (self-host).** A multi-stage `Dockerfile` builds a production image;
the container applies pending migrations and then starts the server.

```bash
docker build -t valet-crm .
docker run -p 3000:3000 --env-file .env valet-crm
```

**Health check.** `GET /api/health` returns `200` with `{ status: "ok" }` when
the database is reachable and `503` when it is not — point your platform's
health probe or uptime monitor at it.

## Build roadmap — complete

- **Phase 1** — Architecture, folder structure, full Prisma schema, config, core lib, seed data.
- **Phase 2** — Auth.js (login, register, password reset), org + user management, RBAC, middleware.
- **Phase 3** — Contacts, companies, leads, the Kanban board, and the lead-sharing flow.
- **Phase 4** — Deals, activities, tasks.
- **Phase 5** — Admin and member dashboards.
- **Phase 6** — Claude API features (summaries, deal insights, email writer, meeting notes, lead scoring).
- **Phase 7** — Notifications and audit logs.
- **Phase 8** — Testing and deployment configuration.
