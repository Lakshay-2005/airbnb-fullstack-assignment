from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel

from app.core import currency as cur

router = APIRouter(prefix="/currencies", tags=["currencies"])


class CurrencyOut(BaseModel):
    code: str
    name: str
    symbol: str
    #: Units of this currency per 1 US dollar (illustrative demo rate), as an exact decimal string.
    rate_per_usd: str
    minor_units: int


class CurrencyTable(BaseModel):
    base: str
    default: str
    note: str
    currencies: list[CurrencyOut]
    #: Country (lower-case) -> the currency its listings are priced in.
    country_currency: dict[str, str]


def _rate(value: Decimal) -> str:
    return format(value.normalize(), "f")


@router.get("", response_model=CurrencyTable)
def list_currencies():
    """The supported currencies and the demo exchange rates: the single source the UI reads."""
    return CurrencyTable(
        base=cur.BASE_CURRENCY,
        default=cur.DEFAULT_DISPLAY_CURRENCY,
        note=cur.RATES_NOTE,
        currencies=[
            CurrencyOut(
                code=c.code,
                name=c.name,
                symbol=c.symbol,
                rate_per_usd=_rate(c.rate),
                minor_units=c.minor_units,
            )
            for c in cur.CURRENCIES.values()
        ],
        country_currency=cur.COUNTRY_CURRENCY,
    )
