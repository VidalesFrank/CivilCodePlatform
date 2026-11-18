from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import (
    analyses,
    auth,
    buildings,
    column_designs,
    designs,
    footing_designs,
    health,
    organizations,
    projects,
    stats,
    wall_designs,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Startup hooks go here (e.g., validate DB connection)
    yield
    # Shutdown hooks (close pools, etc.)


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.0.0",
    description="CivilCode Studio — API HTTP",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,  # required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(buildings.router, prefix="/api/v1")
app.include_router(analyses.router, prefix="/api/v1")
app.include_router(designs.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(column_designs.router, prefix="/api/v1")
app.include_router(wall_designs.router, prefix="/api/v1")
app.include_router(footing_designs.router, prefix="/api/v1")


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "docs": "/docs"}
