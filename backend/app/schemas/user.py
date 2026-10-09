from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: UserRole
    avatar: str | None = None
    created_at: datetime


class PublicUser(BaseModel):
    """What other users are allowed to see about someone."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    avatar: str | None = None
    created_at: datetime | None = None


class SwitchUserIn(BaseModel):
    user_id: int | None = None
    role: UserRole | None = None


class SessionOut(BaseModel):
    token: str
    user: UserOut
