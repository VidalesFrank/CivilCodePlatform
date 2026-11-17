"""Cliente S3/MinIO para uploads de archivos fuente (E2K, XLSX, etc)."""

from functools import lru_cache
from typing import BinaryIO

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import ClientError

from .config import get_settings


@lru_cache
def get_s3_client():
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint_url,
        aws_access_key_id=s.s3_access_key,
        aws_secret_access_key=s.s3_secret_key,
        region_name=s.s3_region,
        config=BotoConfig(signature_version="s3v4"),
    )


def ensure_bucket(bucket: str) -> None:
    """Crea el bucket si no existe (idempotente)."""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"404", "NoSuchBucket", "NotFound"}:
            client.create_bucket(Bucket=bucket)
        else:
            raise


def put_object(bucket: str, key: str, body: BinaryIO, content_type: str) -> None:
    ensure_bucket(bucket)
    get_s3_client().put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)


def presigned_get(bucket: str, key: str, expires: int = 3600) -> str:
    return get_s3_client().generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires
    )
