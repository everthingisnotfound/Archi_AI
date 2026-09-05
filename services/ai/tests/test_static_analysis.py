from __future__ import annotations

from pathlib import Path

from app.analysis.models import SnapshotFileDescriptor, StaticAnalysisRequest
from app.analysis.static_analyzer import analyze_snapshot


def test_static_analysis_extracts_symbols_and_imports(tmp_path: Path) -> None:
    snapshot_id = "snapshot-1"
    repository_root = tmp_path / "snapshots" / snapshot_id / "repo"
    repository_root.mkdir(parents=True)
    (repository_root / "package.json").write_text('{"dependencies":{"react":"^19.0.0"}}', encoding="utf-8")
    (repository_root / "src").mkdir()
    (repository_root / "src" / "index.ts").write_text(
        "import { useState } from 'react';\nexport function App() { return useState(0); }\n",
        encoding="utf-8",
    )

    request = StaticAnalysisRequest(
        organization_id="org-1",
        repository_id="repo-1",
        snapshot_id=snapshot_id,
        files=[
            SnapshotFileDescriptor(path="package.json", size_bytes=32, language="json"),
            SnapshotFileDescriptor(path="src/index.ts", size_bytes=80, language="typescript"),
        ],
    )

    result = analyze_snapshot(str(tmp_path), request)

    assert result.metrics["symbol_count"] >= 1.0
    assert any(edge.edge_type == "package_dependency" for edge in result.edges)
    assert any(edge.edge_type == "import" for edge in result.edges)
    assert len(result.chunks) >= 1
    assert len(result.graph_json.get("nodes", [])) >= 1


def test_static_analysis_deduplicates_identical_chunks(tmp_path: Path) -> None:
    snapshot_id = "snapshot-dedupe"
    repository_root = tmp_path / "snapshots" / snapshot_id / "repo"
    repository_root.mkdir(parents=True)
    duplicate_text = '{\n  "name": "shared-stub"\n}\n'
    (repository_root / "a.json").write_text(duplicate_text, encoding="utf-8")
    (repository_root / "b.json").write_text(duplicate_text, encoding="utf-8")

    request = StaticAnalysisRequest(
        organization_id="org-1",
        repository_id="repo-1",
        snapshot_id=snapshot_id,
        files=[
            SnapshotFileDescriptor(path="a.json", size_bytes=len(duplicate_text), language="json"),
            SnapshotFileDescriptor(path="b.json", size_bytes=len(duplicate_text), language="json"),
        ],
    )

    result = analyze_snapshot(str(tmp_path), request)

    chunk_keys = {(chunk.path, chunk.start_line, chunk.end_line, chunk.content_hash) for chunk in result.chunks}
    assert len(chunk_keys) == len(result.chunks)


def test_static_analysis_extracts_php_imports_and_composer_deps(tmp_path: Path) -> None:
    snapshot_id = "snapshot-php"
    repository_root = tmp_path / "snapshots" / snapshot_id / "repo"
    repository_root.mkdir(parents=True)
    (repository_root / "composer.json").write_text(
        '{"require":{"laravel/framework":"^11.0"}}',
        encoding="utf-8",
    )
    (repository_root / "index.php").write_text(
        "<?php\nrequire_once 'vendor/autoload.php';\nuse App\\Http\\Kernel;\n",
        encoding="utf-8",
    )

    request = StaticAnalysisRequest(
        organization_id="org-1",
        repository_id="repo-1",
        snapshot_id=snapshot_id,
        files=[
            SnapshotFileDescriptor(path="composer.json", size_bytes=48, language="json"),
            SnapshotFileDescriptor(path="index.php", size_bytes=72, language="php"),
        ],
    )

    result = analyze_snapshot(str(tmp_path), request)

    assert any(edge.edge_type == "package_dependency" for edge in result.edges)
    assert any(edge.edge_type == "import" and edge.source_ref == "index.php" for edge in result.edges)
    assert len(result.graph_json.get("edges", [])) >= 1
