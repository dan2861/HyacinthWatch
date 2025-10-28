"""Simple helper to wait for Redis to be reachable.

Used by the docker-compose worker command to avoid starting Celery before
Redis is ready. It attempts TCP connection to host:port until success or
until timeout.
"""
import os
import socket
import time
import sys

HOST = os.environ.get('REDIS_HOST', os.environ.get('REDIS_HOST', 'redis'))
PORT = int(os.environ.get('REDIS_PORT', os.environ.get('REDIS_PORT', 6379)))
TIMEOUT = int(os.environ.get('WAIT_FOR_REDIS_TIMEOUT', 30))
SLEEP = float(os.environ.get('WAIT_FOR_REDIS_SLEEP', 0.5))

start = time.time()
print(f"wait_for_redis: checking {HOST}:{PORT} for up to {TIMEOUT}s")
while True:
    try:
        with socket.create_connection((HOST, PORT), timeout=2):
            print("wait_for_redis: redis reachable")
            break
    except Exception:
        if time.time() - start > TIMEOUT:
            print(
                f"wait_for_redis: timeout after {TIMEOUT}s, exiting with failure")
            # Fail fast so the worker container does not start Celery without
            # a reachable broker. This surfaces the problem clearly and
            # prevents noisy retry logs from Celery.
            sys.exit(1)
        time.sleep(SLEEP)
