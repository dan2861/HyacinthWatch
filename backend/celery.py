from celery import Celery
import os

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = Celery('hyacinthwatch')

# Load task modules from all registered Django app configs
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')