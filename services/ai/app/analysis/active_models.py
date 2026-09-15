"""Canonical, deliberately small models for bounded active assessments."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ProbeKind(StrEnum):
    BASELINE = "baseline"
    REFLECTION = "reflection"
    SQL_ERROR = "sql_error"
    PATH_TRAVERSAL = "path_traversal"
    REDIRECT = "redirect"
    RATE_LIMIT = "rate_limit"


class ActiveEndpoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: HttpUrl
    method: str = "GET"
    name: str | None = None
    query: dict[str, object] = Field(default_factory=dict)
    path: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    cookies: dict[str, str] = Field(default_factory=dict)
    body: str | bytes | dict[str, object] | list[object] | None = None
    content_type: str | None = None
    auth_context: dict[str, object] = Field(default_factory=dict)


class ScanBudget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_requests: int = Field(default=30, ge=1, le=500)
    concurrency: int = Field(default=2, ge=1, le=20)
    delay_seconds: float = Field(default=0, ge=0, le=60)
    timeout_seconds: float = Field(default=5, gt=0, le=60)
    max_response_bytes: int = Field(default=1_500_000, ge=1_024, le=10_000_000)
    max_duration_seconds: float = Field(default=300, gt=0, le=3_600)


class ActiveAssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    endpoints: list[ActiveEndpoint] = Field(min_length=1, max_length=100)
    allowed_hosts: set[str] = Field(min_length=1, max_length=100)
    budget: ScanBudget = Field(default_factory=ScanBudget)


class ActiveResponse(BaseModel):
    status_code: int = Field(ge=100, le=599)
    headers: dict[str, str] = Field(default_factory=dict)
    body: str = ""
    url: HttpUrl | None = None


class ResponseDifference(BaseModel):
    baseline: ActiveResponse
    probe: ActiveResponse
    body_added: str = ""
    body_removed: str = ""
    status_changed: bool = False
    changed_headers: dict[str, tuple[str | None, str | None]] = Field(
        default_factory=dict
    )


class Evidence(BaseModel):
    probe: ProbeKind
    summary: str
    snippet: str = Field(default="", max_length=500)
    response_status: int | None = None


class FindingStatus(StrEnum):
    CANDIDATE = "candidate"
    VALIDATING = "validating"
    SUPPORTED = "supported"
    CONFIRMED = "confirmed"
    INCONCLUSIVE = "inconclusive"
    REJECTED = "rejected"


class EvidenceCorrelation(BaseModel):
    """Records whether a signal is corroborated by a baseline differential."""

    correlated: bool = False
    independent_signals: int = Field(default=1, ge=0)
    rationale: str = ""


class Finding(BaseModel):
    detector: str
    title: str
    severity: str = "medium"
    endpoint: HttpUrl
    status: FindingStatus = FindingStatus.CANDIDATE
    confidence: float = Field(default=0.5, ge=0, le=1)
    category: str = "security"
    detection_method: str = ""
    limitations: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    evidence_correlation: EvidenceCorrelation = Field(default_factory=EvidenceCorrelation)


class ActiveAssessmentResponse(BaseModel):
    findings: list[Finding] = Field(default_factory=list)
    requests_made: int = 0
    skipped_endpoints: list[str] = Field(default_factory=list)
