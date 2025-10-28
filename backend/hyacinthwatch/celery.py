from __future__ import annotations

import os
from celery import Celery

# Ensure the Django settings module is set for Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hyacinthwatch.settings')

app = Celery('hyacinthwatch')

# Load config from Django settings, using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Autodiscover tasks in installed apps (looks for tasks.py)
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
