#!/usr/bin/env python3
"""Static-site validation gate for TermLens.

Hard failures (block merge):
  1. Every local `src`/`href` in shipped HTML resolves to a real file.
  2. `_headers` preserves the `tools=(self)` Permissions-Policy (WebMCP requirement).

Warnings (non-blocking, surfaced to the agent in the CI comment):
  3. Site does not reference the live design token `--color-gold` (Collector's Vault).
     brand.md is the source of truth; design.md (monochrome) is stale.
  4. Stale-monochrome markers from the superseded design.md (pure-black canvas / Inter).
  5. OG meta placeholders still present (open pre-submission items).

Exit code 0 = valid, 1 = invalid. Prints a human/agent-readable report on top.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", ".wrangler", ".brand-preview", "node_modules"}

URL_PREFIX = ("http://", "https://", "//", "mailto:", "data:", "javascript:", "tel:")
ATTR_RE = re.compile(r'\b(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)

errors: list[str] = []
warnings: list[str] = []


def is_external(ref: str) -> bool:
    return ref.startswith(URL_PREFIX) or ref.startswith("#") or ref.strip() == ""


def html_files() -> list[Path]:
    out: list[Path] = []
    for p in ROOT.rglob("*.html"):
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts):
            continue
        out.append(p)
    return out


def check_assets() -> None:
    for html in html_files():
        text = html.read_text(encoding="utf-8", errors="replace")
        for ref in ATTR_RE.findall(text):
            if is_external(ref):
                continue
            target = (html.parent / ref).resolve()
            if not target.exists():
                errors.append(f"{html.relative_to(ROOT)}: broken local ref `{ref}`")


def check_headers() -> None:
    h = ROOT / "_headers"
    if not h.exists():
        errors.append("Missing `_headers` (WebMCP Permissions-Policy)")
        return
    body = h.read_text(encoding="utf-8", errors="replace")
    if "tools=(self)" not in body:
        errors.append("`_headers` must keep `tools=(self)` Permissions-Policy")


def check_design_source_of_truth() -> None:
    hay = ""
    for p in [ROOT / "index.html", ROOT / "styles.css", *html_files()]:
        if p.exists():
            hay += p.read_text(encoding="utf-8", errors="replace")
    if "--color-gold" not in hay:
        warnings.append(
            "Site does not reference `--color-gold`. brand.md (Collector's Vault) is the "
            "source of truth; design.md (monochrome MekaVerse, no-shadow) is STALE."
        )
    stale = re.findall(r"#000000|'Inter'|\bMekaVerse\b", hay)
    if stale:
        warnings.append(
            f"Stale monochrome design markers detected ({','.join(sorted(set(stale)))}). "
            "Follow the Collector's Vault palette in brand.md, not design.md."
        )


def check_og_placeholders() -> None:
    for p in html_files():
        text = p.read_text(encoding="utf-8", errors="replace")
        ph = re.findall(
            r'\b(?:og:url|og:image|og:title|og:description)\b[^>]*content=["\']([^"\']*)["\']',
            text,
            re.IGNORECASE,
        )
        for val in ph:
            if re.search(r"example\.com|YOUR_|CHANGE_ME|<|undefined|placeholder", val, re.IGNORECASE):
                warnings.append(f"{p.name}: OG meta placeholder `{val}` (open item)")


def main() -> int:
    check_assets()
    check_headers()
    check_design_source_of_truth()
    check_og_placeholders()

    line = "=" * 60
    print(line)
    print("TermLens validation gate")
    print(line)
    if errors:
        print("FAIL:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("OK: no broken assets, `_headers` intact.")
    if warnings:
        print("WARNINGS (call agent):")
        for w in warnings:
            print(f"  - {w}")
    print(line)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
