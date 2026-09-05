from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

import networkx as nx
from tree_sitter import Node

from app.analysis.site_analyzer import extract_site_edges, load_site_profile
from app.analysis.models import (
    ExtractedChunk,
    ExtractedEdge,
    ExtractedSymbol,
    StaticAnalysisRequest,
    StaticAnalysisResponse,
)

MAX_READ_BYTES = 10_485_760
MAX_CHUNK_LINES = 240
BINARY_EXTENSIONS = {
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
}

LANGUAGE_PARSER_KEYS: dict[str, str] = {
    "python": "python",
    "javascript": "javascript",
    "typescript": "typescript",
    "php": "php",
}

IMPORT_PATTERN = re.compile(
    r"^\s*(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?['\"]([^'\"]+)['\"]",
    re.MULTILINE,
)
PYTHON_IMPORT_PATTERN = re.compile(
    r"^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))",
    re.MULTILINE,
)
PHP_INCLUDE_PATTERN = re.compile(
    r"(?:require|include)(?:_once)?\s*(?:\(\s*)?['\"]([^'\"]+)['\"]",
    re.IGNORECASE,
)
PHP_USE_PATTERN = re.compile(
    r"^\s*use\s+([A-Za-z0-9_\\]+)",
    re.MULTILINE,
)

SYMBOL_NODE_TYPES: dict[str, tuple[str, ...]] = {
    "python": ("function_definition", "class_definition"),
    "javascript": ("function_declaration", "class_declaration", "method_definition"),
    "typescript": (
        "function_declaration",
        "class_declaration",
        "method_definition",
        "interface_declaration",
        "type_alias_declaration",
    ),
    "php": ("function_definition", "class_declaration", "method_declaration"),
}


@dataclass(frozen=True)
class _ParserBundle:
    language_key: str
    parser: object


def analyze_snapshot(workspace_root: str, request: StaticAnalysisRequest) -> StaticAnalysisResponse:
    repository_root = Path(workspace_root) / "snapshots" / request.snapshot_id / "repo"
    symbols: list[ExtractedSymbol] = []
    edges: list[ExtractedEdge] = []
    chunks: list[ExtractedChunk] = []
    graph = nx.DiGraph()

    for file_descriptor in request.files:
        graph.add_node(file_descriptor.path, label=Path(file_descriptor.path).name)

    edges.extend(parse_package_dependencies(repository_root))
    edges.extend(parse_composer_dependencies(repository_root))
    site_profile = load_site_profile(repository_root)
    if site_profile is not None:
        edges.extend(extract_site_edges(site_profile))

    for file_descriptor in request.files:
        file_path = repository_root / file_descriptor.path
        if not file_path.is_file() or file_descriptor.size_bytes > MAX_READ_BYTES:
            continue
        if Path(file_descriptor.path).suffix.lower() in BINARY_EXTENSIONS:
            continue

        source_text = file_path.read_text(encoding="utf-8", errors="replace")
        if "\x00" in source_text:
            continue
        source_bytes = source_text.encode("utf-8")
        file_symbols = extract_symbols(file_descriptor.path, file_descriptor.language, source_bytes)
        symbols.extend(file_symbols)
        edges.extend(extract_import_edges(file_descriptor.path, file_descriptor.language, source_text))

        for file_symbol in file_symbols:
            chunk_text = extract_lines(source_text, file_symbol.start_line, file_symbol.end_line)
            chunks.append(
                ExtractedChunk(
                    path=file_symbol.path,
                    start_line=file_symbol.start_line,
                    end_line=file_symbol.end_line,
                    text=chunk_text,
                    content_hash=hash_text(chunk_text),
                    symbol_name=file_symbol.name,
                )
            )

        if not file_symbols and source_text.strip():
            end_line = min(len(source_text.splitlines()), MAX_CHUNK_LINES)
            chunk_text = extract_lines(source_text, 1, end_line)
            chunks.append(
                ExtractedChunk(
                    path=file_descriptor.path,
                    start_line=1,
                    end_line=end_line,
                    text=chunk_text,
                    content_hash=hash_text(chunk_text),
                )
            )

    chunks = dedupe_chunks(chunks)

    graph_edges = [
        edge
        for edge in edges
        if edge.edge_type
        in {"import", "package_dependency", "page", "script", "stylesheet", "third_party"}
    ]
    for edge in graph_edges:
        graph.add_edge(edge.source_ref, edge.target_ref, edge_type=edge.edge_type)

    import_edges = [edge for edge in edges if edge.edge_type == "import"]
    package_edges = [edge for edge in edges if edge.edge_type == "package_dependency"]
    metrics = {
        "analyzed_file_count": float(len(request.files)),
        "import_edge_count": float(len(import_edges)),
        "package_dependency_count": float(len(package_edges)),
        "symbol_count": float(len(symbols)),
    }

    return StaticAnalysisResponse(
        symbols=symbols,
        edges=edges,
        chunks=chunks,
        graph_json={
            "edges": [
                {"source": source, "target": target, "type": data.get("edge_type", "import")}
                for source, target, data in graph.edges(data=True)
            ],
            "nodes": [{"id": node_id, "label": data.get("label", node_id)} for node_id, data in graph.nodes(data=True)],
        },
        metrics=metrics,
    )


