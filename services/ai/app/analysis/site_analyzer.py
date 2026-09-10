from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from app.analysis.models import ExtractedEdge
from app.analysis.secret_scanner import SecretFinding

SITE_PROFILE_PATH = Path("_archaeologist") / "site-profile.json"

HEADER_CHECKS: list[tuple[str, str, str, str, str, str]] = [
    (
        "strict-transport-security",
        "MEDIUM",
        "Missing HSTS",
        "HTTPS responses did not send Strict-Transport-Security, so browsers are not instructed to require HTTPS on later visits.",
        "Add `Strict-Transport-Security: max-age=15552000; includeSubDomains` on the HTTPS origin (and preload only after all subdomains are HTTPS).",
        "HSTS tells browsers to refuse plaintext HTTP after the first secure visit. Without it, users can be downgraded on later connections.",
    ),
    (
        "content-security-policy",
        "MEDIUM",
        "Missing Content-Security-Policy",
        "No Content-Security-Policy header was observed. Inline script injection and unexpected third-party script execution are harder to contain.",
        "Ship a CSP that defaults to `default-src 'self'`, then allow only required script/style/connect origins. Prefer nonces over `unsafe-inline`.",
        "CSP is a browser sandbox for what HTML, JavaScript, and CSS may load. It reduces blast radius when markup is injected.",
    ),
    (
        "x-frame-options",
        "LOW",
        "Clickjacking controls not advertised",
        "Neither X-Frame-Options nor a CSP frame-ancestors directive was observed, so pages may be embeddable in foreign iframes.",
        "Set `Content-Security-Policy: frame-ancestors 'self'` (preferred) or `X-Frame-Options: DENY` if the UI must not be framed.",
        "Framing another origin's UI can overlay fake controls. frame-ancestors and X-Frame-Options tell browsers who may embed it.",
    ),
    (
        "x-content-type-options",
        "LOW",
        "MIME sniffing not disabled",
        "X-Content-Type-Options is absent, so some browsers may sniff MIME types and misinterpret a response as executable content.",
        "Send `X-Content-Type-Options: nosniff` on HTML and static asset responses.",
        "nosniff stops browsers from ignoring Content-Type. It matters when an upload or error page could be interpreted as JavaScript.",
    ),
    (
        "referrer-policy",
        "INFO",
        "Referrer-Policy not set",
        "No Referrer-Policy header was observed, so full URLs can be sent to third parties in more situations than necessary.",
        "Send `Referrer-Policy: strict-origin-when-cross-origin` unless analytics requires more detail.",
        "Referrer-Policy controls how much of the current URL is sent on outbound navigation and subresource loads.",
    ),
]


