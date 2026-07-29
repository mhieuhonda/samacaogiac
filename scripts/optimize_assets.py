#!/usr/bin/env python3
# ============================================================
# optimize_assets.py — Asset optimization script for samacaogiac.
#
# This script:
#   1. Compresses PNG images (loading screen, icons) using Pillow.
#   2. Minifies JavaScript (game.js, three.min.js) using simple regex.
#   3. Validates GLSL shader files for syntax issues.
#   4. Generates a manifest.json with file hashes for cache busting.
#
# Usage:
#   python3 scripts/optimize_assets.py [--no-image-opt]
#   python3 scripts/optimize_assets.py --check   # dry-run, no writes
#
# Requirements:
#   pip install pillow
# ============================================================
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "app" / "src" / "main" / "assets"
SHADERS_DIR = ASSETS_DIR / "game" / "shaders"

# Files we will touch
PNG_FILES = [
    REPO_ROOT / "manhinhload.png",
    # Add more PNGs here as the project grows
]
JS_FILES = [
    ASSETS_DIR / "game" / "game.js",
    # three.min.js is already minified — skip it
]
GLSL_FILES = list(SHADERS_DIR.glob("*.glsl")) if SHADERS_DIR.exists() else []


def log(level: str, msg: str) -> None:
    print(f"[{level}] {msg}", file=sys.stderr)


def compress_png(path: Path, dry_run: bool = False) -> tuple[int, int]:
    """Compress a PNG using Pillow. Returns (before, after) sizes in bytes."""
    try:
        from PIL import Image
    except ImportError:
        log("WARN", "Pillow not installed — skipping PNG compression")
        return (0, 0)

    before = path.stat().st_size
    if dry_run:
        log("DRY", f"Would compress {path.name} ({before} bytes)")
        return (before, before)

    with Image.open(path) as img:
        # Convert to RGB if necessary (PNG can be RGBA, JPEG needs RGB)
        if img.mode in ("RGBA", "LA", "P"):
            # Keep PNG alpha
            img = img.convert("RGBA")
        # Save with optimize=True, and quantize if appropriate
        if img.mode == "RGBA":
            img.save(path, "PNG", optimize=True, compress_level=9)
        else:
            img = img.convert("RGB")
            img.save(path, "PNG", optimize=True, compress_level=9)
    after = path.stat().st_size
    return (before, after)


def minify_js(path: Path, dry_run: bool = False) -> tuple[int, int]:
    """A very conservative JS minifier: strip comments and trailing whitespace.
    Does NOT rename variables or rewrite syntax — game.js is small enough that
    the gain from full minification would be marginal (<5KB)."""
    src = path.read_text(encoding="utf-8")
    before = len(src.encode("utf-8"))

    # Strip /* block comments */
    src = re.sub(r"/\*[\s\S]*?\*/", "", src)
    # Strip // line comments (but not inside strings — simple heuristic)
    src = re.sub(r"//[^\n]*", "", src)
    # Strip leading/trailing whitespace on each line
    src = "\n".join(line.strip() for line in src.splitlines())
    # Collapse multiple blank lines
    src = re.sub(r"\n{3,}", "\n\n", src)
    # Strip trailing whitespace
    src = src.rstrip() + "\n"

    after = len(src.encode("utf-8"))
    if dry_run:
        log("DRY", f"Would minify {path.name}: {before} -> {after} bytes")
        return (before, after)

    path.write_text(src, encoding="utf-8")
    return (before, after)


def validate_glsl(path: Path) -> bool:
    """Basic GLSL validation: check balanced braces and required uniforms."""
    src = path.read_text(encoding="utf-8")
    issues = []

    # Brace balance
    if src.count("{") != src.count("}"):
        issues.append(f"unbalanced braces: {src.count('{')} open vs {src.count('}')} close")
    # Paren balance
    if src.count("(") != src.count(")"):
        issues.append("unbalanced parens")
    # Must declare precision
    if "precision" not in src:
        issues.append("missing precision declaration")
    # Must have main
    if "void main" not in src:
        issues.append("missing void main()")

    if issues:
        log("ERROR", f"GLSL {path.name}: {'; '.join(issues)}")
        return False
    log("OK", f"GLSL {path.name} valid")
    return True


def build_manifest(dry_run: bool = False) -> dict:
    """Build a manifest of asset hashes for cache busting / integrity check."""
    manifest: dict[str, str] = {}
    files: list[Path] = []
    if ASSETS_DIR.exists():
        files = [p for p in ASSETS_DIR.rglob("*") if p.is_file()]
    for f in files:
        rel = str(f.relative_to(ASSETS_DIR))
        h = hashlib.sha256(f.read_bytes()).hexdigest()
        manifest[rel] = h
    if not dry_run:
        out = ASSETS_DIR / "manifest.json"
        out.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
        log("OK", f"Wrote {out.relative_to(REPO_ROOT)} ({len(manifest)} entries)")
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description="samacaogiac asset optimizer")
    ap.add_argument("--check", action="store_true", help="Dry-run: validate only, no writes")
    ap.add_argument("--no-image-opt", action="store_true", help="Skip PNG compression")
    args = ap.parse_args()

    dry = args.check
    total_saved = 0

    # 1. PNG
    if not args.no_image_opt:
        for p in PNG_FILES:
            if not p.exists():
                continue
            before, after = compress_png(p, dry)
            saved = before - after
            total_saved += saved
            log("OK" if saved >= 0 else "WARN",
                f"{p.name}: {before} -> {after} bytes ({'saved' if saved>=0 else 'GREW'} {abs(saved)})")

    # 2. JS
    for p in JS_FILES:
        if not p.exists():
            continue
        before, after = minify_js(p, dry)
        saved = before - after
        total_saved += saved
        log("OK" if saved >= 0 else "WARN",
            f"{p.name}: {before} -> {after} bytes (saved {saved})")

    # 3. GLSL
    glsl_ok = True
    for p in GLSL_FILES:
        if not validate_glsl(p):
            glsl_ok = False

    # 4. Manifest
    build_manifest(dry)

    log("DONE", f"Total bytes saved: {total_saved}")
    return 0 if glsl_ok else 1


if __name__ == "__main__":
    sys.exit(main())
