"""Currencies: native pricing, demo rates, conversion/rounding, filters and sorting, coupons across
currencies, booking snapshots, host earnings and database compatibility."""

import pytest
from sqlalchemy import text

from app.core import currency as cur
from app.db.database import engine
from app.db.migrations import run_migrations
from tests.conftest import (
    VILLA,
    VILLA_CLEANING,
    VILLA_NIGHTLY,
    VILLA_SERVICE,
    booking_payload,
    day,
    listing_payload,
)

REQUIRED = "INR USD EUR GBP AED CAD AUD SGD JPY THB IDR CHF NZD KRW MYR".split()


def all_cards(client, **params):
    query = "&".join(f"{k}={v}" for k, v in {"page_size": 48, **params}.items())
    return client.get(f"/api/listings?{query}").json()["items"]


# ------------------------------------------------------------------ table and helpers


def test_supported_currencies_and_rate_table(client):
    table = client.get("/api/currencies").json()
    assert [c["code"] for c in table["currencies"]] == REQUIRED
    assert table["base"] == "USD" and table["default"] == "INR"
    assert "demonstration" in table["note"].lower() and "not live" in table["note"].lower()
    by_code = {c["code"]: c for c in table["currencies"]}
    assert by_code["USD"]["rate_per_usd"] == "1" and by_code["INR"]["rate_per_usd"] == "84"
    assert by_code["JPY"]["minor_units"] == 0 and by_code["KRW"]["minor_units"] == 0
    assert table["country_currency"]["india"] == "INR"


@pytest.mark.parametrize(
    ("amount", "code", "expected"),
    [
        (210_000, "INR", "₹2,10,000"),  # Indian digit grouping
        (1_234, "INR", "₹1,234"),
        (1_200, "USD", "$1,200"),
        (150, "EUR", "€150"),
        (165, "GBP", "£165"),
        (1_180, "AED", "AED 1,180"),
        (99, "CAD", "CA$99"),
        (99, "AUD", "A$99"),
        (99, "SGD", "S$99"),
        (16_500, "JPY", "¥16,500"),
        (3_500, "THB", "฿3,500"),
        (3_300_000, "IDR", "Rp 3,300,000"),
        (340, "CHF", "CHF 340"),
        (120, "NZD", "NZ$120"),
        (135_000, "KRW", "₩135,000"),
        (450, "MYR", "RM 450"),
    ],
)
def test_money_formatting_for_every_supported_currency(amount, code, expected):
    assert cur.format_money(amount, code) == expected


def test_every_required_currency_is_formattable_and_convertible():
    assert list(cur.CURRENCIES) == REQUIRED
    for code in REQUIRED:
        assert cur.convert(1000, code, code) == 1000
        assert cur.format_money(1000, code)
        assert cur.convert(cur.convert(1000, "USD", code), code, "USD") in range(990, 1011)


def test_conversion_and_rounding_rules():
    assert cur.convert(150, "USD", "INR") == 12_600 and cur.convert(12_600, "INR", "USD") == 150
    assert cur.convert(1, "USD", "JPY") == 150 and cur.convert(2, "USD", "KRW") == 2_700
    # half-up: 42 rupees is exactly 0.5 USD at ₹84/$ and rounds up; 41 rounds down
    assert cur.convert(42, "INR", "USD") == 1 and cur.convert(41, "INR", "USD") == 0
    # converting through the base is consistent (no float drift): 100 EUR -> USD -> EUR
    assert cur.convert(cur.convert(100, "EUR", "USD"), "USD", "EUR") == 100
    assert isinstance(cur.convert(7, "GBP", "CHF"), int)


