# Deployment Checklist - Security Fixes

## Pre-Deployment

### [ ] Prepare Environment
- [ ] Create feature branch: `git checkout -b security/fix-ssrf-rate-limit`
- [ ] Ensure Docker is running: `docker ps`
- [ ] Verify Node version: `node --version` (should be 18+)
- [ ] Verify Python version: `python --version` (should be 3.10+)

### [ ] Review Documentation
- [ ] Read SECURITY_AUDIT_REPORT.md
- [ ] Read IMPLEMENTATION_GUIDE.md
- [ ] Read SECURITY_FIXES_QUICK_REFERENCE.md
- [ ] Understand SSRF threat (why private IPs are blocked)
- [ ] Understand Rate Limit threat (why fail-closed is required)

### [ ] Code Review Prep
- [ ] Compare services/ai/app/main.py with services/ai/app/main_FIXED.py
- [ ] Compare apps/api/src/http/rateLimit.ts with apps/api/src/http/rateLimit_FIXED.ts
- [ ] Ensure all changes are minimal and focused

---

## Implementation Phase

### SSRF Fix (services/ai/app/main.py)

- [ ] Create the security validation module:
  - [ ] Copy `services/ai/app/security_validation.py` to project
  - [ ] Verify file is at correct path
  - [ ] Check file has 3683 bytes (correct size)

- [ ] Update main.py:
  - [ ] Add import: `from app.security_validation import validate_allowed_hosts`
  - [ ] Remove old `_validate_allowed_hosts()` function (if present)
  - [ ] Add validation call in `/internal/assessment/active` endpoint:
    ```python
    try:
        validate_allowed_hosts(body.allowed_hosts)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid allowed_hosts: {str(e)}")
    ```

- [ ] Verify changes:
  - [ ] No syntax errors: `python -m py_compile services/ai/app/main.py`
  - [ ] Imports resolve: `cd services/ai && python -c "from app.security_validation import validate_allowed_hosts"`

### Rate Limit Fix (apps/api/src/http/rateLimit.ts)

- [ ] Update catch block:
  - [ ] Remove all conditional logic based on NODE_ENV or config.RATE_LIMIT_FAIL_CLOSED
  - [ ] Always call `next(new AppError(..., 503))` on error (fail closed)
  - [ ] Add comment explaining security reason

- [ ] Remove config option:
  - [ ] Delete `RATE_LIMIT_FAIL_CLOSED` from `apps/api/src/config.ts` (if present)
  - [ ] Check no other code references this option

- [ ] Verify changes:
  - [ ] No TypeScript errors: `cd apps/api && npm run build`
  - [ ] No breaking changes to middleware signature

---

## Testing Phase

### SSRF Validation Tests

```bash
# [ ] Run test suite
cd services/ai
pytest tests/test_security_validation.py -v

# Expected output:
# ✓ test_rejects_private_ip_10_range
# ✓ test_rejects_private_ip_172_range
# ✓ test_rejects_private_ip_192_168_range
# ✓ test_rejects_ipv4_loopback
# ... (28 tests total)
# 28 passed in 0.45s
```

- [ ] All 28 tests pass
- [ ] No skipped tests
- [ ] No deprecation warnings

### Rate Limit Integration Tests

```bash
# [ ] Start Docker environment
docker compose up -d redis api

# [ ] Wait for services to be healthy
sleep 10

# [ ] Test normal operation (Redis running)
curl http://localhost:4000/api/ping
# Expected: 200 OK

# [ ] Stop Redis to simulate failure
docker stop archi_ai-redis-1

# [ ] Test fail-closed behavior (Redis stopped)
curl http://localhost:4000/api/ping
# Expected: 503 Service Unavailable

# [ ] Restart Redis for next test
docker start archi_ai-redis-1
```

- [ ] Normal operation returns 200
- [ ] Redis failure returns 503 (not 200)
- [ ] Fail-closed behavior confirmed

### End-to-End Tests

