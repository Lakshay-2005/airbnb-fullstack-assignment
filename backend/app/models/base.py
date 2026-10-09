from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum
from sqlalchemy.orm import mapped_column


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite has no timezone support)."""
    return datetime.now(UTC).replace(tzinfo=None)


def enum_column(enum_cls: type[StrEnum], **kwargs):
    return mapped_column(Enum(enum_cls, native_enum=False, length=16, validate_strings=True), **kwargs)


def created_column():
    return mapped_column(DateTime, default=utcnow, nullable=False)


def updated_column():
    return mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
