from fastapi import APIRouter, Response
from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert

from app.core.errors import not_found
from app.models import Favorite, Listing, ListingStatus
from app.routers.deps import CurrentUser, DbSession
from app.schemas.listing import ListingCard
from app.services.listings import to_card

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[ListingCard])
def list_favorites(db: DbSession, user: CurrentUser):
    rows = db.scalars(
        select(Listing)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .where(Favorite.user_id == user.id, Listing.status == ListingStatus.ACTIVE)
        .order_by(Favorite.created_at.desc())
    ).unique()
    return [to_card(listing) for listing in rows]


@router.get("/ids", response_model=list[int])
def favorite_ids(db: DbSession, user: CurrentUser):
    return list(db.scalars(select(Favorite.listing_id).where(Favorite.user_id == user.id)))


@router.post("/{listing_id}", status_code=201)
def add_favorite(listing_id: int, db: DbSession, user: CurrentUser):
    """Idempotent: saving an already-saved listing is a no-op, so double clicks are safe."""
    listing = db.get(Listing, listing_id)
    if listing is None or listing.status == ListingStatus.DELETED:
        raise not_found("Listing not found.", "listing_not_found")
    db.execute(insert(Favorite).values(user_id=user.id, listing_id=listing_id).on_conflict_do_nothing())
    db.commit()
    return {"listing_id": listing_id, "favorite": True}


@router.delete("/{listing_id}", status_code=204)
def remove_favorite(listing_id: int, db: DbSession, user: CurrentUser):
    db.execute(delete(Favorite).where(Favorite.user_id == user.id, Favorite.listing_id == listing_id))
    db.commit()
    return Response(status_code=204)
