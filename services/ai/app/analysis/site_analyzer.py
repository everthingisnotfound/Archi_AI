from __future__ import annotations

import json
from pathlib import Path

from app.analysis.models import ExtractedEdge
from app.analysis.secret_scanner import SecretFinding

SITE_PROFILE_PATH = Path("_archaeologist") / "site-profile.json"

HEADER_CHECKS: list[tuple[str, str, str, str, str, str]] = [
    (
        "strict-transport-security",
        "MEDIUM",
        "Missing HSTS",
        "The live response did not send Strict-Transport-Security, so browsers are not instructed to require HTTPS on later visits.",
        "Add `Strict-Transport-Security: max-age=15552000; includeSubDomains` on the HTTPS origin (and preload only after all subdomains are HTTPS).",
        "HSTS tells browsers to refuse plaintext HTTP after the first secure visit. Without it, users can be downgraded on later connections.",
    ),
    (
        "content-security-policy",
        "MEDIUM",
        "Missing Content-Security-Policy",
        "No Content-Security-Policy header was observed. Inline script injection and unexpected third-party script execution are harder to contain.",
        "Ship a CSP that defaults to `default-src 'self'`, then allow only required script/style/connect origins. Prefer nonces over `unsafe-inline`.",
        "CSP is a browser sandbox for what HTML/JS/CSS may load. It does not replace XSS-safe coding, but it reduces blast radius when markup is injected.",
    ),
    (
        "x-frame-options",
        "LOW",
        "Clickjacking controls not advertised",
        "Neither X-Frame-Options nor a CSP `frame-ancestors` directive was observed, so the page may be embeddable in foreign iframes.",
        "Set `Content-Security-Policy: frame-ancestors 'self'` (preferred) or `X-Frame-Options: DENY` if the UI must not be framed.",
        "Framing another origin's UI can overlay fake controls (clickjacking). frame-ancestors / X-Frame-Options tells the browser who may embed the page.",
    ),
    (
        "x-content-type-options",
        "LOW",
        "MIME sniffing not disabled",
        "X-Content-Type-Options is absent, so some browsers may sniff MIME types and execute a file as a script.",
        "Send `X-Content-Type-Options: nosniff` on HTML and static asset responses.",
        "nosniff stops the browser from ignoring Content-Type. That matters if an upload or error page can be interpreted as JavaScript.",
    ),
    (
        "referrer-policy",
        "INFO",
        "Referrer-Policy not set",
        "No Referrer-Policy header was observed, so browsers may leak full URLs (including query tokens) to third parties.",
        "Send `Referrer-Policy: strict-origin-when-cross-origin` unless analytics requires more.",
        "Referrer-Policy controls how much of the current URL is sent on outbound navigations and subresource loads.",
    ),
]


def load_site_profile(repository_root: Path) -> dict | None:
    profile_path = repository_root / SITE_PROFILE_PATH
    if not profile_path.is_file():
        return None
    try:
        payload = json.loads(profile_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def extract_site_edges(profile: dict) -> list[ExtractedEdge]:
    edges: list[ExtractedEdge] = []
    start_url = str(profile.get("startUrl") or "site")
    for page in profile.get("pages") or []:
        if not isinstance(page, dict):
            continue
        page_path = str(page.get("path") or "pages/index.html")
        edges.append(ExtractedEdge(source_ref=start_url, target_ref=page_path, edge_type="page"))
        for asset in profile.get("assets") or []:
            if not isinstance(asset, dict):
                continue
            kind = str(asset.get("kind") or "asset")
            asset_path = str(asset.get("path") or asset.get("url") or "asset")
            edges.append(ExtractedEdge(source_ref=page_path, target_ref=asset_path, edge_type=kind))
        break

    for host in profile.get("thirdParties") or []:
        edges.append(
            ExtractedEdge(source_ref=start_url, target_ref=str(host), edge_type="third_party")
        )
    return edges


def extract_site_findings(profile: dict) -> list[SecretFinding]:
    headers = profile.get("securityHeaders") if isinstance(profile.get("securityHeaders"), dict) else {}
    findings: list[SecretFinding] = []
    header_keys = {str(key).lower() for key in headers}

    for header, severity, title, description, remediation, explanation in HEADER_CHECKS:
        if header == "x-frame-options" and (
            "x-frame-options" in header_keys or "frame-ancestors" in str(headers.get("content-security-policy", "")).lower()
        ):
            continue
        if header in header_keys:
            continue
        findings.append(
            SecretFinding(
                path="_archaeologist/security-headers.json",
                title=title,
                description=description,
                severity=severity,
                category="SECURITY",
                start_line=1,
                end_line=1,
                risk_explanation=explanation,
                remediation=remediation,
            )
        )

    for cookie in profile.get("cookies") or []:
        if not isinstance(cookie, dict):
            continue
        name = str(cookie.get("name") or "cookie")
        if cookie.get("secure") and cookie.get("httpOnly"):
            continue
        missing = []
        if not cookie.get("secure"):
            missing.append("Secure")
        if not cookie.get("httpOnly"):
            missing.append("HttpOnly")
        findings.append(
            SecretFinding(
                path="_archaeologist/security-headers.json",
                title=f"Cookie `{name}` missing {', '.join(missing)}",
                description=(
                    f"Set-Cookie for `{name}` was observed without {', '.join(missing)}. "
                    "Session cookies without these flags are easier to steal over HTTP or via XSS."
                ),
                severity="HIGH" if "HttpOnly" in missing else "MEDIUM",
                category="SECURITY",
                start_line=1,
                end_line=1,
                risk_explanation=(
                    "Secure restricts the cookie to HTTPS. HttpOnly hides it from document.cookie, "
                    "which blocks many XSS cookie-theft scripts. SameSite further limits cross-site sends."
                ),
                remediation=(
                    f"Set `{name}` with Secure; HttpOnly; SameSite=Lax (or Strict for session cookies). "
                    "Do not store long-lived auth tokens in JavaScript-readable cookies."
                ),
            )
        )

    return findings