def test_country_to_currency_mapping_uses_the_structured_country():
    expected = {
        "India": "INR", "United States": "USD", "United Kingdom": "GBP", "France": "EUR", "Spain": "EUR",
        "Italy": "EUR", "Greece": "EUR", "Portugal": "EUR", "Germany": "EUR", "United Arab Emirates": "AED",
        "Canada": "CAD", "Australia": "AUD", "Singapore": "SGD", "Japan": "JPY", "Thailand": "THB",
        "Indonesia": "IDR", "Switzerland": "CHF", "New Zealand": "NZD", "South Korea": "KRW",
        "Malaysia": "MYR", "Maldives": "USD",  # not in the supported list: priced in USD
    }  # fmt: skip
    for country, code in expected.items():
        assert cur.currency_for_country(country) == code, country
    assert cur.currency_for_country("  india ") == "INR" and cur.currency_for_country(None) == "USD"
    with pytest.raises(Exception, match="Unsupported currency"):
        cur.normalize_currency("XYZ")


# ----------------------------------------------------------------- seeded catalogue


def test_indian_listings_are_priced_in_plausible_rupees(client):
    indian = [i for i in all_cards(client) if i["country"] == "India"]
    assert len(indian) >= 20
    for item in indian:
        assert item["native_currency"] == "INR" and item["currency"] == "INR"
        assert 3_000 <= item["nightly_price"] <= 20_000, (item["title"], item["nightly_price"])
    # a basic apartment costs less than the pool villa
    by_title = {i["title"]: i["nightly_price"] for i in indian}
    assert by_title["Rooftop terrace suite with Hawa Mahal views"] < by_title["Palm-fringed pool villa near Anjuna"]


def test_international_listings_use_their_local_currency(client):
    expected = {
        "United States": "USD", "United Kingdom": "GBP", "France": "EUR", "Spain": "EUR", "Italy": "EUR",
        "Greece": "EUR", "Portugal": "EUR", "United Arab Emirates": "AED", "Japan": "JPY",
        "Indonesia": "IDR", "Switzerland": "CHF", "Maldives": "USD",
    }  # fmt: skip
    seen = set()
    for item in all_cards(client, currency="USD"):
        assert item["native_currency"] == expected.get(item["country"], "INR"), item["title"]
        assert item["currency"] == "USD"  # converted for display
        seen.add(item["country"])
    assert set(expected) <= seen


def test_listing_detail_native_vs_display_currency(client):
    native = client.get("/api/listings/1").json()  # no currency: the listing's own (hosts edit this)
    assert (native["currency"], native["nightly_price"]) == ("INR", VILLA_NIGHTLY)
    assert (native["cleaning_fee"], native["service_fee"]) == (VILLA_CLEANING, VILLA_SERVICE)
    usd = client.get("/api/listings/1?currency=USD").json()
    assert usd["currency"] == "USD" and usd["native_currency"] == "INR"
    assert usd["nightly_price"] == cur.convert(VILLA_NIGHTLY, "INR", "USD") == 232
    assert client.get("/api/listings/1?currency=ZZZ").status_code == 400


# ---------------------------------------------------- currency-aware filters and sorting


