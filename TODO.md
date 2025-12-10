# TODO

This document tracks known issues, technical debt, missing features, and improvements for the HyacinthWatch project.

## 🔴 Security (High Priority)

### SEC-001: Hardcoded SECRET_KEY in Settings ✅ COMPLETED
**Priority:** Critical  
**Location:** `backend/hyacinthwatch/settings.py:17-34`  
**Issue:** Django `SECRET_KEY` is hardcoded in source code, exposing security vulnerabilities.  
**Solution:**
- ✅ Move `SECRET_KEY` to environment variable
- ✅ Generate new secret key: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- ✅ Update `.env.example` with placeholder
- ✅ Add validation to fail fast if missing in production

**Status:** Fixed. `SECRET_KEY` now reads from environment variable with production validation. Development fallback generates temporary key with warning. `.env.example` created with instructions.

**Next Steps for Deployment:**
1. Generate a new secret key: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
2. Add `SECRET_KEY=<your-generated-key>` to your `.env` file (or production environment variables)
3. Ensure `.env` is in `.gitignore` (should already be)
4. Rotate any existing sessions/tokens that were created with the old hardcoded key

### SEC-002: DEBUG Mode Enabled in Production Settings ✅ COMPLETED
**Priority:** Critical  
**Location:** `backend/hyacinthwatch/settings.py:18,39-50`  
**Issue:** `DEBUG=True` exposes sensitive information and should never be enabled in production.  
**Solution:**
- ✅ Set `DEBUG=False` by default
- ✅ Use environment variable: `DEBUG=os.environ.get('DEBUG', 'False').lower() == 'true'`
- ✅ Ensure `ALLOWED_HOSTS` is properly configured when `DEBUG=False`

**Status:** Fixed. `DEBUG` now defaults to `False` for security. `ALLOWED_HOSTS` is configurable via environment variable with sensible defaults for development and warnings for production.

**Next Steps for Deployment:**
1. Set `DEBUG=False` in production environment (or omit it to use the secure default)
2. Configure `ALLOWED_HOSTS` with your production domain(s): `ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com`
3. For local development, explicitly set `DEBUG=True` in your `.env` file
4. Test that the application works correctly with `DEBUG=False` before deploying

### SEC-003: Insecure JWT Fallback in DEBUG Mode
**Priority:** High  
**Location:** `backend/observations/authentication.py:44-54`, `backend/observations/jwt_utils.py:68-77`  
**Issue:** JWT signature verification is bypassed in DEBUG mode, allowing unverified tokens.  
**Solution:**
- Remove or restrict dev fallback to localhost-only
- Add explicit warning logs when fallback is used
- Consider using separate dev/staging JWT keys instead of bypassing verification

### SEC-004: Default Permission Class is AllowAny
**Priority:** High  
**Location:** `backend/hyacinthwatch/settings.py:64`  
**Issue:** `DEFAULT_PERMISSION_CLASSES: ['rest_framework.permissions.AllowAny']` allows unauthenticated access to all endpoints.  
**Solution:**
- Change default to `IsAuthenticated` or `IsAuthenticatedOrReadOnly`
- Explicitly set `AllowAny` on public endpoints (e.g., health checks)
- Review all views to ensure proper permission classes

### SEC-005: CORS Configuration Allows All Origins in Some Cases
**Priority:** Medium  
**Location:** `backend/hyacinthwatch/settings.py:60-61`  
**Issue:** `CORS_ALLOW_ALL_ORIGINS = True` when `CORS_ALLOW_ALL=1` is set, which is too permissive.  
**Solution:**
- Remove `CORS_ALLOW_ALL` option or restrict to development only
- Use explicit `CORS_ALLOWED_ORIGINS` list in all environments
- Document CORS requirements in deployment guide

## ⚡ Performance & Architecture

### PERF-001: ML Inference Runs Before QC Check
**Priority:** High  
**Location:** `backend/observations/views.py:274-284`, `backend/workers/tasks.py:classify_presence`  
**Issue:** Expensive ML inference (presence classification) runs before quality control check, wasting compute on low-quality images.  
**Solution:**
- Reorder pipeline: QC → Presence → Segmentation
- Add early exit in `classify_presence` if `qc_score < threshold` (e.g., 0.5)
- Update `ObservationRefCreate.post()` to run QC synchronously before enqueuing ML tasks
- Consider making QC a prerequisite for ML tasks

