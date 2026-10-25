import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / "backend" / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_prefix="DROWSINESS_",
    )

    app_name: str = "AI-Powered Real-Time Trip Safety Management System"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    debug: bool = False

    db_host: str = "localhost"
    db_name: str = "drowsiness_safety_phase1"
    db_user: str = "postgres"
    db_password: str = ""
    db_port: int = 5432
    database_dsn: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DROWSINESS_DATABASE_URL", "DATABASE_URL"),
    )

    cors_origins_value: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias=AliasChoices("DROWSINESS_CORS_ORIGINS", "CORS_ORIGINS"),
    )
    log_level: str = "INFO"
    log_file: str | None = None
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    demo_auth_enabled: bool = False
    schema_path: Path = Field(
        default=BASE_DIR / "database" / "drowsiness_safety_db_schema.sql",
    )

    @field_validator("schema_path", mode="before")
    @classmethod
    def _normalize_schema_path(cls, value: Any) -> Path:
        if value in (None, ""):
            return BASE_DIR / "database" / "drowsiness_safety_db_schema.sql"
        return Path(value)

    @property
    def database_url(self) -> str:
        if self.database_dsn:
            return self._normalize_database_scheme(self.database_dsn)

        url = URL.create(
            "postgresql+psycopg2",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )
        return url.render_as_string(hide_password=False)

    @property
    def cors_origins(self) -> list[str]:
        raw_value = self.cors_origins_value.strip()
        if raw_value.startswith("["):
            try:
                parsed = json.loads(raw_value)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return [str(origin).strip() for origin in parsed if str(origin).strip()]

        return [
            origin.strip()
            for origin in raw_value.split(",")
            if origin.strip()
        ]

    @property
    def psycopg_dsn(self) -> str | None:
        if not self.database_dsn:
            return None
        return self._normalize_database_scheme(self.database_dsn).replace(
            "postgresql+psycopg2://",
            "postgresql://",
            1,
        )

    @staticmethod
    def _normalize_database_scheme(value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
