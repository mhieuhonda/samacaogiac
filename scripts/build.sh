#!/usr/bin/env bash
# ============================================================
# build.sh — Convenience wrapper for building the APK.
#
# Usage:
#   ./scripts/build.sh             # Build release APK (default)
#   ./scripts/build.sh debug       # Build debug APK
#   ./scripts/build.sh native      # Build only the NDK .so files
#   ./scripts/build.sh clean       # Clean all build outputs
#   ./scripts/build.sh check       # Lint + syntax check, no build
#
# This script is also used by CI (GitHub Actions) as a fallback
# when the workflow needs to debug a build issue.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-release}"

info()  { printf '\033[1;32m[INFO]\033[0m %s\n'  "$*" >&2; }
warn()  { printf '\033[1;33m[WARN]\033[0m %s\n'  "$*" >&2; }
err()   { printf '\033[1;31m[ERR ]\033[0m %s\n'  "$*" >&2; }
die()   { err "$*"; exit 1; }

# ---- Preconditions ----
[ -f "./gradlew" ]   || die "gradlew not found. Run from the repo root."
[ -f "./app/build.gradle" ] || die "app/build.gradle not found."
chmod +x ./gradlew 2>/dev/null || true

# Local properties — must point to an Android SDK
if [ ! -f "./local.properties" ]; then
    if [ -n "${ANDROID_HOME:-}" ] || [ -n "${ANDROID_SDK_ROOT:-}" ]; then
        SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT}}"
        echo "sdk.dir=$SDK" > local.properties
        info "Wrote local.properties (sdk.dir=$SDK)"
    else
        warn "ANDROID_HOME not set — Gradle may fail to find the SDK."
    fi
fi

# ---- Mode dispatch ----
case "$MODE" in
    debug)
        info "Building debug APK…"
        ./gradlew assembleDebug --stacktrace
        info "APK: app/build/outputs/apk/debug/app-debug.apk"
        ;;
    release)
        info "Building release APK…"
        # Release requires a keystore. Either:
        #   - keystore.properties file at repo root, OR
        #   - env vars KEY_ALIAS, KEY_PASSWORD, KEYSTORE_FILE, KEYSTORE_PASSWORD
        if [ ! -f "./keystore.properties" ] && [ -z "${KEY_ALIAS:-}" ]; then
            warn "No keystore configured — build may produce an unsigned APK."
        fi
        ./gradlew assembleRelease --stacktrace
        APK="$(find app/build/outputs/apk/release -name '*.apk' | head -1)"
        info "APK: $APK"
        ;;
    native|ndk)
        info "Building NDK libraries only…"
        if [ ! -x "$(command -v make)" ]; then die "make not found"; fi
        if [ -z "${ANDROID_NDK_HOME:-}" ]; then die "ANDROID_NDK_HOME not set"; fi
        make -j4
        make stats
        ;;
    clean)
        info "Cleaning…"
        ./gradlew clean 2>/dev/null || true
        rm -rf app/.cxx app/src/main/jniLibs 2>/dev/null || true
        info "Cleaned."
        ;;
    check|lint)
        info "Running syntax checks…"
        # JS syntax
        if command -v node >/dev/null 2>&1; then
            node -e "new Function(require('fs').readFileSync('app/src/main/assets/game/game.js','utf8'))" \
                && info "game.js: OK" || die "game.js: SYNTAX ERROR"
        else warn "node not found — skipping JS check"; fi
        # Python syntax
        if command -v python3 >/dev/null 2>&1; then
            python3 -c "import ast; ast.parse(open('scripts/optimize_assets.py').read())" \
                && info "optimize_assets.py: OK" || die "Python: SYNTAX ERROR"
        fi
        # Shell syntax (self-check)
        bash -n "$0" && info "build.sh: OK"
        # Lua basic check (just file existence)
        for f in app/src/main/assets/lua/*.lua; do
            [ -f "$f" ] && info "Lua: $(basename "$f") present"
        done
        info "All checks passed."
        ;;
    *)
        die "Unknown mode: $MODE. Use: debug|release|native|clean|check"
        ;;
esac
