"""Guest <-> host conversations. Participation is decided by the signed-in user, never by the client."""

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.errors import bad_request, forbidden, not_found
from app.db.database import write_session
from app.models import Conversation, Listing, ListingStatus, Message, User
from app.models.base import utcnow
from app.schemas.message import (
    ConversationDetail,
    ConversationListing,
    ConversationOut,
    MessageOut,
)
from app.schemas.user import PublicUser


def _message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        sender_id=message.sender_id,
        body=message.body,
        created_at=message.created_at,
        read=message.read_at is not None,
    )


def _unread(db: Session, conversation_id: int, user_id: int) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.read_at.is_(None),
            )
        )
        or 0
    )


def _summary(db: Session, conversation: Conversation, user: User) -> ConversationOut:
    other = conversation.host if conversation.guest_id == user.id else conversation.guest
    last = db.scalars(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.id.desc()).limit(1)
    ).first()
    listing = conversation.listing
    return ConversationOut(
        id=conversation.id,
        listing=ConversationListing(
            id=listing.id,
            title=listing.title,
            city=listing.city,
            country=listing.country,
            image=listing.images[0].image_url if listing.images else None,
        ),
        other_user=PublicUser.model_validate(other, from_attributes=True),
        last_message=_message_out(last) if last else None,
        unread_count=_unread(db, conversation.id, user.id),
        updated_at=conversation.updated_at,
    )


def get_for_participant(db: Session, conversation_id: int, user: User) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise not_found("Conversation not found.", "conversation_not_found")
    if user.id not in (conversation.guest_id, conversation.host_id):
        raise forbidden("This conversation is not yours.", "not_participant")
    return conversation


def list_conversations(db: Session, user: User) -> list[ConversationOut]:
    rows = db.scalars(
        select(Conversation)
        .where((Conversation.guest_id == user.id) | (Conversation.host_id == user.id))
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    ).unique()
    return [_summary(db, c, user) for c in rows]


def open_conversation(db: Session, conversation_id: int, user: User) -> ConversationDetail:
    """Return the thread and mark the other person's messages as read.

    Marking read is a write, so it runs in its own BEGIN IMMEDIATE transaction (like bookings do);
    upgrading this request's read transaction instead can fail with SQLITE_BUSY when two requests
    (e.g. two browser tabs) open the same thread at once.
    """
    conversation = get_for_participant(db, conversation_id, user)
    user_id = user.id  # read before the rollback below, which expires `user` and would reopen a snapshot
    db.rollback()  # end the read snapshot so the reads after the update see it
    with write_session(db.get_bind()) as w:
        w.execute(
            update(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.read_at.is_(None),
            )
            .values(read_at=utcnow())
        )
        w.commit()
    messages = list(
        db.scalars(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id))
    )
    summary = _summary(db, conversation, user)
    return ConversationDetail(**summary.model_dump(), messages=[_message_out(m) for m in messages])


def send_message(db: Session, conversation: Conversation, user: User, body: str) -> MessageOut:
    with write_session(db.get_bind()) as w:
        message = Message(conversation_id=conversation.id, sender_id=user.id, body=body)
        w.add(message)
        w.execute(update(Conversation).where(Conversation.id == conversation.id).values(updated_at=utcnow()))
        w.commit()
    return _message_out(message)


def start_conversation(db: Session, user: User, listing_id: int, body: str) -> ConversationDetail:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.status == ListingStatus.DELETED:
        raise not_found("Listing not found.", "listing_not_found")
    if listing.host_id == user.id:
        raise bad_request("This is your own listing, so there is no one to message.", "own_listing")
    host_id, user_id = listing.host_id, user.id
    db.rollback()
    with write_session(db.get_bind()) as w:
        conversation = w.scalars(
            select(Conversation).where(
                Conversation.listing_id == listing_id, Conversation.guest_id == user_id
            )
        ).first()
        if conversation is None:
            conversation = Conversation(listing_id=listing_id, guest_id=user_id, host_id=host_id)
            w.add(conversation)
            w.flush()
        w.add(Message(conversation_id=conversation.id, sender_id=user_id, body=body))
        conversation.updated_at = utcnow()
        w.commit()
        conversation_id = conversation.id
    return open_conversation(db, conversation_id, user)
