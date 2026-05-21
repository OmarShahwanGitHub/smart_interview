import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from motor.motor_asyncio import AsyncIOMotorClient


_mongo_client: Optional[AsyncIOMotorClient] = None
_s3_client: Any = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def mongo_enabled() -> bool:
    return bool(os.getenv("MONGODB_URI"))


def s3_enabled() -> bool:
    return bool(os.getenv("S3_BUCKET"))


def get_db():
    global _mongo_client
    if not mongo_enabled():
        return None

    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(os.environ["MONGODB_URI"])

    return _mongo_client[os.getenv("MONGODB_DB", "smart_interview")]


def get_s3_client():
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    kwargs: dict[str, Any] = {
        "region_name": os.getenv("S3_REGION", "us-east-1"),
        "config": Config(signature_version="s3v4"),
    }

    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url

    access_key = os.getenv("S3_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY")
    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key

    _s3_client = boto3.client("s3", **kwargs)
    return _s3_client


def public_or_s3_uri(key: str) -> str:
    public_base = os.getenv("S3_PUBLIC_BASE_URL", "").rstrip("/")
    if public_base:
        return f"{public_base}/{key}"
    return f"s3://{os.environ['S3_BUCKET']}/{key}"


def object_key(prefix: str, filename: str | None = None) -> str:
    safe_filename = (filename or "audio.webm").replace("/", "_").replace("\\", "_")
    return f"{prefix.strip('/')}/{uuid.uuid4().hex}-{safe_filename}"


async def insert_one(collection: str, document: dict[str, Any]) -> Optional[str]:
    db = get_db()
    if db is None:
        return None

    document.setdefault("created_at", utc_now())
    result = await db[collection].insert_one(document)
    return str(result.inserted_id)


async def upsert_one(collection: str, filter_doc: dict[str, Any], update_doc: dict[str, Any]) -> None:
    db = get_db()
    if db is None:
        return

    update_doc.setdefault("updated_at", utc_now())
    await db[collection].update_one(
        filter_doc,
        {
            "$set": update_doc,
            "$setOnInsert": {"created_at": utc_now()},
        },
        upsert=True,
    )


async def upload_bytes_to_s3(
    *,
    data: bytes,
    key: str,
    content_type: str,
    metadata: Optional[dict[str, str]] = None,
) -> str:
    if not s3_enabled():
        raise RuntimeError("S3_BUCKET is not configured")

    try:
        get_s3_client().put_object(
            Bucket=os.environ["S3_BUCKET"],
            Key=key,
            Body=data,
            ContentType=content_type,
            Metadata=metadata or {},
        )
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(f"Could not upload recording to S3: {exc}") from exc

    return public_or_s3_uri(key)
