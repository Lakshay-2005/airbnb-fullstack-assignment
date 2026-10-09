from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.models.base import created_column, enum_column
from app.models.enums import CouponType


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    # stored upper-case; the UNIQUE constraint doubles as the lookup index
    code: Mapped[str] = mapped_column(String(40), unique=True)
    description: Mapped[str | None] = mapped_column(String(200))
    type: Mapped[CouponType] = enum_column(CouponType)
    value: Mapped[int] = mapped_column(Integer)  # percent (1-100) or flat dollars
    minimum_amount: Mapped[int] = mapped_column(Integer, default=0)
    maximum_discount: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    usage_limit: Mapped[int | None] = mapped_column(Integer)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)


class CouponUsage(Base):
    __tablename__ = "coupon_usages"
    __table_args__ = (UniqueConstraint("coupon_id", "booking_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = created_column()
