import pytest
from fastapi import HTTPException

from app.security import sign_internal_job_token, verify_internal_job_token


def test_internal_job_token_round_trip() -> None:
    token = sign_internal_job_token("job-1", "x" * 32, issued_at=2_000_000_000)
    verified = verify_internal_job_token(token, "x" * 32, max_age_seconds=10_000_000_000)

    assert verified.job_id == "job-1"


def test_internal_job_token_rejects_tampering() -> None:
    token = sign_internal_job_token("job-1", "x" * 32, issued_at=2_000_000_000)

    with pytest.raises(HTTPException):
        verify_internal_job_token(token.replace("job-1", "job-2"), "x" * 32)

