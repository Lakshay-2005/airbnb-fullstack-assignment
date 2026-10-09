from datetime import date

from fastapi import APIRouter

from app.core.currency import BASE_CURRENCY, format_money, normalize_currency
from app.core.errors import bad_request, not_found
from app.models import Listing, ListingStatus
from app.routers.deps import CurrentUser, DbSession
from app.schemas.booking import PriceBreakdown
from app.schemas.misc import CouponValidateIn, CouponValidateOut
from app.services.coupons import CouponRejected, evaluate_coupon, find_coupon, normalize_code
from app.services.pricing import build_pricing

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _parse_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError as exc:
        raise bad_request("Dates must be formatted YYYY-MM-DD.", "invalid_dates") from exc


@router.post("/validate", response_model=CouponValidateOut)
def validate_coupon(body: CouponValidateIn, db: DbSession, _: CurrentUser):
    """Check a code against either an explicit subtotal or a listing + dates.

    An unusable coupon is a normal outcome, so it returns 200 with `valid: false`
    and a reason the UI can show verbatim.
    """
    code = normalize_code(body.code)
    listing, nights = None, None
    currency = normalize_currency(body.currency, default=BASE_CURRENCY)
    subtotal = body.subtotal
    if body.listing_id is not None:
        listing = db.get(Listing, body.listing_id)
        if listing is None or listing.status != ListingStatus.ACTIVE:
            raise not_found("Listing not found.", "listing_not_found")
        currency = normalize_currency(body.currency, default=listing.currency)
        check_in, check_out = _parse_date(body.check_in), _parse_date(body.check_out)
        if check_in and check_out and check_out > check_in:
            nights = (check_out - check_in).days
            subtotal = build_pricing(listing, nights, currency=currency).subtotal
    if subtotal is None:
        raise bad_request("Provide a subtotal, or a listing with valid dates.", "missing_amount")

    coupon = find_coupon(db, code)
    try:
        discount = evaluate_coupon(coupon, subtotal, currency=currency)
    except CouponRejected as exc:
        return CouponValidateOut(code=code, valid=False, message=str(exc), currency=currency)

    pricing = None
    if listing and nights:
        pricing = PriceBreakdown(**build_pricing(listing, nights, discount, currency).__dict__)
    return CouponValidateOut(
        code=code,
        valid=True,
        message=f"Coupon applied: you save {format_money(discount, currency)}.",
        discount=discount,
        currency=currency,
        description=coupon.description,
        pricing=pricing,
    )
