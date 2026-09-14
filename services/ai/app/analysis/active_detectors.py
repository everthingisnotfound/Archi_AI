"""Pure deterministic detectors used by the active assessment engine."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from pydantic import HttpUrl, TypeAdapter

from .active_models import (
    Evidence,
    EvidenceCorrelation,
    Finding,
    FindingStatus,
    ProbeKind,
    ResponseDifference,
)

_SQL_ERRORS = re.compile(
    r"(sql syntax|mysql|postgres(?:ql)?|sqlite|ora-\d+|odbc|syntax error.*select|"
    r"unclosed quotation|you have an error in your sql)", re.I
)
_TRAVERSAL = re.compile(r"(root:x?:|\\windows\\win\.ini|\[extensions\]|etc/passwd)", re.I)
_REDIRECT_SCHEMES = {"http", "https"}
_HTTP_URL = TypeAdapter(HttpUrl)


def _snippet(body: str, match: re.Match[str] | None = None) -> str:
    if not match:
        return body[:300]
    start = max(0, match.start() - 80)
    return body[start : start + 300]


def detect_reflection(diff: ResponseDifference, marker: str = "active-scan-marker") -> bool:
    return marker in diff.probe.body and marker not in diff.baseline.body


def detect_sql_error(diff: ResponseDifference) -> re.Match[str] | None:
    if _SQL_ERRORS.search(diff.baseline.body):
        return None
    return _SQL_ERRORS.search(diff.probe.body)


def detect_path_traversal(diff: ResponseDifference) -> re.Match[str] | None:
    if _TRAVERSAL.search(diff.baseline.body):
        return None
    return _TRAVERSAL.search(diff.probe.body)


def detect_unsafe_redirect(diff: ResponseDifference, endpoint_url: str) -> bool:
    location = next((v for k, v in diff.probe.headers.items() if k.lower() == "location"), "")
    if not (300 <= diff.probe.status_code < 400 and location):
        return False
    target = urlparse(location)
    source = urlparse(endpoint_url)
    return target.scheme in _REDIRECT_SCHEMES and target.netloc.lower() != source.netloc.lower()


def detect_rate_limit(diff: ResponseDifference) -> bool:
    return diff.probe.status_code == 429 or any(
        key.lower() in {"retry-after", "x-ratelimit-limit", "x-ratelimit-remaining"}
        for key in diff.probe.headers
    )


def finding_for(
    detector: str,
    title: str,
    endpoint_url: str,
    probe: ProbeKind,
    diff: ResponseDifference,
    summary: str,
    severity: str = "medium",
    match: re.Match[str] | None = None,
    status: FindingStatus = FindingStatus.SUPPORTED,
    confidence: float = 0.75,
    category: str = "security",
    detection_method: str = "differential response analysis",
    limitations: list[str] | None = None,
) -> Finding:
    return Finding(
        detector=detector,
        title=title,
        severity=severity,
        endpoint=_HTTP_URL.validate_python(endpoint_url),
        status=status,
        confidence=confidence,
        category=category,
        detection_method=detection_method,
        limitations=limitations or [],
        evidence=[
            Evidence(
                probe=probe,
                summary=summary,
                snippet=_snippet(diff.probe.body, match),
                response_status=diff.probe.status_code,
            )
        ],
        evidence_correlation=EvidenceCorrelation(
            correlated=True,
            independent_signals=1,
            rationale="The probe response differs from the endpoint baseline; no independent corroborating probe was performed.",
        ),
    )