def load_site_profile(repository_root: Path) -> dict | None:
    profile_path = repository_root / SITE_PROFILE_PATH
    if not profile_path.is_file():
        return None
    try:
        payload = json.loads(profile_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def extract_site_edges(profile: dict) -> list[ExtractedEdge]:
    pages = _pages(profile)
    start_url = str(profile.get("startUrl") or "site")
    path_by_url = {
        str(page.get("url")): str(page.get("path"))
        for page in pages
        if page.get("url") and page.get("path")
    }
    edges: list[ExtractedEdge] = []

    for page in pages:
        page_path = str(page.get("path") or "pages/index.html")
        discovered_from = str(page.get("discoveredFrom") or start_url)
        edges.append(
            ExtractedEdge(
                source_ref=path_by_url.get(discovered_from, start_url),
                target_ref=page_path,
                edge_type="page",
            )
        )
        for link in page.get("links") or []:
            target = path_by_url.get(str(link))
            if target:
                edges.append(ExtractedEdge(source_ref=page_path, target_ref=target, edge_type="page_link"))
        for resource in page.get("resources") or []:
            if not isinstance(resource, dict):
                continue
            resource_path = str(resource.get("path") or resource.get("url") or "asset")
            resource_kind = str(resource.get("kind") or "asset")
            edges.append(ExtractedEdge(source_ref=page_path, target_ref=resource_path, edge_type=resource_kind))
        for form in page.get("forms") or []:
            if isinstance(form, dict) and form.get("action"):
                edges.append(
                    ExtractedEdge(source_ref=page_path, target_ref=str(form["action"]), edge_type="form_action")
                )

    # Legacy snapshots carried resources only at profile level.
    if not pages:
        for asset in profile.get("assets") or []:
            if isinstance(asset, dict):
                edges.append(
                    ExtractedEdge(
                        source_ref=start_url,
                        target_ref=str(asset.get("path") or asset.get("url") or "asset"),
                        edge_type=str(asset.get("kind") or "asset"),
                    )
                )
    for host in profile.get("thirdParties") or []:
        edges.append(ExtractedEdge(source_ref=start_url, target_ref=str(host), edge_type="third_party"))
    return _dedupe_edges(edges)


def extract_site_findings(profile: dict) -> list[SecretFinding]:
    pages = _pages(profile)
    findings: list[SecretFinding] = []
    findings.extend(_header_findings(profile, pages))
    findings.extend(_cookie_findings(profile, pages))
    findings.extend(_page_surface_findings(pages))
    return findings


def _pages(profile: dict) -> list[dict]:
    pages = [page for page in profile.get("pages") or [] if isinstance(page, dict)]
    if pages:
        return pages
    # Preserve analysis compatibility with version-one captures.
    return [
        {
            "cookies": profile.get("cookies") or [],
            "path": "_archaeologist/security-headers.json",
            "securityHeaders": profile.get("securityHeaders") or {},
            "url": profile.get("startUrl") or "",
        }
    ]


def _header_findings(profile: dict, pages: list[dict]) -> list[SecretFinding]:
    findings: list[SecretFinding] = []
    for header, severity, title, description, remediation, explanation in HEADER_CHECKS:
        missing: list[dict] = []
        for page in pages:
            headers = page.get("securityHeaders") if isinstance(page.get("securityHeaders"), dict) else {}
            page_url = str(page.get("url") or "")
            if header == "strict-transport-security" and not page_url.startswith("https://"):
                continue
            if header == "x-frame-options" and (
                "x-frame-options" in {str(key).lower() for key in headers}
                or "frame-ancestors" in str(headers.get("content-security-policy", "")).lower()
            ):
                continue
            if header not in {str(key).lower() for key in headers}:
                missing.append(page)
        if not missing:
            continue
        suffix = "" if len(missing) == 1 else f" ({len(missing)}/{len(pages)} captured pages)"
        examples = ", ".join(str(page.get("url") or page.get("path")) for page in missing[:3])
        findings.append(
            SecretFinding(
                path="_archaeologist/site-profile.json",
                title=f"{title}{suffix}",
                description=f"{description} Affected observed pages: {examples}.",
                severity=severity,
                category="SECURITY",
                start_line=1,
                end_line=1,
                risk_explanation=explanation,
                remediation=remediation,
            )
        )
    return findings


def _cookie_findings(profile: dict, pages: list[dict]) -> list[SecretFinding]:
    findings: list[SecretFinding] = []
    seen: set[tuple[str, str]] = set()
    for page in pages:
        for cookie in page.get("cookies") or []:
            if not isinstance(cookie, dict):
                continue
            name = str(cookie.get("name") or "cookie")
            missing = [
                flag
                for flag, present in (("Secure", cookie.get("secure")), ("HttpOnly", cookie.get("httpOnly")))
                if not present
            ]
            key = (name, ",".join(missing))
            if not missing or key in seen:
                continue
            seen.add(key)
            findings.append(
                SecretFinding(
                    path=str(page.get("path") or "_archaeologist/site-profile.json"),
                    title=f"Cookie `{name}` missing {', '.join(missing)}",
                    description=(
                        f"Set-Cookie for `{name}` was observed without {', '.join(missing)}. "
                        "Session cookies without these flags are easier to steal over HTTP or through script injection."
                    ),
                    severity="HIGH" if "HttpOnly" in missing else "MEDIUM",
                    category="SECURITY",
                    start_line=1,
                    end_line=1,
                    risk_explanation=(
                        "Secure restricts a cookie to HTTPS. HttpOnly hides it from document.cookie, "
                        "which blocks many script-based cookie theft attempts. SameSite further limits cross-site sends."
                    ),
                    remediation=(
                        f"Set `{name}` with Secure; HttpOnly; SameSite=Lax (or Strict for session cookies). "
                        "Do not store long-lived authentication tokens in JavaScript-readable cookies."
                    ),
                )
            )
    return findings


def _page_surface_findings(pages: list[dict]) -> list[SecretFinding]:
    findings: list[SecretFinding] = []
    weak_csp_pages: list[str] = []
    mixed_resource_pages: list[str] = []
    sri_pages: list[str] = []
    blank_target_pages: list[str] = []

    for page in pages:
        page_path = str(page.get("path") or "_archaeologist/site-profile.json")
        page_url = str(page.get("url") or "")
        headers = page.get("securityHeaders") if isinstance(page.get("securityHeaders"), dict) else {}
        csp = str(headers.get("content-security-policy") or "").lower()
        if csp and ("'unsafe-inline'" in csp or "'unsafe-eval'" in csp or "*" in csp):
            weak_csp_pages.append(page_url or page_path)

        third_party_scripts_without_sri = False
        mixed_active_resource = False
        for resource in page.get("resources") or []:
            if not isinstance(resource, dict):
                continue
            url = str(resource.get("url") or "")
            kind = str(resource.get("kind") or "")
            if page_url.startswith("https://") and url.startswith("http://") and kind in {"script", "stylesheet"}:
                mixed_active_resource = True
            if kind == "script" and resource.get("thirdParty") and not resource.get("integrity"):
                third_party_scripts_without_sri = True
        if mixed_active_resource:
            mixed_resource_pages.append(page_url or page_path)
        if third_party_scripts_without_sri:
            sri_pages.append(page_url or page_path)
        if int(page.get("targetBlankWithoutNoopener") or 0) > 0:
            blank_target_pages.append(page_url or page_path)

        for form in page.get("forms") or []:
            if not isinstance(form, dict) or not form.get("hasPasswordInput"):
                continue
            action = str(form.get("action") or page_url)
            method = str(form.get("method") or "GET").upper()
            if method == "GET":
                findings.append(_finding(
                    page_path,
                    "Password form submits with GET",
                    "HIGH",
                    f"A password field submits to `{action}` with GET, which can place credentials in URLs, logs, browser history, and referrer headers.",
                    "Submit credential forms with POST over HTTPS and never encode passwords or one-time codes in URLs.",
                    "URLs are copied into browser history, reverse-proxy logs, analytics, and sometimes outbound referrers.",
                ))
            elif page_url and _origin(action) != _origin(page_url):
                findings.append(_finding(
                    page_path,
                    "Password form posts to a different origin",
                    "HIGH",
                    f"A password field on `{page_url}` posts to `{action}`. This is an explicit cross-origin credential handoff that needs review.",
                    "Keep first-party authentication form actions on the same HTTPS origin, or document and tightly control the identity-provider handoff.",
                    "A changed third-party endpoint or integration can receive credentials entered into a trusted-looking first-party page.",
                ))

    findings.extend(_aggregate_finding(
        weak_csp_pages,
        "Content-Security-Policy permits high-risk script behavior",
        "MEDIUM",
        "Observed CSP values include `unsafe-inline`, `unsafe-eval`, or a wildcard source, which weakens the containment CSP is expected to provide.",
        "Remove unsafe script directives, use nonces or hashes for required inline code, and replace wildcard sources with explicit origins.",
        "A permissive CSP makes a markup-injection or compromised third-party-script incident more damaging.",
    ))
    findings.extend(_aggregate_finding(
        mixed_resource_pages,
        "HTTPS page references active content over HTTP",
        "HIGH",
        "An HTTPS page references a script or stylesheet using HTTP, allowing a network attacker to alter active browser content in transit.",
        "Serve every active resource from HTTPS and enforce it with CSP `upgrade-insecure-requests` after remediation.",
        "Scripts and styles are executable browser supply-chain inputs; HTTP delivery permits in-transit modification.",
    ))
    findings.extend(_aggregate_finding(
        sri_pages,
        "Third-party script lacks Subresource Integrity",
        "LOW",
        "A third-party script was loaded without an integrity hash. This is not a vulnerability by itself, but it increases reliance on the third party's delivery path.",
        "For versioned static third-party scripts, add `integrity` and `crossorigin=anonymous`, or self-host reviewed assets.",
        "If a third-party script delivery path is compromised, a pinned integrity hash can prevent the altered payload from executing.",
    ))
    findings.extend(_aggregate_finding(
        blank_target_pages,
        "External-window links lack noopener",
        "LOW",
        "Observed links use `target=_blank` without `rel=noopener`, allowing a newly opened page to retain a reference to the opener in some browsers.",
        "Add `rel=noopener noreferrer` to external links opened in a new tab.",
        "A malicious destination can attempt to navigate the original tab to a convincing phishing page.",
    ))
    return findings


def _aggregate_finding(
    pages: list[str], title: str, severity: str, description: str, remediation: str, explanation: str
) -> list[SecretFinding]:
    if not pages:
        return []
    examples = ", ".join(pages[:3])
    return [_finding(
        "_archaeologist/site-profile.json",
        f"{title} ({len(pages)} captured pages)",
        severity,
        f"{description} Affected observed pages: {examples}.",
        remediation,
        explanation,
    )]


def _finding(path: str, title: str, severity: str, description: str, remediation: str, explanation: str) -> SecretFinding:
    return SecretFinding(
        path=path,
        title=title,
        description=description,
        severity=severity,
        category="SECURITY",
        start_line=1,
        end_line=1,
        risk_explanation=explanation,
        remediation=remediation,
    )


def _origin(value: str) -> str:
    parsed = urlparse(value)
    return f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""


def _dedupe_edges(edges: list[ExtractedEdge]) -> list[ExtractedEdge]:
    unique: dict[tuple[str, str, str], ExtractedEdge] = {}
    for edge in edges:
        unique[(edge.source_ref, edge.target_ref, edge.edge_type)] = edge
    return list(unique.values())