```bash
# [ ] Run full test suite
npm run test

# [ ] Check for new failures
# Expected: No new test failures

# [ ] Rebuild all services
docker compose build

# [ ] Start full stack
docker compose up --pull always

# [ ] Wait for all services to be healthy
sleep 30

# [ ] Verify all services started
docker compose ps
# Expected: All containers in "Up" state
```

- [ ] All services start successfully
- [ ] No container crashes
- [ ] All health endpoints return 200

---

## SSRF Validation Tests

### Test Private IP Rejection

```bash
# [ ] Test: 192.168.x.x blocked
pytest -k "test_rejects_private_ip_192_168_range" -v

# [ ] Test: 10.x.x.x blocked
pytest -k "test_rejects_private_ip_10_range" -v

# [ ] Test: 172.16-31.x.x blocked
pytest -k "test_rejects_private_ip_172_range" -v

# [ ] Test: Loopback blocked
pytest -k "test_rejects_ipv4_loopback" -v

# [ ] Test: IPv6 private ranges blocked
pytest -k "test_rejects_ipv6" -v
```

- [ ] All rejection tests pass
- [ ] No false positives (public IPs accepted)

### Test Public IP Acceptance

```bash
# [ ] Test: Public IPv4 accepted
pytest -k "test_accepts_public_ipv4" -v

# [ ] Test: Public IPv6 accepted
pytest -k "test_accepts_public_ipv6" -v

# [ ] Test: Domain names accepted
pytest -k "test_accepts_public_domain" -v

# [ ] Test: Wildcard domains accepted
pytest -k "test_accepts_wildcard_domain" -v
```

- [ ] All acceptance tests pass
- [ ] Public resources are NOT blocked

---

## Code Review Checklist

### Security Review

- [ ] SSRF fix:
  - [ ] All private IP ranges are blocked (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 127.0.0.0/8)
  - [ ] IPv6 private ranges are blocked (fe80::/10, fc00::/7, ::1/128)
  - [ ] No bypasses or edge cases
  - [ ] Error messages don't leak internal info

- [ ] Rate Limit fix:
  - [ ] Redis failures always result in 503
  - [ ] No conditional fail-open logic
  - [ ] Fail-closed behavior is documented
  - [ ] Error is logged for monitoring

### Code Quality

- [ ] No unused imports
- [ ] No debug code or console.log statements
- [ ] Proper error handling with try/catch
- [ ] Comments explain security reasoning
- [ ] No hardcoded values (use config where needed)

### Test Coverage

- [ ] SSRF: 28 test cases provided
- [ ] Rate Limit: Integration test recommended
- [ ] Edge cases covered (IPv6, wildcards, etc.)
- [ ] Negative tests (rejection cases) included

---

## Pre-Deployment Verification

### Build Verification

```bash
# [ ] Python service builds
cd services/ai
python -m py_compile app/main.py app/security_validation.py

# [ ] Node API builds
cd apps/api
npm run build

# [ ] No TypeScript errors
npx tsc --noEmit

# [ ] No ESLint violations
npm run lint
```

### Performance Verification

```bash
# [ ] SSRF validation is fast (<1ms per check)
pytest tests/test_security_validation.py -v --durations=10

# [ ] Rate limit middleware is fast (<5ms per request)
npm run test -- --testNamePattern="rate limit"
```

---

## Staging Deployment

### Pre-Staging

- [ ] Merge to staging branch
- [ ] Run CI/CD pipeline (all checks must pass)
- [ ] Deploy to staging environment

### Staging Tests

```bash
# [ ] Test SSRF rejection in staging
curl -X POST https://staging.archi-ai.dev/internal/assessment/active \
  -H "Authorization: Bearer <token>" \
  -d '{"allowed_hosts": ["192.168.1.1"]}'
# Expected: 400 error

# [ ] Test SSRF acceptance in staging
curl -X POST https://staging.archi-ai.dev/internal/assessment/active \
  -H "Authorization: Bearer <token>" \
  -d '{"allowed_hosts": ["example.com"]}'
# Expected: 200 or process normally

# [ ] Monitor for any 503 rate limit errors
# (May be expected if using staging Redis, but should be rare)
```

