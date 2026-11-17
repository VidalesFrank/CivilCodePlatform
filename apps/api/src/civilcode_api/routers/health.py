from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings

router = APIRouter(tags=["meta"])


class HealthResponse(BaseModel):
    status: str
    name: str
    env: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    s = get_settings()
    return HealthResponse(status="ok", name=s.app_name, env=s.app_env, version="0.0.0")
