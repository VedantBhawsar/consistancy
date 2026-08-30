# Deployment Guide

Target: a VPS reachable only by IP (no domain, no TLS). This app runs as four
long-lived processes plus Postgres and Redis — a normal VPS is the right fit;
Vercel/serverless is not (see "Why not serverless" at the bottom).

## Architecture recap

| Process | What it does | Needs to run |
|---|---|---|
| `bun run start` (after `bun run build`) | The Next.js web app (login, tasks, settings) | Always |
| `bun run scheduler` | Ticks every 60s, enqueues due reminders into Redis | Always |
| `bun run worker` | Pulls jobs off the queue, sends them via Telegram | Always |
| `bun run telegram-poller` | Long-polls Telegram for inbound DONE/SKIP replies | Always |
| Postgres + Redis | State + job queue | Always |

Inbound replies use **long polling**, not a webhook — the poller calls out to
Telegram itself, so nothing needs to be publicly reachable for that part. The
web app is the only thing you need to expose, and only so *you* can reach it.

## 1. Prerequisites on the VPS

- Docker + Docker Compose (for Postgres/Redis)
- Bun (`curl -fsSL https://bun.sh/install | bash`)
- Git

## 2. Get the code and configure env

```bash
git clone <your-repo-url> consistancy
cd consistancy
bun install
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` / `REDIS_URL` — leave as the `docker-compose.yml` defaults unless you're pointing at managed services.
- `AUTH_SECRET` — generate with `bunx auth secret` (or `openssl rand -base64 32`).
- `TELEGRAM_BOT_TOKEN` — see step 4 below.

## 3. Start Postgres + Redis and run migrations

```bash
docker compose up -d
bun run db:migrate
```

## 4. Create the Telegram bot and get your chat ID

1. Open Telegram, message **@BotFather**, send `/newbot`, follow the prompts.
   Copy the token it gives you into `TELEGRAM_BOT_TOKEN` in `.env`.
2. Message your new bot once (search its username, hit **Start**) — a bot
   can't message you until you've messaged it first.
3. Message **@userinfobot** — it replies with your numeric Telegram user ID.
   That's the value you'll enter as "Telegram chat ID" in the app's
   Settings page once you're logged in (for a 1:1 chat, your user ID and
   chat ID are the same number).

## 5. Build and run everything

```bash
bun run build
```

Run these four as long-lived processes — don't just `bun run` them in a
terminal you'll close. Use `pm2` (simplest) or `systemd`.

**Option A — pm2**

```bash
bun add -g pm2
pm2 start "bun run start" --name consistancy-web
pm2 start "bun run scheduler" --name consistancy-scheduler
pm2 start "bun run worker" --name consistancy-worker
pm2 start "bun run telegram-poller" --name consistancy-poller
pm2 save
pm2 startup   # follow the printed instructions to survive reboots
```

**Option B — systemd**

Create one unit per process, e.g. `/etc/systemd/system/consistancy-web.service`:

```ini
[Unit]
Description=Consistancy web app
After=network.target docker.service

[Service]
WorkingDirectory=/path/to/consistancy
ExecStart=/root/.bun/bin/bun run start
Restart=always
EnvironmentFile=/path/to/consistancy/.env

[Install]
WantedBy=multi-user.target
```

Duplicate for `consistancy-scheduler` (`bun run scheduler`),
`consistancy-worker` (`bun run worker`), and `consistancy-poller`
(`bun run telegram-poller`), then:

```bash
sudo systemctl enable --now consistancy-web consistancy-scheduler consistancy-worker consistancy-poller
```

## 6. Reach the app

By default Next.js listens on port 3000. Either:

- Open port 3000 in your VPS firewall and visit `http://<your-ip>:3000`, or
- Put a reverse proxy (Caddy/nginx) in front on port 80/443.

Plain HTTP over a bare IP means your login cookie travels unencrypted — fine
for personal, low-stakes use, but if you want real HTTPS without owning a
domain, use the free **sslip.io** trick: `<your-ip>.sslip.io` is a real
hostname that resolves back to your IP, so Caddy or `certbot` can issue it a
normal Let's Encrypt certificate with no registrar access needed.

Example with Caddy (`/etc/caddy/Caddyfile`):

```
<your-ip>.sslip.io {
    reverse_proxy localhost:3000
}
```

Caddy handles the certificate automatically. Then visit
`https://<your-ip>.sslip.io`.

## 7. Verify end-to-end

1. Log into the app, go to Settings, paste your Telegram chat ID, save.
2. Add a task scheduled a couple of minutes out.
3. Watch the scheduler/worker logs (`pm2 logs consistancy-scheduler` /
   `pm2 logs consistancy-worker`) — you should see a job enqueued, then sent.
4. You should get a Telegram message from your bot. Reply `DONE` — check
   `pm2 logs consistancy-poller` and confirm the task flips to completed in
   the app.

---

## Optional: switching inbound replies to a webhook instead of polling

The app currently uses long polling because a bare IP has no domain to get a
valid TLS certificate for, and Telegram webhooks require HTTPS. If you later
get domain access (or set up a free tunnel), a webhook is lower-latency and
avoids running the poller process. To use one, you'd need to:

1. Get a public HTTPS URL pointing at the app. Either:
   - Buy/point a real domain + reverse proxy with a Let's Encrypt cert, or
   - Use **Cloudflare Tunnel** (`cloudflared`) — free, gives you an HTTPS URL
     with zero domain/cert setup, or
   - Use the sslip.io + Caddy setup from step 6 above (already gives you HTTPS).
2. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-https-url>/api/webhooks/telegram&secret_token=<a-random-string-you-make-up>"
   ```
3. Verify it took:
   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
   ```
   Check `last_error_message` if updates aren't arriving.
4. To revert to polling (or just disable the webhook):
   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
   ```

Note: this repo doesn't currently ship the webhook route (it was removed in
favor of polling) — you'd need to re-add an `app/api/webhooks/telegram`
route handler that validates the `X-Telegram-Bot-Api-Secret-Token` header
against the secret you chose in step 2, and stop running
`telegram-poller`. Ask for this to be re-added if you get a domain.

---

## Why not serverless (Vercel etc.)

`scheduler` and `worker` are long-running processes (a `setInterval` loop and
a persistent BullMQ/Redis worker) — serverless functions are short-lived and
can't host either. Vercel's free-tier Cron is also capped at once per day,
too coarse for time-of-day reminders. A VPS with always-on processes is the
simplest fit for this app's current design; moving to serverless would mean
first replacing the queue with a single externally-cron-triggered API route
(see earlier discussion if you want this later).
