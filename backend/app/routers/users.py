from fastapi import APIRouter
from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import bad_request, not_found
from app.core.security import create_token
from app.models import User
from app.routers.deps import CurrentUser, DbSession
from app.schemas.user import SessionOut, SwitchUserIn, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/current", response_model=UserOut)
def current_user(user: CurrentUser):
    return user


@router.get("/demo", response_model=list[UserOut])
def demo_users(db: DbSession):
    """Everyone the demo switcher can impersonate (hosts first)."""
    return db.scalars(select(User).order_by(User.role.desc(), User.id)).all()


@router.post("/switch-demo-role", response_model=SessionOut)
def switch_demo_user(body: SwitchUserIn, db: DbSession):
    """Pick a demo identity by user id, or by role (-> that role's default demo user)."""
    settings = get_settings()
    if body.user_id is not None:
        user = db.get(User, body.user_id)
    elif body.role is not None:
        email = settings.default_host_email if body.role == "HOST" else settings.default_guest_email
        user = db.scalar(select(User).where(User.email == email))
    else:
        raise bad_request("Provide either user_id or role.", "missing_identity")
    if user is None:
        raise not_found("Demo user not found.", "user_not_found")
    return SessionOut(token=create_token(user.id), user=user)