### PERF-002: Missing Celery Task Retry Configuration
**Priority:** High  
**Location:** `backend/workers/tasks.py`  
**Issue:** Celery tasks (`classify_presence`, `segment_and_cover`) lack automatic retry configuration with exponential backoff.  
**Solution:**
- Add `@shared_task(autoretry_for=(Exception,), retry_backoff=True, retry_backoff_max=600, max_retries=3)` decorators
- Implement task-specific retry logic for transient failures (network, model loading)
- Add retry tracking in observation metadata
- Configure dead letter queue for permanently failed tasks

### PERF-003: Single Celery Queue for All Tasks
**Priority:** Medium  
**Location:** Celery configuration  
**Issue:** All tasks (presence, segmentation, QC) use the same queue, allowing slow segmentation tasks to block faster presence tasks.  
**Solution:**
- Implement priority queues: `high_priority` (presence), `medium_priority` (segmentation), `low_priority` (QC)
- Configure Celery routing: `task_routes = {'workers.tasks.classify_presence': {'queue': 'high_priority'}}`
- Use separate worker pools for different queues
- Monitor queue depths and adjust worker allocation

### PERF-004: No Database Query Optimization
**Priority:** Medium  
**Location:** `backend/observations/views.py`  
**Issue:** Views may perform N+1 queries (e.g., `ObservationListCreate.get()`).  
**Solution:**
- Add `select_related()` and `prefetch_related()` for foreign key relationships
- Use `only()` or `defer()` to limit fetched fields
- Add database indexes on frequently queried fields (`created_at`, `status`, `user_id`)
- Profile queries with Django Debug Toolbar or `django.db.backends` logging

### PERF-005: Missing Model Caching
**Priority:** Low  
**Location:** `backend/workers/model_loader.py`  
**Issue:** ML models are loaded on every task execution, causing unnecessary I/O and memory churn.  
**Solution:**
- Implement in-memory model cache with LRU eviction
- Use `functools.lru_cache` or custom cache for model instances
- Consider model warming on worker startup
- Monitor memory usage and cache hit rates

## 🚀 Features

### FEAT-001: PWA Service Worker Not Fully Implemented
**Priority:** High  
**Location:** `hyacinthwatch-pwa/src/service-worker.js`, `hyacinthwatch-pwa/src/serviceWorkerRegistration.js`  
**Issue:** Service worker exists but lacks runtime caching, offline fallback, and background sync.  
**Solution:**
- Implement runtime caching for API responses (NetworkFirst strategy)
- Add offline fallback page (`/offline.html`)
- Implement Background Sync API for queued uploads
- Add cache versioning and cleanup strategies
- Test service worker lifecycle (install, activate, fetch events)

### FEAT-002: Missing PWA Manifest Enhancements
**Priority:** Medium  
**Location:** `hyacinthwatch-pwa/public/manifest.json`  
**Issue:** Manifest lacks maskable icons, screenshots, and proper theme configuration.  
**Solution:**
- Generate maskable icons (Android adaptive icons)
- Add screenshots for app store listings
- Configure theme colors matching app design
- Add categories and description metadata
- Test installability on iOS and Android

### FEAT-003: No Background Sync for Offline Observations
**Priority:** High  
**Location:** `hyacinthwatch-pwa/src/App.js:275-285`  
**Issue:** Offline observations only sync when user manually triggers or when `online` event fires; no automatic background sync.  
**Solution:**
- Implement Background Sync API registration
- Queue failed uploads in IndexedDB with sync tags
- Register sync event handler in service worker
- Add retry logic with exponential backoff
- Show sync status in UI

### FEAT-004: Missing API Rate Limiting
**Priority:** Medium  
**Location:** Backend API views  
**Issue:** No rate limiting on upload endpoints, allowing abuse and DoS.  
**Solution:**
- Install `django-ratelimit` or use DRF throttling classes
- Configure per-user rate limits (e.g., 10 uploads/minute)
- Add IP-based rate limiting for unauthenticated endpoints
- Return appropriate HTTP 429 responses with Retry-After header
- Log rate limit violations for monitoring

### FEAT-005: No Image Compression Before Upload
**Priority:** Low  
**Location:** `hyacinthwatch-pwa/src/App.js`  
**Issue:** Full-resolution images are uploaded, increasing bandwidth and storage costs.  
**Solution:**
- Implement client-side image compression using `browser-image-compression` or similar
- Resize images to max 1920x1920px while maintaining aspect ratio
- Compress JPEG quality to 85% (configurable)
- Show compression progress in UI
- Make compression optional for high-quality submissions

