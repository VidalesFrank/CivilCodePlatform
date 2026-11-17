import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any

import bcrypt
import jwt

from .config import get_settings

_settings = get_settings()


def hash_password(plaintext: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plaintext.encode("utf-8"), salt).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=_settings.api_jwt_access_ttl_minutes)).timestamp()),
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _settings.api_secret_key, algorithm=_settings.api_jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Raises jwt.InvalidTokenError (or subclass) on failure."""
    return jwt.decode(
        token,
        _settings.api_secret_key,
        algorithms=[_settings.api_jwt_algorithm],
    )


def generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hex_for_db_storage).

    Raw token goes to cookie; only the hash is persisted — if DB leaks, tokens cannot be forged.
    """
    raw = secrets.token_urlsafe(48)
    digest = sha256(raw.encode("utf-8")).hexdigest()
    return raw, digest


def hash_refresh_token(raw: str) -> str:
    return sha256(raw.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(days=_settings.api_jwt_refresh_ttl_days)
