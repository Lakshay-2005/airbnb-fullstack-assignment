from dataclasses import dataclass
from datetime import date
from math import ceil

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import bad_request, conflict, forbidden, not_found
from app.models import (
    Amenity,
    Booking,
    BookingStatus,
    Listing,
    ListingImage,
    ListingStatus,
    User,
    UserRole,
    listing_amenities,
)
from app.models.base import utcnow
from app.schemas.listing import (
    HostListing,
    ListingCard,
    ListingDetail,
    ListingIn,
    ListingPage,
    StayQuote,
)
from app.schemas.user import PublicUser
from app.services import availability
from app.services.pricing import validate_stay_dates

CATEGORIES = [
    ("beach", "Beach"),
    ("cabins", "Cabins"),
    ("amazing-views", "Amazing views"),
    ("countryside", "Countryside"),
    ("pools", "Amazing pools"),
    ("mansions", "Mansions"),
    ("design", "Design"),
    ("omg", "OMG!"),
    ("tropical", "Tropical"),
    ("lakefront", "Lakefront"),
    ("iconic-cities", "Iconic cities"),
]
PROPERTY_TYPES = [
    "Apartment",
    "Beach house",
    "Boutique stay",
    "Cabin",
    "Cottage",
    "Loft",
    "Luxury home",
    "Mountain home",
    "Villa",
]
SORTS = {
    "recommended": (Listing.id.asc(),),
    "price_asc": (Listing.nightly_price.asc(), Listing.id.asc()),
    "price_desc": (Listing.nightly_price.desc(), Listing.id.asc()),
    "rating": (Listing.rating.desc(), Listing.review_count.desc(), Listing.id.asc()),
    "newest": (Listing.created_at.desc(), Listing.id.desc()),
}


@dataclass
class SearchParams:
    location: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    guests: int | None = None
    min_price: int | None = None
    max_price: int | None = None
    property_types: list[str] | None = None
    category: str | None = None
    amenities: list[str] | None = None
    min_rating: float | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    sort: str = "recommended"
    page: int = 1
    page_size: int = 12


# ------------------------------------------------------------------------ serialisation


def to_card(listing: Listing, stay: StayQuote | None = None) -> ListingCard:
    return ListingCard(
        id=listing.id,
        title=listing.title,
        location=listing.location,
        city=listing.city,
        country=listing.country,
        property_type=listing.property_type,
        category=listing.category,
        guests_capacity=listing.guests_capacity,
        bedrooms=listing.bedrooms,
        beds=listing.beds,
        bathrooms=listing.bathrooms,
        nightly_price=listing.nightly_price,
        rating=round(listing.rating, 2),
        review_count=listing.review_count,
        latitude=listing.latitude,
        longitude=listing.longitude,
        status=listing.status,
        images=[img.image_url for img in listing.images],
        host=PublicUser.model_validate(listing.host),
        stay=stay,
    )


def to_detail(db: Session, listing: Listing) -> ListingDetail:
    host_count = db.scalar(
        select(func.count())
        .select_from(Listing)
        .where(Listing.host_id == listing.host_id, Listing.status == ListingStatus.ACTIVE)
    )
    return ListingDetail(
        **to_card(listing).model_dump(),
        description=listing.description,
        cleaning_fee=listing.cleaning_fee,
        service_fee=listing.service_fee,
        amenities=[a.name for a in listing.amenities],
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        host_listing_count=host_count or 0,
    )


# ------------------------------------------------------------------------------ search


def _location_clause(text: str):
    """Every comma/space separated term must appear in the title, city, country or address."""
    terms = [t.strip() for t in text.replace(",", " ").split() if t.strip()]
    clauses = []
    for term in terms:
        like = f"%{term}%"
        clauses.append(
            or_(
                Listing.city.ilike(like),
                Listing.country.ilike(like),
                Listing.location.ilike(like),
                Listing.title.ilike(like),
            )
        )
    return and_(*clauses) if clauses else None


def _has_amenity(name: str):
    return exists(
        select(1)
        .select_from(listing_amenities.join(Amenity, Amenity.id == listing_amenities.c.amenity_id))
        .where(listing_amenities.c.listing_id == Listing.id, func.lower(Amenity.name) == name.lower())
    )


def search_listings(db: Session, p: SearchParams) -> ListingPage:
    if p.sort not in SORTS:
        raise bad_request(f"Unknown sort '{p.sort}'. Use one of: {', '.join(SORTS)}.", "bad_sort")

    nights = None
    if p.check_in and p.check_out:
        nights = validate_stay_dates(p.check_in, p.check_out)
    elif p.check_in or p.check_out:
        raise bad_request("Provide both check-in and check-out dates.", "invalid_dates")
    if p.min_price is not None and p.max_price is not None and p.min_price > p.max_price:
        raise bad_request("Minimum price cannot exceed maximum price.", "invalid_price_range")

    where = [Listing.status == ListingStatus.ACTIVE]
    if p.location and (clause := _location_clause(p.location)) is not None:
        where.append(clause)
    if p.guests:
        where.append(Listing.guests_capacity >= p.guests)
    if p.min_price is not None:
        where.append(Listing.nightly_price >= p.min_price)
    if p.max_price is not None:
        where.append(Listing.nightly_price <= p.max_price)
    if p.property_types:
        where.append(Listing.property_type.in_(p.property_types))
    if p.category:
        where.append(Listing.category == p.category)
    for name in p.amenities or []:
        where.append(_has_amenity(name))
    if p.min_rating:
        where.append(Listing.rating >= p.min_rating)
    if p.bedrooms:
        where.append(Listing.bedrooms >= p.bedrooms)
    if p.bathrooms:
        where.append(Listing.bathrooms >= p.bathrooms)
    if nights:
        clash = (
            select(Booking.id)
            .where(
                Booking.listing_id == Listing.id,
                availability.blocks_dates(),
                availability.overlaps(p.check_in, p.check_out),
            )
            .exists()
        )
        where.append(~clash)

    total = db.scalar(select(func.count()).select_from(Listing).where(*where)) or 0
    rows = db.scalars(
        select(Listing)
        .where(*where)
        .order_by(*SORTS[p.sort])
        .offset((p.page - 1) * p.page_size)
        .limit(p.page_size)
    ).unique()

    items = []
    for listing in rows:
        stay = None
        if nights:
            stay = StayQuote(
                nights=nights,
                total=listing.nightly_price * nights + listing.cleaning_fee + listing.service_fee,
            )
        items.append(to_card(listing, stay))
    return ListingPage(
        items=items,
        total=total,
        page=p.page,
        page_size=p.page_size,
        total_pages=max(1, ceil(total / p.page_size)),
    )


