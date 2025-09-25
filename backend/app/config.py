from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv

# Load environment variables from .env when present.
load_dotenv()


@dataclass(frozen=True, slots=True)
class Settings:
    """Application configuration sourced from environment variables."""

    openai_api_key: Optional[str]
    openai_model: str = "gpt-4.1-mini"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
    )


settings = get_settings()
