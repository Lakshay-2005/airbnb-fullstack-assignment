from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BookingStatus, PaymentStatus
from app.schemas.user import PublicUser


class PriceBreakdown(BaseModel):
    nights: int
    nightly_price: int
    subtotal: int
    cleaning_fee: int
    service_fee: int
    discount: int
    total: int
    currency: str = "USD"


class CouponCheck(BaseModel):
    code: str
    valid: bool
    message: str
    discount: int = 0
    description: str | None = None


class QuoteOut(BaseModel):
    """Server-authoritative price preview for a prospective stay."""

    listing_id: int
    bookable: bool
    # Human-readable reason when `bookable` is false (invalid dates, unavailable, too many guests…)
    message: str | None = None
    code: str | None = None
    pricing: PriceBreakdown | None = None
    coupon: CouponCheck | None = None


class BookingCreate(BaseModel):
    # Unknown fields (e.g. a client-computed total) are ignored on purpose: never trusted.
    model_config = ConfigDict(extra="ignore")

    listing_id: int
    check_in: date
    check_out: date
    guests: int = Field(ge=1, le=64)
    coupon_code: str | None = Field(default=None, max_length=40)


class CouponApply(BaseModel):
    code: str | None = Field(default=None, max_length=40)


class PayIn(BaseModel):
    # "card_4242" always succeeds; "card_declined" simulates a declined card.
    payment_method: str = Field(default="card_4242", max_length=40)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: PaymentStatus
    amount: int
    method: str | None = None
    failure_reason: str | None = None


class BookingListing(BaseModel):
    id: int
    title: str
    city: str
    country: str
    location: str
    property_type: str
    image: str | None
    host: PublicUser
    status: str


class BookingOut(BaseModel):
    id: int
    reference: str
    status: BookingStatus
    check_in: date
    check_out: date
    guests: int
    nights: int
    subtotal: int
    cleaning_fee: int
    service_fee: int
    discount: int
    total: int
    currency: str = "USD"
    coupon_code: str | None
    hold_expires_at: datetime | None
    created_at: datetime
    can_cancel: bool
    can_review: bool = False
    listing: BookingListing
    guest: PublicUser
    guest_email: str | None = None
    payment: PaymentOut | None
