from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized runtime configuration — loads from environment + .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Core
    app_env: Literal["development", "staging", "production"] = "development"
    app_name: str = "CivilCode Studio"
    app_log_level: str = "INFO"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Auth
    api_secret_key: str = Field(
        default="change-me-use-openssl-rand-hex-32",
        description="Secret for signing JWT access tokens",
    )
    api_jwt_algorithm: str = "HS256"
    api_jwt_access_ttl_minutes: int = 15
    api_jwt_refresh_ttl_days: int = 30

    # Database
    database_url: str = "postgresql+asyncpg://civilcode:civilcode@localhost:5432/civilcode"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    @property
    def cookie_secure(self) -> bool:
        """Secure flag on cookies — true in prod/staging, false in local dev."""
        return self.app_env != "development"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
