"""
Supabase JWT Authentication for Django REST Framework.
Authenticates Supabase JWT bearer tokens and maps them to Django users.
"""
import os
import logging
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework import exceptions as drf_exceptions
from rest_framework.request import Request
from django.contrib.auth import get_user_model
from django.conf import settings
from .qc_summary import verify_supabase_jwt

logger = logging.getLogger(__name__)


class SupabaseJWTAuthentication(BaseAuthentication):
    """Authenticate Supabase JWT bearer tokens by verifying JWKs and
    mapping the token 'sub' claim to a Django user (created on demand).
    """

    def authenticate(self, request: Request):
        # Log the raw Authorization header for debugging CORS/auth issues.
        # Use INFO so this shows up in container logs by default.
        logger.info("SupabaseJWTAuthentication called; HTTP_AUTHORIZATION=%r",
                    request.META.get('HTTP_AUTHORIZATION'))
        auth = get_authorization_header(request).split()
        if not auth or auth[0].lower() != b'bearer':
            logger.debug("No bearer token present in Authorization header")
            return None
        try:
            token = auth[1].decode()
        except Exception:
            logger.exception("Failed to decode Authorization header token")
            return None
        supabase_url = os.environ.get('SUPABASE_URL') or ''
        if not supabase_url:
            logger.debug("SUPABASE_URL not configured, skipping JWT auth")
            return None
        try:
            payload = verify_supabase_jwt(token, supabase_url)
        except Exception as e:
            # If verification failed due to network/JWKS fetch issues, we
            # may be able to do a DEV-only fallback (decode without
            # verification) when Django DEBUG=True. Otherwise, allow other
            # authentication backends to run so local-dev setups using
            # cookie sessions still work.
            msg = str(e or '')
            logger.warning("Supabase token verification failed: %s", e)
            if 'jwks' in msg.lower() or 'fetch' in msg.lower() or 'unable to verify' in msg.lower():
                # JWKS/network-related failure
                if getattr(settings, 'DEBUG', False):
                    # DEV-FALLBACK: decode token without verifying signature.
                    # This is insecure and only permitted in DEBUG mode for
                    # local development convenience.
                    try:
                        import jwt as _pyjwt
                        payload = _pyjwt.decode(
                            token, options={"verify_signature": False})
                        logger.warning(
                            "DEV-FALLBACK: decoded token without verification (DEBUG mode). sub=%s", payload.get('sub'))
                        # continue with payload below to map to user
                    except Exception as de:
                        logger.exception(
                            "DEV-FALLBACK decode failed: %s", de)
                        return None
                else:
                    logger.debug(
                        "Token verification failed due to JWKS/network issue; falling back to other auth backends")
                    return None
            # For other verification errors (invalid signature, expired), fail authentication.
            else:
                logger.debug("Token verification failed: %s", e)
                return None
        sub = payload.get('sub')
        email = payload.get('email') or (
            payload.get('user_metadata') or {}).get('email')
        if not sub:
            logger.warning(
                "Supabase token missing 'sub' claim: %r", payload)
            raise drf_exceptions.AuthenticationFailed(
                'Invalid token payload')
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            username=sub, defaults={'email': email or ''})
        logger.info("Supabase JWT authenticated user=%s (email=%s)",
                    user.username, user.email)
        return (user, token)
