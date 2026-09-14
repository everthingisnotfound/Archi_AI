"""Transport boundary and bounded HTTP implementation for active analysis."""

from __future__ import annotations

from collections.abc import Callable
from typing import Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from pydantic import HttpUrl, TypeAdapter

from .active_models import ActiveEndpoint, ActiveResponse, ProbeKind

_HTTP_URL = TypeAdapter(HttpUrl)


class ActiveTransport(Protocol):
    async def send(self, endpoint: ActiveEndpoint, probe: ProbeKind) -> ActiveResponse:
        """Send one internally-defined, safe probe."""


TransportFactory = Callable[[], ActiveTransport]


class BoundedHttpTransport:
    """HTTP transport limited to the engine's safe GET/HEAD probe contract."""

    def __init__(
        self,
        allowed_hosts: set[str],
        max_response_bytes: int,
        timeout_seconds: float = 5,
    ) -> None:
        self._allowed_hosts = {
            host.lower().rstrip(".") for host in allowed_hosts
        }
        self._max_response_bytes = max_response_bytes
        self._timeout_seconds = timeout_seconds

    async def send(self, endpoint: ActiveEndpoint, probe: ProbeKind) -> ActiveResponse:
        method = endpoint.method.upper()
        if method not in {"GET", "HEAD"}:
            raise ValueError("active validation only permits GET and HEAD requests")
        if endpoint.body is not None:
            raise ValueError("active validation does not permit request bodies for GET and HEAD")

        url = self._probe_url(str(endpoint.url), probe)
        parsed = urlsplit(url)
        host = (parsed.hostname or "").lower().rstrip(".")
        if not any(
            host == allowed.removeprefix("*.")
            or (allowed.startswith("*.") and host.endswith(f".{allowed[2:]}"))
            for allowed in self._allowed_hosts
        ):
            raise ValueError("active validation target is outside the explicit host scope")

        headers = dict(endpoint.headers)
        if endpoint.content_type:
            headers.setdefault("content-type", endpoint.content_type)
        cookies = endpoint.cookies or None
        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=self._timeout_seconds,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5),
        ) as client:
            async with client.stream(
                method,
                url,
                headers=headers,
                cookies=cookies,
                content=_body_bytes(endpoint.body),
            ) as response:
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) >= self._max_response_bytes:
                        break
                body = bytes(content[: self._max_response_bytes]).decode(
                    "utf-8", errors="replace"
                )
                response_headers = dict(response.headers)
                status_code = response.status_code
                response_url = str(response.url)
        return ActiveResponse(
            status_code=status_code,
            headers=response_headers,
            body=body,
            url=_HTTP_URL.validate_python(response_url),
        )

    @staticmethod
    def _probe_url(url: str, probe: ProbeKind) -> str:
        parsed = urlsplit(url)
        query = parse_qsl(parsed.query, keep_blank_values=True)
        if probe is ProbeKind.BASELINE:
            return url
        marker = {
            ProbeKind.REFLECTION: "active-scan-marker",
            ProbeKind.SQL_ERROR: "'",
            ProbeKind.PATH_TRAVERSAL: "../",
            ProbeKind.REDIRECT: "https://archi.invalid/",
            ProbeKind.RATE_LIMIT: "archi-rate-limit-check",
        }[probe]
        if query:
            name, _ = query[0]
            query[0] = (name, marker)
        else:
            query.append(("archi_probe", marker))
        return urlunsplit(parsed._replace(query=urlencode(query)))


def _body_bytes(body: object) -> bytes | None:
    if body is None:
        return None
    if isinstance(body, bytes):
        return body
    if isinstance(body, str):
        return body.encode("utf-8")
    raise ValueError("active validation does not serialize structured request bodies")
