import threading
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models import Booking, BookingStatus
from app.models.base import utcnow
from tests.conftest import (
    VILLA,
    VILLA_CLEANING,
    VILLA_NIGHTLY,
    VILLA_SERVICE,
    booking_payload,
    day,
)


def create(client, headers, **kwargs):
    return client.post("/api/bookings", json=booking_payload(**kwargs), headers=headers)


def create_and_pay(client, headers, **kwargs):
    booking = create(client, headers, **kwargs)
    assert booking.status_code == 201, booking.text
    paid = client.post(f"/api/bookings/{booking.json()['id']}/pay", headers=headers)
    assert paid.status_code == 200, paid.text
    return paid.json()


def availability(client, listing_id=VILLA):
    return client.get(f"/api/listings/{listing_id}/availability").json()


# ---------------------------------------------------------------- pricing & quotes


def test_price_calculation_is_server_authoritative(client, guest):
    response = create(
        client, guest, check_in=100, check_out=104,
        total=1, subtotal=1, nights=99, discount=9999, cleaning_fee=0,  # all ignored
    )  # fmt: skip
    assert response.status_code == 201
    booking = response.json()
    assert booking["nights"] == 4
    assert booking["subtotal"] == VILLA_NIGHTLY * 4 == 78_000
    assert booking["discount"] == 0
    assert booking["currency"] == "INR"  # no currency requested: the listing's own
    assert booking["total"] == 78_000 + VILLA_CLEANING + VILLA_SERVICE == 84_000
    assert booking["status"] == "PENDING" and booking["payment"]["status"] == "PENDING"
    assert booking["payment"]["amount"] == booking["total"]
    assert booking["reference"].startswith("AC-")


def test_quote_matches_created_booking(client, guest):
    quote = client.get(
        f"/api/listings/{VILLA}/quote",
        params={
            "check_in": day(100),
            "check_out": day(103),
            "guests": 2,
            "coupon_code": "welcome10",
        },
        headers=guest,
    ).json()
    assert quote["bookable"] is True
    pricing = quote["pricing"]
    assert pricing["currency"] == "INR"
    assert pricing["subtotal"] == 58_500 and pricing["discount"] == 5_850  # 10% (under the ₹12,600 cap)
    assert pricing["total"] == 58_500 + VILLA_CLEANING + VILLA_SERVICE - 5_850

    booking = create(client, guest, check_in=100, check_out=103, coupon_code="WELCOME10").json()
    assert booking["total"] == pricing["total"] and booking["coupon_code"] == "WELCOME10"


def test_quote_reports_problems_without_failing(client, guest):
    params = {"check_in": day(100), "check_out": day(104), "guests": 20}
    quote = client.get(f"/api/listings/{VILLA}/quote", params=params, headers=guest).json()
    assert quote["bookable"] is False and "capacity" in quote["message"]

    params = {"check_in": day(104), "check_out": day(100), "guests": 2}
    quote = client.get(f"/api/listings/{VILLA}/quote", params=params, headers=guest).json()
    assert quote["bookable"] is False and quote["code"] == "invalid_dates"


# -------------------------------------------------------- critical booking matrix


def test_case_a_overlapping_dates_rejected(client, guest, api):
    create_and_pay(client, api.as_user("liam@example.com"), check_in=100, check_out=105)
    overlap = create(client, guest, check_in=103, check_out=107)
    assert overlap.status_code == 409
    assert overlap.json()["detail"] == "Selected dates are no longer available."
    assert create(client, guest, check_in=98, check_out=101).status_code == 409  # overlaps start
    assert create(client, guest, check_in=101, check_out=103).status_code == 409  # inside
    assert create(client, guest, check_in=99, check_out=106).status_code == 409  # engulfs


def test_case_b_back_to_back_booking_allowed(client, guest, api):
    create_and_pay(client, api.as_user("liam@example.com"), check_in=100, check_out=105)
    assert create(client, guest, check_in=105, check_out=108).status_code == 201  # starts at check-out
    assert create(client, guest, check_in=96, check_out=100).status_code == 201  # ends at check-in


def test_case_c_guest_capacity_rejected(client, guest):
    response = create(client, guest, guests=10)  # villa sleeps 8
    assert response.status_code == 400
    assert response.json()["detail"] == "Guest count exceeds property capacity (max 8)."


