"""
Supabase Storage utility for uploads, downloads, and signed URLs.
Used by Celery workers and the Django backend.

This uses the supabase-py client for server-side operations.
"""

import os
import time
from typing import Optional

# Lazy import of supabase client so missing envs or package don't break import-time
try:
    from supabase import create_client
except Exception:
    create_client = None

_sb = None


def _get_client():
    """Return a supabase client instance, creating it if needed.

    Returns None if supabase-py is not installed or required envs are missing.
    """
    global _sb
    if _sb is not None:
        return _sb

    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not create_client:
        return None
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _sb


def download_bytes(bucket: str, path: str) -> Optional[bytes]:
    """Download file contents from Supabase Storage, or return None if not available."""
    sb = _get_client()
    if not sb:
        return None
    res = sb.storage.from_(bucket).download(path)
    return res


def upload_bytes(bucket: str, path: str, data: bytes, content_type: str = 'application/octet-stream') -> Optional[str]:
    """Upload bytes to a Supabase Storage bucket and return its storage URI (supabase://bucket/path).

    Returns None if upload cannot be performed (missing client/envs).
    """
    sb = _get_client()
    if not sb:
        raise RuntimeError(
            'supabase client is not available (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and that supabase-py is installed)')
    # The underlying HTTP client expects header values to be str or bytes;
    # some storage client implementations merge the file_options into HTTP
    # headers directly. Convert boolean/other values to strings to avoid
    # httpx TypeError: "Header value must be str or bytes, not <class 'bool'>".
    file_options = {"content-type": content_type, "upsert": str(True)}
    bucket_obj = sb.storage.from_(bucket)

    # Retry/backoff settings for transient network/storage errors
    max_attempts = 3
    base_delay = 0.5

    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            # Primary attempt: normal upload
            bucket_obj.upload(path, data, file_options=file_options)
            return f"supabase://{bucket}/{path}"
        except TypeError:
            # Some clients reject boolean header values; try with stringified upsert and retry
            file_options["upsert"] = "true"
            try:
                bucket_obj.upload(path, data, file_options=file_options)
                return f"supabase://{bucket}/{path}"
            except Exception as e:
                last_exc = e
        except Exception as e:
            last_exc = e

        # If we reach here, attempt to handle duplicate/update/delete strategies
        try:
            msg = str(last_exc) if last_exc is not None else ''
        except Exception:
            msg = ''

        # Supabase Storage can return 400 (Bad Request) or 409 (Conflict) when a file exists
        # even with upsert=True. Try update (PUT) as a fallback.
        if last_exc and ('400' in msg or '409' in msg or 'Bad Request' in msg or 'Duplicate' in msg or 'already exists' in msg):
            try:
                # Try update (PUT) if supported by the client
                bucket_obj.update(path, data, file_options=file_options)
                return f"supabase://{bucket}/{path}"
            except Exception:
                try:
                    # Remove then re-upload as a last resort
                    bucket_obj.remove(path)
                    bucket_obj.upload(path, data, file_options=file_options)
                    return f"supabase://{bucket}/{path}"
                except Exception as e:
                    last_exc = e

        # If this was the last attempt, break and re-raise below
        if attempt == max_attempts:
            break

        # Backoff before retrying
        delay = base_delay * (2 ** (attempt - 1))
        time.sleep(delay)

    # No successful upload after retries: re-raise the last exception or raise a RuntimeError
    if last_exc:
        raise last_exc
    raise RuntimeError('upload failed without exception')


def signed_url(bucket: str, path: str, expires_sec: int = 600) -> Optional[str]:
    """Generate a signed URL that expires after expires_sec seconds, or raise if not available."""
    sb = _get_client()
    if not sb:
        raise RuntimeError(
            'supabase client is not available (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and that supabase-py is installed)')
    out = sb.storage.from_(bucket).create_signed_url(path, expires_sec)
    signed = out.get('signedURL') or out.get('data') or out
    if isinstance(signed, dict):
        signed = signed.get('signedURL')
    if not signed:
        raise RuntimeError('failed to create signed url: %r' % (out,))
    if signed.startswith('/'):
        SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
        return SUPABASE_URL + signed
    return signed


def list_objects(bucket: str, prefix: str = '', limit: int = 100, offset: int = 0):
    """List objects in a bucket. Returns list of dicts or raises if client missing."""
    sb = _get_client()
    if not sb:
        raise RuntimeError(
            'supabase client is not available (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and that supabase-py is installed)')
    # The storage client API varies between versions/implementations. Try
    # calling .list() with common parameter names and fall back to a
    # permissive call if the client doesn't accept a parameter.
    bucket_obj = sb.storage.from_(bucket)
    out = None
    # Try calling .list with several common signatures. Different
    # versions of the supabase client expose different parameter names
    # (prefix vs path) and some reject additional kwargs like limit/offset.
    out = None
    # 1) Preferred: explicit keyword args supported by some clients
    try:
        out = bucket_obj.list(prefix=prefix, limit=limit, offset=offset)
    except TypeError:
        # 2) Try 'path' keyword but without extra kwargs (some clients want only path)
        try:
            out = bucket_obj.list(path=prefix)
        except TypeError:
            # 3) Try single positional arg (prefix as first positional)
            try:
                out = bucket_obj.list(prefix)
            except TypeError:
                # 4) Try positional (limit, offset) as older wrappers sometimes expect
                try:
                    out = bucket_obj.list(limit, offset)
                except Exception:
                    # Last resort: call without args (returns top-level folders/objects)
                    out = bucket_obj.list()
    # supabase-py may return { 'data': [...] } or a list directly
    if isinstance(out, dict) and 'data' in out:
        return out['data']
    return out


def delete_object(bucket: str, path: str) -> bool:
    """Delete an object from Supabase Storage. Returns True on success, False otherwise.

    This is a thin wrapper around the client's remove/delete API. It returns
    False if the supabase client is not available or the deletion failed.
    """
    sb = _get_client()
    if not sb:
        return False
    bucket_obj = sb.storage.from_(bucket)
    try:
        # most clients expose remove(path)
        bucket_obj.remove(path)
        return True
    except Exception:
        try:
            # some clients may use delete
            bucket_obj.delete(path)
            return True
        except Exception:
            return False
