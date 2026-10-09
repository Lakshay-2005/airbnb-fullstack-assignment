"""Demo-session tokens.

There is no real authentication in this project. The client asks the API to
"switch demo user" and receives an HMAC-signed token naming that user. The
server verifies the signature and always loads the role from the database, so
a client can neither forge an identity nor claim a role it does not have.
"""

import base64
import hashlib
import hmac
import time

from app.core.config import get_settings


def _sign(payload: str) -> str:
    key = get_settings().secret_key.encode()
    return hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: int) -> str:
    expires = int(time.time()) + get_settings().session_ttl_days * 86400
    payload = f"{user_id}.{expires}"
    raw = f"{payload}.{_sign(payload)}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def verify_token(token: str) -> int | None:
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        user_id, expires, signature = decoded.split(".")
        if not hmac.compare_digest(signature, _sign(f"{user_id}.{expires}")):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, UnicodeDecodeError):
        return None
