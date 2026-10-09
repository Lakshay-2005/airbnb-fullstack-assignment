"""Booking lifecycle: quote -> create (PENDING) -> pay (CONFIRMED) -> cancel / complete.

Every mutation runs inside a `write_session` (BEGIN IMMEDIATE) so the availability
check and the insert happen atomically with respect to every other writer.
All amounts are recomputed here; nothing price-related is read from the client.
"""

import secrets
import string
from datetime import timedelta

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, bad_request, conflict, forbidden, not_found
from app.db.database import write_session
from app.models import (
    Booking,
    BookingStatus,
    Listing,
    ListingStatus,
    Payment,
    PaymentStatus,
    Review,
    User,
)
from app.models.base import utcnow
from app.schemas.booking import BookingCreate, CouponCheck, PriceBreakdown, QuoteOut
from app.services import availability
from app.services.coupons import (
    CouponRejected,
    attach_coupon,
    evaluate_coupon,
    find_coupon,
    normalize_code,
    release_coupon,
)
from app.services.pricing import Pricing, build_pricing, validate_guests, validate_stay_dates

REFERENCE_ALPHABET = string.ascii_uppercase + string.digits
SUPPORTED_PAYMENT_METHODS = {"card_4242", "card_declined"}


def new_reference() -> str:
    return "AC-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(8))


# ----------------------------------------------------------------------- housekeeping


def housekeeping(db: Session) -> None:
    """Expire unpaid holds and mark finished stays COMPLETED (done lazily, on read paths)."""
    today = utcnow().date()
    needs_work = db.scalar(
        select(Booking.id)
        .where(
            or_(
                and_(Booking.status == BookingStatus.PENDING, Booking.hold_expires_at <= utcnow()),
                and_(Booking.status == BookingStatus.CONFIRMED, Booking.check_out <= today),
            )
        )
        .limit(1)
    )
    if needs_work is None:
        return
    with write_session(db.get_bind()) as s:
        _expire_stale_pending(s)
        _complete_finished_stays(s)
        s.commit()
    db.rollback()  # refresh the request session's snapshot


def _expire_stale_pending(s: Session) -> None:
    stale = s.scalars(
        select(Booking).where(Booking.status == BookingStatus.PENDING, Booking.hold_expires_at <= utcnow())
    ).unique()
    for booking in stale:
        booking.status = BookingStatus.CANCELLED
        booking.hold_expires_at = None
        if booking.payment and booking.payment.status != PaymentStatus.SUCCESS:
            booking.payment.status = PaymentStatus.FAILED
            booking.payment.failure_reason = "Payment window expired."
        release_coupon(s, booking)


def _complete_finished_stays(s: Session) -> None:
    s.execute(
        update(Booking)
        .where(
            Booking.status == BookingStatus.CONFIRMED,
            Booking.check_out <= utcnow().date(),
        )
        .values(status=BookingStatus.COMPLETED)
    )


# ----------------------------------------------------------------------------- quoting


def _bookable_listing(db: Session, listing_id: int) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.status != ListingStatus.ACTIVE:
        raise not_found("Listing not found.", "listing_not_found")
    return listing


def _price_stay(
    db: Session, listing: Listing, payload_dates, guests: int, coupon_code: str | None
) -> tuple[Pricing, str | None, CouponCheck | None]:
    """Validate a stay and price it. Raises AppError for hard failures; a bad coupon is
    returned as a CouponCheck so a quote can still show the undiscounted price."""
    check_in, check_out = payload_dates
    nights = validate_stay_dates(check_in, check_out)
    validate_guests(listing, guests)
    if availability.has_conflict(db, listing.id, check_in, check_out):
        raise conflict("Selected dates are no longer available.", "dates_unavailable")

    discount, applied_code, check = 0, None, None
    if coupon_code and coupon_code.strip():
        code = normalize_code(coupon_code)
        coupon = find_coupon(db, code)
        subtotal = listing.nightly_price * nights
        try:
            discount = evaluate_coupon(coupon, subtotal)
            applied_code = code
            check = CouponCheck(
                code=code,
                valid=True,
                message=f"Coupon applied: you save ${discount}.",
                discount=discount,
                description=coupon.description if coupon else None,
            )
        except CouponRejected as exc:
            check = CouponCheck(code=code, valid=False, message=str(exc))
    return build_pricing(listing, nights, discount), applied_code, check


def quote_stay(
    db: Session, user: User, listing_id: int, check_in, check_out, guests: int, coupon_code
) -> QuoteOut:
    listing = _bookable_listing(db, listing_id)
    try:
        if listing.host_id == user.id:
            raise forbidden("You can't book your own listing.", "own_listing")
        pricing, _, check = _price_stay(db, listing, (check_in, check_out), guests, coupon_code)
    except AppError as exc:
        return QuoteOut(listing_id=listing_id, bookable=False, message=exc.detail, code=exc.code)
    return QuoteOut(
        listing_id=listing_id,
        bookable=True,
        pricing=PriceBreakdown(**pricing.__dict__, currency=get_settings().currency),
        coupon=check,
    )


# --------------------------------------------------------------------------- mutations


def _reload(db: Session, booking_id: int) -> Booking:
    # End the request session's read snapshot so it sees what the write session committed.
    db.rollback()
    return db.execute(
        select(Booking).where(Booking.id == booking_id).execution_options(populate_existing=True)
    ).scalar_one()


