from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import verify_token
from app.db.database import get_db
from app.models import User, UserRole

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, authorization: Annotated[str | None, Header()] = None) -> User:
    """Resolve the acting user from the signed demo token.

    No token means the default demo guest, so a reviewer can use the app immediately.
    A token that is present but invalid or expired is rejected.
    """
    if authorization and authorization.lower().startswith("bearer "):
        user_id = verify_token(authorization[7:].strip())
        user = db.get(User, user_id) if user_id else None
        if user is None:
            raise AppError(401, "Your demo session is invalid or expired.", "invalid_session")
        return user

    user = db.scalar(select(User).where(User.email == get_settings().default_guest_email))
    if user is None:
        user = db.scalar(select(User).where(User.role == UserRole.GUEST).order_by(User.id))
    if user is None:
        raise AppError(503, "The database has no users yet. Run `python seed.py`.", "not_seeded")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
