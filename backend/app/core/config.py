from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./airbnb_clone.db"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_origin_regex: str = ""
    secret_key: str = "dev-only-secret-change-me"
    auto_seed: bool = True

    # Business rules
    currency: str = "USD"
    max_nights: int = 30
    pending_hold_minutes: int = 15
    session_ttl_days: int = 30
    default_guest_email: str = "guest@example.com"
    default_host_email: str = "host@example.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
