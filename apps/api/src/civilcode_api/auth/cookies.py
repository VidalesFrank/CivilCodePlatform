from fastapi import Response

from ..config import get_settings

ACCESS_COOKIE = "cc_access"
REFRESH_COOKIE = "cc_refresh"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    secure = settings.cookie_secure

    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=settings.api_jwt_access_ttl_minutes * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=settings.api_jwt_refresh_ttl_days * 86400,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/api/v1/auth",  # refresh cookie only sent to auth endpoints
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
