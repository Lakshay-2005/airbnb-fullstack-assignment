from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

BEGIN_MODE_OPTION = "sqlite_begin_mode"


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    connect_args = {"check_same_thread": False, "timeout": 15} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args)

    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _on_connect(dbapi_conn, _record):
            # Take manual control of transactions (pysqlite's implicit BEGIN is unreliable),
            # enforce foreign keys and use WAL so readers never block the writer.
            dbapi_conn.isolation_level = None
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=15000")
            cur.close()

        @event.listens_for(engine, "begin")
        def _on_begin(conn):
            mode = conn.get_execution_options().get(BEGIN_MODE_OPTION, "DEFERRED")
            conn.exec_driver_sql(f"BEGIN {mode}")

    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def write_session(bind) -> Session:
    """Session whose transaction starts with BEGIN IMMEDIATE.

    SQLite then grants this transaction the (single) write lock up front, so
    "check availability, then insert booking" can never interleave with another
    writer doing the same thing. Concurrent bookings are serialised by the DB.
    """
    session = Session(bind=bind, autoflush=False, expire_on_commit=False)
    session.connection(execution_options={BEGIN_MODE_OPTION: "IMMEDIATE"})
    return session


def init_db() -> None:
    from app import models  # noqa: F401  (register tables)

    Base.metadata.create_all(engine)
