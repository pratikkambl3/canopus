# CANOPUS — Self-Hosted Dockerized Deployment

> Retro records, reimagined for the club. Fully self-hosted with a 3-tier Docker architecture.

## Architecture

```
Internet
   │
   ▼ :${FRONTEND_PORT}
┌─────────────────────────────┐
│  frontend  (Nginx + Vite)   │   React SPA — static files
└──────────────┬──────────────┘
               │ /api/*  →  proxy
               ▼
┌─────────────────────────────┐
│  backend   (Node / Express) │   REST API + JWT auth + file uploads
└──────────────┬──────────────┘
               │ Internal: canopus_net
               ▼
┌─────────────────────────────┐
│  postgres  (PostgreSQL 16)  │   Track metadata
│  Volume: canopus_data       │
└─────────────────────────────┘
     Volume: canopus_uploads   (audio + artwork files)
```

## Quick Start

### 1. Clone & configure

```bash
git clone <repo-url> canopus
cd canopus
cp .env.example .env
```

Edit `.env` and set **all** values marked `change_me`:

| Variable | Description |
|---|---|
| `FRONTEND_PORT` | Host port for the web UI (default `3000`) |
| `BACKEND_PORT` | Internal Express port (default `8000`) |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password — use a strong value |
| `JWT_SECRET` | JWT signing secret — generate with `openssl rand -base64 64` |
| `JWT_EXPIRES_IN` | Token lifetime (default `24h`) |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Admin login password — use a strong value |
| `CORS_ORIGINS` | Comma-separated allowed origins for the API |
| `PUBLIC_URL` | Leave empty for relative URLs |
| `VITE_API_URL` | `/api` for Docker; `http://localhost:8000` for local dev |

### 2. Build & start

```bash
docker compose up -d --build
```

This will:
1. Pull the PostgreSQL image
2. Build the backend Node.js image
3. Build the frontend Nginx/Vite image
4. Start all three containers in the correct order (Postgres → Backend → Frontend)

### 3. Access the app

| URL | Description |
|---|---|
| `http://localhost:3000` | Radio + Records public UI |
| `http://localhost:3000/admin` | Admin panel (login required) |
| `http://localhost:3000/api/health` | Backend health check |

---

## Environment Separation

The app uses only environment variables for all configuration. To switch environments:

| Environment | Command |
|---|---|
| Development | `cp .env.example .env` then `docker compose up -d` |
| Staging | Use a `.env.staging` file: `docker compose --env-file .env.staging up -d` |
| Production | Use your CI/CD system or secrets manager to inject env vars |

---

## Local Development (without Docker)

### Backend

```bash
cd backend
npm install
# Create a .env in backend/ or export vars:
export DB_HOST=localhost DB_PORT=5432 DB_NAME=canopus_db DB_USER=canopus DB_PASSWORD=secret
export JWT_SECRET=dev_secret ADMIN_EMAIL=admin@test.com ADMIN_PASSWORD=test123
export BACKEND_PORT=8000 CORS_ORIGINS=http://localhost:3000
npm run dev
```

### Frontend

```bash
cd frontend
npm install
# Set VITE_API_URL to point at your local backend:
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

---

## Useful Commands

```bash
# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Stop all containers
docker compose down

# Stop and remove volumes (DESTROYS ALL DATA)
docker compose down -v

# Rebuild a single service
docker compose up -d --build backend

# Check container health
docker compose ps

# Connect to PostgreSQL directly
docker exec -it canopus_postgres psql -U <DB_USER> -d <DB_NAME>
```

---

## Data Persistence

| What | Where |
|---|---|
| Track metadata | `canopus_data` Docker volume → PostgreSQL |
| Audio files | `canopus_uploads` Docker volume → `/app/uploads/audio/` |
| Artwork images | `canopus_uploads` Docker volume → `/app/uploads/artwork/` |

Docker volumes survive `docker compose down`. Only `docker compose down -v` removes them.

---

## Security Notes

- `.env` is in `.gitignore` — **never commit it**
- PostgreSQL is **not exposed** to the host; only reachable inside `canopus_net`
- The backend is **not exposed** to the host; only Nginx proxies requests to it
- JWTs expire after `JWT_EXPIRES_IN` (default 24 h)
- Admin credentials are validated with bcrypt (constant-time comparison)
- Use strong, randomly generated values for `JWT_SECRET`, `DB_PASSWORD`, and `ADMIN_PASSWORD` in production

---

## Production Checklist

- [ ] Set `APP_ENV=production`
- [ ] Use strong random `JWT_SECRET` (`openssl rand -base64 64`)
- [ ] Use a strong `DB_PASSWORD` and `ADMIN_PASSWORD`
- [ ] Set `CORS_ORIGINS` to your actual domain
- [ ] Put Nginx behind a reverse proxy (Caddy / Traefik) with TLS termination
- [ ] Set up automated backups for the `canopus_data` volume