def parse_package_dependencies(repository_root: Path) -> list[ExtractedEdge]:
    package_json_path = repository_root / "package.json"
    if not package_json_path.is_file():
        return []

    try:
        package_data = json.loads(package_json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    dependency_names: set[str] = set()
    for section in ("dependencies", "devDependencies", "peerDependencies"):
        section_values = package_data.get(section, {})
        if isinstance(section_values, dict):
            dependency_names.update(section_values.keys())

    return [
        ExtractedEdge(source_ref="package.json", target_ref=name, edge_type="package_dependency")
        for name in sorted(dependency_names)
    ]


def parse_composer_dependencies(repository_root: Path) -> list[ExtractedEdge]:
    composer_path = repository_root / "composer.json"
    if not composer_path.is_file():
        return []

    try:
        composer_data = json.loads(composer_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    dependency_names: set[str] = set()
    for section in ("require", "require-dev"):
        section_values = composer_data.get(section, {})
        if isinstance(section_values, dict):
            dependency_names.update(section_values.keys())

    return [
        ExtractedEdge(source_ref="composer.json", target_ref=name, edge_type="package_dependency")
        for name in sorted(dependency_names)
        if name != "php"
    ]


def extract_symbols(path: str, language: str | None, source_bytes: bytes) -> list[ExtractedSymbol]:
    parser_bundle = load_parser(language)
    if parser_bundle is None:
        return []

    tree = parser_bundle.parser.parse(source_bytes)
    root = tree.root_node
    symbol_types = SYMBOL_NODE_TYPES.get(parser_bundle.language_key, ())
    extracted: list[ExtractedSymbol] = []

    def walk(node: Node) -> None:
        if node.type in symbol_types:
            name = extract_symbol_name(node, source_bytes)
            if name:
                extracted.append(
                    ExtractedSymbol(
                        path=path,
                        name=name,
                        kind=node.type,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                    )
                )
        for child in node.children:
            walk(child)

    walk(root)
    return extracted


def extract_import_edges(path: str, language: str | None, source_text: str) -> list[ExtractedEdge]:
    targets: set[str] = set()

    if language in {"javascript", "typescript"}:
        targets.update(match.group(1) for match in IMPORT_PATTERN.finditer(source_text))
    elif language == "python":
        for match in PYTHON_IMPORT_PATTERN.finditer(source_text):
            module_name = match.group(1) or match.group(2)
            if module_name:
                targets.add(module_name)
    elif language == "php":
        targets.update(match.group(1) for match in PHP_INCLUDE_PATTERN.finditer(source_text))
        targets.update(match.group(1) for match in PHP_USE_PATTERN.finditer(source_text))

    return [
        ExtractedEdge(source_ref=path, target_ref=target, edge_type="import")
        for target in sorted(targets)
    ]


def load_parser(language: str | None) -> _ParserBundle | None:
    if language is None:
        return None

    parser_key = LANGUAGE_PARSER_KEYS.get(language)
    if parser_key is None:
        return None

    try:
        from tree_sitter_languages import get_parser

        parser = get_parser(parser_key)
        return _ParserBundle(language_key=language, parser=parser)
    except Exception:
        return None


def extract_symbol_name(node: Node, source_bytes: bytes) -> str | None:
    for child in node.children:
        if child.type == "name" and child.text is not None:
            return child.text.decode("utf-8", errors="replace")
        if child.type == "identifier" and child.text is not None:
            return child.text.decode("utf-8", errors="replace")
        if child.type == "property_identifier" and child.text is not None:
            return child.text.decode("utf-8", errors="replace")

    if node.text is not None:
        text = node.text.decode("utf-8", errors="replace")
        match = re.match(r"(?:async\s+)?(?:function|class|interface|type)\s+([A-Za-z0-9_]+)", text)
        if match:
            return match.group(1)

    return None


def extract_lines(source_text: str, start_line: int, end_line: int) -> str:
    lines = source_text.splitlines()
    selected = lines[max(start_line - 1, 0):end_line]
    return sanitize_text("\n".join(selected))


def sanitize_text(value: str) -> str:
    return value.replace("\x00", "")


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def dedupe_chunks(chunks: list[ExtractedChunk]) -> list[ExtractedChunk]:
    seen: set[tuple[str, int, int, str]] = set()
    deduped: list[ExtractedChunk] = []

    for chunk in chunks:
        key = (chunk.path, chunk.start_line, chunk.end_line, chunk.content_hash)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(chunk)

    return deduped
