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
    google_api_key: str = ""
    tavily_api_key: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_price_amount: int = 49900       # paise; 49900 = ₹499
    razorpay_tribunal_amount: int = 19900    # paise; 19900 = ₹199
    resend_api_key: str = ""
    frontend_origin: str = "http://localhost:5173"
    admin_secret: str = ""  # Legacy — retained for back-compat; admin actions now use admin_emails
    admin_emails: str = ""  # Comma-separated allowlist of admin Clerk emails (or user IDs). Set in Railway env.

    @property
    def admin_identifiers(self) -> set[str]:
        """Lowercased set of admin emails / Clerk user IDs from ADMIN_EMAILS."""
        return {p.strip().lower() for p in self.admin_emails.split(",") if p.strip()}

    @property
    def is_stub(self) -> bool:
        has_key = bool(self.anthropic_api_key or self.groq_api_key or self.google_api_key)
        return self.stub_mode.lower() == "true" or not has_key

    model_config = {"env_file": ".env", "extra": "ignore"}


_s = Settings()
_s.groq_api_key = _s.groq_api_key.strip()
_s.anthropic_api_key = _s.anthropic_api_key.strip()
_s.google_api_key = _s.google_api_key.strip()
_s.tavily_api_key = _s.tavily_api_key.strip()
settings = _s
