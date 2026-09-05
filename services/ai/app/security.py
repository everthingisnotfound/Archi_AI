from __future__ import annotations

import hmac
from dataclasses import dataclass
from hashlib import sha256
from time import time

from fastapi import Header, HTTPException, status


@dataclass(frozen=True)
class InternalJobToken:
    job_id: str
    issued_at: int


def sign_internal_job_token(job_id: str, secret: str, issued_at: int | None = None) -> str:
    timestamp = issued_at if issued_at is not None else int(time())
    message = f"{job_id}.{timestamp}"
    signature = hmac.new(secret.encode(), message.encode(), sha256).hexdigest()
    return f"{message}.{signature}"


def verify_internal_job_token(token: str, secret: str, max_age_seconds: int = 900) -> InternalJobToken:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal token")

    job_id, issued_at_raw, signature = parts
    try:
        issued_at = int(issued_at_raw)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal token") from exc

    if int(time()) - issued_at > max_age_seconds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Internal token expired")

    expected = hmac.new(secret.encode(), f"{job_id}.{issued_at}".encode(), sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal token")

    return InternalJobToken(job_id=job_id, issued_at=issued_at)


def require_internal_job_token(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing internal token")
    return authorization.removeprefix("Bearer ").strip()

