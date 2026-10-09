from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import ListingStatus
from app.schemas.user import PublicUser

MAX_IMAGES = 12


class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_url: str
    sort_order: int


class StayQuote(BaseModel):
    """Total price for the searched dates, shown on cards when dates are supplied."""

    nights: int
    total: int


class ListingCard(BaseModel):
    id: int
    title: str
    location: str
    city: str
    country: str
    property_type: str
    category: str
    guests_capacity: int
    bedrooms: int
    beds: int
    bathrooms: int
    nightly_price: int
    rating: float
    review_count: int
    latitude: float | None
    longitude: float | None
    status: ListingStatus
    images: list[str]
    host: PublicUser
    stay: StayQuote | None = None


class ListingDetail(ListingCard):
    description: str
    cleaning_fee: int
    service_fee: int
    amenities: list[str]
    created_at: datetime
    updated_at: datetime
    host_listing_count: int = 0


class ListingPage(BaseModel):
    items: list[ListingCard]
    total: int
    page: int
    page_size: int
    total_pages: int


class ListingIn(BaseModel):
    """Payload for creating and updating a listing (updates replace the whole listing)."""

    title: str = Field(min_length=5, max_length=160)
    description: str = Field(min_length=20, max_length=5000)
    location: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    country: str = Field(min_length=2, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    property_type: str = Field(min_length=2, max_length=40)
    category: str = Field(default="trending", min_length=2, max_length=40)
    guests_capacity: int = Field(ge=1, le=32)
    bedrooms: int = Field(ge=0, le=20)
    beds: int = Field(ge=1, le=40)
    bathrooms: int = Field(ge=1, le=20)
    nightly_price: int = Field(ge=10, le=100_000)
    cleaning_fee: int = Field(default=0, ge=0, le=10_000)
    service_fee: int = Field(default=0, ge=0, le=10_000)
    status: ListingStatus = ListingStatus.ACTIVE
    amenities: list[str] = Field(default_factory=list, max_length=40)
    images: list[str] = Field(min_length=1, max_length=MAX_IMAGES)

    @field_validator("images")
    @classmethod
    def _valid_urls(cls, urls: list[str]) -> list[str]:
        cleaned = [u.strip() for u in urls if u.strip()]
        if not cleaned:
            raise ValueError("Add at least one photo.")
        for url in cleaned:
            if not url.lower().startswith(("http://", "https://")):
                raise ValueError(f"Photo URL must start with http(s)://: {url[:60]}")
        return cleaned

    @field_validator("status")
    @classmethod
    def _not_deleted(cls, status: ListingStatus) -> ListingStatus:
        if status == ListingStatus.DELETED:
            raise ValueError("Use DELETE to remove a listing.")
        return status

    @field_validator("amenities")
    @classmethod
    def _clean_amenities(cls, names: list[str]) -> list[str]:
        seen: dict[str, str] = {}
        for name in names:
            name = " ".join(name.split())
            if name:
                seen.setdefault(name.lower(), name[:80])
        return list(seen.values())


class HostListing(ListingCard):
    booking_count: int = 0
    upcoming_booking_count: int = 0
    earnings: int = 0


class AvailabilityOut(BaseModel):
    listing_id: int
    range_start: str
    range_end: str
    # Booked ranges as [check_in, check_out): the check-out day itself is still bookable.
    unavailable_ranges: list[dict[str, str]]
    # Every blocked *night* inside the window, for easy calendar rendering.
    unavailable_dates: list[str]


class MetaOut(BaseModel):
    property_types: list[str]
    categories: list[dict[str, str]]
    amenities: list[str]
    price_min: int
    price_max: int


class DestinationOut(BaseModel):
    city: str
    country: str
    count: int
