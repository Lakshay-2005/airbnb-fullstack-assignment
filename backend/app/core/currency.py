"""Currencies, demonstration exchange rates and money helpers (the one place that knows about them).

* Money is stored as **whole units of its currency** (integers: rupees, yen, euros...). Nothing
  price-related ever touches binary floating point; conversions use `Decimal`.
* Rates are expressed against one canonical base, **USD** ("units of currency per 1 USD"). They are
  *illustrative demo rates, not live financial rates*; nothing here calls an exchange-rate API and the
  mock checkout never charges real money.
* Conversion rule (used for every amount shown or stored): `amount * rate[to] / rate[from]`, rounded
  half-up to a whole unit. Component amounts (nightly rate, cleaning fee, service fee) are converted
  one by one and totals are then summed, so a breakdown always adds up exactly.
* Coupon thresholds and caps (`minimum_amount`, `maximum_discount`, flat `value`) are defined in the
  canonical currency (USD) and converted with the same rule when a stay is priced in another currency.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from app.core.errors import bad_request

BASE_CURRENCY = "USD"
#: What the app shows when the client does not choose a display currency.
DEFAULT_DISPLAY_CURRENCY = "INR"

RATES_NOTE = (
    "Illustrative demonstration exchange rates (units per 1 US dollar), not live financial rates. "
    "The mock checkout never charges real money."
)


@dataclass(frozen=True)
class Currency:
    code: str
    name: str
    symbol: str
    rate: Decimal  # units of this currency per 1 USD
    #: ISO 4217 minor-unit exponent. JPY and KRW have none; the rest nominally have 2, but this app
    #: only stores and shows whole units, so formatting never prints a fractional part.
    minor_units: int


def _c(code: str, name: str, symbol: str, rate: str, minor_units: int = 2) -> Currency:
    return Currency(code, name, symbol, Decimal(rate), minor_units)


#: Ordered for display. INR first because it is the default.
CURRENCIES: dict[str, Currency] = {
    c.code: c
    for c in (
        _c("INR", "Indian Rupee", "₹", "84"),
        _c("USD", "US Dollar", "$", "1"),
        _c("EUR", "Euro", "€", "0.92"),
        _c("GBP", "British Pound", "£", "0.79"),
        _c("AED", "UAE Dirham", "AED", "3.6725"),
        _c("CAD", "Canadian Dollar", "CA$", "1.36"),
        _c("AUD", "Australian Dollar", "A$", "1.52"),
        _c("SGD", "Singapore Dollar", "S$", "1.34"),
        _c("JPY", "Japanese Yen", "¥", "150", 0),
        _c("THB", "Thai Baht", "฿", "35"),
        _c("IDR", "Indonesian Rupiah", "Rp", "15800"),
        _c("CHF", "Swiss Franc", "CHF", "0.88"),
        _c("NZD", "New Zealand Dollar", "NZ$", "1.65"),
        _c("KRW", "South Korean Won", "₩", "1350", 0),
        _c("MYR", "Malaysian Ringgit", "RM", "4.5"),
    )
}

_EURO_ZONE = (
    "austria belgium croatia cyprus estonia finland france germany greece ireland italy latvia "
    "lithuania luxembourg malta netherlands portugal slovakia slovenia spain"
).split()

#: Country (lower-case, as stored on a listing) -> the currency its listings are priced in.
COUNTRY_CURRENCY: dict[str, str] = {
    "india": "INR",
    "united states": "USD",
    "usa": "USD",
    "united kingdom": "GBP",
    "uk": "GBP",
    "united arab emirates": "AED",
    "uae": "AED",
    "canada": "CAD",
    "australia": "AUD",
    "singapore": "SGD",
    "japan": "JPY",
    "thailand": "THB",
    "indonesia": "IDR",
    "switzerland": "CHF",
    "new zealand": "NZD",
    "south korea": "KRW",
    "korea": "KRW",
    "malaysia": "MYR",
    **{country: "EUR" for country in _EURO_ZONE},
}


def currency_for_country(country: str | None) -> str:
    """Native pricing currency for a listing's (structured) country; unknown countries price in USD."""
    return COUNTRY_CURRENCY.get((country or "").strip().lower(), BASE_CURRENCY)


def is_supported(code: str | None) -> bool:
    return bool(code) and code.upper() in CURRENCIES


def normalize_currency(code: str | None, default: str | None = None) -> str:
    """Validate a client-supplied currency code (case-insensitive). Raises 400 for unknown codes."""
    if code is None or not code.strip():
        if default is None:
            raise bad_request("A currency code is required.", "unsupported_currency")
        return default
    upper = code.strip().upper()
    if upper not in CURRENCIES:
        raise bad_request(
            f"Unsupported currency '{code}'. Supported: {', '.join(CURRENCIES)}.", "unsupported_currency"
        )
    return upper


def convert(amount: int, source: str, target: str) -> int:
    """Convert a whole-unit amount between currencies (half-up rounding, no floats)."""
    if source == target:
        return amount
    value = Decimal(amount) * CURRENCIES[target].rate / CURRENCIES[source].rate
    return int(value.quantize(Decimal(1), ROUND_HALF_UP))


def to_base(amount: int, source: str) -> Decimal:
    """Exact value in the canonical currency (USD), for comparisons and limits."""
    return Decimal(amount) / CURRENCIES[source].rate


def rate_factor(source: str, target: str) -> float:
    """`rate[target] / rate[source]`: only used to build SQL price expressions (filters, sorting)."""
    return float(CURRENCIES[target].rate / CURRENCIES[source].rate)


def _group_indian(digits: str) -> str:
    if len(digits) <= 3:
        return digits
    head, tail = digits[:-3], digits[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts + [tail])


def format_money(amount: int, code: str) -> str:
    """Human-readable amount for messages and receipts, e.g. ₹2,10,000, $1,200, ¥16,500, CHF 340."""
    currency = CURRENCIES[code]
    digits = str(abs(int(amount)))
    grouped = _group_indian(digits) if code == "INR" else f"{int(digits):,}"
    sign = "-" if amount < 0 else ""
    separator = " " if currency.symbol.isalpha() else ""
    return f"{sign}{currency.symbol}{separator}{grouped}"


def listing_amount_error(amount: int, code: str, *, minimum_usd: int, maximum_usd: int) -> str | None:
    """Sanity bounds for host-entered prices, expressed in USD so they mean the same in every currency."""
    value = to_base(amount, code)
    if value < minimum_usd:
        return f"Amount is too low (at least about {format_money(convert(minimum_usd, 'USD', code), code)})."
    if value > maximum_usd:
        return f"Amount is too high (at most about {format_money(convert(maximum_usd, 'USD', code), code)})."
    return None
