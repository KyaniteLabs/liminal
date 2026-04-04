#!/usr/bin/env python3
"""Convert archaeology data files into a SQLite database for Datasette exploration.

Project-agnostic: point --project-root at any repo with narrative/data/ and
this script auto-detects CSV and JSON files, flattens nested structures into
separate tables, creates indexes, and enables FTS5 for full-text search.

Requires: sqlite-utils CLI on PATH.
"""

import argparse
import csv
import json
import subprocess
import sys
import tempfile
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str, verbose: bool = False) -> None:
    if verbose:
        print(f"  {msg}")


def run_su(args: list[str], verbose: bool = False) -> subprocess.CompletedProcess:
    """Call sqlite-utils CLI and return the result."""
    cmd = ["sqlite-utils"] + args
    if verbose:
        print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  WARNING: sqlite-utils error: {result.stderr.strip()}", file=sys.stderr)
    return result


def load_json(path: Path, verbose: bool = False) -> dict | list | None:
    if not path.exists():
        log(f"SKIP {path.name} (not found)", verbose)
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        log(f"LOADED {path.name}", verbose)
        return data
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  WARNING: Failed to read {path}: {exc}", file=sys.stderr)
        return None


def import_csv(db: Path, table: str, csv_path: Path, verbose: bool = False) -> int:
    if not csv_path.exists():
        log(f"SKIP {csv_path.name} (not found)", verbose)
        return 0
    run_su(["insert", str(db), table, str(csv_path), "--csv"], verbose)
    with open(csv_path, encoding="utf-8") as f:
        count = sum(1 for _ in csv.reader(f)) - 1
    log(f"IMPORTED {csv_path.name} -> {table} ({count} rows)", verbose)
    return max(count, 0)


def write_temp(records: list[dict]) -> Path:
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w", encoding="utf-8")
    json.dump(records, tmp, default=str)
    tmp.close()
    return Path(tmp.name)


def import_list(db: Path, table: str, records: list[dict], verbose: bool = False) -> int:
    if not records:
        log(f"SKIP {table} (empty)", verbose)
        return 0
    tmp = write_temp(records)
    try:
        run_su(["insert", str(db), table, str(tmp)], verbose)
        log(f"IMPORTED {table} ({len(records)} rows)", verbose)
    finally:
        tmp.unlink(missing_ok=True)
    return len(records)


def extract_nested(data: dict, key: str) -> list[dict] | None:
    value = data.get(key)
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [{"_key": k, **(v if isinstance(v, dict) else {"value": v})} for k, v in value.items()]
    return None


def flatten_dict(data: dict, prefix: str = "") -> dict:
    flat: dict = {}
    for k, v in data.items():
        key = f"{prefix}_{k}" if prefix else k
        flat[key] = json.dumps(v, default=str) if isinstance(v, (dict, list)) else v
    return flat


def _flat(records: list) -> list[dict]:
    return [flatten_dict(r) if isinstance(r, dict) else {"value": r} for r in records]


def _import_mapping(db: Path, data: dict, mapping: dict[str, str], verbose: bool = False) -> int:
    total = 0
    for key, table in mapping.items():
        records = extract_nested(data, key)
        if records:
            total += import_list(db, table, _flat(records), verbose)
    return total


# ---------------------------------------------------------------------------
# Specialized importers
# ---------------------------------------------------------------------------

def import_commit_eras(db: Path, data_dir: Path, verbose: bool = False) -> int:
    data = load_json(data_dir / "commit-eras.json", verbose)
    if data is None:
        return 0
    total = import_list(db, "eras", _flat(data.get("eras", [])), verbose)
    meta_keys = [k for k in data if k != "eras"]
    if meta_keys:
        meta = [{"key": k, "value": json.dumps(data[k], default=str)} for k in meta_keys]
        total += import_list(db, "project_meta", meta, verbose)
    return total


def import_derived_patterns(db: Path, data_dir: Path, verbose: bool = False) -> int:
    data = load_json(data_dir / "derived-patterns.json", verbose)
    if data is None:
        return 0
    total = 0
    named = {"frustration_to_automation_latency": "frustration_patterns", "co_authorship_gap_analysis": "co_authorship_gaps"}
    for key, table in named.items():
        section = data.get(key)
        if section is None:
            continue
        if isinstance(section, dict):
            for sub_val in section.values():
                if isinstance(sub_val, list) and sub_val:
                    total += import_list(db, table, _flat(sub_val), verbose)
                    break
        elif isinstance(section, list):
            total += import_list(db, table, section, verbose)
    for key, val in data.items():
        if key not in named and isinstance(val, list) and val:
            total += import_list(db, key.replace("-", "_")[:60], val, verbose)
    return total


