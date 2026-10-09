"""Pure business rules for stay dates and pricing (no database access)."""

from dataclasses import dataclass
from datetime import date, timedelta

from app.core.config import get_settings
from app.core.currency import convert
from app.core.errors import bad_request
from app.models import Listing
from app.models.base import utcnow


@dataclass(frozen=True)
class Pricing:
    """A stay's price breakdown; every amount is whole units of `currency`."""

    nights: int
    nightly_price: int
    subtotal: int
    cleaning_fee: int
    service_fee: int
    discount: int
    total: int
    currency: str


def validate_stay_dates(check_in: date, check_out: date, today: date | None = None) -> int:
    """Return the number of nights, or raise a 400 explaining what is wrong."""
    today = today or utcnow().date()
    if check_out <= check_in:
        raise bad_request("Check-out must be after check-in.", "invalid_dates")
    # One day of grace so guests in time zones behind UTC can still book "today".
    if check_in < today - timedelta(days=1):
        raise bad_request("Check-in date cannot be in the past.", "invalid_dates")
    nights = (check_out - check_in).days
    max_nights = get_settings().max_nights
    if nights > max_nights:
        raise bad_request(f"Stays are limited to {max_nights} nights.", "invalid_dates")
    return nights


def validate_guests(listing: Listing, guests: int) -> None:
    if guests < 1:
        raise bad_request("At least one guest is required.", "invalid_guests")
    if guests > listing.guests_capacity:
        raise bad_request(
            f"Guest count exceeds property capacity (max {listing.guests_capacity}).",
            "capacity_exceeded",
        )


def build_pricing(listing: Listing, nights: int, discount: int = 0, currency: str | None = None) -> Pricing:
    """Price a stay in `currency` (default: the listing's own currency).

    The nightly rate and the two flat fees are converted individually with the server's rate table
    (`core.currency.convert`), then `subtotal = nightly * nights` and
    `total = subtotal + cleaning + service - discount`, so the breakdown always adds up exactly.
    `discount` must already be expressed in `currency`; it can never exceed the subtotal.
    """
    currency = currency or listing.currency
    nightly = convert(listing.nightly_price, listing.currency, currency)
    cleaning = convert(listing.cleaning_fee, listing.currency, currency)
    service = convert(listing.service_fee, listing.currency, currency)
    subtotal = nightly * nights
    discount = max(0, min(discount, subtotal))
    return Pricing(
        nights=nights,
        nightly_price=nightly,
        subtotal=subtotal,
        cleaning_fee=cleaning,
        service_fee=service,
        discount=discount,
        total=subtotal + cleaning + service - discount,
        currency=currency,
    )