## 🧪 Testing & Quality

### TEST-001: Insufficient Test Coverage
**Priority:** High  
**Location:** `backend/observations/tests/`, `hyacinthwatch-pwa/src/App.test.js`  
**Issue:** Limited test coverage; only segmentation fallback tests exist.  
**Solution:**
- Add unit tests for authentication (`authentication.py`)
- Add integration tests for observation upload flow
- Add tests for Celery tasks (use `@override_settings` and mock model loading)
- Add API endpoint tests using DRF `APIClient`
- Add frontend component tests for critical user flows
- Target 80%+ code coverage

### TEST-002: No End-to-End Testing
**Priority:** Medium  
**Location:** Project root  
**Issue:** No E2E tests for complete user workflows (upload → processing → visualization).  
**Solution:**
- Set up Playwright or Cypress for E2E testing
- Test critical paths: user registration → photo upload → view results
- Test offline → online sync flow
- Add E2E tests to CI/CD pipeline
- Run E2E tests against staging environment

### TEST-003: Missing Test Data Fixtures
**Priority:** Low  
**Location:** `backend/observations/fixtures/`  
**Issue:** No reusable test fixtures for observations, users, or game profiles.  
**Solution:**
- Create Django fixtures for common test scenarios
- Add factory classes using `factory_boy` for dynamic test data
- Document fixture usage in test README

## 🔧 Technical Debt

### DEBT-001: Authentication/Authorization Inconsistency
**Priority:** High  
**Location:** `backend/observations/authentication.py`, `backend/hyacinthwatch/settings.py:64`  
**Issue:** Mix of DRF permission classes (`AllowAny` default) and custom JWT authentication creates inconsistent authorization behavior.  
**Solution:**
- Standardize on DRF permission classes for all views
- Remove `AllowAny` default; use `IsAuthenticated` or view-specific permissions
- Create custom permission classes for role-based access (researcher, moderator)
- Document authentication flow in `backend/README.md`
- Add permission tests

### DEBT-002: Duplicate Task Definitions
**Priority:** Medium  
**Location:** `backend/observations/tasks.py`, `backend/workers/tasks.py`  
**Issue:** Some tasks exist in both `observations/tasks.py` (legacy) and `workers/tasks.py` (current), causing confusion.  
**Solution:**
- Consolidate all Celery tasks in `workers/tasks.py`
- Remove or deprecate `observations/tasks.py`
- Update all imports to use `workers.tasks`
- Add deprecation warnings if legacy tasks are still imported

### DEBT-003: Inconsistent Error Handling
**Priority:** Medium  
**Location:** Throughout codebase  
**Issue:** Error handling is inconsistent; some functions use try/except with logging, others silently fail.  
**Solution:**
- Standardize error handling pattern: log exception, return appropriate response/status
- Use Django's logging framework consistently
- Add structured error responses (error codes, messages)
- Create custom exception classes for domain-specific errors
- Add error monitoring (Sentry integration)

### DEBT-004: Missing Type Hints
**Priority:** Low  
**Location:** Python codebase  
**Issue:** Most Python functions lack type hints, reducing code maintainability.  
**Solution:**
- Add type hints to all function signatures
- Use `mypy` for type checking in CI
- Gradually add types starting with public APIs
- Document type requirements in contributing guide

### DEBT-005: Requirements.txt Not Pinned
**Priority:** Medium  
**Location:** `backend/requirements.txt`, `backend/requirements_worker.txt`  
**Issue:** Dependencies use unpinned versions (e.g., `celery>=5.3.0`), causing potential version conflicts.  
**Solution:**
- Pin all dependency versions (e.g., `celery==5.3.0`)
- Use `pip freeze > requirements.txt` to generate pinned versions
- Document version update process
- Add dependency vulnerability scanning (e.g., `safety`)

## 📚 Documentation

### DOC-001: Missing API Documentation
**Priority:** High  
**Location:** Backend API  
**Issue:** No OpenAPI/Swagger documentation for API endpoints.  
**Solution:**
- Install `drf-spectacular` or `drf-yasg` for OpenAPI schema generation
- Add API documentation endpoint (`/api/schema/`)
- Document request/response formats, authentication, error codes
- Include example requests/responses

