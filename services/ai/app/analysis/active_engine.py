"""Bounded, pure active assessment orchestration."""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
from urllib.parse import urlparse

from .active_detectors import (
    detect_path_traversal,
    detect_rate_limit,
    detect_reflection,
    detect_sql_error,
    detect_unsafe_redirect,
    finding_for,
)
from .active_models import (
    ActiveAssessmentRequest,
    ActiveAssessmentResponse,
    ActiveEndpoint,
    ActiveResponse,
    Finding,
    FindingStatus,
    ProbeKind,
    ResponseDifference,
)
from .active_transport import ActiveTransport

PROBES = tuple(probe for probe in ProbeKind if probe is not ProbeKind.BASELINE)
_SAFE_METHODS = {"GET", "HEAD"}


def response_difference(baseline: ActiveResponse, probe: ActiveResponse) -> ResponseDifference:
    baseline_lines = set(baseline.body.splitlines())
    probe_lines = set(probe.body.splitlines())
    headers = {key.lower(): value for key, value in baseline.headers.items()}
    probe_headers = {key.lower(): value for key, value in probe.headers.items()}
    changed = {
        key: (headers.get(key), probe_headers.get(key))
        for key in headers.keys() | probe_headers.keys()
        if headers.get(key) != probe_headers.get(key)
    }
    return ResponseDifference(
        baseline=baseline,
        probe=probe,
        body_added="\n".join(sorted(probe_lines - baseline_lines)),
        body_removed="\n".join(sorted(baseline_lines - probe_lines)),
        status_changed=baseline.status_code != probe.status_code,
        changed_headers=changed,
    )


def _in_scope(endpoint: ActiveEndpoint, allowed_hosts: set[str]) -> bool:
    host = (urlparse(str(endpoint.url)).hostname or "").lower().rstrip(".")
    return any(
        host == allowed.removeprefix("*.")
        or (allowed.startswith("*.") and host.endswith("." + allowed[2:]))
        for allowed in allowed_hosts
    )


class ActiveAssessmentEngine:
    def __init__(self, transport: ActiveTransport) -> None:
        self.transport = transport

    async def assess(self, request: ActiveAssessmentRequest) -> ActiveAssessmentResponse:
        endpoints = [
            endpoint
            for endpoint in request.endpoints
            if endpoint.method.upper() in _SAFE_METHODS
            and _in_scope(endpoint, {host.lower().rstrip(".") for host in request.allowed_hosts})
        ]
        skipped = [str(endpoint.url) for endpoint in request.endpoints if endpoint not in endpoints]
        budget = request.budget
        limit = min(budget.max_requests, len(endpoints) * (1 + len(PROBES)))
        semaphore = asyncio.Semaphore(budget.concurrency)
        counter = 0
        counter_lock = asyncio.Lock()

        async def send(endpoint: ActiveEndpoint, probe: ProbeKind) -> ActiveResponse:
            nonlocal counter
            async with semaphore:
                async with counter_lock:
                    if counter >= limit:
                        raise _BudgetExhausted
                    counter += 1
                if budget.delay_seconds:
                    await asyncio.sleep(budget.delay_seconds)
                return await asyncio.wait_for(
                    self.transport.send(endpoint, probe), timeout=budget.timeout_seconds
                )

        async def one(endpoint: ActiveEndpoint) -> list[Finding]:
            try:
                baseline = await send(endpoint, ProbeKind.BASELINE)
                findings: list[Finding] = []
                for probe in PROBES:
                    try:
                        response = await send(endpoint, probe)
                    except _BudgetExhausted:
                        break
                    diff = response_difference(baseline, response)
                    findings.extend(_findings(endpoint, probe, diff))
                return findings
            except (_BudgetExhausted, TimeoutError):
                return []

        results = await asyncio.wait_for(
            asyncio.gather(*(one(endpoint) for endpoint in endpoints)),
            timeout=budget.max_duration_seconds,
        )
        return ActiveAssessmentResponse(
            findings=[finding for group in results for finding in group],
            requests_made=counter,
            skipped_endpoints=skipped,
        )


class _BudgetExhausted(Exception):
    pass


def _findings(
    endpoint: ActiveEndpoint, probe: ProbeKind, diff: ResponseDifference
) -> Iterable[Finding]:
    url = str(endpoint.url)
    if probe is ProbeKind.REFLECTION and detect_reflection(diff):
        reflection_status = (
            FindingStatus.SUPPORTED
            if "active-scan-marker" in diff.body_added
            else FindingStatus.CANDIDATE
        )
        yield finding_for(
            "reflection",
            "Reflected active scan marker",
            url,
            probe,
            diff,
            "Marker reflected differentially",
            status=reflection_status,
            confidence=0.85 if reflection_status is FindingStatus.SUPPORTED else 0.45,
            limitations=[
                "Reflection alone does not establish exploitability.",
            ],
        )
    elif probe is ProbeKind.SQL_ERROR:
        match = detect_sql_error(diff)
        if match:
            yield finding_for(
                "sql_error",
                "SQL error-like response",
                url,
                probe,
                diff,
                "SQL error indicator",
                match=match,
            )
    elif probe is ProbeKind.PATH_TRAVERSAL:
        match = detect_path_traversal(diff)
        if match:
            yield finding_for(
                "path_traversal",
                "Path traversal indicator",
                url,
                probe,
                diff,
                "Traversal indicator",
                match=match,
            )
    elif probe is ProbeKind.REDIRECT and detect_unsafe_redirect(diff, url):
        yield finding_for(
            "unsafe_redirect",
            "Unsafe external redirect",
            url,
            probe,
            diff,
            "External redirect",
            severity="high",
        )
    elif probe is ProbeKind.RATE_LIMIT and detect_rate_limit(diff):
        yield finding_for(
            "rate_limit",
            "Rate-limit behavior observed (informational)",
            url,
            probe,
            diff,
            "429 or rate-limit headers",
            severity="info",
            category="informational",
            confidence=0.9,
            detection_method="observed throttling response",
            limitations=[
                "Observed throttling is evidence about behavior, not a vulnerability claim.",
            ],
        )
