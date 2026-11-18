"""Cliente Celery para disparar tasks desde la API sin importar el worker."""

import asyncio
import os
from functools import lru_cache

from celery import Celery


@lru_cache
def get_celery() -> Celery:
    broker = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
    return Celery("civilcode_api_client", broker=broker, backend=backend)


def _send_task_sync(name: str, args: list, queue: str) -> str:
    celery = get_celery()
    result = celery.send_task(name, args=args, queue=queue)
    return result.id


async def dispatch_import(revision_id: str) -> str:
    """Encola la task de import en el worker. Devuelve task_id.

    Celery broker usa conexiones bloqueantes — ejecutamos en executor para no
    bloquear el event loop y evitar el bug de kombu con channels vacíos.
    """
    return await asyncio.to_thread(
        _send_task_sync,
        "civilcode_worker.tasks.import.run_import",
        [revision_id],
        "import",
    )
