from datetime import datetime

from sqlalchemy import Column, Float, ForeignKey, Index, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.base import created_column, enum_column, updated_column
from app.models.enums import ListingStatus
from app.models.user import User

listing_amenities = Table(
    "listing_amenities",
    Base.metadata,
    Column("listing_id", ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class ListingImage(Base):
    __tablename__ = "listing_images"
    __table_args__ = (Index("ix_listing_images_listing_sort", "listing_id", "sort_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"))
    image_url: Mapped[str] = mapped_column(String(1000))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Listing(Base):
    """A bookable stay.

    All money columns are whole US dollars (integers): prices are exact and
    never touch floating point. Discounts are rounded to the nearest dollar.
    `service_fee` and `cleaning_fee` are flat per-stay amounts.
    """

    __tablename__ = "listings"
    __table_args__ = (
        Index("ix_listings_city_country", "city", "country"),
        Index("ix_listings_location", "location"),
        Index("ix_listings_property_type", "property_type"),
        Index("ix_listings_price", "nightly_price"),
        Index("ix_listings_status_category", "status", "category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    property_type: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(40), default="trending")
    guests_capacity: Mapped[int] = mapped_column(Integer)
    bedrooms: Mapped[int] = mapped_column(Integer)
    beds: Mapped[int] = mapped_column(Integer)
    bathrooms: Mapped[int] = mapped_column(Integer)
    nightly_price: Mapped[int] = mapped_column(Integer)
    cleaning_fee: Mapped[int] = mapped_column(Integer, default=0)
    service_fee: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ListingStatus] = enum_column(ListingStatus, default=ListingStatus.ACTIVE)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = updated_column()

    host: Mapped[User] = relationship(lazy="joined")
    images: Mapped[list[ListingImage]] = relationship(
        cascade="all, delete-orphan", order_by=ListingImage.sort_order, lazy="selectin"
    )
    amenities: Mapped[list[Amenity]] = relationship(
        secondary=listing_amenities, lazy="selectin", order_by=Amenity.name
    )