def test_case_d_invalid_date_ranges(client, guest):
    reversed_dates = create(client, guest, check_in=110, check_out=105)
    assert reversed_dates.status_code == 400
    assert reversed_dates.json()["detail"] == "Check-out must be after check-in."
    assert create(client, guest, check_in=110, check_out=110).status_code == 400
    assert create(client, guest, check_in=-3, check_out=2).status_code == 400  # past
    assert create(client, guest, check_in=100, check_out=200).status_code == 400  # too long


def test_case_e_concurrent_bookings_only_one_wins(client, api):
    users = [api.as_user(e) for e in ("liam@example.com", "emma@example.com", "noah@example.com",
                                      "ava@example.com", "lucas@example.com", "zoe@example.com")]  # fmt: skip
    statuses, barrier = [], threading.Barrier(len(users))

    def attempt(headers):
        with TestClient(app) as local:
            barrier.wait()
            statuses.append(
                local.post(
                    "/api/bookings",
                    json=booking_payload(check_in=120, check_out=124),
                    headers=headers,
                ).status_code
            )

    threads = [threading.Thread(target=attempt, args=(h,)) for h in users]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(statuses) == [201] + [409] * (len(users) - 1), statuses
    with SessionLocal() as db:
        held = (
            db.query(Booking)
            .filter(Booking.listing_id == VILLA, Booking.check_in == date.fromisoformat(day(120)))
            .count()
        )
    assert held == 1


def test_case_f_successful_booking_blocks_dates(client, guest, api):
    assert day(100) not in availability(client)["unavailable_dates"]
    booking = create_and_pay(client, guest, check_in=100, check_out=103)
    assert booking["status"] == "CONFIRMED" and booking["payment"]["status"] == "SUCCESS"

    blocked = availability(client)
    assert {"check_in": day(100), "check_out": day(103)} in blocked["unavailable_ranges"]
    assert blocked["unavailable_dates"].count(day(100)) == 1
    assert day(101) in blocked["unavailable_dates"] and day(102) in blocked["unavailable_dates"]
    assert day(103) not in blocked["unavailable_dates"]  # check-out day stays free

    appears = client.get("/api/bookings", headers=guest).json()
    assert booking["id"] in [b["id"] for b in appears]


def test_case_g_cancellation_releases_dates(client, guest, api):
    booking = create_and_pay(client, guest, check_in=100, check_out=103)
    cancelled = client.post(f"/api/bookings/{booking['id']}/cancel", headers=guest)
    assert cancelled.status_code == 200
    body = cancelled.json()
    assert body["status"] == "CANCELLED" and body["payment"]["status"] == "REFUNDED"
    assert day(100) not in availability(client)["unavailable_dates"]
    # and someone else can now book those dates
    assert create(client, api.as_user("liam@example.com"), check_in=100, check_out=103).status_code == 201
    # cancelling again is harmless
    assert client.post(f"/api/bookings/{booking['id']}/cancel", headers=guest).status_code == 200


# ---------------------------------------------------------------- other rules


def test_pending_hold_blocks_then_expires(client, guest, api):
    booking = create(client, guest, check_in=100, check_out=103).json()
    assert create(client, api.as_user("liam@example.com"), check_in=100, check_out=103).status_code == 409

    with SessionLocal() as db:  # simulate the 15-minute payment window lapsing
        row = db.get(Booking, booking["id"])
        row.hold_expires_at = utcnow() - timedelta(minutes=1)
        db.commit()

    assert day(100) not in availability(client)["unavailable_dates"]
    assert create(client, api.as_user("liam@example.com"), check_in=100, check_out=103).status_code == 201
    late = client.post(f"/api/bookings/{booking['id']}/pay", headers=guest)
    assert late.status_code == 409 and late.json()["code"] == "booking_not_payable"
    refreshed = client.get(f"/api/bookings/{booking['id']}", headers=guest).json()
    assert refreshed["status"] == "CANCELLED" and refreshed["payment"]["status"] == "FAILED"


def test_declined_payment_keeps_booking_pending_and_retryable(client, guest):
    booking = create(client, guest, check_in=100, check_out=103).json()
    declined = client.post(
        f"/api/bookings/{booking['id']}/pay",
        json={"payment_method": "card_declined"},
        headers=guest,
    )
    assert declined.status_code == 402 and declined.json()["code"] == "payment_failed"
    state = client.get(f"/api/bookings/{booking['id']}", headers=guest).json()
    assert state["status"] == "PENDING" and state["payment"]["status"] == "FAILED"
    assert day(100) in availability(client)["unavailable_dates"]  # still held

    retry = client.post(
        f"/api/bookings/{booking['id']}/pay", json={"payment_method": "card_4242"}, headers=guest
    )
    assert retry.json()["status"] == "CONFIRMED" and retry.json()["payment"]["status"] == "SUCCESS"


