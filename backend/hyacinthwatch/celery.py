import os
from celery import Celery

# default Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hyacinthwatch.settings")

app = Celery("hyacinthwatch")

# load settings from Django config, using CELERY_ prefix
app.config_from_object("django.conf:settings", namespace="CELERY")

# auto-discover tasks.py in all installed apps
app.autodiscover_tasks()
