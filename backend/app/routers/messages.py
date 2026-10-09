from fastapi import APIRouter

from app.routers.deps import CurrentUser, DbSession
from app.schemas.message import (
    ConversationDetail,
    ConversationOut,
    MessageIn,
    MessageOut,
    StartConversationIn,
)
from app.services import messaging

router = APIRouter(prefix="/conversations", tags=["messages"])


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: DbSession, user: CurrentUser):
    return messaging.list_conversations(db, user)


@router.get("/unread-count")
def unread_count(db: DbSession, user: CurrentUser):
    return {"count": sum(c.unread_count for c in messaging.list_conversations(db, user))}


@router.post("", response_model=ConversationDetail, status_code=201)
def start_conversation(payload: StartConversationIn, db: DbSession, user: CurrentUser):
    """Message a listing's host (re-uses the existing thread for this listing, if any)."""
    return messaging.start_conversation(db, user, payload.listing_id, payload.body)


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, db: DbSession, user: CurrentUser):
    return messaging.open_conversation(db, conversation_id, user)


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
def send_message(conversation_id: int, payload: MessageIn, db: DbSession, user: CurrentUser):
    conversation = messaging.get_for_participant(db, conversation_id, user)
    return messaging.send_message(db, conversation, user, payload.body)
