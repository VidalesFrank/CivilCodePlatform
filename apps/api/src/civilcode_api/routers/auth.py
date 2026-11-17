from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from ..auth.dependencies import get_current_user
from ..auth.membership import provision_personal_org
from ..db import get_db
from ..models.refresh_token import RefreshToken
from ..models.user import User
from ..schemas.auth import LoginRequest, LoginResponse, RegisterRequest, UserPublic
from ..security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserPublic:
    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.flush()  # para tener user.id antes de provision_personal_org
    await provision_personal_org(db, user)
    await db.commit()
    await db.refresh(user)
    return UserPublic.model_validate(user)


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

    access = create_access_token(subject=str(user.id))
    raw_refresh, refresh_hash = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=refresh_token_expiry(),
        )
    )
    await db.commit()

    set_auth_cookies(response, access_token=access, refresh_token=raw_refresh)
    return LoginResponse(user=UserPublic.model_validate(user))


@router.post("/refresh", response_model=UserPublic)
async def refresh(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    cc_refresh: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> UserPublic:
    if not cc_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    token_hash = hash_refresh_token(cc_refresh)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await db.execute(stmt)
    db_token = result.scalar_one_or_none()

    now = datetime.now(UTC)
    if db_token is None or db_token.revoked or db_token.expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await db.get(User, db_token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    # Rotate refresh token: revoke old, issue new
    db_token.revoked = True
    new_raw, new_hash = generate_refresh_token()
    db.add(
        RefreshToken(user_id=user.id, token_hash=new_hash, expires_at=refresh_token_expiry())
    )
    await db.commit()

    new_access = create_access_token(subject=str(user.id))
    set_auth_cookies(response, access_token=new_access, refresh_token=new_raw)
    return UserPublic.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    cc_refresh: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> None:
    if cc_refresh:
        token_hash = hash_refresh_token(cc_refresh)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        result = await db.execute(stmt)
        db_token = result.scalar_one_or_none()
        if db_token is not None:
            db_token.revoked = True
            await db.commit()
    clear_auth_cookies(response)


@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[User, Depends(get_current_user)]) -> UserPublic:
    return UserPublic.model_validate(user)
