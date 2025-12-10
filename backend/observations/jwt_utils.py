"""
Shared utilities for JWT token verification with dev fallback support.
"""
import logging
from typing import Optional, Dict, Any, Tuple

from django.conf import settings
from rest_framework.exceptions import PermissionDenied
import jwt as _pyjwt

from .qc_summary import verify_supabase_jwt

logger = logging.getLogger(__name__)


def verify_jwt_with_fallback(
    token: str,
    supabase_url: str,
    require_role: Optional[list] = None
) -> Tuple[Optional[Dict[str, Any]], Optional[Exception]]:
    """
    Verify a Supabase JWT token with optional dev fallback for DEBUG mode.

    Args:
        token: JWT token string to verify
        supabase_url: Supabase project URL for JWKS verification
        require_role: Optional list of allowed roles (e.g., ['researcher', 'moderator', 'admin'])
                     If provided, token must have one of these roles in user_metadata.role

    Returns:
        Tuple of (payload dict or None, error Exception or None)
        - If verification succeeds: (payload, None)
        - If fallback succeeds: (payload, None)
        - If verification fails: (None, error)
    """
    if not supabase_url:
        logger.debug("SUPABASE_URL not configured, cannot verify JWT")
        return None, ValueError("SUPABASE_URL not configured")

    try:
        payload = verify_supabase_jwt(token, supabase_url)
        logger.debug("JWT verified successfully, sub=%s", payload.get('sub'))

        # Check role if required
        if require_role:
            user_meta = payload.get('user_metadata') or {}
            if isinstance(user_meta, dict):
                role = user_meta.get('role')
                if role and role not in require_role:
                    logger.warning(
                        "Role check failed: role=%s, required=%s", role, require_role)
                    return None, PermissionDenied(
                        f"Insufficient role: {role}. Required: {', '.join(require_role)}"
                    )

        return payload, None
    except Exception as e:
        error_msg = str(e or '')
        is_jwks_error = (
            'JWKS_FETCH_FAILED' in error_msg or
            'jwks fetch failed' in error_msg.lower() or
            'unable to verify' in error_msg.lower() or
            'fetch failed' in error_msg.lower() or
            'jwks' in error_msg.lower()
        )
        is_debug = getattr(settings, 'DEBUG', False)

        if is_jwks_error and is_debug:
            # DEV-FALLBACK: decode token without verifying signature (INSECURE, DEBUG ONLY)
            logger.warning(
                "JWT verification failed due to JWKS/network issue, attempting dev fallback (DEBUG mode)")
            try:
                payload = _dev_fallback_decode(token, require_role)
                return payload, None
            except Exception as fallback_error:
                logger.exception("Dev fallback failed: %s", fallback_error)
                return None, fallback_error
        else:
            logger.debug("JWT verification failed: %s", e)
            if is_jwks_error:
                logger.warning(
                    "JWKS fetch failed but not in DEBUG mode (DEBUG=%s)", is_debug)
            return None, e


def _dev_fallback_decode(token: str, require_role: Optional[list] = None) -> Dict[str, Any]:
    """
    DEV-ONLY fallback: decode JWT without signature verification.
    This is insecure and only permitted in DEBUG mode for local development.

    Args:
        token: JWT token string
        require_role: Optional list of allowed roles

    Returns:
        Decoded payload dict if successful

    Raises:
        ValueError: If token format is invalid
        PermissionDenied: If role check fails
    """
    # Validate token format (should have 3 parts: header.payload.signature)
    token_parts = token.split('.')
    if len(token_parts) != 3:
        raise ValueError(
            f"Token format invalid: expected JWT with 3 parts (header.payload.signature), "
            f"got {len(token_parts)} parts"
        )

    try:
        payload = _pyjwt.decode(token, options={"verify_signature": False})
        logger.warning(
            "DEV-FALLBACK: decoded token without verification (DEBUG mode). sub=%s",
            payload.get('sub')
        )

        # Check role if required
        if require_role:
            user_meta = payload.get('user_metadata') or {}
            if isinstance(user_meta, dict):
                role = user_meta.get('role')
                if role and role not in require_role:
                    logger.warning(
                        "Role check failed: role=%s, required=%s", role, require_role)
                    raise PermissionDenied(
                        f"Insufficient role: {role}. Required: {', '.join(require_role)}"
                    )

        return payload
    except _pyjwt.exceptions.DecodeError as e:
        logger.exception(
            "DEV-FALLBACK decode failed - invalid JWT format: %s", e)
        raise ValueError(
            f"Token decode failed: invalid JWT format. Error: {str(e)}")
    except PermissionDenied:
        raise
    except Exception as e:
        logger.exception("DEV-FALLBACK decode failed: %s", e)
        raise
