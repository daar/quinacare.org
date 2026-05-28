#!/usr/bin/env python3
"""
check-patterns.py
=================

Scan the repository for content / code patterns that an LLM can review and
suggest fixes for, and emit the findings as machine-readable JSON.

This script is intentionally dependency-free (stdlib only) so it runs in
CI, in a pre-commit hook, or from an ad-hoc terminal without setup.

Why a pattern scanner?
----------------------
Some anti-patterns aren't real lint errors — they're "this would be nicer
as the new component we just built." Examples:

    * Three or more {% image %} tags stacked in a row in an .mdoc page
      should be a {% gallery %} instead.

Adding a pattern
----------------
Subclass ``Pattern`` and decorate it with ``@register``. The class needs:

    id           : kebab-case identifier (also the JSON key)
    severity     : "error" | "warning" | "info"
    description  : one-line human description (also goes in the JSON)
    file_globs   : list of glob patterns the pattern applies to
    scan(path, text) -> Iterable[Finding]

A ``Finding`` is a small dataclass (file, start_line, end_line, message
and an optional ``meta`` dict for pattern-specific extra fields).

Run
---
    python scripts/check-patterns.py                # scans src/, prints JSON
    python scripts/check-patterns.py --paths foo bar
    python scripts/check-patterns.py --pattern gallery-stacked-images
    python scripts/check-patterns.py --pretty      # 2-space indented JSON
    python scripts/check-patterns.py --exit-code   # exit 1 if errors found
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable, List, Type


# ---------------------------------------------------------------------------
# Framework
# ---------------------------------------------------------------------------


@dataclass
class Finding:
    file: str
    start_line: int
    end_line: int
    message: str
    meta: dict = field(default_factory=dict)


class Pattern:
    """Base class for a pattern. Subclasses must define the class attributes
    and ``scan``. Use the @register decorator below to add them to the run."""

    id: str = ""
    severity: str = "warning"
    description: str = ""
    file_globs: tuple[str, ...] = ()

    def scan(self, path: Path, text: str) -> Iterable[Finding]:
        raise NotImplementedError


PATTERNS: list[Type[Pattern]] = []


def register(cls: Type[Pattern]) -> Type[Pattern]:
    PATTERNS.append(cls)
    return cls


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------


@register
class StackedImagesShouldBeGallery(Pattern):
    """Three or more `{% image ... /%}` tags appearing very close together
    in an .mdoc page — should be wrapped in `{% gallery %}` with
    `{% gallery-image %}` children.

    "Very close" = at most one blank line between consecutive images. Any
    real text content between two images breaks the run.
    """

    id = "gallery-stacked-images"
    severity = "error"
    description = (
        "Three or more {% image %} tags stacked together — replace with "
        "the {% gallery %} component."
    )
    file_globs = ("src/content/**/*.mdoc",)

    # Match a markdoc image tag on its own line. We don't care about the
    # attributes' content, only that the line is essentially "{% image ... /%}".
    IMAGE_RE = re.compile(r"^\s*\{%\s*image\b[^%]*\/%}\s*$")

    # How many blank lines we'll skip between two images before deciding
    # the run has ended.
    MAX_BLANK_GAP = 1

    def scan(self, path: Path, text: str) -> Iterable[Finding]:
        lines = text.splitlines()
        run: list[int] = []
        blank_gap = 0

        def flush() -> Finding | None:
            if len(run) >= 3:
                f = Finding(
                    file=str(path),
                    start_line=run[0] + 1,  # 1-indexed for editors
                    end_line=run[-1] + 1,
                    message=(
                        f"{len(run)} {{% image %}} tags appear within a few "
                        "lines of each other — convert this block to a "
                        "{% gallery %}…{% /gallery %} with one "
                        "{% gallery-image %} per source."
                    ),
                    meta={
                        "image_count": len(run),
                        "tag_line_numbers": [n + 1 for n in run],
                    },
                )
                return f
            return None

        for idx, line in enumerate(lines):
            if self.IMAGE_RE.match(line):
                if run and (idx - run[-1] - 1) > self.MAX_BLANK_GAP:
                    finding = flush()
                    if finding:
                        yield finding
                    run = []
                run.append(idx)
                blank_gap = 0
            elif line.strip() == "":
                blank_gap += 1
                # blank lines don't break the run on their own; the gap
                # check at the next image decides.
            else:
                # Non-blank, non-image line — end of run.
                finding = flush()
                if finding:
                    yield finding
                run = []
                blank_gap = 0

        finding = flush()
        if finding:
            yield finding


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def gather_files(root: Path, globs: Iterable[str]) -> list[Path]:
    """Resolve a list of glob patterns against root, deduped + sorted."""
    out: set[Path] = set()
    for g in globs:
        # Path.glob doesn't accept absolute patterns; strip a leading slash
        # so callers can pass either form.
        out.update(root.glob(g.lstrip("/")))
    return sorted(out)


def run(
    root: Path,
    only_patterns: set[str] | None,
    paths_filter: list[Path] | None,
) -> dict:
    pattern_blocks: list[dict] = []
    total_findings = 0
    files_scanned: set[Path] = set()

    for cls in PATTERNS:
        if only_patterns is not None and cls.id not in only_patterns:
            continue
        p = cls()
        files = gather_files(root, p.file_globs)
        if paths_filter:
            wanted = [pp.resolve() for pp in paths_filter]
            files = [
                f
                for f in files
                if any(str(f.resolve()).startswith(str(w)) for w in wanted)
            ]
        findings: list[Finding] = []
        for f in files:
            files_scanned.add(f)
            try:
                text = f.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as exc:
                print(f"warning: could not read {f}: {exc}", file=sys.stderr)
                continue
            findings.extend(p.scan(f, text))

        pattern_blocks.append(
            {
                "id": p.id,
                "severity": p.severity,
                "description": p.description,
                "file_globs": list(p.file_globs),
                "findings_count": len(findings),
                "findings": [asdict(x) for x in findings],
            }
        )
        total_findings += len(findings)

    return {
        "patterns": pattern_blocks,
        "summary": {
            "patterns_checked": len(pattern_blocks),
            "files_scanned": len(files_scanned),
            "total_findings": total_findings,
            "error_count": sum(
                pb["findings_count"]
                for pb in pattern_blocks
                if pb["severity"] == "error"
            ),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Scan the repository for review-worthy content / code patterns "
            "and emit findings as JSON."
        ),
    )
    parser.add_argument(
        "--paths",
        nargs="*",
        type=Path,
        help="Optional list of paths to limit the scan to (default: whole repo).",
    )
    parser.add_argument(
        "--pattern",
        action="append",
        default=[],
        help="Only run the named pattern(s); can be passed multiple times.",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print the JSON output.",
    )
    parser.add_argument(
        "--exit-code",
        action="store_true",
        help=(
            "Exit with status 1 if at least one pattern of severity=error "
            "produced a finding. Useful in CI."
        ),
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Repo root (default: parent of scripts/).",
    )

    args = parser.parse_args(argv)
    only = set(args.pattern) if args.pattern else None

    report = run(args.root, only, args.paths)
    json.dump(
        report,
        sys.stdout,
        indent=2 if args.pretty else None,
        ensure_ascii=False,
    )
    sys.stdout.write("\n")

    if args.exit_code and report["summary"]["error_count"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
