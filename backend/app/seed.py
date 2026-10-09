"""Populate the database with demo users, listings, bookings, reviews and coupons.

Run `python seed.py` (add `--reset` to wipe and rebuild). Booked dates are relative to
the day the seed runs, so the availability demo always has upcoming reservations.
"""

import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.currency import currency_for_country
from app.db.database import Base, SessionLocal, engine, init_db
from app.models import (
    Amenity,
    Booking,
    BookingStatus,
    Conversation,
    Coupon,
    CouponType,
    Favorite,
    Listing,
    ListingImage,
    Message,
    Payment,
    PaymentStatus,
    Review,
    User,
    UserRole,
)
from app.models.base import utcnow
from app.seed_data import AMENITIES, COUPONS, LISTINGS, REVIEW_COMMENTS, USERS, photo
from app.seed_extra import EXTRA_LISTINGS
from app.services.bookings import new_reference
from app.services.pricing import build_pricing

# (listing index, guest key, start offset in days, nights, status)
UPCOMING = [
    (0, "priya", 12, 5, "CONFIRMED"),
    (0, "liam", 30, 4, "CONFIRMED"),
    (1, "alex", 21, 4, "CONFIRMED"),
    (6, "emma", 5, 4, "CONFIRMED"),
    (10, "noah", 14, 7, "CONFIRMED"),
    (15, "alex", 45, 5, "CONFIRMED"),
    (8, "ava", 8, 3, "CONFIRMED"),
    (23, "lucas", 18, 4, "CONFIRMED"),
    (19, "zoe", 9, 3, "CONFIRMED"),
    (12, "priya", 60, 7, "CONFIRMED"),
    (2, "alex", 25, 3, "CANCELLED"),
]
# Alex has a finished stay at these listings: index 1 is reviewed, index 13 is left unreviewed
# so the "write a review" flow can be demonstrated.
ALEX_PAST_LISTINGS = {1: True, 13: False}


def _make_booking(listing: Listing, guest: User, start, nights: int, status: str) -> Booking:
    pricing = build_pricing(listing, nights)
    booking = Booking(
        reference=new_reference(),
        listing_id=listing.id,
        guest_id=guest.id,
        check_in=start,
        check_out=start + timedelta(days=nights),
        guests=min(listing.guests_capacity, random.choice([1, 2, 2, 3, 4])),
        nights=nights,
        currency=pricing.currency,
        subtotal=pricing.subtotal,
        cleaning_fee=pricing.cleaning_fee,
        service_fee=pricing.service_fee,
        discount=0,
        total=pricing.total,
        status=BookingStatus(status),
        created_at=utcnow() - timedelta(days=random.randint(1, 20)),
    )
    paid = status in ("CONFIRMED", "COMPLETED")
    refunded = status == "CANCELLED"
    booking.payment = Payment(
        amount=pricing.total,
        method="card_4242",
        status=PaymentStatus.SUCCESS
        if paid
        else PaymentStatus.REFUNDED
        if refunded
        else PaymentStatus.PENDING,
    )
    return booking


