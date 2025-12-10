# Infrastructure & Deployment

Docker Compose configuration and deployment documentation for HyacinthWatch.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Services](#services)
- [Configuration](#configuration)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Overview

This directory contains Docker Compose configuration for running the entire HyacinthWatch stack locally or in production. The setup includes:

- Django backend API server
- Celery workers for ML inference
- Redis message broker
- PostgreSQL database (optional, can use external)

## Architecture

```
┌─────────────────┐
│   Backend API   │  ← Django + Gunicorn
│   (Port 8000)   │
└────────┬────────┘
         │
         ├─→ Redis (Port 6379)
         │
         └─→ Celery Worker
              └─→ ML Models
```

### Service Dependencies

```
backend → Redis (health check)
worker → Redis (health check)
```

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

### Running the Stack

1. **Navigate to infra directory**
   ```bash
   cd infra
   ```

2. **Configure environment**
   ```bash
   cd ../backend
   cp .env.example .env.docker
   # Edit .env.docker with your configuration
   ```

3. **Start services**
   ```bash
   cd ../infra
   docker-compose up -d
   ```

4. **Check service status**
   ```bash
   docker-compose ps
   ```

5. **View logs**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f backend
   docker-compose logs -f worker
   ```

6. **Stop services**
   ```bash
   docker-compose down
   ```

### Accessing Services

- **Backend API**: http://localhost:8000
- **Redis**: localhost:6379
- **PostgreSQL**: If included, localhost:5432

## Services

### Backend (`backend`)

**Image**: Built from `../backend/Dockerfile`

**Configuration:**
- Port: `8000:8000`
- Environment: Loads from `../backend/.env.docker`
- Volumes:
  - `../backend:/app` (code hot-reload)
  - Optional: `media_files:/app/media` (persistent media)

**Command:**
```bash
python manage.py migrate &&
gunicorn hyacinthwatch.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --log-level info
```

**Health Check:**
- Manual: `curl http://localhost:8000/v1/debug/headers`

### Worker (`worker`)

**Image**: Built from `../backend/Dockerfile.worker`

**Configuration:**
- Environment: Loads from `../backend/.env.docker`
- Volumes:
  - `../backend:/app` (code hot-reload)
- Depends on: `redis` (health check)

**Command:**
```bash
python wait_for_redis.py &&
python manage.py migrate &&
celery -A hyacinthwatch.celery worker --loglevel=info
```

**Concurrency:**
- Default: 8 workers (prefork mode)
- Adjust in Dockerfile or command

### Redis (`redis`)

**Image**: `redis:7-alpine`

**Configuration:**
- Port: `6379:6379`
- Health check: `redis-cli ping`
- Persistence: Not configured (data lost on restart)

**For Production:**
- Add volume for persistence
- Configure password authentication
- Set up Redis Sentinel for HA

## Configuration

### Environment Variables

All services use `../backend/.env.docker`. Key variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname
# Or individual settings:
DB_NAME=hyacinthwatch
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=postgres  # Use service name in Docker
DB_PORT=5432

# Django
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
STORAGE_BUCKET_OBS=observations
STORAGE_BUCKET_MASKS=masks

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_VISIBILITY_TIMEOUT=3600

# Model Versions
PRESENCE_MODEL_VERSION=1.0.0
SEGMENTATION_MODEL_VERSION=1.0.1
```

### Docker Compose Overrides

Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'

services:
  backend:
    ports:
      - "8000:8000"
      - "5678:5678"  # Debug port
    environment:
      - DEBUG=1
```

### Network Configuration

Services communicate via Docker's default bridge network:
- Service names are hostnames (e.g., `redis`, `backend`)
- Use service names in connection strings

## Development

### Hot Reload

Code changes are reflected automatically:
- Backend: Volume mount enables hot reload
- Worker: Restart required for code changes
  ```bash
  docker-compose restart worker
  ```

### Running Migrations

Migrations run automatically on startup. To run manually:

```bash
docker-compose exec backend python manage.py migrate
```

### Django Shell

```bash
docker-compose exec backend python manage.py shell
```

### Celery Task Inspection

```bash
# Active tasks
docker-compose exec worker celery -A hyacinthwatch.celery inspect active

# Registered tasks
docker-compose exec worker celery -A hyacinthwatch.celery inspect registered

# Worker stats
docker-compose exec worker celery -A hyacinthwatch.celery inspect stats
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f worker

# Last 100 lines
docker-compose logs --tail=100 backend

# Since timestamp
docker-compose logs --since=10m backend
```

### Rebuilding Images

```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build backend

# Rebuild without cache
docker-compose build --no-cache backend
```

## Production Deployment

### Production Considerations

1. **Security**
   - Set `DEBUG=False`
   - Use strong `SECRET_KEY`
   - Configure `ALLOWED_HOSTS`
   - Enable HTTPS (use reverse proxy)
   - Secure Redis with password
   - Use secrets management

2. **Performance**
   - Adjust Gunicorn workers (CPU cores * 2 + 1)
   - Configure Celery concurrency
   - Enable database connection pooling
   - Use production-grade Redis (persistence, HA)

3. **Reliability**
   - Add health checks
   - Configure restart policies
   - Set up monitoring and alerting
   - Use external PostgreSQL
   - Backup strategy

4. **Scaling**
   - Run multiple worker instances
   - Use Redis Cluster for high availability
   - Load balance backend instances
   - Use managed database service

### Production Docker Compose

Example `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    restart: always
    environment:
      - DEBUG=False
      - ALLOWED_HOSTS=yourdomain.com
    command: >
      sh -c "python manage.py migrate &&
             gunicorn hyacinthwatch.wsgi:application
               --bind 0.0.0.0:8000
               --workers 4
               --timeout 120
               --access-logfile -
               --error-logfile -"

  worker:
    restart: always
    deploy:
      replicas: 2
    command: >
      sh -c "python wait_for_redis.py &&
             celery -A hyacinthwatch.celery worker
               --loglevel=info
               --concurrency=4"

  redis:
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
```

### Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Database

For production, use external PostgreSQL:
- Managed service (AWS RDS, Google Cloud SQL, etc.)
- Update `DATABASE_URL` in `.env.docker`
- Configure connection pooling
- Set up automated backups

### Monitoring

Recommended tools:
- **Application**: Sentry, Rollbar
- **Infrastructure**: Prometheus, Grafana
- **Logs**: ELK Stack, Loki
- **APM**: New Relic, Datadog

### Backup Strategy

1. **Database**: Daily automated backups
2. **Media files**: Sync to cloud storage
3. **Redis**: Optional persistence (if critical)
4. **Configuration**: Version control

## Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Check logs
   docker-compose logs
   
   # Check Docker resources
   docker system df
   docker system prune  # If needed
   ```

2. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :8000
   
   # Change port in docker-compose.yml
   ports:
     - "8001:8000"
   ```

3. **Database connection errors**
   - Verify `DATABASE_URL` or DB settings
   - Check database is accessible
   - Verify network connectivity

4. **Redis connection errors**
   - Verify Redis is running: `docker-compose ps redis`
   - Check `CELERY_BROKER_URL` uses service name: `redis://redis:6379/0`
   - Test connection: `docker-compose exec backend python -c "import redis; r=redis.Redis(host='redis'); r.ping()"`

5. **Worker not processing tasks**
   - Check worker logs: `docker-compose logs worker`
   - Verify Redis connection
   - Check task registration: `docker-compose exec worker celery -A hyacinthwatch.celery inspect registered`

6. **Out of memory**
   - Reduce worker concurrency
   - Reduce Gunicorn workers
   - Increase Docker memory limit

### Debugging Commands

```bash
# Enter container shell
docker-compose exec backend bash
docker-compose exec worker bash

# Check environment variables
docker-compose exec backend env | grep DATABASE

# Test database connection
docker-compose exec backend python manage.py dbshell

# Test Redis connection
docker-compose exec backend python -c "import redis; r=redis.Redis(host='redis'); print(r.ping())"

# Check service health
docker-compose ps
docker stats
```

### Cleaning Up

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (data loss!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Full cleanup
docker-compose down -v --rmi all
docker system prune -a
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [Celery Documentation](https://docs.celeryproject.org/)

---

**Last Updated**: 2025-01-05