def test_paying_twice_is_idempotent(client, guest):
    booking = create_and_pay(client, guest, check_in=100, check_out=103)
    again = client.post(f"/api/bookings/{booking['id']}/pay", headers=guest)
    assert again.status_code == 200 and again.json()["status"] == "CONFIRMED"


def test_user_cannot_touch_someone_elses_booking(client, guest, api):
    booking = create(client, guest, check_in=100, check_out=103).json()
    liam = api.as_user("liam@example.com")
    assert client.post(f"/api/bookings/{booking['id']}/pay", headers=liam).status_code == 403
    assert client.post(f"/api/bookings/{booking['id']}/cancel", headers=liam).status_code == 403
    assert client.get(f"/api/bookings/{booking['id']}", headers=liam).status_code == 403
    assert client.get("/api/bookings/99999", headers=guest).status_code == 404


def test_cannot_book_own_listing(client, host):
    response = create(client, host, check_in=100, check_out=103)
    assert response.status_code == 403 and response.json()["code"] == "own_listing"


def test_cannot_book_missing_or_paused_listing(client, host, guest):
    assert create(client, guest, listing_id=99999).status_code == 404
    listing = client.get("/api/listings/1").json()
    body = {k: listing[k] for k in (
        "title", "description", "location", "city", "country", "property_type", "category",
        "guests_capacity", "bedrooms", "beds", "bathrooms", "nightly_price", "cleaning_fee", "service_fee",
    )}  # fmt: skip
    body.update(amenities=listing["amenities"], images=listing["images"], status="PAUSED")
    assert client.put("/api/listings/1", json=body, headers=host).status_code == 200
    assert create(client, guest, check_in=100, check_out=103).status_code == 404
    assert 1 not in [i["id"] for i in client.get("/api/listings?page_size=48").json()["items"]]


def test_cannot_cancel_started_stay(client, guest):
    booking = create_and_pay(client, guest, check_in=100, check_out=103)
    with SessionLocal() as db:
        row = db.get(Booking, booking["id"])
        row.check_in = utcnow().date() - timedelta(days=1)
        row.check_out = utcnow().date() + timedelta(days=2)
        db.commit()
    response = client.post(f"/api/bookings/{booking['id']}/cancel", headers=guest)
    assert response.status_code == 409 and response.json()["code"] == "not_cancellable"


def test_finished_stays_become_completed(client, guest):
    booking = create_and_pay(client, guest, check_in=100, check_out=103)
    with SessionLocal() as db:
        row = db.get(Booking, booking["id"])
        row.check_in, row.check_out = (
            utcnow().date() - timedelta(days=5),
            utcnow().date() - timedelta(days=2),
        )
        db.commit()
    listed = client.get("/api/bookings", headers=guest).json()
    assert next(b for b in listed if b["id"] == booking["id"])["status"] == BookingStatus.COMPLETED


# ----------------------------------------------------------------------- coupons


def test_coupon_validation_messages(client, guest):
    def validate(code, **extra):
        body = {
            "code": code,
            "listing_id": VILLA,
            "check_in": day(100),
            "check_out": day(104),
            **extra,
        }
        return client.post("/api/coupons/validate", json=body, headers=guest).json()

    ok = validate("WELCOME10")
    assert ok["valid"] and ok["discount"] == 7_800 and ok["currency"] == "INR"
    assert ok["pricing"]["total"] == 78_000 + 6_000 - 7_800

    assert not validate("NOPE")["valid"] and "isn't valid" in validate("NOPE")["message"]
    assert "expired" in validate("EXPIRED2020")["message"]
    assert "no longer active" in validate("paused15")["message"]
    assert "usage limit" in validate("FIRSTSTAY")["message"]
    assert "at least ₹2,10,000" in validate("FLAT500")["message"]  # US$2,500 in rupees, Indian grouping
    assert validate("flat50")["discount"] == 4_200  # codes are case-insensitive; US$50 = ₹4,200


