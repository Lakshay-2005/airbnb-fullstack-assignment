from tests.conftest import booking_payload, day, listing_payload


def test_demo_user_switching_and_default(client, api):
    assert client.get("/api/users/current").json()["email"] == "guest@example.com"
    host = client.post("/api/users/switch-demo-role", json={"role": "HOST"}).json()
    assert host["user"]["role"] == "HOST" and host["user"]["email"] == "host@example.com"
    me = client.get("/api/users/current", headers={"Authorization": f"Bearer {host['token']}"}).json()
    assert me["id"] == host["user"]["id"]


def test_forged_or_tampered_tokens_are_rejected(client):
    assert client.get("/api/users/current", headers={"Authorization": "Bearer garbage"}).status_code == 401
    token = client.post("/api/users/switch-demo-role", json={"role": "GUEST"}).json()["token"]
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    assert (
        client.get("/api/users/current", headers={"Authorization": f"Bearer {tampered}"}).status_code == 401
    )
    assert client.post("/api/users/switch-demo-role", json={}).status_code == 400
    assert client.post("/api/users/switch-demo-role", json={"user_id": 9999}).status_code == 404


def test_role_header_cannot_escalate_privileges(client, guest):
    response = client.post("/api/listings", json=listing_payload(), headers={**guest, "X-User-Role": "HOST"})
    assert response.status_code == 403


def test_host_cannot_edit_or_delete_another_hosts_listing(client, host, other_host):
    mine = client.post("/api/listings", json=listing_payload(), headers=host).json()["id"]
    edit = client.put(
        f"/api/listings/{mine}", json=listing_payload(title="Hijacked listing"), headers=other_host
    )
    assert edit.status_code == 403
    assert edit.json()["detail"] == "You don't own this listing."
    assert client.delete(f"/api/listings/{mine}", headers=other_host).status_code == 403
    assert client.get(f"/api/listings/{mine}").json()["title"] == "Test hillside retreat"


def test_host_dashboard_data(client, host, guest):
    listings = client.get("/api/host/listings", headers=host).json()
    assert len(listings) == 7 and all(item["host"]["name"] == "Maya Kapoor" for item in listings)
    assert {"booking_count", "upcoming_booking_count", "earnings", "status"} <= set(listings[0])

    summary = client.get("/api/host/summary", headers=host).json()
    assert summary["listing_count"] == 7 and summary["booking_count"] > 0

    assert client.get("/api/host/listings", headers=guest).status_code == 403
    assert client.get("/api/host/bookings", headers=guest).status_code == 403


def test_full_host_journey(client, host, guest, api):
    created = client.post("/api/listings", json=listing_payload(), headers=host).json()
    assert created["id"] in [i["id"] for i in client.get("/api/host/listings", headers=host).json()]

    client.put(f"/api/listings/{created['id']}", json=listing_payload(nightly_price=200), headers=host)

    # a guest books the host's new listing and the host sees it
    payload = booking_payload(listing_id=created["id"], check_in=40, check_out=43, guests=3)
    booking = client.post("/api/bookings", json=payload, headers=guest).json()
    assert booking["total"] == 200 * 3 + 30 + 20
    client.post(f"/api/bookings/{booking['id']}/pay", headers=guest)

    received = client.get("/api/host/bookings", headers=host).json()
    mine = next(b for b in received if b["id"] == booking["id"])
    assert mine["guest"]["name"] == "Alex Morgan" and mine["guest_email"] == "guest@example.com"
    assert mine["status"] == "CONFIRMED" and mine["check_in"] == day(40)
    # guests never see other guests' e-mail addresses
    assert client.get(f"/api/bookings/{booking['id']}", headers=guest).json()["guest_email"] is None

    # unrelated host sees nothing of it
    other = api.as_user("arjun.host@example.com")
    assert booking["id"] not in [b["id"] for b in client.get("/api/host/bookings", headers=other).json()]


def test_favorites_are_persistent_and_idempotent(client, guest, api):
    before = client.get("/api/favorites", headers=guest).json()
    ids_before = client.get("/api/favorites/ids", headers=guest).json()
    assert len(before) == len(ids_before) >= 3

    target = next(i for i in range(1, 29) if i not in ids_before)
    for _ in range(3):  # repeated clicks are safe
        assert client.post(f"/api/favorites/{target}", headers=guest).status_code == 201
    ids_after = client.get("/api/favorites/ids", headers=guest).json()
    assert ids_after.count(target) == 1 and len(ids_after) == len(ids_before) + 1
    assert client.get("/api/favorites", headers=guest).json()[0]["id"] == target  # newest first

    for _ in range(2):
        assert client.delete(f"/api/favorites/{target}", headers=guest).status_code == 204
    assert target not in client.get("/api/favorites/ids", headers=guest).json()

    # favourites are per user
    liam = api.as_user("liam@example.com")
    assert client.get("/api/favorites/ids", headers=liam).json() != ids_before
    assert client.post("/api/favorites/99999", headers=guest).status_code == 404


def test_deleted_listing_disappears_from_favorites(client, host, guest):
    listing_id = client.post("/api/listings", json=listing_payload(), headers=host).json()["id"]
    client.post(f"/api/favorites/{listing_id}", headers=guest)
    assert listing_id in client.get("/api/favorites/ids", headers=guest).json()
    client.delete(f"/api/listings/{listing_id}", headers=host)
    assert listing_id not in client.get("/api/favorites/ids", headers=guest).json()