### DOC-002: Missing Architecture Decision Records (ADRs)
**Priority:** Low  
**Location:** `docs/` directory  
**Issue:** No documentation of architectural decisions (e.g., why Supabase for auth, why Celery for tasks).  
**Solution:**
- Create `docs/adr/` directory
- Document key decisions: authentication strategy, task queue choice, storage solution
- Use ADR template (context, decision, consequences)

### DOC-003: Incomplete Deployment Guide
**Priority:** Medium  
**Location:** `infra/README.md`  
**Issue:** Deployment guide may lack production-specific configurations.  
**Solution:**
- Add production environment variable checklist
- Document database migration process
- Add monitoring and alerting setup guide
- Include rollback procedures
- Document backup/restore procedures

## 🔍 Monitoring & Observability

### MON-001: No Application Performance Monitoring (APM)
**Priority:** Medium  
**Location:** Backend  
**Issue:** No APM tool to track request latency, database query performance, or Celery task duration.  
**Solution:**
- Integrate APM tool (e.g., Datadog, New Relic, Sentry Performance)
- Add custom metrics for ML inference latency
- Set up dashboards for key metrics
- Configure alerts for performance degradation

### MON-002: Limited Logging Configuration
**Priority:** Medium  
**Location:** `backend/hyacinthwatch/settings.py`  
**Issue:** No structured logging configuration; logs may not be aggregated in production.  
**Solution:**
- Configure structured logging (JSON format)
- Set up log aggregation (ELK stack, CloudWatch, etc.)
- Add correlation IDs for request tracing
- Configure log levels per environment
- Add log rotation and retention policies

### MON-003: No Health Check Endpoint
**Priority:** Low  
**Location:** Backend API  
**Issue:** No health check endpoint for load balancers and monitoring tools.  
**Solution:**
- Add `/health/` endpoint checking database, Redis, and Supabase connectivity
- Return appropriate status codes (200 healthy, 503 unhealthy)
- Add `/ready/` endpoint for Kubernetes readiness probes
- Document health check usage

## 🐳 DevOps & Infrastructure

### DEVOPS-001: Missing CI/CD Pipeline
**Priority:** High  
**Location:** `.github/workflows/` or `.gitlab-ci.yml`  
**Issue:** No automated testing, linting, or deployment pipeline.  
**Solution:**
- Set up GitHub Actions or GitLab CI
- Add jobs for: linting (Black, ESLint), testing, security scanning
- Add automated deployment to staging on merge to `develop`
- Add manual approval gate for production deployment
- Document CI/CD process

### DEVOPS-002: No Docker Image Versioning
**Priority:** Medium  
**Location:** `infra/docker-compose.yml`  
**Issue:** Docker images may use `latest` tag, making rollbacks difficult.  
**Solution:**
- Tag Docker images with version numbers or commit SHAs
- Use semantic versioning for releases
- Document image tagging strategy
- Set up image registry (Docker Hub, GitHub Container Registry)

### DEVOPS-003: Missing Database Migration Strategy
**Priority:** Medium  
**Location:** Backend  
**Issue:** No documented process for applying migrations in production.  
**Solution:**
- Document migration workflow (test → staging → production)
- Add migration rollback procedures
- Set up migration testing in CI
- Consider using migration locks to prevent concurrent migrations

## ❓ Questions & Research

### Q-001: Direct Supabase Storage Upload from PWA
**Priority:** Low  
**Location:** `hyacinthwatch-pwa/src/App.js:237-255`  
**Question:** How does the React app get signed URLs and directly store images in Supabase Storage, bypassing the backend?  
**Research Needed:**
- Document the signed URL generation flow
- Verify security implications (authentication, authorization)
- Determine if this is intentional or should be changed
- Update architecture diagram if this is the intended flow

---

## Legend

- **Priority Levels:**
  - 🔴 Critical: Security vulnerabilities, data loss risks
  - 🟠 High: Major functionality gaps, performance issues
  - 🟡 Medium: Important improvements, technical debt
  - 🟢 Low: Nice-to-have features, minor improvements

- **Status Tracking:**
  - Use GitHub Issues to track individual items
  - Link issues to this TODO using issue numbers (e.g., `SEC-001: #123`)
  - Update this file when items are completed or deprioritized

---

**Last Updated:** 2025-01-05  
**Maintainer:** Dan2861
