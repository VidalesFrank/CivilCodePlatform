import os

from celery import Celery

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

app = Celery(
    "civilcode_worker",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=["civilcode_worker.tasks.demo"],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # hard kill after 1h
    task_soft_time_limit=3000,  # warn after 50min
    worker_prefetch_multiplier=1,  # fair scheduling for long tasks
    task_default_queue="default",
    task_routes={
        "civilcode_worker.tasks.import.*": {"queue": "import"},
        "civilcode_worker.tasks.analysis.*": {"queue": "analysis"},
        "civilcode_worker.tasks.design.*": {"queue": "design"},
        "civilcode_worker.tasks.rendering.*": {"queue": "rendering"},
    },
)
