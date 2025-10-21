from django.core.management.base import BaseCommand
import os
import logging

try:
    from utils.storage import list_objects, signed_url
except Exception:
    list_objects = None
    signed_url = None


class Command(BaseCommand):
    help = 'List objects in a Supabase storage bucket. Uses STORAGE_BUCKET_OBS env if not specified.'

    def add_arguments(self, parser):
        parser.add_argument('--bucket', '-b', help='Bucket name to list')
        parser.add_argument('--prefix', '-p', help='Prefix to list', default='')
        parser.add_argument('--limit', '-l', type=int, help='Limit number of entries', default=100)
        parser.add_argument('--offset', type=int, help='Offset', default=0)
        parser.add_argument('--signed', action='store_true', help='Print a signed URL for each object (requires service role key)')
        parser.add_argument('--expires', type=int, default=600, help='Signed URL expiry in seconds')

    def handle(self, *args, **options):
        bucket = options.get('bucket') or os.environ.get('STORAGE_BUCKET_OBS')
        prefix = options.get('prefix') or ''
        limit = options.get('limit') or 100
        offset = options.get('offset') or 0
        show_signed = options.get('signed')
        expires = options.get('expires') or 600

        if not bucket:
            self.stderr.write('No bucket specified and STORAGE_BUCKET_OBS not set')
            return

        if not list_objects:
            self.stderr.write('storage.list_objects helper not available (is supabase-py installed and envs set?)')
            return

        try:
            items = list_objects(bucket, prefix=prefix, limit=limit, offset=offset)
        except Exception as e:
            self.stderr.write(f'Failed to list objects: {e}')
            return

        if not items:
            self.stdout.write('No objects')
            return

        for it in items:
            # it commonly contains 'name', 'id', 'updated_at', 'metadata'
            name = it.get('name') if isinstance(it, dict) else str(it)
            line = f"{name}"
            if show_signed and signed_url:
                try:
                    su = signed_url(bucket, name, expires_sec=expires)
                    line += f"  -> {su}"
                except Exception as e:
                    line += f"  -> signed url failed: {e}"
            self.stdout.write(line)
