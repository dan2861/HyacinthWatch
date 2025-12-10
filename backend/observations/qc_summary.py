from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from rest_framework.exceptions import ValidationError, PermissionDenied
from functools import wraps
import threading
import time
import json
import requests
import jwt

_CACHE = {}
_CACHE_LOCK = threading.Lock()


def cached_json(key: str, ttl_seconds: int = 600):
    """Decorator for caching JSON-serializable function results in memory.
    
    Thread-safe in-memory cache. For production, consider using Redis.
    
    Args:
        key: Cache key string
        ttl_seconds: Time-to-live in seconds (default: 600)
    """
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            now = time.time()
            with _CACHE_LOCK:
                ent = _CACHE.get(key)
                if ent and ent['expires_at'] > now:
                    return ent['value']
            val = fn(*args, **kwargs)
            with _CACHE_LOCK:
                _CACHE[key] = {'value': val, 'expires_at': now + ttl_seconds}
            return val
        return wrapped
    return decorator


class Params:
    __slots__ = ("start", "end", "tz", "user_id", "min_confidence", "device_model",
                 "platform", "species", "granularity", "granularity_resolved", "smooth")


def parse_params(request):
    """Parse and validate query parameters for QC summary endpoint.
    
    Supports ISO8601 datetime parsing with multiple format fallbacks,
    timezone handling, and various filter parameters.
    
    Args:
        request: Django request object with query_params
        
    Returns:
        Params object with parsed and validated values
        
    Raises:
        ValidationError: If parameters are invalid
    """
    q = request.query_params

    def try_parse_iso(s):
        """Try to parse ISO8601 datetime string with multiple format fallbacks."""
        if not s:
            return None
        try:
            return datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception:
            pass
        fmts = ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ',
                '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']
        for fmt in fmts:
            try:
                parsed = datetime.strptime(s, fmt)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed
            except Exception:
                continue
        try:
            if s.isdigit():
                return datetime.fromtimestamp(int(s), tz=timezone.utc)
        except Exception:
            pass
        return None

    start_s = q.get('start')
    end_s = q.get('end')
    start = try_parse_iso(start_s)
    end = try_parse_iso(end_s)

    if start is None or end is None:
        now = datetime.now(timezone.utc)
        if end is None:
            end = now
        if start is None:
            start = end - timedelta(days=7)

    if not (start < end):
        raise ValidationError(
            'start must be before end; provide ISO8601 timestamps (e.g. 2025-10-01T00:00:00Z)')
    tz_name = q.get('tz', 'America/New_York')
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo('UTC')

    user_id = q.get('user_id')
    min_conf = q.get('min_confidence')
    min_conf = float(min_conf) if min_conf is not None else None
    if min_conf is not None and not (0.0 <= min_conf <= 1.0):
        raise ValidationError('min_confidence must be in [0,1]')

    device_model = q.get('device_model')
    platform = q.get('platform')
    if platform and platform.lower() not in ('android', 'ios', 'web'):
        raise ValidationError('platform must be one of android, ios, web')

    species = q.get('species')
    granularity = (q.get('granularity', 'auto') or 'auto').lower()
    if granularity not in ('auto', 'day', 'hour'):
        raise ValidationError('granularity must be auto|day|hour')
    smooth = q.get('smooth')
    smooth = float(smooth) if smooth is not None else 0.0
    if not (0.0 <= smooth <= 1.0):
        raise ValidationError('smooth must be in [0,1]')

    window_days = (end - start).total_seconds() / 86400
    gran_resolved = ('hour' if (granularity == 'auto' and window_days <= 3) else (
        granularity if granularity != 'auto' else 'day'))

    p = Params()
    p.start, p.end, p.tz = start, end, tz
    p.user_id, p.min_confidence = user_id, min_conf
    p.device_model, p.platform, p.species = device_model, platform, species
    p.granularity, p.granularity_resolved, p.smooth = granularity, gran_resolved, smooth
    return p


