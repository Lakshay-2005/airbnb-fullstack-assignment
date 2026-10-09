from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import forbidden, not_found
from app.models import Booking, BookingStatus, User
from app.routers.deps import CurrentUser, DbSession
from app.schemas.booking import (
    BookingCreate,
    BookingListing,
    BookingOut,
    CouponApply,
    PayIn,
    PaymentOut,
    QuoteOut,
)
from app.schemas.user import PublicUser
from app.services import bookings as svc

router = APIRouter(tags=["bookings"])


def booking_to_out(booking: Booking, viewer: User, reviewed: set[int] | None = None) -> BookingOut:
    """Serialise a booking. Guest e-mail is only revealed to the listing's host."""
    listing = booking.listing
    is_host = viewer.id == listing.host_id
    can_review = (
        booking.status == BookingStatus.COMPLETED
        and booking.guest_id == viewer.id
        and booking.id not in (reviewed or set())
    )
    return BookingOut(
        id=booking.id,
        reference=booking.reference,
        status=booking.status,
        check_in=booking.check_in,
        check_out=booking.check_out,
        guests=booking.guests,
        nights=booking.nights,
        subtotal=booking.subtotal,
        cleaning_fee=booking.cleaning_fee,
        service_fee=booking.service_fee,
        discount=booking.discount,
        total=booking.total,
        coupon_code=booking.coupon_code,
        hold_expires_at=booking.hold_expires_at,
        created_at=booking.created_at,
        can_cancel=booking.guest_id == viewer.id and svc.can_cancel(booking),
        can_review=can_review,
        listing=BookingListing(
            id=listing.id,
            title=listing.title,
            city=listing.city,
            country=listing.country,
            location=listing.location,
            property_type=listing.property_type,
            image=listing.images[0].image_url if listing.images else None,
            host=PublicUser.model_validate(listing.host),
            status=listing.status,
        ),
        guest=PublicUser.model_validate(booking.guest),
        guest_email=booking.guest.email if is_host else None,
        payment=PaymentOut.model_validate(booking.payment) if booking.payment else None,
    )


def bookings_to_out(db: Session, rows: list[Booking], viewer: User) -> list[BookingOut]:
    reviewed = svc.reviewed_booking_ids(db, [b.id for b in rows])
    return [booking_to_out(b, viewer, reviewed) for b in rows]


@router.get("/listings/{listing_id}/quote", response_model=QuoteOut)
def quote(
    listing_id: int,
    db: DbSession,
    user: CurrentUser,
    check_in: date,
    check_out: date,
    guests: Annotated[int, Query(ge=1, le=64)] = 1,
    coupon_code: str | None = None,
):
    """Authoritative price + bookability preview used by the booking card."""
    svc.housekeeping(db)
    return svc.quote_stay(db, user, listing_id, check_in, check_out, guests, coupon_code)


@router.post("/bookings", response_model=BookingOut, status_code=201)
def create_booking(body: BookingCreate, db: DbSession, user: CurrentUser):
    return booking_to_out(svc.create_booking(db, user, body), user)


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(db: DbSession, user: CurrentUser, status: BookingStatus | None = None):
    svc.housekeeping(db)
    query = select(Booking).where(Booking.guest_id == user.id)
    if status:
        query = query.where(Booking.status == status)
    rows = db.scalars(query.order_by(Booking.check_in.desc(), Booking.id.desc())).unique().all()
    return bookings_to_out(db, list(rows), user)


@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: DbSession, user: CurrentUser):
    svc.housekeeping(db)
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise not_found("Booking not found.", "booking_not_found")
    if booking.guest_id != user.id and booking.listing.host_id != user.id:
        raise forbidden("You can't view this booking.", "not_booking_owner")
    return bookings_to_out(db, [booking], user)[0]


@router.put("/bookings/{booking_id}/coupon", response_model=BookingOut)
def set_coupon(booking_id: int, body: CouponApply, db: DbSession, user: CurrentUser):
    """Apply (or remove, with a null code) a coupon on a booking that is still awaiting payment."""
    return booking_to_out(svc.apply_coupon_to_booking(db, user, booking_id, body.code), user)


@router.post("/bookings/{booking_id}/pay", response_model=BookingOut)
def pay(booking_id: int, db: DbSession, user: CurrentUser, body: PayIn | None = None):
    method = body.payment_method if body else "card_4242"
    return booking_to_out(svc.pay_booking(db, user, booking_id, method), user)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: int, db: DbSession, user: CurrentUser):
    return booking_to_out(svc.cancel_booking(db, user, booking_id), user)
