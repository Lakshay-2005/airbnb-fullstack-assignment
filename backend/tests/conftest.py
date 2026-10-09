import os
import tempfile
from datetime import date, timedelta
from pathlib import Path

# The app reads its settings at import time, so point it at a throw-away database first.
_TMP = Path(tempfile.mkdtemp(prefix="airbnb-clone-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["AUTO_SEED"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import seed_database  # noqa: E402


def day(offset: int) -> str:
    """ISO date `offset` days from today (tests use dates far beyond the seeded bookings)."""
    return (date.today() + timedelta(days=offset)).isoformat()


class Api:
    """Thin helper that remembers a demo-user bearer token."""

    def __init__(self, client: TestClient):
        self.client = client
        self.users = {u["email"]: u for u in client.get("/api/users/demo").json()}

    def as_user(self, email: str) -> dict[str, str]:
        user = self.users[email]
        token = self.client.post("/api/users/switch-demo-role", json={"user_id": user["id"]})
        return {"Authorization": f"Bearer {token.json()['token']}"}

    def id_of(self, email: str) -> int:
        return self.users[email]["id"]


@pytest.fixture()
def client():
    seed_database(reset=True)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def api(client) -> Api:
    return Api(client)


@pytest.fixture()
def guest(api):
    return api.as_user("guest@example.com")


@pytest.fixture()
def host(api):
    return api.as_user("host@example.com")


@pytest.fixture()
def other_host(api):
    return api.as_user("arjun.host@example.com")


# Seed layout the tests rely on: listing 1 is host@example.com's Goa villa (capacity 8,
# $240/night, $60 cleaning, $45 service); listing 7 belongs to another host.
VILLA = 1
VILLA_NIGHTLY, VILLA_CLEANING, VILLA_SERVICE = 240, 60, 45


def booking_payload(listing_id=VILLA, check_in=100, check_out=104, guests=2, **extra):
    return {
        "listing_id": listing_id,
        "check_in": day(check_in),
        "check_out": day(check_out),
        "guests": guests,
        **extra,
    }


def listing_payload(**overrides):
    payload = {
        "title": "Test hillside retreat",
        "description": "A quiet retreat used by the automated tests, with plenty of space.",
        "location": "Test Road, Testville",
        "city": "Testville",
        "country": "Testland",
        "property_type": "Cabin",
        "category": "cabins",
        "guests_capacity": 4,
        "bedrooms": 2,
        "beds": 2,
        "bathrooms": 1,
        "nightly_price": 150,
        "cleaning_fee": 30,
        "service_fee": 20,
        "amenities": ["Wifi", "Hammock"],
        "images": ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    }
    payload.update(overrides)
    return payload