- [ ] No unexpected 503 errors
- [ ] Rate limiting works normally
- [ ] SSRF validation rejects private IPs
- [ ] SSRF validation accepts public IPs

### Staging Monitoring

- [ ] Monitor logs for errors
- [ ] Check APM metrics (if available)
- [ ] Monitor rate limit middleware for failures
- [ ] Check Redis connection pool health

---

## Production Deployment

### Pre-Production

- [ ] Get approval from security team
- [ ] Get approval from engineering lead
- [ ] Notify ops team of deployment
- [ ] Prepare rollback plan (revert to previous version)

### Deployment

- [ ] Tag release: `git tag v1.0.0-security-fix`
- [ ] Push tag: `git push origin v1.0.0-security-fix`
- [ ] Deploy to production using standard process
- [ ] Wait for all services to become healthy

### Post-Deployment

- [ ] Monitor all services for 30 minutes
- [ ] Check error rates (should be normal)
- [ ] Check rate limit 503 errors (should be near zero unless Redis fails)
- [ ] Verify no user-facing impact

### Production Verification

```bash
# [ ] Test SSRF rejection in production
curl -X POST https://api.archi-ai.dev/internal/assessment/active \
  -H "Authorization: Bearer <token>" \
  -d '{"allowed_hosts": ["10.0.0.1"]}'
# Expected: 400 error

# [ ] Test rate limiting is working
# (Make many rapid requests and expect 429 after limit)
for i in {1..100}; do
  curl http://localhost:4000/api/test
done
# Expected: Mix of 200 and 429 responses

# [ ] Check logs for any unusual errors
kubectl logs -l app=api -n production --tail=100
kubectl logs -l app=ai-service -n production --tail=100
```

- [ ] All health checks passing
- [ ] No error rate spike
- [ ] Rate limit responses are 429/503 as expected
- [ ] No user complaints or issues

---

## Post-Deployment

### Monitoring

- [ ] Set up alerts for 503 rate limit errors
- [ ] Set up alerts for 400 SSRF rejections (indicates attempted exploitation)
- [ ] Monitor Redis availability
- [ ] Track rate limit bypass attempts in logs

### Documentation

- [ ] Update CHANGELOG with fix details
- [ ] Update runbook if needed
- [ ] Notify security team of deployment
- [ ] Archive audit report with release notes

### Follow-up

- [ ] Plan P1 items for next sprint (dependency scanning, test coverage)
- [ ] Schedule security code review training
- [ ] Plan APM implementation
- [ ] Review dependency vulnerability scanning setup

---

## Rollback Plan

If issues occur:

1. **Immediate Action**:
   - [ ] Stop deployments
   - [ ] Check logs for errors
   - [ ] Determine if issue is related to fixes

2. **If Fix-Related Issue**:
   - [ ] Revert to previous version: `git revert <commit>`
   - [ ] Tag rollback: `git tag v1.0.0-security-fix-rollback`
   - [ ] Deploy previous version

3. **Post-Rollback**:
   - [ ] Investigate root cause
   - [ ] Fix issue in new branch
   - [ ] Repeat testing before redeployment

4. **Prevention**:
   - [ ] Add more comprehensive tests
   - [ ] Extend staging testing period
   - [ ] Run chaos engineering tests

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Lead | _____________ | _____________ | _____________ |
| Engineering Lead | _____________ | _____________ | _____________ |
| DevOps Lead | _____________ | _____________ | _____________ |
| QA Lead | _____________ | _____________ | _____________ |

---

**Deployment Status**: Ready for Production ✅  
**Risk Level**: LOW  
**Rollback Time**: <5 minutes  
**Estimated Duration**: 2 hours (review + test) + 30 minutes (deploy + verify)
