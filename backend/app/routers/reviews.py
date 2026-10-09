from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.errors import forbidden
from app.models import Booking, BookingStatus, Listing, Review
from app.routers.deps import CurrentUser, DbSession
from app.schemas.misc import ReviewIn, ReviewList, ReviewOut
from app.services import bookings as bookings_svc
from app.services.listings import get_listing_for_viewer

router = APIRouter(tags=["reviews"])


def _reviewable_booking(db, user_id: int, listing_id: int) -> Booking | None:
    """A completed stay by this guest that has not been reviewed yet."""
    reviewed = select(Review.booking_id)
    return db.scalars(
        select(Booking)
        .where(
            Booking.listing_id == listing_id,
            Booking.guest_id == user_id,
            Booking.status == BookingStatus.COMPLETED,
            Booking.id.not_in(reviewed),
        )
        .order_by(Booking.check_out.desc())
        .limit(1)
    ).first()


@router.get("/listings/{listing_id}/reviews", response_model=ReviewList)
def list_reviews(
    listing_id: int,
    db: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    listing = get_listing_for_viewer(db, listing_id, user)
    bookings_svc.housekeeping(db)
    total, average = db.execute(
        select(func.count(), func.coalesce(func.avg(Review.rating), 0)).where(Review.listing_id == listing.id)
    ).one()
    items = db.scalars(
        select(Review)
        .where(Review.listing_id == listing.id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(limit)
    ).unique()
    return ReviewList(
        items=[ReviewOut.model_validate(r) for r in items],
        total=total,
        average=round(float(average), 2),
        can_review=_reviewable_booking(db, user.id, listing.id) is not None,
    )


@router.post("/listings/{listing_id}/reviews", response_model=ReviewOut, status_code=201)
def create_review(listing_id: int, body: ReviewIn, db: DbSession, user: CurrentUser):
    listing = get_listing_for_viewer(db, listing_id, user)
    bookings_svc.housekeeping(db)
    booking = _reviewable_booking(db, user.id, listing.id)
    if booking is None:
        raise forbidden("Only guests with a completed stay can review this listing.", "review_not_allowed")
    review = Review(
        listing_id=listing.id,
        user_id=user.id,
        booking_id=booking.id,
        rating=body.rating,
        comment=body.comment.strip(),
    )
    db.add(review)
    db.flush()
    # Keep the denormalised rating on the listing in sync with its reviews.
    count, avg = db.execute(
        select(func.count(), func.avg(Review.rating)).where(Review.listing_id == listing.id)
    ).one()
    target = db.get(Listing, listing.id)
    target.review_count, target.rating = count, round(float(avg), 2)
    db.commit()
    db.refresh(review)
    return ReviewOut.model_validate(review)
