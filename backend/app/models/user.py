from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import created_column, enum_column
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    role: Mapped[UserRole] = enum_column(UserRole, default=UserRole.GUEST)
    avatar: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = created_column()
