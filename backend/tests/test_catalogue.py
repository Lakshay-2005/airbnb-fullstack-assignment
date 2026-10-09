"""Seed catalogue integrity, the search contract the home-page quick filters rely on, and pause/reactivate."""

from app.db.database import SessionLocal
from app.models import Listing, User
from app.seed import seed_database

# What the frontend's quick filters send (frontend/src/lib/quick-filters.ts).
WHOLE_HOME_TYPES = "Villa,Beach house,Cabin,Cottage,Luxury home,Mountain home"


def all_listings(client):
    return client.get("/api/listings?page_size=48").json()["items"]


def test_catalogue_is_extended_and_consistent(client):
    items = all_listings(client)
    assert len(items) == 48
    meta = client.get("/api/meta").json()
    categories = {c["id"] for c in meta["categories"]}
    assert all(item["category"] in categories for item in items)
    assert all(item["property_type"] in meta["property_types"] for item in items)
    assert len({item["title"] for item in items}) == len(items)
    for item in items:
        assert len(item["images"]) >= 3 and len(set(item["images"])) == len(item["images"])
        assert item["latitude"] is not None and item["longitude"] is not None


def test_original_records_are_untouched_by_the_extension(client):
    """Tests and demos rely on these: Maya owns exactly the first 7 listings, Goa has two stays."""
    items = {item["id"]: item for item in all_listings(client)}
    assert [i for i, item in items.items() if item["host"]["name"] == "Maya Kapoor"] == [1, 2, 3, 4, 5, 6, 27]
    assert items[1]["title"] == "Palm-fringed pool villa near Anjuna" and items[1]["nightly_price"] == 240
    assert min(items) == 1 and max(items) == 48


def test_seeding_twice_changes_nothing(client):
    with SessionLocal() as db:
        before = (db.query(Listing).count(), db.query(User).count())
    seed_database()  # non-reset: a no-op on a seeded database
    with SessionLocal() as db:
        assert (db.query(Listing).count(), db.query(User).count()) == before


def test_quick_filter_contract(client):
    top = client.get("/api/listings?page_size=48&min_rating=4.8").json()
    assert top["total"] > 0 and all(item["rating"] >= 4.8 for item in top["items"])

    budget = client.get("/api/listings?page_size=48&max_price=150").json()
    assert budget["total"] > 0 and all(item["nightly_price"] <= 150 for item in budget["items"])

    homes = client.get(f"/api/listings?page_size=48&property_type={WHOLE_HOME_TYPES}").json()
    assert homes["total"] > 0
    assert all(item["property_type"] in WHOLE_HOME_TYPES.split(",") for item in homes["items"])

    # quick filters combine with a destination (AND), they never widen the search
    combined = client.get("/api/listings?page_size=48&location=India&max_price=150&min_rating=4.8").json()
    assert 0 < combined["total"] < budget["total"]
    assert all(i["country"] == "India" and i["nightly_price"] <= 150 and i["rating"] >= 4.8 for i in combined["items"])


def test_home_page_section_queries_return_stays(client):
    """Every "See all" link on the home page is one of these queries."""
    for query in (
        "location=India&min_rating=4.9",
        "location=United+Kingdom",
        "location=United+States",
        "category=amazing-views",
        "category=pools",
        "category=cabins",
        "category=design",
        "min_rating=4.7",
    ):
        assert client.get(f"/api/listings?{query}").json()["total"] >= 3, query


def test_pausing_a_listing_hides_it_and_reactivating_restores_it(client, host):
    listing = client.get("/api/listings/1").json()
    payload = {
        key: listing[key]
        for key in (
            "title", "description", "location", "city", "country", "latitude", "longitude",
            "property_type", "category", "guests_capacity", "bedrooms", "beds", "bathrooms",
            "nightly_price", "cleaning_fee", "service_fee", "amenities", "images",
        )
    }  # fmt: skip
    paused = client.put("/api/listings/1", json={**payload, "status": "PAUSED"}, headers=host)
    assert paused.status_code == 200 and paused.json()["status"] == "PAUSED"
    assert 1 not in [i["id"] for i in all_listings(client)]
    assert client.get("/api/host/listings", headers=host).json()[0]["id"] in {1, 2, 3, 4, 5, 6, 27}

    active = client.put("/api/listings/1", json={**payload, "status": "ACTIVE"}, headers=host)
    assert active.status_code == 200
    assert 1 in [i["id"] for i in all_listings(client)]
