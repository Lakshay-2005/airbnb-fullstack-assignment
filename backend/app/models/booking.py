from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.base import created_column, enum_column, updated_column
from app.models.enums import BookingStatus, PaymentStatus
from app.models.listing import Listing
from app.models.user import User


class Booking(Base):
    """A reservation of nights [check_in, check_out): the check-out day is free for the next guest."""

    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_listing_dates", "listing_id", "check_in", "check_out"),
        Index("ix_bookings_guest_status", "guest_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(16), unique=True)
    # RESTRICT: a listing with booking history is soft-deleted, never hard-deleted
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="RESTRICT"))
    guest_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    guests: Mapped[int] = mapped_column(Integer)
    nights: Mapped[int] = mapped_column(Integer)
    subtotal: Mapped[int] = mapped_column(Integer)
    cleaning_fee: Mapped[int] = mapped_column(Integer)
    service_fee: Mapped[int] = mapped_column(Integer)
    discount: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer)
    coupon_code: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[BookingStatus] = enum_column(BookingStatus, default=BookingStatus.PENDING)
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = updated_column()

    listing: Mapped[Listing] = relationship(lazy="joined")
    guest: Mapped[User] = relationship(lazy="joined")
    payment: Mapped["Payment"] = relationship(
        back_populates="booking", uselist=False, cascade="all, delete-orphan", lazy="joined"
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[PaymentStatus] = enum_column(PaymentStatus, default=PaymentStatus.PENDING)
    method: Mapped[str | None] = mapped_column(String(40))
    failure_reason: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = updated_column()

    booking: Mapped[Booking] = relationship(back_populates="payment")
