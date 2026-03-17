# Deploying to Hetzner VPS (Dockerized)

This document provides technical details for deploying and maintaining **Since This Call** on a VPS.

## 🏗️ Architecture Overview

The application runs on a Hetzner VPS using **Docker Compose**.

- **Next.js Web**: The main application server.
- **Redis (Database)**: Self-hosted Redis instance for lightning-fast performance and zero per-request costs.
- **Caddy (Reverse Proxy)**: Automatically manages SSL certificates (Let's Encrypt) and routes traffic to the container.
- **Redis Proxy**: A tiny helper that enables legacyREST API support for internal services.

## 🚀 Deployment Steps

1. **SSH into the VPS**:
   ```bash
   ssh root@204.168.130.15
   ```

2. **Run with Docker Compose**:
   ```bash
   # Build and start in detached mode
   docker compose up -d --build
   ```

3. **Check Logs**:
   ```bash
   docker compose logs -f
   ```

## 🛡️ Security

- **UFW (Firewall)**:
  - `Allow 22/tcp` (SSH)
  - `Allow 80/tcp` (HTTP)
  - `Allow 443/tcp` (HTTPS)
  - `Allow 6379/tcp` (Redis - for local watcher access)
- **Redis**: Secured with a master password (`REDIS_URL` in `.env.local`).

## 📊 Maintenance Workflow

### 1. Local-to-VPS Sync
To pull fresh production data to your laptop:
```bash
npx tsx scripts/sync-vps-to-local.ts
```

### 2. Monitoring Guru Performance
Run the recalculation script on the server (or locally if synced):
```bash
npx tsx scripts/recalculate-all-production.ts
```

### 3. Backups
Automatic backup script:
```bash
npx tsx scripts/backup-data.ts
```
Exports a JSON file to `backups/`.

## 🔄 SSL Management (Caddy)
SSL is managed by Caddy. The `Caddyfile` is located in the root directory. To refresh or update settings:
```bash
# Inside VPS
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## 🛑 Important Notes
- **Never stop the Redis container** without a backup first.
- **Port 6379** must remain exposed on UFW to allow the `Twitter Watcher` (running on your laptop) to write data live.