def test_coupon_discount_is_capped(client, guest):
    long_stay = {"code": "SUMMER20", "listing_id": 10, "check_in": day(100), "check_out": day(110)}
    result = client.post("/api/coupons/validate", json=long_stay, headers=guest).json()
    # listing 10 is priced in AED: 20% of AED 28,800 would be 5,760, capped at US$300 = AED 1,102
    assert result["valid"] and result["currency"] == "AED" and result["discount"] == 1_102

    flat = {"code": "FLAT500", "listing_id": 10, "check_in": day(100), "check_out": day(104)}
    assert client.post("/api/coupons/validate", json=flat, headers=guest).json()["discount"] == 1_836  # US$500


def test_invalid_coupon_rejected_on_booking(client, guest):
    response = create(client, guest, check_in=100, check_out=103, coupon_code="EXPIRED2020")
    assert response.status_code == 400 and response.json()["code"] == "invalid_coupon"
    # nothing was held
    assert day(100) not in availability(client)["unavailable_dates"]


def test_coupon_usage_limit_and_release(client, guest, api):
    from app.models import Coupon

    with SessionLocal() as db:
        coupon = db.query(Coupon).filter_by(code="WELCOME10").one()
        coupon.usage_limit, coupon.usage_count = 1, 0
        db.commit()

    first = create(client, guest, check_in=100, check_out=103, coupon_code="WELCOME10")
    assert first.status_code == 201
    second = create(
        client,
        api.as_user("liam@example.com"),
        check_in=110,
        check_out=113,
        coupon_code="WELCOME10",
    )
    assert second.status_code == 400 and "usage limit" in second.json()["detail"]

    client.post(f"/api/bookings/{first.json()['id']}/cancel", headers=guest)  # releases the use
    third = create(
        client,
        api.as_user("liam@example.com"),
        check_in=110,
        check_out=113,
        coupon_code="WELCOME10",
    )
    assert third.status_code == 201


def test_apply_and_remove_coupon_on_pending_booking(client, guest):
    booking = create(client, guest, check_in=100, check_out=104).json()
    applied = client.put(
        f"/api/bookings/{booking['id']}/coupon", json={"code": "welcome10"}, headers=guest
    ).json()
    assert applied["discount"] == 7_800 and applied["total"] == 84_000 - 7_800
    assert applied["payment"]["amount"] == applied["total"]

    removed = client.put(f"/api/bookings/{booking['id']}/coupon", json={"code": None}, headers=guest).json()
    assert removed["discount"] == 0 and removed["total"] == 84_000 and removed["coupon_code"] is None

    bad = client.put(f"/api/bookings/{booking['id']}/coupon", json={"code": "NOPE"}, headers=guest)
    assert bad.status_code == 400

    client.post(f"/api/bookings/{booking['id']}/pay", headers=guest)
    late = client.put(f"/api/bookings/{booking['id']}/coupon", json={"code": "WELCOME10"}, headers=guest)
    assert late.status_code == 409


# ---------------------------------------------------------------------- reviews


def test_reviews_listing_and_eligibility(client, api):
    listing = client.get("/api/listings/2").json()  # Alex already reviewed his Palolem stay
    reviews = client.get("/api/listings/2/reviews").json()
    assert reviews["total"] == listing["review_count"] and reviews["items"]
    assert reviews["can_review"] is False

    alex = api.as_user("guest@example.com")
    # Tokyo studio (listing 14): Alex has a finished, unreviewed stay
    can = client.get("/api/listings/14/reviews", headers=alex).json()
    assert can["can_review"] is True
    posted = client.post(
        "/api/listings/14/reviews",
        json={"rating": 5, "comment": "Lovely minimalist studio."},
        headers=alex,
    )
    assert posted.status_code == 201
    after = client.get("/api/listings/14/reviews", headers=alex).json()
    assert after["can_review"] is False and after["total"] == can["total"] + 1
    assert client.get("/api/listings/14").json()["review_count"] == after["total"]
    again = client.post(
        "/api/listings/14/reviews",
        json={"rating": 4, "comment": "Trying to review twice."},
        headers=alex,
    )
    assert again.status_code == 403


def test_review_requires_completed_stay(client, guest):
    response = client.post(
        "/api/listings/3/reviews",
        json={"rating": 5, "comment": "I never stayed here."},
        headers=guest,
    )
    assert response.status_code == 403