def test_price_filter_uses_the_display_currency(client):
    for code in ("USD", "INR", "EUR", "JPY"):
        everything = all_cards(client, currency=code)
        limit = sorted(i["nightly_price"] for i in everything)[len(everything) // 3]
        filtered = all_cards(client, currency=code, max_price=limit)
        assert {i["id"] for i in filtered} == {i["id"] for i in everything if i["nightly_price"] <= limit}
        assert all(i["nightly_price"] <= limit and i["currency"] == code for i in filtered)
        ranged = all_cards(client, currency=code, min_price=limit, max_price=limit * 2)
        assert {i["id"] for i in ranged} == {i["id"] for i in everything if limit <= i["nightly_price"] <= limit * 2}


def test_same_price_text_means_different_listings_in_different_currencies(client):
    """150 US dollars and 150 rupees must not be confused: the filter follows the display currency."""
    usd = all_cards(client, currency="USD", max_price=150)
    inr = all_cards(client, currency="INR", max_price=150)
    assert len(usd) > 5 and inr == []  # nothing costs under ₹150 a night
    in_rupees = all_cards(client, currency="INR", max_price=12_600)  # US$150 expressed in rupees
    assert {i["id"] for i in in_rupees} == {i["id"] for i in usd}


def test_price_sort_follows_the_display_currency_across_mixed_native_currencies(client):
    for code in ("INR", "USD", "JPY"):
        asc = all_cards(client, currency=code, sort="price_asc")
        prices = [i["nightly_price"] for i in asc]
        assert prices == sorted(prices)
        assert len({i["native_currency"] for i in asc}) > 5  # genuinely mixed currencies
        desc = [i["nightly_price"] for i in all_cards(client, currency=code, sort="price_desc")]
        assert desc == sorted(desc, reverse=True)
    # the cheapest and dearest differ by currency family, but are the same listing in every currency
    by_code = {
        code: [i["id"] for i in all_cards(client, currency=code, sort="price_asc")][0] for code in ("INR", "USD")
    }
    assert by_code["INR"] == by_code["USD"]


def test_pagination_total_and_meta_follow_currency(client):
    page = client.get("/api/listings?currency=USD&max_price=150&page_size=5&page=2").json()
    total = client.get("/api/listings?currency=USD&max_price=150&page_size=48").json()["total"]
    assert page["total"] == total and page["page"] == 2 and len(page["items"]) == min(5, max(0, total - 5))
    inr, usd = client.get("/api/meta?currency=INR").json(), client.get("/api/meta?currency=USD").json()
    assert inr["currency"] == "INR" and usd["currency"] == "USD"
    assert inr["price_max"] > usd["price_max"] * 50  # same listing, rupees vs dollars


def test_stay_totals_on_cards_match_the_quote(client, guest):
    items = all_cards(client, currency="USD", check_in=day(300), check_out=day(303))
    card = next(i for i in items if i["id"] == VILLA)
    quote = client.get(
        f"/api/listings/{VILLA}/quote",
        params={"check_in": day(300), "check_out": day(303), "guests": 2, "currency": "USD"},
        headers=guest,
    ).json()["pricing"]
    assert card["stay"]["total"] == quote["total"] and quote["currency"] == "USD"


# ------------------------------------------------------------------------ coupons


def test_coupon_caps_and_thresholds_keep_their_dollar_meaning(client, guest):
    def validate(code, listing, currency, **extra):
        body = {"code": code, "listing_id": listing, "check_in": day(100), "check_out": day(110), "currency": currency}
        return client.post("/api/coupons/validate", json={**body, **extra}, headers=guest).json()

    # SUMMER20 = 20% off, capped at US$300, on a long stay in the AED listing 10 (AED 28,800 ≈ US$7,842)
    for code, expected_cap in (("USD", 300), ("INR", 25_200), ("JPY", 45_000), ("AED", 1_102), ("EUR", 276)):
        result = validate("SUMMER20", 10, code)
        assert result["valid"] and result["currency"] == code
        assert result["discount"] == expected_cap == cur.convert(300, "USD", code), code
        pricing = result["pricing"]
        assert pricing["currency"] == code
        assert pricing["total"] == pricing["subtotal"] + pricing["cleaning_fee"] + pricing["service_fee"] - expected_cap

    # FLAT500 needs a US$2,500 subtotal: the same stay in rupees must clear ₹2,10,000, not "₹2,500"
    short = validate("FLAT500", VILLA, "INR", check_out=day(104))  # 4 nights ≈ US$928
    assert not short["valid"] and "at least ₹2,10,000" in short["message"]
    short_usd = validate("FLAT500", VILLA, "USD", check_out=day(104))
    assert not short_usd["valid"] and "at least $2,500" in short_usd["message"]
    long_inr = validate("FLAT500", 10, "INR")
    assert long_inr["valid"] and long_inr["discount"] == 42_000  # a flat US$500, not 500 rupees


# ------------------------------------------------------------ booking snapshots


def book(client, headers, **kwargs):
    response = client.post("/api/bookings", json=booking_payload(**kwargs), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_booking_is_priced_and_stored_in_the_requested_currency(client, guest):
    quote = client.get(
        f"/api/listings/{VILLA}/quote",
        params={"check_in": day(100), "check_out": day(104), "guests": 2, "currency": "USD"},
        headers=guest,
    ).json()["pricing"]
    booking = book(client, guest, check_in=100, check_out=104, currency="usd")
    assert booking["currency"] == "USD"
    # nightly 19,500 -> $232; cleaning 3,500 -> $42; service 2,500 -> $30 (each converted, then summed)
    assert booking["subtotal"] == 232 * 4 == 928
    assert (booking["cleaning_fee"], booking["service_fee"]) == (42, 30)
    assert booking["total"] == 928 + 42 + 30 == 1_000
    assert booking["payment"]["amount"] == booking["total"]
    assert quote["total"] == booking["total"] and quote["currency"] == "USD"  # agree to the unit


def test_booking_currency_defaults_to_the_listing_and_rejects_unknown_codes(client, guest):
    assert book(client, guest, check_in=100, check_out=102)["currency"] == "INR"
    bad = client.post("/api/bookings", json=booking_payload(check_in=110, check_out=112, currency="XXX"), headers=guest)
    assert bad.status_code == 400 and bad.json()["code"] == "unsupported_currency"
    assert day(110) not in client.get(f"/api/listings/{VILLA}/availability").json()["unavailable_dates"]


def test_client_cannot_supply_amounts_or_rates(client, guest):
    cheat = booking_payload(check_in=100, check_out=102, currency="USD", total=1, subtotal=1, rate=1000, rates={"USD": 1})
    booking = client.post("/api/bookings", json=cheat, headers=guest).json()
    assert booking["total"] == 232 * 2 + 42 + 30


def test_snapshot_survives_later_display_changes_and_rate_changes(client, guest, monkeypatch):
    booking = book(client, guest, check_in=100, check_out=104, currency="EUR")
    assert booking["currency"] == "EUR"
    before = (booking["subtotal"], booking["total"])
    # the demo rate for euros changes later: history must not be rewritten, only new quotes differ
    monkeypatch.setitem(cur.CURRENCIES, "EUR", cur.Currency("EUR", "Euro", "€", cur.Decimal("1.5"), 2))
    again = client.get(f"/api/bookings/{booking['id']}", headers=guest).json()
    assert again["currency"] == "EUR" and (again["subtotal"], again["total"]) == before
    listed = next(b for b in client.get("/api/bookings", headers=guest).json() if b["id"] == booking["id"])
    assert listed["currency"] == "EUR" and listed["total"] == before[1]
    fresh = client.get(
        f"/api/listings/{VILLA}/quote",
        params={"check_in": day(200), "check_out": day(204), "guests": 2, "currency": "EUR"},
        headers=guest,
    ).json()["pricing"]
    assert fresh["total"] != before[1]


def test_coupon_on_a_booking_uses_that_bookings_currency(client, guest):
    booking = book(client, guest, check_in=100, check_out=104, currency="USD")
    applied = client.put(f"/api/bookings/{booking['id']}/coupon", json={"code": "WELCOME10"}, headers=guest).json()
    assert applied["currency"] == "USD" and applied["discount"] == 93  # 10% of $928, under the $150 cap
    assert applied["total"] == 1_000 - 93 and applied["payment"]["amount"] == applied["total"]


def test_receipt_amounts_agree_everywhere_a_booking_is_shown(client, guest, host):
    booking = book(client, guest, check_in=100, check_out=104, currency="USD", coupon_code="WELCOME10")
    paid = client.post(f"/api/bookings/{booking['id']}/pay", headers=guest).json()
    seen = [
        paid,
        client.get(f"/api/bookings/{booking['id']}", headers=guest).json(),
        next(b for b in client.get("/api/bookings", headers=guest).json() if b["id"] == booking["id"]),
        next(b for b in client.get("/api/host/bookings", headers=host).json() if b["id"] == booking["id"]),
    ]
    for item in seen:
        assert item["currency"] == "USD" and item["status"] == "CONFIRMED"
        assert item["total"] == item["subtotal"] + item["cleaning_fee"] + item["service_fee"] - item["discount"]
        assert item["payment"]["amount"] == item["total"] == booking["total"] == 1_000 - 93
        assert (item["subtotal"], item["discount"]) == (928, 93)


def test_cancellation_keeps_the_snapshot_and_releases_dates(client, guest):
    booking = book(client, guest, check_in=100, check_out=104, currency="GBP")
    cancelled = client.post(f"/api/bookings/{booking['id']}/cancel", headers=guest).json()
    assert cancelled["status"] == "CANCELLED" and cancelled["currency"] == "GBP"
    assert cancelled["total"] == booking["total"]
    assert day(100) not in client.get(f"/api/listings/{VILLA}/availability").json()["unavailable_dates"]


# --------------------------------------------------------------------- host side


def test_host_earnings_are_converted_to_the_requested_currency(client, guest, host):
    def earnings(code):
        return client.get(f"/api/host/summary?currency={code}", headers=host).json()

    before_inr, before_usd = earnings("INR"), earnings("USD")
    assert before_inr["currency"] == "INR" and before_usd["currency"] == "USD"
    booking = book(client, guest, check_in=100, check_out=104, currency="USD")
    client.post(f"/api/bookings/{booking['id']}/pay", headers=guest)
    assert earnings("USD")["earnings"] - before_usd["earnings"] == booking["total"] == 1_000
    assert earnings("INR")["earnings"] - before_inr["earnings"] == cur.convert(1_000, "USD", "INR")  # 84,000
    listing = next(i for i in client.get("/api/host/listings?currency=USD", headers=host).json() if i["id"] == VILLA)
    assert listing["currency"] == "USD" and listing["native_currency"] == "INR"


def test_listing_currency_follows_its_country_and_prices_are_sanity_checked(client, host):
    japan = client.post("/api/listings", json=listing_payload(country="Japan", nightly_price=18_000, cleaning_fee=3_000, service_fee=2_000), headers=host)
    assert japan.status_code == 201 and japan.json()["currency"] == "JPY"
    france = client.post("/api/listings", json=listing_payload(country="France"), headers=host).json()
    assert france["currency"] == "EUR" and france["nightly_price"] == 150
    # 10 yen is a fraction of a US cent: rejected in USD-equivalent terms, not as "10 units"
    cheap = client.post("/api/listings", json=listing_payload(country="Japan", nightly_price=10), headers=host)
    assert cheap.status_code == 400 and cheap.json()["code"] == "invalid_price"
    absurd = client.post("/api/listings", json=listing_payload(country="India", nightly_price=90_000_000), headers=host)
    assert absurd.status_code == 400
    # moving a listing to another country re-derives its currency
    moved = client.put(f"/api/listings/{france['id']}", json=listing_payload(country="Canada"), headers=host).json()
    assert moved["currency"] == "CAD"


# ------------------------------------------------------ database compatibility


def test_migration_adds_currency_columns_to_an_old_database_without_losing_data(client, guest):
    booking = book(client, guest, check_in=100, check_out=102)
    with engine.begin() as conn:  # emulate a database created before currency support
        conn.execute(text("ALTER TABLE listings DROP COLUMN currency"))
        conn.execute(text("ALTER TABLE bookings DROP COLUMN currency"))
    applied = run_migrations(engine)
    assert applied == ["listings.currency", "bookings.currency"]
    assert run_migrations(engine) == []  # idempotent
    with engine.connect() as conn:
        assert conn.execute(text("SELECT DISTINCT currency FROM listings")).scalars().all() == ["USD"]
        row = conn.execute(text("SELECT currency, total FROM bookings WHERE id = :i"), {"i": booking["id"]}).one()
    assert row.currency == "USD"  # the unit pre-currency amounts were stored in
    assert row.total == booking["total"]  # untouched
    # the app still works against the migrated database
    old = client.get(f"/api/bookings/{booking['id']}", headers=guest).json()
    assert old["currency"] == "USD" and old["total"] == booking["total"]
    assert client.get("/api/listings/1").json()["currency"] == "USD"


def test_seed_is_idempotent_including_prices_and_currencies(client):
    from app.seed import seed_database

    before = client.get("/api/listings?page_size=48").json()["items"]
    seed_database()  # non-reset run on a seeded database changes nothing
    after = client.get("/api/listings?page_size=48").json()["items"]
    assert [(i["id"], i["currency"], i["nightly_price"]) for i in after] == [
        (i["id"], i["currency"], i["nightly_price"]) for i in before
    ]
    assert len(after) == 48
