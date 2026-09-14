# Railway Deployment Guide for Archi AI

## Overview
Archi AI requires 4 services to run on Railway:
1. **API** - Express.js backend (process jobs, serve API)
2. **Worker** - Node.js background jobs (ingests repos, runs analysis)
3. **AI Service** - Python backend (runs AI analysis on code)
4. **Web** - React frontend (static/served via nginx)

Plus shared infrastructure:
- PostgreSQL database
- Redis cache

## Step 1: Create Services on Railway

### 1a. Database & Cache (ONE-TIME SETUP)

Go to Railway dashboard → New Project → Add New Service

**PostgreSQL:**
- Click "Add Service" → select "PostgreSQL"
- Railway creates automatically
- Copy the `DATABASE_URL` from Variables tab
- Note: Format is `postgresql://user:pass@host:port/db?schema=public`

**Redis:**
- Click "Add Service" → select "Redis"
- Railway creates automatically  
- Copy the `REDIS_URL` from Variables tab
- Note: Format is `redis://user:pass@host:port`

### 1b. API Service

**Create Service:**
1. Go to your Railway project
2. Click "New" → "GitHub Repo"
3. Select your `Archi_AI` repo
4. Railway auto-detects it's a Node.js monorepo

**Configure:**
- Service Name: `api`
- Root Directory: repository root (`/`)
- Builder: Railpack/Nixpacks
- Port: `4000`

**Environment Variables** (add in Railway Variables tab):
```
NODE_ENV=production
PORT=4000
DATABASE_URL={paste from PostgreSQL above}
REDIS_URL={paste from Redis above}
SESSION_SECRET={generate: openssl rand -hex 32}
INTERNAL_JOB_TOKEN_SECRET={generate: openssl rand -hex 32}
GROQ_API_KEY={your GROQ API key}
OPENAI_API_KEY={your OpenAI key or leave empty}
CORS_ORIGIN=https://your-frontend-domain.com,https://your-api-domain.com
AI_SERVICE_URL=http://ai-service:8000
WORKSPACE_ROOT=/tmp/workspaces
API_BASE_URL=https://api.yourdomain.com
WEB_BASE_URL=https://yourdomain.com
```

**Start Command in Railway UI:**
- Build: `npm run build --workspace @ai-archaeologist/api` (builds required workspace packages first)
- Start: `npm run start --workspace @ai-archaeologist/api`

### 1c. Worker Service

**Create Service:**
1. Click "New" → "GitHub Repo"
2. Select same repo
3. Service Name: `worker`

**Configure:**
- Root Directory: repository root (`/`)
- Builder: Railpack/Nixpacks

**Environment Variables** (same as API):
```
NODE_ENV=production
DATABASE_URL={from PostgreSQL}
REDIS_URL={from Redis}
INTERNAL_JOB_TOKEN_SECRET={same as API}
GROQ_API_KEY={your key}
OPENAI_API_KEY={your key}
AI_SERVICE_URL=http://ai-service:8000
WORKSPACE_ROOT=/tmp/workspaces
WORKER_CONCURRENCY=2
```

**Start Command in Railway UI:**
- Build: `npm run build --workspace @ai-archaeologist/worker` (builds required workspace packages first)
- Start: `npm run start --workspace @ai-archaeologist/worker`

Run database migrations from the API deployment only. Do not add a migration command
to the worker start command; concurrent API and worker migrations can contend for
Prisma's migration lock.

### 1d. AI Service

**Create Service:**
1. Click "New" → "GitHub Repo"
2. Select same repo
3. Service Name: `ai-service`

**Configure:**
- Root Directory: `/services/ai`
- Builder: Railpack/Nixpacks

**Environment Variables:**
```
AI_SERVICE_URL=http://localhost:8000
GROQ_API_KEY={your key}
OPENAI_API_KEY={your key}
PORT=8000
```

**The committed `services/ai/Procfile` supplies the AI start command:**
```
web: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Do not keep a root-level `Procfile`: Railway applies it while detecting every service, which
can make the web/API/worker services inherit the AI command.

### 1e. Web Service

**Create Service:**
1. Click "New" → "GitHub Repo"
2. Select same repo
3. Service Name: `web`

**Configure:**
- Root Directory: repository root (`/`)
- Builder: Railpack/Nixpacks

**Environment Variables:**
```
NODE_ENV=production
VITE_API_BASE_URL=https://api.yourdomain.com
```

`VITE_API_BASE_URL` is embedded during the web build. Set it before deploying; the frontend
cannot reach an API on a different Railway domain when it is omitted. Never use `npm run dev`
in Railway. After deployment, the HTML must reference `/assets/index-*.js` and must not reference
`/@vite/client` or `/src/main.tsx`.

### Railway service variable minimums

The AI variables alone are not enough. API requires `DATABASE_URL`, `REDIS_URL`,
`SESSION_SECRET`, `INTERNAL_JOB_TOKEN_SECRET`, `CORS_ORIGIN`, and `AI_SERVICE_URL`.
Worker requires `DATABASE_URL`, `REDIS_URL`, `INTERNAL_JOB_TOKEN_SECRET`, and `AI_SERVICE_URL`.
AI requires `INTERNAL_JOB_TOKEN_SECRET`, `GROQ_API_KEY`, `AI_PROVIDER`, and `PORT`.
Web requires `VITE_API_BASE_URL` at build time.

`INTERNAL_JOB_TOKEN_SECRET` must be identical on API, worker, and AI. `AI_SERVICE_URL` must
use the AI service's actual Railway private hostname, not `http://ai:8000` unless that is the
private DNS name in your project.

