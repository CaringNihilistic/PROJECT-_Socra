from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    stub_mode: str = "true"
    database_url: str = "postgresql://socra:socra_dev@localhost:5432/socra_db"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "dev_secret_key_change_in_prod"
    clerk_secret_key: str = ""
    clerk_frontend_api_url: str = ""  # e.g. https://xxxx.clerk.accounts.dev
    groq_api_key: str = ""

    @property
    def is_stub(self) -> bool:
        has_key = bool(self.anthropic_api_key or self.groq_api_key)
        return self.stub_mode.lower() == "true" or not has_key

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
