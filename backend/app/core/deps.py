from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.database.session import get_db
from app.models import Role, User

security = HTTPBearer(auto_error=False)

ADMIN_ROLES = {"super_admin", "admin"}
STAFF_ROLES = {"super_admin", "admin", "agent", "editor"}


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == payload["sub"])
    )
    user = result.scalar_one_or_none()
    if user and user.is_active:
        return user
    return None


async def get_current_user(
    user: Annotated[User | None, Depends(get_current_user_optional)],
) -> User:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


def require_roles(*allowed: str):
    async def role_checker(user: Annotated[User, Depends(get_current_user)]) -> User:
        role_name = user.role.name if user.role else "guest"
        if role_name not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return role_checker


require_admin = require_roles("super_admin", "admin")
require_staff = require_roles("super_admin", "admin", "agent", "editor")