## Step 2: Create railway.json (Optional but Recommended)

Create file: `railway.json` in root:

```json
{
  "build": {
    "builder": "nixpacks",
    "config": {
      "nixpacks": {
        "providers": ["nodejs", "python"]
      }
    }
  }
}
```

## Step 3: Configure Networking

Railway services on the same project communicate via internal network:
- `api` → `worker` via Redis
- `api` → `ai-service` via HTTP to `http://ai-service:8000`
- `web` → `api` via HTTP to public API URL

Make sure:
- `AI_SERVICE_URL` on API/Worker points to `http://ai-service:8000`
- `CORS_ORIGIN` on API includes your web domain
- Database/Redis URLs are from Railway variables (auto-set correctly)

## Step 4: Test Locally First

Before deploying to Railway, test with Docker Compose:

```bash
docker compose up -d
# Wait 30s for services to start
curl http://localhost:4000/healthz  # Should return 200
curl http://localhost:5173          # Should show web UI
curl http://localhost:5173/api/auth/csrf  # Should return JSON
```

Then test the flow:
1. Open http://localhost:5173
2. Register account
3. Submit website: `https://nextgen.ehospital.gov.in/`
4. Check API logs: `docker compose logs api`
5. Check Worker logs: `docker compose logs worker`
6. Worker should start crawling, then queue analysis

## Step 5: Deploy to Railway

1. **Commit all changes:**
   ```bash
   git add -A
   git commit -m "deploy: production ready configuration"
   git push origin main
   ```

2. **Railway auto-deploys** when you push (if you've connected GitHub)

3. **Monitor deployments** in Railway dashboard:
   - Check each service's logs
   - Verify health checks pass (should see `api listening` in API logs)

4. **Test live:**
   ```bash
   curl https://your-api-domain.com/healthz
   curl https://your-web-domain.com
   ```

## Step 6: Verify the System Works

1. **Login:**
   - Open https://your-web-domain.com
   - Register account
   - Login

2. **Test GitHub repo ingestion:**
   - Submit: `https://github.com/torvalds/linux` (or smaller repo)
   - Watch status change to "RUNNING"
   - After ~2-5 min, should show files and analysis

3. **Test website ingestion:**
   - Submit: `https://github.com` (homepage, public)
   - Should crawl pages and show results

4. **Check logs if it fails:**
   - Railway UI → Service → Logs tab
   - API logs: look for `POST /organizations/{id}/repositories/website`
   - Worker logs: look for `ingestion job` or `website crawl`
   - AI logs: look for analysis errors

## Troubleshooting

### Worker not processing jobs
**Symptom:** Status stays "QUEUED", never becomes "RUNNING"

**Fixes:**
1. Check Worker is running: `railway logs worker`
2. Verify REDIS_URL is correct on both API and Worker
3. Ensure both can connect: `redis-cli -u $REDIS_URL ping` should return PONG
4. Check if Redis is accessible from Worker service

### AI Service connection failed
**Symptom:** Analysis fails with "unable to reach AI service"

**Fixes:**
1. Verify `AI_SERVICE_URL=http://ai-service:8000` on Worker
2. Check AI service is healthy: `curl http://ai-service:8000/healthz`
3. Verify AI service logs show it's running

### Website crawl fails with 403
**Symptom:** "Website returned HTTP 403"

**Fixes:**
1. The website blocks our crawler - try a different public site
2. Hospital portals often require authentication
3. Try: `https://github.com/`, `https://example.com/`, public sites

### Database migration fails
**Symptom:** API crashes on startup with migration error

**Fixes:**
1. Ensure PostgreSQL is fully provisioned (wait 2-3 min)
2. Check DATABASE_URL is correct
3. Run manually: `npx prisma migrate deploy` in API service shell

## Environment Variables Cheat Sheet

Copy and paste into Railway Variables tab for each service:

**API & Worker (both need these):**
```
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SESSION_SECRET=xxx
INTERNAL_JOB_TOKEN_SECRET=xxx
GROQ_API_KEY=xxx
OPENAI_API_KEY=xxx
CORS_ORIGIN=https://yourdomain.com
AI_SERVICE_URL=http://ai-service:8000
WORKSPACE_ROOT=/tmp/workspaces
```

**API only:**
```
PORT=4000
API_BASE_URL=https://api.yourdomain.com
WEB_BASE_URL=https://yourdomain.com
```

**Worker only:**
```
WORKER_CONCURRENCY=2
```

**AI Service:**
```
AI_SERVICE_URL=http://localhost:8000
PORT=8000
GROQ_API_KEY=xxx
OPENAI_API_KEY=xxx
```

**Web:**
```
NODE_ENV=production
VITE_API_BASE_URL=https://api.yourdomain.com
```

## Next Steps

1. ✅ Push code to GitHub
2. ⏳ Create services on Railway (5-10 min)
3. ⏳ Set environment variables (5 min)
4. ⏳ Watch deployments complete (10-15 min)
5. ⏳ Test flows end-to-end (5 min)
6. 🚀 Go live!

**Total time: ~30-40 minutes**

---

## Questions?

If anything fails, check:
1. Service logs in Railway dashboard
2. Ensure all env vars are set correctly
3. Verify database/redis provisioning complete
4. Check GitHub Actions show successful builds
