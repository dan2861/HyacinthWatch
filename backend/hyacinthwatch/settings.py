from datetime import timedelta
from pathlib import Path
import os
import dj_database_url
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
DOCKER_ENV_PATH = BASE_DIR / ".env.docker"

load_dotenv(ENV_PATH)

if os.environ.get("DJANGO_IN_DOCKER") == "1" or os.path.exists(DOCKER_ENV_PATH):
    load_dotenv(DOCKER_ENV_PATH, override=True)

SECRET_KEY = 'django-insecure-r1(_3#+6792j)$p((()#$^i7#-4w-06^pbjuo6zx=mxsa6&ile'

DEBUG = True

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'storages',
    'observations',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Allow CRA dev server
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.74.82.53:3000',
]

CORS_ALLOW_CREDENTIALS = True

if os.environ.get('CORS_ALLOW_ALL') in ('1', 'true', 'True'):
    CORS_ALLOW_ALL_ORIGINS = True

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'observations.authentication.SupabaseJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
}

ROOT_URLCONF = 'hyacinthwatch.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'hyacinthwatch.wsgi.application'

DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    qs = dict(parse_qsl(parsed.query))
    qs.pop('pgbouncer', None)
    sanitized_query = urlencode(qs)
    sanitized = urlunparse(parsed._replace(query=sanitized_query))
    DATABASES = {'default': dj_database_url.parse(sanitized, conn_max_age=600, ssl_require=(
        os.environ.get('PGSSLMODE', '').lower() == 'require'))}
    try:
        DATABASES['default'].setdefault('OPTIONS', {})
        DATABASES['default']['OPTIONS'].setdefault(
            'connect_timeout', int(os.environ.get('DB_CONNECT_TIMEOUT', 5)))
    except Exception:
        pass
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'postgres'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD'),
            'HOST': os.environ.get('DB_HOST'),
            'PORT': os.environ.get('DB_PORT', '6543'),
            'OPTIONS': {
                'sslmode': os.environ.get('PGSSLMODE', 'require'),
                # Fail fast when remote DB is unreachable (seconds)
                'connect_timeout': int(os.environ.get('DB_CONNECT_TIMEOUT', 5)),
            },
        },
    }

try:
    _db_info = DATABASES.get('default', {})
    print(
        f"[settings] Using DB engine={_db_info.get('ENGINE')} host={_db_info.get('HOST')} port={_db_info.get('PORT')}")
except Exception:
    pass

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

DEFAULT_FILE_STORAGE = os.environ.get(
    'DEFAULT_FILE_STORAGE', 'django.core.files.storage.FileSystemStorage')

if os.environ.get('USE_S3', '0') == '1':
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', None)
    AWS_S3_ENDPOINT_URL = os.environ.get(
        'AWS_S3_ENDPOINT_URL') or os.environ.get('SUPABASE_URL')
    AWS_S3_ADDRESSING_STYLE = os.environ.get('AWS_S3_ADDRESSING_STYLE', 'path')
    AWS_DEFAULT_ACL = os.environ.get('AWS_DEFAULT_ACL', None)

CELERY_BROKER_CONNECTION_RETRY = True
CELERY_BROKER_CONNECTION_MAX_RETRIES = None
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'visibility_timeout': int(os.environ.get('CELERY_VISIBILITY_TIMEOUT', 3600))
}

ORPHAN_PRESENCE_DELAY_MINUTES = int(
    os.environ.get('ORPHAN_PRESENCE_DELAY_MINUTES', '10'))
ORPHAN_PRESENCE_MAX_RETRIES = int(
    os.environ.get('ORPHAN_PRESENCE_MAX_RETRIES', '3'))

CELERY_BEAT_SCHEDULE = {
    'monitor-orphaned-observations': {
        'task': 'observations.monitor.retry_orphaned_presence',
        'schedule': timedelta(minutes=int(os.environ.get('ORPHAN_MONITOR_SCHEDULE_MINUTES', '5'))),
        'args': (),
    },
}