def create_booking(db: Session, user: User, data: BookingCreate) -> Booking:
    settings = get_settings()
    with write_session(db.get_bind()) as s:
        _expire_stale_pending(s)
        listing = _bookable_listing(s, data.listing_id)
        if listing.host_id == user.id:
            raise forbidden("You can't book your own listing.", "own_listing")

        pricing, applied_code, check = _price_stay(
            s, listing, (data.check_in, data.check_out), data.guests, data.coupon_code
        )
        if check is not None and not check.valid:
            raise bad_request(f"Invalid coupon: {check.message}", "invalid_coupon")

        booking = Booking(
            reference=new_reference(),
            listing_id=listing.id,
            guest_id=user.id,
            check_in=data.check_in,
            check_out=data.check_out,
            guests=data.guests,
            nights=pricing.nights,
            subtotal=pricing.subtotal,
            cleaning_fee=pricing.cleaning_fee,
            service_fee=pricing.service_fee,
            discount=pricing.discount,
            total=pricing.total,
            coupon_code=applied_code,
            status=BookingStatus.PENDING,
            hold_expires_at=utcnow() + timedelta(minutes=settings.pending_hold_minutes),
        )
        booking.payment = Payment(amount=pricing.total, status=PaymentStatus.PENDING)
        s.add(booking)
        s.flush()
        if applied_code:
            attach_coupon(s, find_coupon(s, applied_code), booking)
        s.commit()
        booking_id = booking.id
    return _reload(db, booking_id)


def _owned_booking(s: Session, user: User, booking_id: int) -> Booking:
    booking = s.get(Booking, booking_id)
    if booking is None:
        raise not_found("Booking not found.", "booking_not_found")
    if booking.guest_id != user.id:
        raise forbidden("This booking belongs to another guest.", "not_booking_owner")
    return booking


def pay_booking(db: Session, user: User, booking_id: int, method: str) -> Booking:
    if method not in SUPPORTED_PAYMENT_METHODS:
        raise bad_request("Unsupported payment method.", "invalid_payment_method")

    declined = False
    with write_session(db.get_bind()) as s:
        _expire_stale_pending(s)
        booking = _owned_booking(s, user, booking_id)

        if booking.status in (BookingStatus.CONFIRMED, BookingStatus.COMPLETED):
            s.commit()
            return _reload(db, booking_id)  # paying twice is a harmless no-op
        if booking.status == BookingStatus.CANCELLED:
            raise conflict(
                "This reservation was cancelled or its payment window expired. "
                "Please start a new booking.",
                "booking_not_payable",
            )
        # Defence in depth: the hold should guarantee this, but the server never assumes.
        if availability.has_conflict(s, booking.listing_id, booking.check_in, booking.check_out, booking.id):
            raise conflict("Selected dates are no longer available.", "dates_unavailable")

        payment = booking.payment
        payment.method = method
        if method == "card_declined":
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = "Your card was declined by the issuer."
            declined = True  # booking stays PENDING so the guest can retry within the hold
        else:
            payment.status = PaymentStatus.SUCCESS
            payment.failure_reason = None
            booking.status = BookingStatus.CONFIRMED
            booking.hold_expires_at = None
        s.commit()

    if declined:
        raise AppError(
            402,
            "Payment failed: your card was declined. Try another card — " "your dates are held while you do.",
            "payment_failed",
        )
    return _reload(db, booking_id)


def apply_coupon_to_booking(db: Session, user: User, booking_id: int, code: str | None) -> Booking:
    with write_session(db.get_bind()) as s:
        _expire_stale_pending(s)
        booking = _owned_booking(s, user, booking_id)
        if booking.status != BookingStatus.PENDING:
            raise conflict("Coupons can only be changed before payment.", "booking_not_pending")

        release_coupon(s, booking)
        discount, applied = 0, None
        if code and code.strip():
            coupon = find_coupon(s, code)
            try:
                discount = evaluate_coupon(coupon, booking.subtotal)
            except CouponRejected as exc:
                raise bad_request(f"Invalid coupon: {exc}", "invalid_coupon") from exc
            applied = coupon.code
            attach_coupon(s, coupon, booking)

        booking.coupon_code = applied
        booking.discount = discount
        booking.total = booking.subtotal + booking.cleaning_fee + booking.service_fee - discount
        booking.payment.amount = booking.total
        s.commit()
    return _reload(db, booking_id)


def can_cancel(booking: Booking) -> bool:
    """Cancellation policy: free cancellation any time before the check-in day."""
    if booking.status == BookingStatus.PENDING:
        return True
    return booking.status == BookingStatus.CONFIRMED and booking.check_in > utcnow().date()


def cancel_booking(db: Session, user: User, booking_id: int) -> Booking:
    with write_session(db.get_bind()) as s:
        _expire_stale_pending(s)
        booking = _owned_booking(s, user, booking_id)
        if booking.status == BookingStatus.CANCELLED:
            s.commit()
            return _reload(db, booking_id)  # idempotent
        if not can_cancel(booking):
            raise conflict(
                "This booking can no longer be cancelled (the stay has started or finished).",
                "not_cancellable",
            )
        paid = booking.payment.status == PaymentStatus.SUCCESS
        booking.status = BookingStatus.CANCELLED
        booking.hold_expires_at = None
        if paid:
            booking.payment.status = PaymentStatus.REFUNDED  # full refund before check-in
        else:
            booking.payment.status = PaymentStatus.FAILED
            booking.payment.failure_reason = "Reservation cancelled before payment."
        release_coupon(s, booking)
        s.commit()
    return _reload(db, booking_id)


# ------------------------------------------------------------------------------- reads


def reviewed_booking_ids(db: Session, booking_ids: list[int]) -> set[int]:
    if not booking_ids:
        return set()
    return set(db.scalars(select(Review.booking_id).where(Review.booking_id.in_(booking_ids))))
