import asyncio

from app.analysis.active_engine import ActiveAssessmentEngine
from app.analysis.active_models import (
    ActiveAssessmentRequest,
    ActiveEndpoint,
    ActiveResponse,
    FindingStatus,
    ProbeKind,
)


class FixtureTransport:
    def __init__(self, vulnerable: bool) -> None:
        self.vulnerable = vulnerable
        self.calls: list[ProbeKind] = []

    async def send(self, endpoint, probe):
        self.calls.append(probe)
        if probe is ProbeKind.BASELINE:
            return ActiveResponse(status_code=200, body="safe")
        if not self.vulnerable:
            return ActiveResponse(status_code=200, body="safe")
        if probe is ProbeKind.REFLECTION:
            return ActiveResponse(status_code=200, body="safe active-scan-marker")
        if probe is ProbeKind.SQL_ERROR:
            return ActiveResponse(status_code=500, body="SQL syntax error near SELECT")
        if probe is ProbeKind.PATH_TRAVERSAL:
            return ActiveResponse(status_code=200, body="root:x:0:0:root")
        if probe is ProbeKind.REDIRECT:
            return ActiveResponse(
                status_code=302, headers={"Location": "https://other.example.test/login"}
            )
        return ActiveResponse(status_code=429, headers={"Retry-After": "1"})


def request(**budget):
    return ActiveAssessmentRequest(
        endpoints=[{"url": "https://example.test/check"}],
        allowed_hosts={"example.test"},
        budget=budget,
    )


def test_fixture_transport_reports_vulnerable_behaviors():
    transport = FixtureTransport(vulnerable=True)
    result = asyncio.run(ActiveAssessmentEngine(transport).assess(request()))

    assert {finding.detector for finding in result.findings} == {
        "reflection",
        "sql_error",
        "path_traversal",
        "unsafe_redirect",
        "rate_limit",
    }
    assert result.requests_made == 6


def test_fixture_transport_safe_case_and_scope_are_bounded():
    transport = FixtureTransport(vulnerable=False)
    result = asyncio.run(
        ActiveAssessmentEngine(transport).assess(
            ActiveAssessmentRequest(
                endpoints=[
                    {"url": "https://example.test/check"},
                    {"url": "https://outside.test/check"},
                    {"url": "https://sub.example.test/check"},
                    {"url": "https://example.test/write", "method": "POST"},
                ],
                allowed_hosts={"example.test"},
                budget={"max_requests": 2, "concurrency": 1},
            )
        )
    )

    assert result.findings == []
    assert result.requests_made == 2
    assert len(result.skipped_endpoints) == 3


def test_budget_prevents_probe_overrun():
    transport = FixtureTransport(vulnerable=True)
    result = asyncio.run(
        ActiveAssessmentEngine(transport).assess(request(max_requests=3, concurrency=1))
    )
    assert result.requests_made == 3
    assert len(transport.calls) == 3


def test_findings_expose_lifecycle_confidence_and_correlated_evidence():
    result = asyncio.run(
        ActiveAssessmentEngine(FixtureTransport(vulnerable=True)).assess(request())
    )

    reflection = next(finding for finding in result.findings if finding.detector == "reflection")
    assert reflection.status is FindingStatus.SUPPORTED
    assert 0 <= reflection.confidence <= 1
    assert reflection.category == "security"
    assert reflection.detection_method
    assert reflection.evidence_correlation.correlated is True
    assert reflection.evidence_correlation.independent_signals >= 2

    throttling = next(finding for finding in result.findings if finding.detector == "rate_limit")
    assert throttling.category == "informational"
    assert throttling.severity == "info"
    assert "not a vulnerability claim" in throttling.limitations[0]


def test_endpoint_serializes_richer_request_context_and_keeps_defaults():
    endpoint = ActiveEndpoint(
        url="https://example.test/items",
        method="POST",
        query={"page": "2", "tag": ["one", "two"]},
        path="/items",
        headers={"X-Trace": "trace-id"},
        cookies={"session": "cookie"},
        body='{"name":"item"}',
        content_type="application/json",
        auth_context={"scheme": "bearer"},
    )

    serialized = endpoint.model_dump(mode="json")
    assert serialized["query"] == {"page": "2", "tag": ["one", "two"]}
    assert serialized["path"] == "/items"
    assert serialized["headers"] == {"X-Trace": "trace-id"}
    assert serialized["cookies"] == {"session": "cookie"}
    assert serialized["body"] == '{"name":"item"}'
    assert serialized["content_type"] == "application/json"
    assert serialized["auth_context"] == {"scheme": "bearer"}
    assert ActiveEndpoint(url="https://example.test").headers == {}
