from fastapi import APIRouter
from sqlalchemy import select

from app.core.currency import DEFAULT_DISPLAY_CURRENCY, normalize_currency
from app.core.errors import forbidden
from app.models import Booking, BookingStatus, Listing, ListingStatus, User, UserRole
from app.models.base import utcnow
from app.routers.bookings import bookings_to_out
from app.routers.deps import CurrentUser, DbSession
from app.schemas.booking import BookingOut
from app.schemas.listing import HostListing
from app.schemas.misc import HostSummary
from app.services import bookings as bookings_svc
from app.services.listings import host_listings

router = APIRouter(prefix="/host", tags=["host"])


def _require_host(user: User) -> None:
    if user.role != UserRole.HOST:
        raise forbidden("Switch to a host account to use the host dashboard.", "host_required")


@router.get("/listings", response_model=list[HostListing])
def my_listings(db: DbSession, user: CurrentUser, currency: str | None = None):
    """Prices and earnings in `currency`; without it each listing is shown in its own currency."""
    bookings_svc.housekeeping(db)
    return host_listings(db, user, normalize_currency(currency) if currency else None)


@router.get("/bookings", response_model=list[BookingOut])
def my_listing_bookings(db: DbSession, user: CurrentUser):
    """Reservations guests have made on the host's listings (abandoned/expired ones excluded)."""
    _require_host(user)
    bookings_svc.housekeeping(db)
    rows = db.scalars(
        select(Booking)
        .join(Listing, Listing.id == Booking.listing_id)
        .where(Listing.host_id == user.id)
        .where(
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.CANCELLED])
        )
        .order_by(Booking.check_in.desc(), Booking.id.desc())
    ).unique()
    return bookings_to_out(db, list(rows), user)


@router.get("/summary", response_model=HostSummary)
def summary(db: DbSession, user: CurrentUser, currency: str = DEFAULT_DISPLAY_CURRENCY):
    _require_host(user)
    currency = normalize_currency(currency)
    bookings_svc.housekeeping(db)
    listings = host_listings(db, user, currency)
    today = utcnow().date()
    upcoming = db.scalars(
        select(Booking.id)
        .join(Listing, Listing.id == Booking.listing_id)
        .where(
            Listing.host_id == user.id,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.check_out > today,
        )
    ).all()
    return HostSummary(
        listing_count=len(listings),
        active_listing_count=sum(1 for item in listings if item.status == ListingStatus.ACTIVE),
        booking_count=sum(item.booking_count for item in listings),
        upcoming_booking_count=len(upcoming),
        earnings=sum(item.earnings for item in listings),
        currency=currency,
    )
