from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Jake"
    app_env: str = "development"
    database_url: str = "sqlite:///./jake.db"
    jwt_secret: str = "troque-este-segredo-em-producao"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    openai_api_key: str | None = None
    default_ai_mode: str = "balanced"
    economy_model: str = "gpt-4.1-mini"
    balanced_model: str = "gpt-4.1-mini"
    max_model: str = "gpt-4.1"
    whatsapp_enabled: bool = True
    vision_enabled: bool = True
    voice_enabled: bool = True
    screen_control_enabled: bool = True
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    app_base_url: str = "http://127.0.0.1:3000"
    require_verified_email: bool = False
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Jake IA"
    smtp_use_tls: bool = True

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
