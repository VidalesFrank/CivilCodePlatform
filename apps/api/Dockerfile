FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy manifest first for layer caching
COPY pyproject.toml ./
RUN uv pip install --system -e .

# Copy source and migrations
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

EXPOSE 8000

# Dev default; override in docker-compose for prod with gunicorn + uvicorn workers
CMD ["uvicorn", "civilcode_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
