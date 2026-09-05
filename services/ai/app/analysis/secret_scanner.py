from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

SECRET_PATTERNS: list[tuple[re.Pattern[str], str, str, str, str]] = [
    (
        re.compile(r"AKIA[0-9A-Z]{16}"),
        "Possible AWS access key",
        "HIGH",
        "A value matching the AWS access key ID format was found in source code.",
        "Rotate the exposed key in IAM, remove it from the repository, and load credentials from environment variables or a secrets manager.",
    ),
    (
        re.compile(r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]"),
        "Possible hardcoded credential",
        "HIGH",
        "A literal credential assignment was detected instead of loading secrets from a secure store.",
        "Move the value to environment variables or a secrets manager, rotate the exposed credential, and add the file pattern to secret scanning in CI.",
    ),
    (
        re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----"),
        "Private key material in source",
        "CRITICAL",
        "A PEM-encoded private key block was found in a tracked file. Anyone with repo access can impersonate your service or decrypt protected data.",
        "Revoke and replace the key immediately, store the replacement outside version control (vault, KMS, or deployment secrets), and use `.gitignore` plus pre-commit secret scanning to prevent recurrence.",
    ),
    (
        re.compile(r"(?i)eval\s*\("),
        "Use of eval()",
        "MEDIUM",
        "Dynamic code execution via `eval()` can enable injection if untrusted input reaches the expression.",
        "Replace `eval()` with explicit parsing/validation, or confine execution to a hardened sandbox with strict input controls.",
    ),
]


@dataclass(frozen=True)
class SecretFinding:
    path: str
    title: str
    description: str
    severity: str
    category: str
    start_line: int
    end_line: int
    risk_explanation: str
    remediation: str


BINARY_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".mp3",
    ".wasm",
    ".bin",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
}


def sanitize_text(value: str) -> str:
    return value.replace("\x00", "").replace("\u0000", "")


def scan_repository_for_secrets(repository_root: Path, relative_paths: list[str]) -> list[SecretFinding]:
    findings: list[SecretFinding] = []

    for relative_path in relative_paths:
        suffix = Path(relative_path).suffix.lower()
        if suffix in BINARY_SUFFIXES:
            continue

        file_path = repository_root / relative_path
        if not file_path.is_file():
            continue

        try:
            raw = file_path.read_bytes()[:2_000_000]
        except OSError:
            continue

        if b"\x00" in raw:
            continue

        content = raw.decode("utf-8", errors="replace")

        for line_number, line in enumerate(content.splitlines(), start=1):
            cleaned = sanitize_text(line.strip())[:240]
            if not cleaned:
                continue
            for pattern, title, severity, risk_explanation, remediation in SECRET_PATTERNS:
                if pattern.search(cleaned):
                    findings.append(
                        SecretFinding(
                            path=relative_path,
                            title=title,
                            description=cleaned,
                            severity=severity,
                            category="SECURITY",
                            start_line=line_number,
                            end_line=line_number,
                            risk_explanation=risk_explanation,
                            remediation=remediation,
                        )
                    )

    return findings
