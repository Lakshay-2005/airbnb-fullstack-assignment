from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.schemas.user import PublicUser

MessageBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class MessageIn(BaseModel):
    body: MessageBody


class StartConversationIn(BaseModel):
    listing_id: int
    body: MessageBody


class MessageOut(BaseModel):
    id: int
    sender_id: int
    body: str
    created_at: datetime
    read: bool


class ConversationListing(BaseModel):
    id: int
    title: str
    city: str
    country: str
    image: str | None = None


class ConversationOut(BaseModel):
    id: int
    listing: ConversationListing
    other_user: PublicUser
    last_message: MessageOut | None = None
    unread_count: int
    updated_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
