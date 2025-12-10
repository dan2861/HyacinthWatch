# HyacinthWatch Backend

Django REST API backend with Celery workers for ML-powered image analysis.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

The backend provides:
- REST API for observation uploads and retrieval
- Celery workers for asynchronous ML inference
- Quality control (QC) scoring
- Gamification system (points, levels)
- Supabase JWT authentication
- Image storage (local filesystem or Supabase Storage)

## Architecture

### Components

- **Django API Server**: Handles HTTP requests, manages observations
- **Celery Workers**: Process ML tasks asynchronously
- **Redis**: Message broker for Celery
- **PostgreSQL**: Primary database
- **Supabase Storage**: Optional cloud storage for images and models

### Task Flow

```
Upload → API → Enqueue Tasks → Redis → Celery Workers
                                      ├─ Presence Classification
                                      └─ Segmentation
```

See [../WORKFLOW.md](../WORKFLOW.md) for detailed workflow.

## Setup

### Prerequisites

- Python 3.10+
- PostgreSQL 12+
- Redis 6+
- Supabase account (for storage and auth)

### Installation

1. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   pip install -r requirements_worker.txt  # For ML workers
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser** (optional)
   ```bash
   python manage.py createsuperuser
   ```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hyacinthwatch
# Or use individual settings:
DB_NAME=hyacinthwatch
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
PGSSLMODE=prefer

# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STORAGE_BUCKET_OBS=observations
STORAGE_BUCKET_MASKS=masks

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_VISIBILITY_TIMEOUT=3600

# Model Versions
PRESENCE_MODEL_VERSION=1.0.0
SEGMENTATION_MODEL_VERSION=1.0.1

# Storage
DEFAULT_FILE_STORAGE=django.core.files.storage.FileSystemStorage
USE_S3=0  # Set to 1 to use Supabase Storage

# Orphan Monitoring
ORPHAN_PRESENCE_DELAY_MINUTES=10
ORPHAN_PRESENCE_MAX_RETRIES=3
ORPHAN_MONITOR_SCHEDULE_MINUTES=5
```

### Running Locally

1. **Start Redis** (if not using Docker)
   ```bash
   redis-server
   ```

2. **Start Django development server**
   ```bash
   python manage.py runserver
   ```

3. **Start Celery worker** (in separate terminal)
   ```bash
   celery -A hyacinthwatch.celery worker --loglevel=info
   ```

4. **Start Celery beat** (for scheduled tasks, optional)
   ```bash
   celery -A hyacinthwatch.celery beat --loglevel=info
   ```

### Docker Setup

See [../infra/README.md](../infra/README.md) for Docker Compose setup.

## API Documentation

### Base URL

- Development: `http://localhost:8000`
- Production: Configure `ALLOWED_HOSTS` in settings

### Endpoints

#### Observations

##### `POST /v1/observations`
Upload a new observation.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Headers:
  - `Authorization: Bearer <supabase-jwt-token>` (optional)
- Body:
  - `image`: Image file (required)
  - `metadata`: JSON string with:
    - `id`: UUID (optional, auto-generated if not provided)
    - `captured_at`: ISO8601 timestamp (required)
    - `lat`: Latitude (optional)
    - `lon`: Longitude (optional)
    - `location_accuracy_m`: Accuracy in meters (optional)
    - `device_info`: Device information string (optional)
    - `notes`: User notes (optional)

**Response:**
```json
{
  "id": "uuid",
  "image": "url",
  "image_url": "supabase://bucket/path",
  "captured_at": "2025-01-05T12:00:00Z",
  "lat": 40.7128,
  "lon": -74.0060,
  "status": "received",
  "created_at": "2025-01-05T12:00:00Z",
  ...
}
```

##### `GET /v1/observations`
List observations (returns first 50).

