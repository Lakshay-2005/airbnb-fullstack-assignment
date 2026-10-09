from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, select

from app.core.currency import DEFAULT_DISPLAY_CURRENCY, normalize_currency
from app.core.errors import bad_request
from app.models import Amenity, Listing, ListingStatus
from app.models.base import utcnow
from app.routers.deps import CurrentUser, DbSession
from app.schemas.listing import (
    AvailabilityOut,
    DestinationOut,
    ListingDetail,
    ListingIn,
    ListingPage,
    MetaOut,
)
from app.services import availability, bookings
from app.services import listings as svc

router = APIRouter(tags=["listings"])


def _csv(value: str | None) -> list[str] | None:
    items = [v.strip() for v in value.split(",") if v.strip()] if value else []
    return items or None


@router.get("/listings", response_model=ListingPage)
def search(
    db: DbSession,
    location: str | None = None,
    check_in: date | None = None,
    check_out: date | None = None,
    guests: Annotated[int | None, Query(ge=1, le=64)] = None,
    min_price: Annotated[int | None, Query(ge=0, description="Nightly price, in `currency`")] = None,
    max_price: Annotated[int | None, Query(ge=0, description="Nightly price, in `currency`")] = None,
    property_type: Annotated[str | None, Query(description="Comma-separated")] = None,
    category: str | None = None,
    amenities: Annotated[str | None, Query(description="Comma-separated; all required")] = None,
    min_rating: Annotated[float | None, Query(ge=0, le=5)] = None,
    bedrooms: Annotated[int | None, Query(ge=0)] = None,
    bathrooms: Annotated[int | None, Query(ge=0)] = None,
    sort: str = "recommended",
    currency: Annotated[
        str, Query(description="Display currency: prices, price filters and the price sort use it")
    ] = DEFAULT_DISPLAY_CURRENCY,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=48)] = 12,
):
    bookings.housekeeping(db)  # releases expired payment holds before availability is evaluated
    params = svc.SearchParams(
        location=location,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        min_price=min_price,
        max_price=max_price,
        property_types=_csv(property_type),
        category=category,
        amenities=_csv(amenities),
        min_rating=min_rating,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        sort=sort,
        currency=normalize_currency(currency),
        page=page,
        page_size=page_size,
    )
    return svc.search_listings(db, params)


@router.get("/meta", response_model=MetaOut)
def meta(db: DbSession, currency: str = DEFAULT_DISPLAY_CURRENCY):
    """Vocabulary for filter UIs: property types, categories, amenities and price bounds (in `currency`)."""
    currency = normalize_currency(currency)
    price = svc.display_price(currency)
    low, high = db.execute(
        select(func.min(price), func.max(price)).where(Listing.status == ListingStatus.ACTIVE)
    ).one()
    return MetaOut(
        property_types=svc.PROPERTY_TYPES,
        categories=[{"id": cid, "label": label} for cid, label in svc.CATEGORIES],
        amenities=list(db.scalars(select(Amenity.name).order_by(Amenity.name))),
        currency=currency,
        price_min=int(low or 0),
        price_max=int(high or 1000),
    )


@router.get("/destinations", response_model=list[DestinationOut])
def destinations(db: DbSession, q: str | None = None, limit: Annotated[int, Query(le=30)] = 12):
    query = (
        select(Listing.city, Listing.country, func.count().label("count"))
        .where(Listing.status == ListingStatus.ACTIVE)
        .group_by(Listing.city, Listing.country)
        .order_by(func.count().desc(), Listing.city)
        .limit(limit)
    )
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.where(Listing.city.ilike(like) | Listing.country.ilike(like))
    return [DestinationOut(city=r.city, country=r.country, count=r.count) for r in db.execute(query)]


@router.get("/listings/{listing_id}", response_model=ListingDetail)
def get_listing(listing_id: int, db: DbSession, user: CurrentUser, currency: str | None = None):
    """Prices are converted into `currency`; without it the listing's own (native) currency is used."""
    shown = normalize_currency(currency) if currency else None
    return svc.to_detail(db, svc.get_listing_for_viewer(db, listing_id, user), shown)


@router.get("/listings/{listing_id}/availability", response_model=AvailabilityOut)
def get_availability(
    listing_id: int,
    db: DbSession,
    user: CurrentUser,
    start: date | None = None,
    end: date | None = None,
):
    """Booked ranges for a listing, taken from the database (never hard-coded in the UI)."""
    listing = svc.get_listing_for_viewer(db, listing_id, user)
    bookings.housekeeping(db)
    start = start or utcnow().date()
    end = end or start + timedelta(days=365)
    if end <= start:
        raise bad_request("`end` must be after `start`.", "invalid_dates")
    if (end - start).days > 800:
        raise bad_request("Availability window is limited to ~2 years.", "invalid_dates")
    ranges = availability.booked_ranges(db, listing.id, start, end)
    return AvailabilityOut(
        listing_id=listing.id,
        range_start=start.isoformat(),
        range_end=end.isoformat(),
        unavailable_ranges=[{"check_in": a.isoformat(), "check_out": b.isoformat()} for a, b in ranges],
        unavailable_dates=[d.isoformat() for d in availability.blocked_nights(ranges, start, end)],
    )


@router.post("/listings", response_model=ListingDetail, status_code=201)
def create_listing(body: ListingIn, db: DbSession, user: CurrentUser):
    return svc.to_detail(db, svc.create_listing(db, user, body))


@router.put("/listings/{listing_id}", response_model=ListingDetail)
def update_listing(listing_id: int, body: ListingIn, db: DbSession, user: CurrentUser):
    return svc.to_detail(db, svc.update_listing(db, user, listing_id, body))


@router.delete("/listings/{listing_id}", status_code=204)
def delete_listing(listing_id: int, db: DbSession, user: CurrentUser):
    svc.delete_listing(db, user, listing_id)
    return Response(status_code=204)
