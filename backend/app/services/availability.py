from datetime import date, datetime, timedelta

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus
from app.models.base import utcnow


def blocks_dates(now: datetime | None = None):
    """SQL predicate: bookings that currently occupy their dates.

    Confirmed/completed stays always block. A PENDING booking holds the dates only
    until its payment window (`hold_expires_at`) lapses.
    """
    now = now or utcnow()
    return or_(
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
        and_(Booking.status == BookingStatus.PENDING, Booking.hold_expires_at > now),
    )


def overlaps(check_in: date, check_out: date):
    """SQL predicate for half-open ranges: [a, b) overlaps [c, d) iff a < d and c < b."""
    return and_(Booking.check_in < check_out, Booking.check_out > check_in)


def has_conflict(
    db: Session,
    listing_id: int,
    check_in: date,
    check_out: date,
    exclude_booking_id: int | None = None,
) -> bool:
    query = select(Booking.id).where(
        Booking.listing_id == listing_id, blocks_dates(), overlaps(check_in, check_out)
    )
    if exclude_booking_id is not None:
        query = query.where(Booking.id != exclude_booking_id)
    return db.scalar(exists(query).select()) or False


def booked_ranges(db: Session, listing_id: int, start: date, end: date) -> list[tuple[date, date]]:
    rows = db.execute(
        select(Booking.check_in, Booking.check_out)
        .where(Booking.listing_id == listing_id, blocks_dates(), overlaps(start, end))
        .order_by(Booking.check_in)
    ).all()
    return [(r.check_in, r.check_out) for r in rows]


def blocked_nights(ranges: list[tuple[date, date]], start: date, end: date) -> list[date]:
    nights: set[date] = set()
    for check_in, check_out in ranges:
        day = max(check_in, start)
        while day < min(check_out, end):
            nights.add(day)
            day += timedelta(days=1)
    return sorted(nights)
