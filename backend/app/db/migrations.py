"""Tiny, idempotent schema upgrades for SQLite databases created before a column existed.

`Base.metadata.create_all` creates missing *tables* but never alters existing ones, so columns added
later are applied here with `ALTER TABLE ... ADD COLUMN` (no data is touched or removed).

Rows that predate currency support keep `USD`: that is the unit their amounts were stored in, so
booking history stays exactly as it was. (A demo database seeded before currency support therefore keeps
its dollar prices; `python seed.py --reset` rebuilds it with the local-currency catalogue.)
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

#: (table, column, DDL type/default)
ADDED_COLUMNS = [
    ("listings", "currency", "VARCHAR(3) NOT NULL DEFAULT 'USD'"),
    ("bookings", "currency", "VARCHAR(3) NOT NULL DEFAULT 'USD'"),
]


def run_migrations(engine: Engine) -> list[str]:
    """Add any missing columns; returns the list applied (empty when the schema is current)."""
    applied: list[str] = []
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl in ADDED_COLUMNS:
            if table not in tables:
                continue
            existing = {c["name"] for c in inspect(conn).get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
                applied.append(f"{table}.{column}")
    return applied
