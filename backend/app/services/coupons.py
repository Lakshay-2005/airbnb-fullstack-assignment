from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Coupon, CouponType, CouponUsage
from app.models.base import utcnow


class CouponRejected(Exception):
    """The coupon cannot be applied; the message is safe to show to the guest."""


def normalize_code(code: str) -> str:
    return code.strip().upper()


def find_coupon(db: Session, code: str) -> Coupon | None:
    return db.scalar(select(Coupon).where(Coupon.code == normalize_code(code)))


def evaluate_coupon(coupon: Coupon | None, subtotal: int, now: datetime | None = None) -> int:
    """Validate a coupon against a stay subtotal and return the discount in whole dollars."""
    now = now or utcnow()
    if coupon is None:
        raise CouponRejected("That coupon code isn't valid.")
    if not coupon.active:
        raise CouponRejected("This coupon is no longer active.")
    if coupon.expires_at and coupon.expires_at <= now:
        raise CouponRejected(f"This coupon expired on {coupon.expires_at:%b %d, %Y}.")
    if coupon.usage_limit is not None and coupon.usage_count >= coupon.usage_limit:
        raise CouponRejected("This coupon has reached its usage limit.")
    if subtotal < coupon.minimum_amount:
        raise CouponRejected(
            f"This coupon needs a stay subtotal of at least ${coupon.minimum_amount} "
            f"(yours is ${subtotal})."
        )

    if coupon.type == CouponType.PERCENTAGE:
        raw = (Decimal(subtotal) * coupon.value / 100).quantize(Decimal(1), ROUND_HALF_UP)
        discount = int(raw)
    else:
        discount = coupon.value
    if coupon.maximum_discount is not None:
        discount = min(discount, coupon.maximum_discount)
    return max(0, min(discount, subtotal))  # a coupon can never make the stay cost less than free


def attach_coupon(db: Session, coupon: Coupon, booking: Booking) -> None:
    coupon.usage_count += 1
    db.add(CouponUsage(coupon_id=coupon.id, user_id=booking.guest_id, booking_id=booking.id))


def release_coupon(db: Session, booking: Booking) -> None:
    """Give the coupon use back (booking cancelled/expired or coupon swapped)."""
    usage = db.scalar(select(CouponUsage).where(CouponUsage.booking_id == booking.id))
    if usage is None:
        return
    coupon = db.get(Coupon, usage.coupon_id)
    if coupon and coupon.usage_count > 0:
        coupon.usage_count -= 1
    db.delete(usage)
