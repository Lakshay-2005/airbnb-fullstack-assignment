from tests.conftest import booking_payload, day, listing_payload


def test_listing_retrieval(client):
    page = client.get("/api/listings").json()
    assert page["total"] >= 20
    assert len(page["items"]) == page["page_size"] == 12
    assert page["total_pages"] == -(-page["total"] // 12)

    detail = client.get("/api/listings/1")
    assert detail.status_code == 200
    body = detail.json()
    assert body["title"] and len(body["images"]) >= 3 and body["amenities"]
    assert body["host"]["name"] and body["cleaning_fee"] == 60


def test_listing_not_found(client):
    response = client.get("/api/listings/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Listing not found."


def test_pagination_is_server_side_and_disjoint(client):
    first = client.get("/api/listings?page=1&page_size=10").json()
    second = client.get("/api/listings?page=2&page_size=10").json()
    ids_1 = {i["id"] for i in first["items"]}
    ids_2 = {i["id"] for i in second["items"]}
    assert ids_1 and ids_2 and not ids_1 & ids_2
    assert client.get("/api/listings?page=99").json()["items"] == []


def test_location_search(client):
    goa = client.get("/api/listings?location=Goa")
    assert goa.json()["total"] == 2
    assert {i["city"] for i in goa.json()["items"]} == {"Goa"}
    assert {i["country"] for i in client.get("/api/listings?location=Paris, France").json()["items"]} == {
        "France"
    }
    assert client.get("/api/listings?location=Atlantis").json()["total"] == 0


def test_filters(client):
    cheap = client.get("/api/listings?max_price=120&page_size=48").json()["items"]
    assert cheap and all(i["nightly_price"] <= 120 for i in cheap)

    ranged = client.get("/api/listings?min_price=200&max_price=300&page_size=48").json()["items"]
    assert ranged and all(200 <= i["nightly_price"] <= 300 for i in ranged)

    cabins = client.get("/api/listings?property_type=Cabin&page_size=48").json()["items"]
    assert cabins and {i["property_type"] for i in cabins} == {"Cabin"}

    multi = client.get("/api/listings?property_type=Cabin,Villa&page_size=48").json()["items"]
    assert {i["property_type"] for i in multi} == {"Cabin", "Villa"}

    pools = client.get("/api/listings?amenities=Pool,Wifi&page_size=48").json()["items"]
    assert pools
    for item in pools:
        detail = client.get(f"/api/listings/{item['id']}").json()
        assert {"Pool", "Wifi"} <= set(detail["amenities"])

    assert {i["category"] for i in client.get("/api/listings?category=beach").json()["items"]} == {"beach"}
    big = client.get("/api/listings?bedrooms=4&bathrooms=3&page_size=48").json()["items"]
    assert big and all(i["bedrooms"] >= 4 and i["bathrooms"] >= 3 for i in big)
    top = client.get("/api/listings?min_rating=4.8&page_size=48").json()["items"]
    assert all(i["rating"] >= 4.8 for i in top)


def test_guest_capacity_filter(client):
    for item in client.get("/api/listings?guests=9&page_size=48").json()["items"]:
        assert item["guests_capacity"] >= 9
    assert client.get("/api/listings?guests=30").json()["total"] == 0


def test_sorting(client):
    asc = [
        i["nightly_price"] for i in client.get("/api/listings?sort=price_asc&page_size=48").json()["items"]
    ]
    assert asc == sorted(asc)
    assert client.get("/api/listings?sort=nonsense").status_code == 400


def test_invalid_search_inputs(client):
    assert client.get(f"/api/listings?check_in={day(10)}&check_out={day(5)}").status_code == 400
    assert client.get(f"/api/listings?check_in={day(10)}").status_code == 400
    assert client.get("/api/listings?min_price=500&max_price=100").status_code == 400
    assert client.get("/api/listings?page=0").status_code == 422


def test_search_excludes_unavailable_listings(client, api, guest):
    # Seeded: listing 1 is booked day(12)..day(17)
    start, end = day(13), day(16)
    available = client.get(f"/api/listings?check_in={start}&check_out={end}&page_size=48").json()
    assert 1 not in [i["id"] for i in available["items"]]
    assert all(i["stay"]["nights"] == 3 for i in available["items"])

    # Checkout day of an existing booking is free for the next guest.
    on_checkout = client.get(f"/api/listings?check_in={day(17)}&check_out={day(19)}&page_size=48")
    assert 1 in [i["id"] for i in on_checkout.json()["items"]]


def test_stay_total_in_search_results(client):
    items = client.get(f"/api/listings?check_in={day(200)}&check_out={day(204)}&page_size=48").json()["items"]
    item = next(i for i in items if i["id"] == 1)
    assert item["stay"] == {"nights": 4, "total": 240 * 4 + 60 + 45}


def test_meta_and_destinations(client):
    meta = client.get("/api/meta").json()
    assert "Villa" in meta["property_types"] and "Pool" in meta["amenities"]
    assert meta["price_min"] < meta["price_max"] and len(meta["categories"]) >= 10
    destinations = client.get("/api/destinations?q=Goa").json()
    assert destinations[0]["city"] == "Goa" and destinations[0]["count"] == 2


def test_create_listing_as_host(client, host):
    created = client.post("/api/listings", json=listing_payload(), headers=host)
    assert created.status_code == 201
    body = created.json()
    assert body["host"]["name"] == "Maya Kapoor"
    assert body["amenities"] == ["Hammock", "Wifi"] and len(body["images"]) == 2

    fetched = client.get(f"/api/listings/{body['id']}").json()
    assert fetched["title"] == "Test hillside retreat"
    assert body["id"] in [i["id"] for i in client.get("/api/host/listings", headers=host).json()]


def test_create_listing_validation(client, host):
    bad = client.post("/api/listings", json=listing_payload(nightly_price=1, images=[]), headers=host)
    assert bad.status_code == 422
    assert bad.json()["code"] == "validation_error" and bad.json()["errors"]
    bad_url = client.post("/api/listings", json=listing_payload(images=["ftp://x/y.jpg"]), headers=host)
    assert bad_url.status_code == 422


def test_guest_cannot_create_listing(client, guest):
    response = client.post("/api/listings", json=listing_payload(), headers=guest)
    assert response.status_code == 403


def test_update_listing_persists(client, host):
    listing_id = client.post("/api/listings", json=listing_payload(), headers=host).json()["id"]
    updated = client.put(
        f"/api/listings/{listing_id}",
        json=listing_payload(title="Renamed retreat", nightly_price=199, amenities=["Pool"]),
        headers=host,
    )
    assert updated.status_code == 200
    fetched = client.get(f"/api/listings/{listing_id}").json()
    assert fetched["title"] == "Renamed retreat" and fetched["nightly_price"] == 199
    assert fetched["amenities"] == ["Pool"]


def test_delete_listing(client, host):
    listing_id = client.post("/api/listings", json=listing_payload(), headers=host).json()["id"]
    assert client.delete(f"/api/listings/{listing_id}", headers=host).status_code == 204
    assert client.get(f"/api/listings/{listing_id}").status_code == 404
    assert listing_id not in [i["id"] for i in client.get("/api/listings?page_size=48").json()["items"]]
    assert client.delete(f"/api/listings/{listing_id}", headers=host).status_code == 404


def test_cannot_delete_listing_with_upcoming_booking(client, host, guest):
    booking = client.post(
        "/api/bookings", json=booking_payload(check_in=100, check_out=104), headers=guest
    ).json()
    client.post(f"/api/bookings/{booking['id']}/pay", headers=guest)
    blocked = client.delete("/api/listings/1", headers=host)
    assert blocked.status_code == 409 and "upcoming" in blocked.json()["detail"]
