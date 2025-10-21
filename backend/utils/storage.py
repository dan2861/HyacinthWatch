"""
Supabase Storage utility for uploads, downloads, and signed URLs.
Used by Celery workers and the Django backend.

This uses the supabase-py client for server-side operations.
"""

import os
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
        raise RuntimeError('supabase client is not available (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and that supabase-py is installed)')
    sb.storage.from_(bucket).upload(path, data, file_options={"content-type": content_type, "upsert": True})
    return f"supabase://{bucket}/{path}"


def signed_url(bucket: str, path: str, expires_sec: int = 600) -> Optional[str]:
    """Generate a signed URL that expires after expires_sec seconds, or raise if not available."""
    sb = _get_client()
    if not sb:
        raise RuntimeError('supabase client is not available (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and that supabase-py is installed)')
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
        raise RuntimeError('supabase client is not available (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and that supabase-py is installed)')
    out = sb.storage.from_(bucket).list(prefix=prefix, limit=limit, offset=offset)
    # supabase-py may return { 'data': [...] } or a list directly
    if isinstance(out, dict) and 'data' in out:
        return out['data']
    return out
