from app.analysis.site_analyzer import extract_site_edges, extract_site_findings


def test_extract_site_edges_and_findings() -> None:
    profile = {
        "startUrl": "https://example.com/",
        "pages": [{"path": "pages/index.html", "url": "https://example.com/"}],
        "assets": [{"kind": "script", "path": "assets/script-abc.js"}],
        "thirdParties": ["cdn.example.net"],
        "securityHeaders": {"x-content-type-options": "nosniff"},
        "cookies": [{"name": "sid", "secure": False, "httpOnly": False}],
    }

    edges = extract_site_edges(profile)
    assert any(edge.edge_type == "third_party" for edge in edges)
    assert any(edge.edge_type == "script" for edge in edges)

    findings = extract_site_findings(profile)
    titles = {finding.title for finding in findings}
    assert "Missing HSTS" in titles
    assert any("sid" in title for title in titles)
