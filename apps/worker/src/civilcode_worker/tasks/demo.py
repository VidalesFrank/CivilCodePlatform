from datetime import UTC, datetime

from ..celery_app import app


@app.task(name="demo.echo")
def echo(message: str) -> dict[str, str]:
    """Smoke-test task — returns input + timestamp. Use to validate Celery + Redis wiring."""
    return {
        "message": message,
        "received_at": datetime.now(UTC).isoformat(),
    }
