from dataclasses import dataclass
from datetime import date
from math import ceil

from sqlalchemy import and_, case, exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.currency import (
    CURRENCIES,
    DEFAULT_DISPLAY_CURRENCY,
    convert,
    currency_for_country,
    listing_amount_error,
    normalize_currency,
    rate_factor,
)
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
from app.services.pricing import build_pricing, validate_stay_dates

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
SORT_KEYS = ("recommended", "price_asc", "price_desc", "rating", "newest")


def display_price(currency: str):
    """SQL expression: a listing's nightly price converted into `currency` (same rule as `convert`).

    Search filters and the price sort use this, so a price a guest sees in rupees is compared and
    ordered as rupees, never as dollars. The tiny epsilon makes SQLite's ROUND break exact .5 ties
    upwards like the Python (half-up) conversion does.
    """
    return case(
        *[
            (Listing.currency == code, func.round(Listing.nightly_price * rate_factor(code, currency) + 1e-9))
            for code in CURRENCIES
            if code != currency
        ],
        else_=Listing.nightly_price,
    )


def sort_order(sort: str, currency: str):
    price = display_price(currency)
    return {
        "recommended": (Listing.id.asc(),),
        "price_asc": (price.asc(), Listing.id.asc()),
        "price_desc": (price.desc(), Listing.id.asc()),
        "rating": (Listing.rating.desc(), Listing.review_count.desc(), Listing.id.asc()),
        "newest": (Listing.created_at.desc(), Listing.id.desc()),
    }[sort]


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
    #: Currency the price filters, the price sort and the returned prices use.
    currency: str = DEFAULT_DISPLAY_CURRENCY
    page: int = 1
    page_size: int = 12


# ------------------------------------------------------------------------ serialisation


def to_card(listing: Listing, stay: StayQuote | None = None, currency: str | None = None) -> ListingCard:
    """Serialise a listing; prices are converted into `currency` (default: the listing's own)."""
    shown = currency or listing.currency
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
        currency=shown,
        native_currency=listing.currency,
        nightly_price=convert(listing.nightly_price, listing.currency, shown),
        rating=round(listing.rating, 2),
        review_count=listing.review_count,
        latitude=listing.latitude,
        longitude=listing.longitude,
        status=listing.status,
        images=[img.image_url for img in listing.images],
        host=PublicUser.model_validate(listing.host),
        stay=stay,
    )


def to_detail(db: Session, listing: Listing, currency: str | None = None) -> ListingDetail:
    shown = currency or listing.currency
    host_count = db.scalar(
        select(func.count())
        .select_from(Listing)
        .where(Listing.host_id == listing.host_id, Listing.status == ListingStatus.ACTIVE)
    )
    return ListingDetail(
        **to_card(listing, currency=shown).model_dump(),
        description=listing.description,
        cleaning_fee=convert(listing.cleaning_fee, listing.currency, shown),
        service_fee=convert(listing.service_fee, listing.currency, shown),
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
    if p.sort not in SORT_KEYS:
        raise bad_request(f"Unknown sort '{p.sort}'. Use one of: {', '.join(SORT_KEYS)}.", "bad_sort")
    currency = normalize_currency(p.currency, default=DEFAULT_DISPLAY_CURRENCY)

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
    if p.min_price is not None:  # price filters are expressed in the display currency
        where.append(display_price(currency) >= p.min_price)
    if p.max_price is not None:
        where.append(display_price(currency) <= p.max_price)
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
        .order_by(*sort_order(p.sort, currency))
        .offset((p.page - 1) * p.page_size)
        .limit(p.page_size)
    ).unique()

    items = []
    for listing in rows:
        stay = None
        if nights:
            stay = StayQuote(nights=nights, total=build_pricing(listing, nights, currency=currency).total)
        items.append(to_card(listing, stay, currency))
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


#: Sanity bounds for host-entered prices, in USD so they mean the same in rupees, yen or francs.
NIGHTLY_USD_BOUNDS = (1, 20_000)
FEE_USD_BOUNDS = (0, 5_000)


def _validate_prices(data: ListingIn, currency: str) -> None:
    checks = (
        ("Nightly price", data.nightly_price, NIGHTLY_USD_BOUNDS),
        ("Cleaning fee", data.cleaning_fee, FEE_USD_BOUNDS),
        ("Service fee", data.service_fee, FEE_USD_BOUNDS),
    )
    for label, amount, (low, high) in checks:
        problem = listing_amount_error(amount, currency, minimum_usd=low, maximum_usd=high)
        if problem:
            raise bad_request(f"{label}: {problem}", "invalid_price")


def _apply(db: Session, listing: Listing, data: ListingIn) -> None:
    # The pricing currency follows the listing's country; the three price fields are in that currency.
    currency = currency_for_country(data.country)
    _validate_prices(data, currency)
    listing.currency = currency
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


def host_listings(db: Session, host: User, currency: str | None = None) -> list[HostListing]:
    """The host's listings with booking stats. Prices and earnings are shown in `currency`
    (default: each listing's own currency); earnings from bookings made in other currencies are
    converted with the demo rates."""
    _require_host(host)
    listings = db.scalars(
        select(Listing)
        .where(Listing.host_id == host.id, Listing.status != ListingStatus.DELETED)
        .order_by(Listing.created_at.desc(), Listing.id.desc())
    ).unique()

    today = utcnow().date()
    counts = {
        row.listing_id: row
        for row in db.execute(
            select(
                Booking.listing_id,
                func.count().label("total"),
                func.sum(func.iif(Booking.check_out > today, 1, 0)).label("upcoming"),
            )
            .where(Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]))
            .group_by(Booking.listing_id)
        )
    }
    # Earnings are summed per (listing, booking currency) so each group converts exactly once.
    earned: dict[int, list[tuple[str, int]]] = {}
    for row in db.execute(
        select(Booking.listing_id, Booking.currency, func.sum(Booking.total))
        .where(Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED]))
        .group_by(Booking.listing_id, Booking.currency)
    ):
        earned.setdefault(row[0], []).append((row[1], int(row[2] or 0)))

    result = []
    for listing in listings:
        shown = currency or listing.currency
        row = counts.get(listing.id)
        result.append(
            HostListing(
                **to_card(listing, currency=shown).model_dump(),
                booking_count=row.total if row else 0,
                upcoming_booking_count=int(row.upcoming or 0) if row else 0,
                earnings=sum(convert(amount, code, shown) for code, amount in earned.get(listing.id, [])),
            )
        )
    return result
