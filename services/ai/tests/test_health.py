from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.security import sign_internal_job_token


def test_health_endpoint() -> None:
    app = create_app(
        Settings(
            database_url="postgresql://example",
            internal_job_token_secret="x" * 32,
        )
    )
    client = TestClient(app)

    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_internal_health_requires_signed_token() -> None:
    secret = "x" * 32
    app = create_app(
        Settings(
            database_url="postgresql://example",
            internal_job_token_secret=secret,
        )
    )
    client = TestClient(app)
    token = sign_internal_job_token("job-1", secret)

    response = client.get("/internal/healthz", headers={"authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["jobId"] == "job-1"

