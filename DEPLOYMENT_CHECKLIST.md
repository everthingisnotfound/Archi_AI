# 🚀 Archi AI - Ready for Live Deployment

> **Release gate (2026-09-14):** The repository build and focused tests pass, but a live
> deployment is not verified until PostgreSQL, Redis, API, worker, AI, and web are deployed
> together and one end-to-end ingestion completes. Treat this as a controlled passive-analysis
> demo, not an active Burp Suite-style scanner. The website crawler does not log in, bypass
> verification pages, execute browser JavaScript, submit forms, mutate state, or send payloads.

## Tonight's mandatory checks

1. Configure production PostgreSQL, Redis, API, worker, AI, and web services.
2. Run `npm run db:migrate:deploy` before accepting traffic.
3. Confirm API, worker, and AI `/healthz` endpoints are healthy.
4. Test register -> login -> submit a small GitHub repository -> worker ingestion -> analysis results.
5. Submit one authorized public website and verify `site-profile.json`, `crawl-observations.json`,
   and `endpoints/` are created.
6. Test a verification/interstitial page and confirm the UI reports incomplete coverage.

## Known release blockers for broader claims

- DNS validation and the later HTTP connection are separate operations; isolate the crawler
  from internal networks before allowing arbitrary targets.
- JavaScript shells and identity-verification pages can prevent complete route discovery.
- Authenticated crawling, token/session analysis, active probing, form submission, and exploit
  verification are not implemented.

## What We Fixed Today

### 🐛 Bugs Fixed
- ✅ JSON parsing error on login (now returns proper JSON)
- ✅ Website crawler blocking (improved user agent + timeout)
- ✅ Production workspace config (/tmp/workspaces on Railway)

### ✨ New Features Added
- ✅ Delete Repository (with confirmation)
- ✅ Re-scan Repository (to check for changes)

### 📚 Documentation Added
- ✅ `RAILWAY_DEPLOYMENT.md` - Service-specific Railway setup guide
- ✅ `PRODUCTION_READY.md` - Deployment checklist
- ✅ Service-local `railway.json` files - explicit build/start/health settings

## Deployment status

Redeploy all Railway services from the latest `main` commit after configuration or
build changes. Record the deployed commit before diagnosing logs so stale deployments
are not mistaken for current failures.

## Your Next Steps (30-40 minutes)

### 1. Go to Railway Dashboard
   - https://dashboard.railway.app

### 2. Create New Project
   - Connect your GitHub repo: `everthingisnotfound/Archi_AI`

### 3. Add Services
   Follow `RAILWAY_DEPLOYMENT.md` → Step 1:
   - PostgreSQL ✅ (auto)
   - Redis ✅ (auto)
   - API service
   - Worker service
   - AI service (Python)
   - Web service

### 4. Configure Environment Variables
   Copy from `RAILWAY_DEPLOYMENT.md` → Step 3:
   - Each service needs all vars in its Variables tab
   - Example: `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, etc.

### 5. Deploy
   - All services auto-deploy on git push
   - Watch logs for "listening" or health check passes

### 6. Test
   - Open https://your-domain.com
   - Test: register → submit repo → verify analysis

## What's Already Working Locally
```bash
docker compose up -d
# ✅ API on :4000
# ✅ Web on :5173
# ✅ Worker processing jobs
# ✅ AI service on :8000
# ✅ PostgreSQL & Redis ready
```

## UI Features Ready
- ✅ Login/Register
- ✅ Add GitHub repos
- ✅ Add websites (crawls public pages)
- ✅ Upload ZIP/folder
- ✅ View analysis results
- ✅ Security findings
- ✅ Threat briefing
- ✅ **NEW: Delete button**
- ✅ **NEW: Re-scan button**

## Critical Notes

### ⚠️ Before Going Live
1. Set up all 4 services on Railway (API, Worker, AI, Web)
2. Verify `AI_SERVICE_URL=http://ai-service:8000` on API/Worker
3. Confirm database provisioning complete (wait 2-3 min)
4. Test end-to-end with a GitHub repo

### 🔑 Required Environment Variables
Must be set for EACH service:
```
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
GROQ_API_KEY=your_key
INTERNAL_JOB_TOKEN_SECRET=32+ chars
SESSION_SECRET=32+ chars
AI_SERVICE_URL=http://ai-service:8000 (for API/Worker)
```

### 🚫 Common Mistakes
- ❌ Forgetting to create Worker service (jobs won't process)
- ❌ Missing `AI_SERVICE_URL` (analysis will fail)
- ❌ Wrong database URLs (won't start)
- ❌ Hospital portals return 403 (choose public sites for testing)

## Performance Expectations
- GitHub repo: 2-5 minutes (clone + analyze)
- Website crawl: 1-3 minutes (depends on site size)
- Analysis: 30-60 seconds (static analysis)
- Threat briefing: 30-90 seconds (AI generation)

## Support
If anything fails:
1. Check service logs in Railway dashboard
2. Verify all env vars are set
3. Confirm database/redis provisioning
4. Look for specific error messages

## Release gate

The application is not production-verified until API, worker, AI, and web are healthy
in Railway and one end-to-end ingestion completes. Follow `RAILWAY_DEPLOYMENT.md`
for service-specific commands and environment variables.

Questions? Check `RAILWAY_DEPLOYMENT.md` for detailed step-by-step.