**Query Parameters:**
- None (pagination not yet implemented)

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "status": "done",
      "pred": {
        "presence": {
          "score": 0.85,
          "label": "present",
          "model_v": "1.0.0"
        },
        "seg": {
          "cover_pct": 12.5,
          "model_v": "1.0.0",
          "mask_url": "supabase://masks/user_id/obs_id.png"
        }
      },
      ...
    }
  ]
}
```

##### `GET /v1/observations/<uuid>`
Get a single observation by ID.

**Response:**
```json
{
  "id": "uuid",
  "status": "done",
  "qc": {...},
  "qc_score": 0.85,
  "pred": {...},
  ...
}
```

##### `GET /v1/observations/<uuid>/signed_url`
Get a signed URL for accessing the observation image.

**Authentication:** Required (Supabase JWT)

**Response:**
```json
{
  "signed_url": "https://..."
}
```

#### Quality Control

##### `GET /v1/qc/summary`
Get QC analytics summary.

**Query Parameters:**
- `start`: Start date (ISO8601)
- `end`: End date (ISO8601)
- `min_confidence`: Minimum QC score
- `granularity`: `hour`, `day`, `week`, `month`
- `platform`: Filter by platform
- `species`: Filter by species

**Response:**
```json
{
  "summary": {...},
  "time_series": [...],
  "histograms": {...}
}
```

#### Gamification

##### `GET /v1/game/profile`
Get authenticated user's game profile (points, level).

**Authentication:** Required (Supabase JWT)

**Response:**
```json
{
  "user": "user_id",
  "points": 150,
  "level": 3,
  "observations_count": 25
}
```

### Authentication

The API supports Supabase JWT authentication:

1. Client obtains JWT token from Supabase
2. Include token in `Authorization: Bearer <token>` header
3. Backend verifies token and maps Supabase user to Django user

See `observations/authentication.py` for implementation.

## Configuration

### Django Settings

Key settings in `hyacinthwatch/settings.py`:

- **CORS**: Configured for React dev servers
- **Database**: PostgreSQL via `DATABASE_URL` or individual settings
- **Storage**: FileSystemStorage (default) or Supabase Storage
- **Celery**: Redis broker configuration
- **Authentication**: Supabase JWT + Session + Basic

### Model Configuration

Models are loaded from Supabase Storage:
- Path: `models/{task}/{version}/`
- Files: `model_meta.json`, `{weights_filename}.pt`
- Versions controlled via environment variables

See `workers/model_loader.py` for loading logic.

## Development

### Project Structure

```
backend/
├── hyacinthwatch/        # Django project
│   ├── settings.py       # Configuration
│   ├── urls.py          # URL routing
│   ├── celery.py        # Celery configuration
│   └── wsgi.py          # WSGI application
├── observations/         # Main app
│   ├── models.py        # Database models
│   ├── views.py         # API views
│   ├── serializers.py   # DRF serializers
│   ├── tasks.py         # Celery tasks (legacy)
│   ├── authentication.py # JWT auth
│   ├── gamification.py  # Points system
│   ├── qc.py            # Quality control
│   └── urls.py          # App URLs
├── workers/              # Celery workers
│   ├── tasks.py         # ML inference tasks
│   └── model_loader.py  # Model loading
├── utils/                # Utilities
│   └── storage.py       # Supabase storage helpers
└── manage.py            # Django management
```

### Adding New Endpoints

1. Create view in `observations/views.py`
2. Add URL pattern in `observations/urls.py`
3. Update serializer if needed
4. Add tests

### Adding New Celery Tasks

1. Define task in `workers/tasks.py`
2. Register with `@shared_task` decorator
3. Enqueue from views or other tasks
4. Handle errors and retries

### Database Migrations

```bash
# Create migration
python manage.py makemigrations

# Apply migration
python manage.py migrate

# Show migration status
python manage.py showmigrations
```

### Management Commands

```bash
# List Supabase bucket contents
python manage.py list_bucket

# List orphaned observations
python manage.py list_orphans

# Purge absent observations
python manage.py purge_absent

# Enqueue pilot observations
python manage.py enqueue_pilot
```

## Testing

### Running Tests

```bash
# All tests
python manage.py test

# Specific app
python manage.py test observations

# Specific test
python manage.py test observations.tests.TestObservationModel
```

### Test Structure

```
observations/
├── tests/
│   ├── __init__.py
│   ├── test_segmentation_fallback.py
│   └── test_segmentation_fallback2.py
└── tests.py
```

### Writing Tests

```python
from django.test import TestCase
from observations.models import Observation

class ObservationTestCase(TestCase):
    def setUp(self):
        # Setup test data
        pass
    
    def test_observation_creation(self):
        # Test logic
        pass
```

## Deployment

### Production Settings

1. **Set `DEBUG=False`**
2. **Configure `ALLOWED_HOSTS`**
3. **Use strong `SECRET_KEY`**
4. **Enable HTTPS**
5. **Configure database connection pooling**
6. **Set up logging**
7. **Configure static file serving**

### WSGI Server

Production uses Gunicorn:

```bash
gunicorn hyacinthwatch.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120 \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --log-level info
```

### Celery Workers

```bash
celery -A hyacinthwatch.celery worker \
  --loglevel=info \
  --concurrency=8
```

### Monitoring

- Monitor Celery queue length
- Track task execution times
- Monitor database connections
- Set up error alerting

### Health Checks

- API: `GET /v1/debug/headers` (for testing)
- Database: Django admin or custom endpoint
- Redis: `redis-cli ping`
- Celery: Monitor worker logs

## Troubleshooting

### Common Issues

1. **Database connection errors**
   - Check `DATABASE_URL` or individual DB settings
   - Verify PostgreSQL is running
   - Check SSL mode settings

2. **Celery tasks not executing**
   - Verify Redis is running
   - Check `CELERY_BROKER_URL`
   - Review worker logs

3. **Model loading failures**
   - Verify Supabase credentials
   - Check model paths in Supabase Storage
   - Review model version environment variables

4. **Storage upload failures**
   - Verify Supabase Storage bucket exists
   - Check service role key permissions
   - Review storage configuration

### Debugging

```bash
# Django shell
python manage.py shell

# Celery task inspection
celery -A hyacinthwatch.celery inspect active

# Redis inspection
redis-cli
> KEYS *
> LLEN celery
```

## Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Celery Documentation](https://docs.celeryproject.org/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Supabase Python Client](https://github.com/supabase/supabase-py)

---

**Last Updated**: 2025-01-05