def bin_blur(values):
    """Bin blur variance values into histogram buckets.
    
    Args:
        values: List of blur variance values (0-50 range)
        
    Returns:
        List of [label, count] pairs for histogram
    """
    bins = [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50)]
    counts = [0]*len(bins)
    for v in values:
        if v is None:
            continue
        v = max(0, min(50, float(v)))
        idx = min(int(v//10), len(bins)-1)
        counts[idx] += 1
    labels = [f"{a}-{b}" for a, b in bins]
    return list(map(list, zip(labels, counts)))


def bin_brightness(values):
    """Bin brightness values (0-1 normalized) into histogram buckets.
    
    Args:
        values: List of brightness values (0-1 range)
        
    Returns:
        List of [label, count] pairs for histogram
    """
    labels = ["very_dark", "dark", "ok", "bright", "blown"]
    counts = [0]*5
    for v in values:
        if v is None:
            continue
        v = float(v)
        if v < 0.3:
            counts[0] += 1
        elif v < 0.45:
            counts[1] += 1
        elif v <= 0.7:
            counts[2] += 1
        elif v <= 0.85:
            counts[3] += 1
        else:
            counts[4] += 1
    return list(map(list, zip(labels, counts)))


def ema_series(buckets, key, out_key, alpha=0.3):
    """Compute exponential moving average for a series of buckets.
    
    Args:
        buckets: List of dicts containing time series data
        key: Key to read values from in each bucket
        out_key: Key to write EMA values to in each bucket
        alpha: Smoothing factor (0-1), higher = more responsive to recent values
    """
    ema = None
    for b in buckets:
        x = b.get(key, 0.0) or 0.0
        ema = x if ema is None else (alpha * x + (1 - alpha) * ema)
        b[out_key] = round(ema, 3)


_JWK_CACHE = {'jwks': None, 'expires_at': 0}


def verify_supabase_jwt(token, supabase_url, allowed_roles=('researcher', 'moderator', 'admin')):
    """Verify a Supabase JWT token by fetching JWKs and validating signature.
    
    Fetches JSON Web Key Set from Supabase's well-known endpoint and uses
    it to verify the token signature. Also checks role if present in
    user_metadata.
    
    Args:
        token: Raw JWT bearer token string
        supabase_url: Supabase project URL for JWKS endpoint
        allowed_roles: Tuple of allowed role values (default: researcher, moderator, admin)
        
    Returns:
        Decoded JWT payload dict
        
    Raises:
        PermissionDenied: If token is invalid, signature verification fails, or role is insufficient
    """
    now = time.time()
    if _JWK_CACHE['jwks'] is None or _JWK_CACHE['expires_at'] < now:
        try:
            jwks_url = supabase_url.rstrip('/') + '/.well-known/jwks.json'
            r = requests.get(jwks_url, timeout=5)
            r.raise_for_status()
            _JWK_CACHE['jwks'] = r.json()
            _JWK_CACHE['expires_at'] = now + 3600
        except Exception:
            _JWK_CACHE['jwks'] = None
    jwks = _JWK_CACHE['jwks']
    if not jwks:
        raise PermissionDenied('JWKS_FETCH_FAILED: Unable to verify token (jwks fetch failed). '
                              'This usually means the backend cannot reach Supabase to fetch public keys. '
                              'Check network connectivity and SUPABASE_URL configuration.')

    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        kid = unverified.get('kid')
    except Exception:
        raise PermissionDenied('Invalid token')

    key = None
    for k in jwks.get('keys', []):
        if k.get('kid') == kid:
            key = k
            break
    if not key:
        raise PermissionDenied('Token key not found')

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
    try:
        payload = jwt.decode(token, public_key, algorithms=[
                             unverified.get('alg', 'RS256')], options={"verify_aud": False})
    except Exception as e:
        raise PermissionDenied('Token verification failed: %s' % (e,))

    role = None
    user_meta = payload.get('user_metadata') or {}
    if isinstance(user_meta, dict):
        role = user_meta.get('role')
    if role and role not in allowed_roles:
        raise PermissionDenied(f'Insufficient role: {role}. Required: {", ".join(allowed_roles)}')

    return payload
