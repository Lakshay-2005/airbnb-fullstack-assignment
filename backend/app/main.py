from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.db.database import SessionLocal, init_db
from app.models import User
from app.routers import bookings, coupons, favorites, host, listings, messages, reviews, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if get_settings().auto_seed:
        with SessionLocal() as db:
            empty = db.scalar(select(func.count()).select_from(User)) == 0
        if empty:
            from app.seed import seed_database

            seed_database()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Airbnb Clone API",
        description="Stays marketplace API: listings, availability, bookings, host tools.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=False,  # auth is a bearer header, not cookies
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    api = APIRouter(prefix="/api")
    for module in (users, listings, bookings, favorites, coupons, reviews, host, messages):
        api.include_router(module.router)

    @api.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    app.include_router(api)
    return app


app = create_app()
