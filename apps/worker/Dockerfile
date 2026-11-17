FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY pyproject.toml ./
RUN uv pip install --system -e .

COPY src/ ./src/

CMD ["celery", "-A", "civilcode_worker.celery_app", "worker", "--loglevel=info", "-Q", "default,import,analysis,design,rendering"]