def import_telemetry_sessions(db: Path, data_dir: Path, verbose: bool = False) -> int:
    data = load_json(data_dir / "telemetry-sessions.json", verbose)
    if data is None:
        return 0
    total = import_list(db, "sessions_per_era", data.get("sessions_per_era", []), verbose)
    for key in ("frustration_analysis", "intent_analysis"):
        section = data.get(key)
        if isinstance(section, dict):
            rows = [flatten_dict({k: v}) for k, v in section.items()]
            total += import_list(db, key, rows, verbose)
        elif isinstance(section, list):
            total += import_list(db, key, section, verbose)
    return total


def import_audit_files(db: Path, data_dir: Path, verbose: bool = False) -> int:
    total = 0
    for path in sorted(data_dir.glob("audit-*.json")):
        table = path.stem.replace("-", "_")
        data = load_json(path, verbose)
        if data is None:
            continue
        if isinstance(data, list):
            total += import_list(db, table, data, verbose)
        elif isinstance(data, dict):
            rows = []
            for k, v in data.items():
                if isinstance(v, list) and v:
                    rows.extend(_flat(v))
                else:
                    rows.append({"key": k, "value": json.dumps(v, default=str)})
            total += import_list(db, table, rows, verbose)
    return total


# ---------------------------------------------------------------------------
# Registry: (filename, key->table mapping)
# ---------------------------------------------------------------------------

MAPPED_IMPORTS: list[tuple[str, dict[str, str]]] = [
    ("cross-repo-analysis.json", {"monthly_velocity": "monthly_velocity", "top_repos": "repos",
        "hourly_pattern": "hourly_activity", "day_of_week": "weekly_activity", "language_evolution": "languages"}),
    ("model-adoption-analysis.json", {"model_releases": "model_releases", "first_mentions": "model_mentions",
        "adoption_lag": "adoption_lag", "timeline": "model_timeline"}),
    ("lunar-phases.json", {"daily_phases": "lunar_phases", "key_events": "lunar_events"}),
    ("youtube-ai-correlation.json", {"monthly_summary": "yt_monthly",
        "key_correlations": "yt_correlations", "creator_influence_map": "yt_creator_influence"}),
    ("youtube-topic-classification.json", {"classified_videos": "yt_classified", "categories": "yt_categories"}),
    ("telemetry-git.json", {"commits_by_hour": "commits_by_hour", "commits_by_day_of_week": "commits_by_weekday",
        "author_breakdown": "authors", "co_authored_by": "co_authors"}),
    ("telemetry-agents.json", {"agent_comparison": "agent_comparison", "co_authorship_patterns": "co_authorship_patterns"}),
    ("telemetry-codebase.json", {"file_growth_timeline": "file_growth",
        "language_evolution": "codebase_languages", "module_emergence_timeline": "module_emergence"}),
    ("telemetry-cross-repo.json", {"timeline": "cross_repo_timeline", "concurrent_repos": "concurrent_repos"}),
    ("telemetry-github-full.json", {"repos": "github_repos", "activity_heatmap": "github_heatmap"}),
    ("telemetry-repo-depth.json", {"repos": "repo_depth", "domain_map": "domain_map", "liminal_feeder_repos": "feeder_repos"}),
]


# ---------------------------------------------------------------------------
# Indexes & FTS
# ---------------------------------------------------------------------------

