# Deploying NexLink

This takes the project from a folder on your machine to a live app people can log into. "Live" needs three things together: a **Postgres database**, a **host** running the Next.js app, and the **schema applied** to that database. The smoothest stack is **Neon** (database) + **Vercel** (host) — both have free tiers. Budget about 20–30 minutes.

## The one thing you must do locally first

The repo ships with the schema in `prisma/schema.prisma` **and** migration files in
`prisma/migrations/`, so production can apply the schema with `npx prisma migrate deploy`
(the Docker image runs this automatically on start). The one thing you must still do
from your own machine is create the first Super Admin account (Step 5) — self-registration
is disabled, so there is no way to do it from a browser.

## Before you start

- Accounts: **GitHub**, **Vercel**, **Neon** (Neon can be created through Vercel during Step 2).
- **Node.js 20+** installed locally.
- The project unzipped from `valet-crm-final.zip`.

---

## Step 1 — Put the code on GitHub

Vercel deploys from a Git repo. From inside the project folder:

```bash
cd valet-crm
git init
git add .
git commit -m "NexLink"
git branch -M main
git remote add origin https://github.com/<your-username>/valet-crm.git
git push -u origin main
```

## Step 2 — Create the Neon Postgres database

Vercel's own Postgres product was retired in December 2024 and folded into Neon, so use Neon from the Vercel Marketplace (or sign up at neon.com directly).

- In Vercel: **Storage → Create Database → Neon**, or install Neon from the Marketplace.
- Neon gives you **two** connection strings:
  - **Pooled** → use as `DATABASE_URL` (what the app uses at runtime)
  - **Direct / unpooled** → use as `DIRECT_URL` (what `prisma migrate` uses — poolers don't support the locks migrations need)
- If you use the Vercel-managed Neon integration, it auto-injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Set `DIRECT_URL` to the `_UNPOOLED` value.

## Step 3 — Generate and apply the schema (local, one-time)

Create a `.env` file in the project root (copy `.env.example`) with at least these four values:

```env
DATABASE_URL="<neon pooled connection string>"
DIRECT_URL="<neon direct / unpooled connection string>"
AUTH_SECRET="<paste the output of: npx auth secret>"
AUTH_URL="http://localhost:3000"
```

Then install and run the first migration:

```bash
npm install
npx prisma migrate dev --name init
```

That creates `prisma/migrations/<timestamp>_init/` and applies the schema to your Neon database. Commit the migration so production can use it:

```bash
git add prisma/migrations
git commit -m "Add initial migration"
git push
```

**Do not** run `npm run db:seed` against your production database — the seed creates demo accounts with a publicly known password. It exists only for local testing.

> The project includes an `.npmrc` with `legacy-peer-deps=true` to resolve React 19 peer-dependency conflicts, so a plain `npm install` works both locally and on Vercel.

## Step 4 — Deploy on Vercel

1. vercel.com → **Add New → Project** → import your GitHub repo. Next.js is auto-detected and the build command (`prisma generate && next build`) is already configured.
2. Before the first deploy, add **Environment Variables** (Production):

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Neon pooled string | Yes |
| `DIRECT_URL` | Neon direct / unpooled string | Yes (migrations) |
| `AUTH_SECRET` | output of `npx auth secret` | Yes |
| `AUTH_URL` | `https://your-app.vercel.app` | Recommended |
| `AUTH_TRUST_HOST` | `true` | Recommended (Vercel proxy) |
| `DEFAULT_ORG_SLUG` | `valet-club` | Optional |
| `DEFAULT_ORG_NAME` | `NexLink` | Optional |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | Optional — turns on AI features |
| `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | your bucket | Optional — file uploads |
| `EMAIL_FROM`, `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD` | SMTP creds | Optional — password reset |

3. Click **Deploy**.

> If you used the Vercel-managed Neon integration, `DATABASE_URL` is already injected — you only need to add `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, and `AUTH_TRUST_HOST`.

## Step 5 — Make yourself the owner

Public self-registration is **disabled** — `/register` returns 403, and accounts are
created only by invitation. On a brand-new database there is no one to invite you,
so you create the first account once, from your machine, with the bootstrap script:

```bash
BOOTSTRAP_EMAIL="you@yourclub.com.au" \
BOOTSTRAP_PASSWORD="a-long-password-you-choose" \
BOOTSTRAP_NAME="Your Name" \
npm run bootstrap
```

Run it with the same `DATABASE_URL` as production (a `.env` in the project root is
fine). It creates one organization and one **Super Admin** — you. It refuses to run
if any user already exists, so it is safe to re-run and cannot damage a live club.

Then sign in at **`/login`** and invite the rest of the club from **Members**.

**Do not** use `npm run db:seed` for this — the seed deletes the club organization
and all of its data before inserting demo accounts, and it now refuses to run when
`NODE_ENV=production`.

---

## Optional add-ons

The app runs fine without any of these; the related features simply stay off until configured.

- **AI features** (lead scoring, deal insights, email + meeting-note writers): set `ANTHROPIC_API_KEY`.
- **Avatar / file uploads**: set the `S3_*` variables (AWS S3, Cloudflare R2, or MinIO via `S3_ENDPOINT`).
- **Password-reset emails**: set the `EMAIL_*` SMTP variables.
- **Custom domain**: Vercel → Project → **Domains**, then update `AUTH_URL` to match.
- **Uptime monitoring**: point a probe at **`/api/health`** — returns `200` when the database is reachable, `503` otherwise.

## Updating the app later

Push to `main` and Vercel redeploys automatically. For schema changes:

```bash
# locally, against a dev database
npx prisma migrate dev --name <change_name>
git add prisma/migrations && git commit -m "schema: <change_name>" && git push
```

Production applies committed migrations via `prisma migrate deploy` (run it as a release step, through the Neon SQL console, or locally with your env pointed at production).

## Troubleshooting

- **`npm install` fails with ERESOLVE / peer conflict** → make sure `.npmrc` (with `legacy-peer-deps=true`) is present, or run `npm install --legacy-peer-deps`.
- **`prisma migrate` hangs or errors about advisory locks / prepared statements** → it's pointing at the pooled URL. Confirm `DIRECT_URL` is set to the direct / unpooled connection.
- **`P1001 Can't reach database server`** → check the host/port in the connection string and that `sslmode=require` is included; Neon requires SSL.
- **Login redirects to an error or loops** → set `AUTH_URL` to the exact deployed URL and `AUTH_TRUST_HOST=true`.
- **Build fails on `prisma generate`** → the Prisma engine downloads at build time; this works by default on Vercel. Behind a strict local firewall, allow `binaries.prisma.sh`.