def seed_database(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(engine)
    init_db()
    random.seed(42)
    today = utcnow().date()

    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            return
        _seed(db, today)
        db.commit()


def _make_listing(item, users: dict[str, User], amenities: dict[str, Amenity]) -> Listing:
    listing = Listing(
        host=users[item["host"]],
        title=item["title"],
        description=item["description"],
        location=item["location"],
        city=item["city"],
        country=item["country"],
        latitude=item["lat"],
        longitude=item["lng"],
        property_type=item["type"],
        category=item["category"],
        guests_capacity=item["guests"],
        bedrooms=item["bedrooms"],
        beds=item["beds"],
        bathrooms=item["baths"],
        currency=currency_for_country(item["country"]),  # prices below are in this currency
        nightly_price=item["price"],
        cleaning_fee=item["cleaning"],
        service_fee=item["service"],
        created_at=utcnow() - timedelta(days=random.randint(30, 400)),
    )
    listing.images = [ListingImage(image_url=photo(name), sort_order=i) for i, name in enumerate(item["photos"])]
    listing.amenities = [amenities[name] for name in item["amenities"]]
    return listing


def _seed(db: Session, today) -> None:
    users = {}
    for key, name, email, role, avatar in USERS:
        users[key] = User(name=name, email=email, role=UserRole(role), avatar=avatar)
        db.add(users[key])
    amenities = {name: Amenity(name=name) for name in AMENITIES}
    db.add_all(amenities.values())

    listings = [_make_listing(item, users, amenities) for item in LISTINGS]
    db.add_all(listings)
    db.flush()

    _seed_history(db, users, listings, today)
    _seed_upcoming(db, users, listings, today)
    _seed_coupons(db)
    _seed_favorites(db, users, listings)
    _seed_extra_listings(db, users, amenities, today)
    _seed_conversation(db, users, listings)


def _seed_history(
    db: Session, users: dict[str, User], listings: list[Listing], today, alex_past=ALEX_PAST_LISTINGS
) -> None:
    """Finished stays (COMPLETED) that back the seeded reviews; ratings are derived from them."""
    guest_keys = [k for k, u in users.items() if u.role == UserRole.GUEST]
    for index, listing in enumerate(listings):
        end = today - timedelta(days=random.randint(6, 14))
        review_total = 0
        for n in range(random.randint(3, 7)):
            nights = random.randint(2, 6)
            start = end - timedelta(days=nights)
            key = random.choice(guest_keys)
            reviewed = True
            if n == 0 and index in alex_past:
                key, reviewed = "alex", alex_past[index]
            elif key == "alex":
                key = "liam"
            booking = _make_booking(listing, users[key], start, nights, "COMPLETED")
            db.add(booking)
            db.flush()
            if reviewed:
                rating, comment = random.choices(
                    REVIEW_COMMENTS, weights=[{5: 6, 4: 3, 3: 0.4}[r] for r, _ in REVIEW_COMMENTS]
                )[0]
                db.add(
                    Review(
                        listing_id=listing.id,
                        user_id=booking.guest_id,
                        booking_id=booking.id,
                        rating=rating,
                        comment=comment,
                        created_at=utcnow() - timedelta(days=(today - end).days, hours=n),
                    )
                )
                review_total += rating
                listing.review_count += 1
            end = start - timedelta(days=random.randint(8, 30))
        listing.rating = round(review_total / listing.review_count, 2) if listing.review_count else 0


def _seed_upcoming(db: Session, users: dict[str, User], listings: list[Listing], today) -> None:
    for index, guest_key, offset, nights, status in UPCOMING:
        start = today + timedelta(days=offset)
        db.add(_make_booking(listings[index], users[guest_key], start, nights, status))


def _seed_coupons(db: Session) -> None:
    for code, desc, kind, value, minimum, maximum, active, days, limit, used in COUPONS:
        db.add(
            Coupon(
                code=code,
                description=desc,
                type=CouponType(kind),
                value=value,
                minimum_amount=minimum,
                maximum_discount=maximum,
                active=active,
                expires_at=utcnow() + timedelta(days=days),
                usage_limit=limit,
                usage_count=used,
            )
        )


def _seed_favorites(db: Session, users: dict[str, User], listings: list[Listing]) -> None:
    for index in (0, 8, 10, 17, 23, 1):
        db.add(Favorite(user_id=users["alex"].id, listing_id=listings[index].id))
    for key in ("priya", "liam", "emma", "noah", "ava"):
        for index in random.sample(range(len(listings)), 4):
            db.add(Favorite(user_id=users[key].id, listing_id=listings[index].id))


def _seed_conversation(db: Session, users: dict[str, User], listings: list[Listing]) -> None:
    """One demo thread: Alex asks Maya about the Goa beach house he has booked (no randomness used)."""
    listing = listings[1]
    now = utcnow()
    thread = Conversation(
        listing_id=listing.id,
        guest_id=users["alex"].id,
        host_id=listing.host_id,
        created_at=now - timedelta(days=2, hours=3),
        updated_at=now - timedelta(hours=5),
    )
    db.add(thread)
    db.flush()
    script = [
        ("alex", timedelta(days=2, hours=3), True, "Hi Maya! We are looking forward to the stay. Is early check-in possible?"),
        ("maya", timedelta(days=2, hours=1), True, "Hi Alex, welcome! Check-in opens at 3 PM, but I will tell you if it frees up early."),
        ("alex", timedelta(days=1, hours=20), True, "That works. Is there parking close to the house?"),
        ("maya", timedelta(hours=5), False, "Yes, free parking right outside the gate. I will send the door code the day before."),
    ]
    for sender, ago, read, body in script:
        db.add(
            Message(
                conversation_id=thread.id,
                sender_id=users[sender].id,
                body=body,
                created_at=now - ago,
                read_at=(now - ago + timedelta(minutes=20)) if read else None,
            )
        )


def _seed_extra_listings(db: Session, users: dict[str, User], amenities: dict[str, Amenity], today) -> None:
    """Listings 29+: seeded last with their own random seed so the original records stay identical."""
    random.seed(2026)
    extras = [_make_listing(item, users, amenities) for item in EXTRA_LISTINGS]
    db.add_all(extras)
    db.flush()
    _seed_history(db, users, extras, today, alex_past={})
