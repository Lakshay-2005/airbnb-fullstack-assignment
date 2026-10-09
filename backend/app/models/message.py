from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.base import created_column, updated_column
from app.models.listing import Listing
from app.models.user import User


class Conversation(Base):
    """One thread per (listing, guest). The host is always the listing's host."""

    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("listing_id", "guest_id", name="uq_conversation_listing_guest"),
        Index("ix_conversations_guest", "guest_id"),
        Index("ix_conversations_host", "host_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"))
    guest_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = updated_column()

    listing: Mapped[Listing] = relationship(lazy="joined")
    guest: Mapped[User] = relationship(foreign_keys=[guest_id], lazy="joined")
    host: Mapped[User] = relationship(foreign_keys=[host_id], lazy="joined")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", order_by="Message.id", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation", "conversation_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = created_column()
    #: set when the *other* participant opens the thread
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
