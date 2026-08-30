# Consistancy

A personal productivity app for running a predefined daily routine: define
scheduled tasks, get reminded on Telegram when they're due, mark them done
(from the web app or by replying in Telegram), and track daily/weekly
completion.

The full product spec/design doc lives in [`spec.md`](./spec.md) (note: it
was written against WhatsApp as the notification channel; the app actually
ships with **Telegram**, since it needs no business verification).

## How it works

```
Scheduler (ticks every 60s)
    → finds due task occurrences
    → enqueues notification jobs into Redis (BullMQ)
    → Worker sends them via the Telegram Bot API
    → Telegram poller long-polls for inbound DONE/SKIP replies
    → task occurrence status updates, reflected on the web dashboard
```

Four long-lived processes plus Postgres and Redis. See
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full production deployment guide
(VPS + Docker Compose + pm2/systemd, plus the sslip.io HTTPS trick for a
bare-IP VPS).

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Auth.js** (`next-auth`) for authentication
- **PostgreSQL** + **Drizzle ORM**
- **Redis** + **BullMQ** for the notification job queue
- **Telegram Bot API** for reminders and two-way (DONE/SKIP) interaction
- **Tailwind CSS**
- **Zod** for request/schema validation
- Package manager: **Bun**

## Project structure

```
app/                  Next.js App Router routes (pages + API routes)
components/           React components (task list, forms, nav, etc.)
lib/db/               Drizzle schema + migrations
lib/services/         Domain logic (tasks, occurrences, recurrence, scheduler, completion, progress)
lib/notifications/    NotificationProvider abstraction + Telegram implementation
lib/queue/            BullMQ queue + worker setup
lib/auth/             Password hashing, auth types
lib/validation/       Zod schemas
scripts/              Entry points for the scheduler, worker, and Telegram poller processes
```

## Getting started (local dev)

Requires [Bun](https://bun.sh) and Docker (for Postgres + Redis).

```bash
bun install
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` / `REDIS_URL` — defaults match `docker-compose.yml`, no changes needed for local dev.
- `AUTH_SECRET` — generate with `bunx auth secret`.
- `TELEGRAM_BOT_TOKEN` — message **@BotFather** on Telegram, send `/newbot`, copy the token it gives you.

Start Postgres + Redis and run migrations:

```bash
docker compose up -d
bun run db:migrate
```

Run the web app plus the three background processes (each in its own terminal):

```bash
bun run dev              # Next.js dev server — http://localhost:3000
bun run scheduler        # enqueues due reminders every 60s
bun run worker           # sends queued reminders via Telegram
bun run telegram-poller  # listens for inbound DONE/SKIP replies
```

Sign up in the web app, then go to **Settings** and paste your Telegram chat
ID (message **@userinfobot** to get it) so reminders have somewhere to go.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the Next.js dev server |
| `bun run build` / `bun run start` | Production build / start |
| `bun run lint` | Lint with ESLint |
| `bun run db:generate` | Generate a new Drizzle migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run scheduler` | Run the reminder scheduler process |
| `bun run worker` | Run the BullMQ notification worker |
| `bun run telegram-poller` | Run the Telegram long-poller for inbound replies |

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a full VPS deployment walkthrough,
including why this app needs long-lived processes and isn't a fit for
serverless platforms like Vercel.
