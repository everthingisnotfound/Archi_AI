from pathlib import Path

from app.analysis.secret_scanner import scan_repository_for_secrets


def test_secret_scanner_detects_hardcoded_secret(tmp_path: Path) -> None:
    repository_root = tmp_path / "repo"
    repository_root.mkdir()
    (repository_root / "config.py").write_text('API_KEY = "super-secret-value-123456"\n', encoding="utf-8")

    findings = scan_repository_for_secrets(repository_root, ["config.py"])

    assert len(findings) >= 1
    assert findings[0].category == "SECURITY"
    assert findings[0].risk_explanation
    assert findings[0].remediation