def table_exists(db: Path, table: str) -> bool:
    result = run_su(["query", str(db), f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"])
    if result.returncode == 0 and result.stdout.strip():
        try:
            rows = json.loads(result.stdout)
            return len(rows) > 0
        except json.JSONDecodeError:
            pass
    return False


def create_indexes(db: Path, verbose: bool = False) -> None:
    indexes = [
        ("commits", ["date", "author", "repo"]),
        ("eras", ["name", "frustration_category", "dominant_intent"]),
        ("sessions", ["timestamp", "session_id"]),
        ("yt_classified", ["category"]),
        ("lunar_phases", ["date"]),
    ]
    for table, columns in indexes:
        if not table_exists(db, table):
            log(f"SKIP indexes on {table} (table not found)", verbose)
            continue
        for col in columns:
            run_su(["create-index", str(db), table, col, "--name", f"idx_{table}_{col}", "--if-not-exists"], verbose)


def create_fts(db: Path, verbose: bool = False) -> None:
    for table, columns in [("commits", ["message"]), ("sessions", ["messages"]), ("eras", ["description", "narrative_arc"])]:
        if not table_exists(db, table):
            log(f"SKIP FTS on {table} (table not found)", verbose)
            continue
        fts_table = f"{table}_fts"
        if table_exists(db, fts_table):
            log(f"SKIP FTS on {table} (already exists)", verbose)
            continue
        run_su(["enable-fts", str(db), table] + columns + ["--fts4", "--create-triggers"], verbose)


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def print_summary(db: Path, verbose: bool = False) -> None:
    result = run_su(["tables", str(db), "--counts"], verbose)
    if result.returncode == 0 and result.stdout.strip():
        print("\nTables (with row counts):")
        for line in result.stdout.strip().splitlines():
            print(f"  {line}")
    idx = run_su(["indexes", str(db)], verbose)
    if idx.returncode == 0 and idx.stdout.strip():
        print("\nIndexes:")
        for line in idx.stdout.strip().splitlines():
            print(f"  {line}")
    fts = run_su(["query", str(db), "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts%'"], verbose)
    if fts.returncode == 0 and fts.stdout.strip():
        try:
            tables = json.loads(fts.stdout)
            if tables:
                print("\nFTS tables:")
                for t in tables:
                    print(f"  {t.get('name', t)}")
        except json.JSONDecodeError:
            pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Build archaeology SQLite database from narrative data files")
    parser.add_argument("--project-root", default=".", help="Path to project root (default: .)")
    parser.add_argument("--output", default="narrative/data/archaeology.db", help="Output DB path")
    parser.add_argument("--verbose", action="store_true", help="Print detailed progress")
    args = parser.parse_args()

    root = Path(args.project_root).resolve()
    db_path = root / args.output
    data_dir = root / "narrative" / "data"

    if not data_dir.exists():
        print(f"ERROR: Data directory not found: {data_dir}", file=sys.stderr)
        sys.exit(1)

    if db_path.exists():
        db_path.unlink()
        log(f"Deleted existing DB: {db_path}", args.verbose)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.touch()

    print(f"Building archaeology DB: {db_path}")
    print(f"Data directory: {data_dir}")

    # CSV
    print("\n--- CSV ---")
    import_csv(db_path, "commits", data_dir / "github-commits.csv", args.verbose)

    # Flat JSON arrays
    print("\n--- Flat JSON ---")
    for filename, table in [("human-messages.json", "sessions"), ("youtube-search-history.json", "youtube_searches")]:
        data = load_json(data_dir / filename, args.verbose)
        if isinstance(data, list):
            import_list(db_path, table, data, args.verbose)

    # Specialized imports
    print("\n--- Nested JSON ---")
    import_commit_eras(db_path, data_dir, args.verbose)
    import_derived_patterns(db_path, data_dir, args.verbose)
    import_telemetry_sessions(db_path, data_dir, args.verbose)

    # youtube-creators.json
    data = load_json(data_dir / "youtube-creators.json", args.verbose)
    if isinstance(data, dict):
        import_list(db_path, "yt_creators", data.get("creators", []), args.verbose)

    # Registry-driven imports
    for filename, mapping in MAPPED_IMPORTS:
        data = load_json(data_dir / filename, args.verbose)
        if isinstance(data, dict):
            _import_mapping(db_path, data, mapping, args.verbose)

    # Audit files
    print("\n--- Audit files ---")
    import_audit_files(db_path, data_dir, args.verbose)

    # Indexes & FTS
    print("\n--- Indexes ---")
    create_indexes(db_path, args.verbose)
    print("\n--- Full-text search ---")
    create_fts(db_path, args.verbose)

    print_summary(db_path, args.verbose)
    print(f"\nDone. Database: {db_path}")


if __name__ == "__main__":
    main()
