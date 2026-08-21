from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.database.session import get_db
from app.models import User
from app.repositories.property_repository import PropertyRepository
from app.schemas import (
    PaginatedResponse,
    PasswordReset,
    PasswordResetRequest,
    PropertyCreate,
    PropertyDetail,
    PropertyListItem,
    PropertySearchParams,
    RefreshTokenRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    service = AuthService(db)
    try:
        user = await service.register(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return UserResponse(
        id=user.id, email=user.email, first_name=user.first_name, last_name=user.last_name,
        phone=user.phone, avatar_url=user.avatar_url, is_active=user.is_active,
        is_verified=user.is_verified, role=user.role.name if user.role else None, created_at=user.created_at,
    )


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: Annotated[AsyncSession, Depends(get_db)]):
    service = AuthService(db)
    user = await service.authenticate(data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return service.create_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh_tokens(data: RefreshTokenRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.core.security import decode_token
    from sqlalchemy import select
    from app.models import User as UserModel

    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh" or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    try:
        user_id = UUID(str(payload["sub"]))
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    service = AuthService(db)
    return service.create_tokens(user)


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return UserResponse(
        id=user.id, email=user.email, first_name=user.first_name, last_name=user.last_name,
        phone=user.phone, avatar_url=user.avatar_url, is_active=user.is_active,
        is_verified=user.is_verified, role=user.role.name if user.role else None, created_at=user.created_at,
    )


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    service = AuthService(db)
    user = await service.get_user_by_email(data.email)
    if user:
        import secrets
        user.reset_token = secrets.token_urlsafe(32)
        await db.flush()
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(data: PasswordReset, db: Annotated[AsyncSession, Depends(get_db)]):
    from sqlalchemy import select
    from app.core.security import get_password_hash
    from app.models import User as UserModel

    result = await db.execute(select(UserModel).where(UserModel.reset_token == data.token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user.hashed_password = get_password_hash(data.new_password)
    user.reset_token = None
    await db.flush()
    return {"message": "Password updated successfully"}
