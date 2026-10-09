from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.booking import PriceBreakdown
from app.schemas.user import PublicUser


class CouponValidateIn(BaseModel):
    code: str = Field(max_length=40)
    listing_id: int | None = None
    check_in: str | None = None
    check_out: str | None = None
    # Optional: validate against a specific subtotal instead of listing + dates
    subtotal: int | None = Field(default=None, ge=0)


class CouponValidateOut(BaseModel):
    code: str
    valid: bool
    message: str
    discount: int = 0
    description: str | None = None
    pricing: PriceBreakdown | None = None


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=10, max_length=2000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int
    comment: str
    created_at: datetime
    user: PublicUser


class ReviewList(BaseModel):
    items: list[ReviewOut]
    total: int
    average: float
    can_review: bool


class HostSummary(BaseModel):
    listing_count: int
    active_listing_count: int
    booking_count: int
    upcoming_booking_count: int
    earnings: int
