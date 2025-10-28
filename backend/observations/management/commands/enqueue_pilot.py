from django.core.management.base import BaseCommand
import concurrent.futures
import time
import logging
import uuid


class Command(BaseCommand):
    help = "Enqueue many Celery tasks concurrently to pilot worker throughput."

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=100,
                            help='Number of tasks to enqueue')
        parser.add_argument('--concurrency', type=int, default=10,
                            help='Number of parallel threads to use for enqueueing')
        parser.add_argument('--task', choices=['segment', 'presence'], default='segment',
                            help='Which task to enqueue: segment or presence')
        parser.add_argument('--sample-existing', type=int, default=0,
                            help='If >0, sample this many Observation ids from the DB and reuse them (avoid creating fake ids)')

    def handle(self, *args, **options):
        num = options['num']
        concurrency = options['concurrency']
        task_name = options['task']
        sample_existing = options['sample_existing']

        logger = logging.getLogger('observations.management.enqueue_pilot')

        # Resolve task callables lazily so imports only occur when Django env is ready
        try:
            if task_name == 'segment':
                from workers.tasks import segment_and_cover as task_callable
            else:
                from workers.tasks import classify_presence as task_callable
        except Exception as e:
            logger.exception('failed to import task: %s', e)
            self.stderr.write('failed to import task: %s' % e)
            return

        obs_ids = []
        if sample_existing > 0:
            try:
                from observations.models import Observation
                qs = Observation.objects.all().order_by(
                    '-created_at')[:sample_existing]
                obs_ids = [str(o.id) for o in qs]
                if not obs_ids:
                    self.stdout.write(
                        'no existing observations found to sample; falling back to random ids')
            except Exception:
                obs_ids = []

        def enqueue_one(i):
            # choose an observation id: reuse sampled ids if available, else generate a uuid
            if obs_ids:
                obs_id = obs_ids[i % len(obs_ids)]
            else:
                obs_id = str(uuid.uuid4())
            start = time.time()
            try:
                # use apply_async/delay to enqueue
                try:
                    task_callable.delay(obs_id)
                except Exception:
                    # fallback to synchronous call if the worker isn't reachable; still useful for local CPU-bound testing
                    task_callable(obs_id)
                return True, time.time() - start, obs_id
            except Exception as e:
                return False, str(e), obs_id

        self.stdout.write(
            f'Enqueueing {num} {task_name} tasks with concurrency={concurrency}...')
        start_all = time.time()
        results = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
            futures = [ex.submit(enqueue_one, i) for i in range(num)]
            for fut in concurrent.futures.as_completed(futures):
                results.append(fut.result())

        elapsed = time.time() - start_all
        successes = sum(1 for ok, _t, _id in results if ok is True)
        failures = [r for r in results if r[0] is not True]
        self.stdout.write(
            f'Enqueued {successes}/{num} tasks in {elapsed:.2f}s')
        if failures:
            self.stdout.write(
                f'{len(failures)} failures; sample: {failures[:5]}')
        else:
            self.stdout.write('No enqueue failures')

        # Print a short summary of task ids or sample obs ids used
        sample_obs = list({r[2] for r in results})[:5]
        self.stdout.write('Sample observation ids used: %s' %
                          ','.join(sample_obs))