def get_listing_for_viewer(db: Session, listing_id: int, viewer: User) -> Listing:
    """Public detail view: paused listings are visible only to their host."""
    listing = db.get(Listing, listing_id)
    if listing is None or listing.status == ListingStatus.DELETED:
        raise not_found("Listing not found.", "listing_not_found")
    if listing.status == ListingStatus.PAUSED and listing.host_id != viewer.id:
        raise not_found("Listing not found.", "listing_not_found")
    return listing


# ---------------------------------------------------------------------------- host CRUD


def _require_host(user: User) -> None:
    if user.role != UserRole.HOST:
        raise forbidden("Switch to a host account to manage listings.", "host_required")


def _owned_listing(db: Session, user: User, listing_id: int) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.status == ListingStatus.DELETED:
        raise not_found("Listing not found.", "listing_not_found")
    if listing.host_id != user.id:
        raise forbidden("You don't own this listing.", "not_listing_owner")
    return listing


def _resolve_amenities(db: Session, names: list[str]) -> list[Amenity]:
    resolved = []
    for name in names:
        amenity = db.scalar(select(Amenity).where(func.lower(Amenity.name) == name.lower()))
        if amenity is None:
            amenity = Amenity(name=name)
            db.add(amenity)
        resolved.append(amenity)
    return resolved


def _coords_for_city(db: Session, data: ListingIn) -> tuple[float | None, float | None]:
    """Reuse coordinates of an existing listing in the same city when the host gave none."""
    if data.latitude is not None and data.longitude is not None:
        return data.latitude, data.longitude
    match = db.execute(
        select(Listing.latitude, Listing.longitude).where(
            func.lower(Listing.city) == data.city.lower(),
            Listing.latitude.is_not(None),
            Listing.longitude.is_not(None),
        )
    ).first()
    return (match.latitude, match.longitude) if match else (None, None)


def _apply(db: Session, listing: Listing, data: ListingIn) -> None:
    fields = data.model_dump(exclude={"images", "amenities", "latitude", "longitude"})
    for key, value in fields.items():
        setattr(listing, key, value)
    listing.latitude, listing.longitude = _coords_for_city(db, data)
    listing.amenities = _resolve_amenities(db, data.amenities)
    listing.images = [ListingImage(image_url=url, sort_order=i) for i, url in enumerate(data.images)]


def create_listing(db: Session, host: User, data: ListingIn) -> Listing:
    _require_host(host)
    listing = Listing(host_id=host.id)
    _apply(db, listing, data)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def update_listing(db: Session, host: User, listing_id: int, data: ListingIn) -> Listing:
    _require_host(host)
    listing = _owned_listing(db, host, listing_id)
    _apply(db, listing, data)
    listing.updated_at = utcnow()
    db.commit()
    db.refresh(listing)
    return listing


def delete_listing(db: Session, host: User, listing_id: int) -> None:
    """Soft delete. Refused while guests still hold upcoming/pending reservations."""
    from app.models import Favorite

    _require_host(host)
    listing = _owned_listing(db, host, listing_id)
    active = db.scalar(
        select(func.count())
        .select_from(Booking)
        .where(
            Booking.listing_id == listing.id,
            Booking.check_out > utcnow().date(),
            availability.blocks_dates(),
        )
    )
    if active:
        raise conflict(
            f"This listing has {active} upcoming reservation(s). Wait for them to finish or "
            "pause the listing instead.",
            "listing_has_bookings",
        )
    listing.status = ListingStatus.DELETED
    db.query(Favorite).filter(Favorite.listing_id == listing.id).delete()
    db.commit()


def host_listings(db: Session, host: User) -> list[HostListing]:
    _require_host(host)
    listings = db.scalars(
        select(Listing)
        .where(Listing.host_id == host.id, Listing.status != ListingStatus.DELETED)
        .order_by(Listing.created_at.desc(), Listing.id.desc())
    ).unique()

    today = utcnow().date()
    stats = {
        row.listing_id: row
        for row in db.execute(
            select(
                Booking.listing_id,
                func.count().label("total"),
                func.sum(func.iif(Booking.check_out > today, 1, 0)).label("upcoming"),
                func.sum(Booking.total).label("earnings"),
            )
            .where(
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
            )
            .group_by(Booking.listing_id)
        )
    }
    result = []
    for listing in listings:
        row = stats.get(listing.id)
        result.append(
            HostListing(
                **to_card(listing).model_dump(),
                booking_count=row.total if row else 0,
                upcoming_booking_count=int(row.upcoming or 0) if row else 0,
                earnings=int(row.earnings or 0) if row else 0,
            )
        )
    return result
