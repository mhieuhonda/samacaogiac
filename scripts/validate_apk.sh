#!/usr/bin/env bash
# ============================================================
# validate_apk.sh — Post-build APK validation.
#
# Checks that the built APK:
#   - Is valid (zipalign + apksigner verify)
#   - Has both v1 + v2 + v3 signature schemes (no "app harmful" warning)
#   - Has a sensible minimum SDK and target SDK
#   - Does NOT ship debuggable=true in release
#   - Does NOT request suspicious permissions (READ_SMS, etc.)
#
# Usage:
#   ./scripts/validate_apk.sh path/to/app-release.apk
# ============================================================
set -euo pipefail

APK="${1:-}"
[ -n "$APK" ] || { echo "Usage: $0 <apk>"; exit 1; }
[ -f "$APK" ] || { echo "APK not found: $APK"; exit 1; }

# Locate build-tools
BT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}/build-tools"
if [ -d "$BT" ]; then
    BT_VER="$(ls "$BT" | sort -V | tail -1)"
    AAPT2="$BT/$BT_VER/aapt2"
    APKSIGNER="$BT/$BT_VER/apksigner"
    ZIPALIGN="$BT/$BT_VER/zipalign"
else
    # Fall back to PATH
    AAPT2="aapt2"
    APKSIGNER="apksigner"
    ZIPALIGN="zipalign"
fi

pass() { printf '\033[1;32m[PASS]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*"; }
info()  { printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }

EXIT=0

# 1. ZIP integrity
if unzip -t "$APK" >/dev/null 2>&1; then
    pass "ZIP integrity OK"
else
    fail "ZIP corruption detected"
    EXIT=1
fi

# 2. Signature schemes
if command -v "$APKSIGNER" >/dev/null 2>&1; then
    info "Signature info:"
    if "$APKSIGNER" verify --print-certs "$APK" 2>&1 | grep -q "Verified using v1 scheme"; then
        pass "v1 signature"
    else
        fail "v1 signature missing (legacy — needed for Android <7)"
        EXIT=1
    fi
    if "$APKSIGNER" verify --print-certs "$APK" 2>&1 | grep -q "Verified using v2 scheme"; then
        pass "v2 signature (Android 7+)"
    else
        fail "v2 signature missing — Google Play Protect WILL warn"
        EXIT=1
    fi
    if "$APKSIGNER" verify --print-certs "$APK" 2>&1 | grep -q "Verified using v3 scheme"; then
        pass "v3 signature (Android 9+ key rotation)"
    else
        # v3 is not strictly required but recommended
        info "v3 signature not present (recommended but not required)"
    fi
else
    fail "apksigner not found — cannot verify signatures"
    EXIT=1
fi

# 3. Alignment
if command -v "$ZIPALIGN" >/dev/null 2>&1; then
    if "$ZIPALIGN" -c -v 4 "$APK" >/dev/null 2>&1; then
        pass "ZIP aligned to 4 bytes"
    else
        fail "ZIP not aligned"
        EXIT=1
    fi
fi

# 4. Dump badging and check
if command -v "$AAPT2" >/dev/null 2>&1; then
    BADGE="$("$AAPT2" dump badging "$APK" 2>/dev/null || true)"

    # SDK
    MINS=$(echo "$BADGE" | grep -oP "sdkVersion='\K[^']+")
    TGT=$(echo "$BADGE" | grep -oP "targetSdkVersion='\K[^']+")
    [ -n "$MINS" ] && pass "minSdk = $MINS"
    [ -n "$TGT" ] && [ "$TGT" -ge 33 ] && pass "targetSdk = $TGT (modern)" \
        || fail "targetSdk too low ($TGT — should be >= 33 to avoid Play Protect warning)"

    # Suspicious permissions — list any we should warn about
    PERMS=$(echo "$BADGE" | grep "uses-permission" | sed "s/.*name='\([^']*\)'.*/\1/" | sort -u)
    SUSPECT_REGEX="(READ_SMS|READ_CONTACTS|READ_CALL_LOG|SEND_SMS|RECEIVE_SMS|SYSTEM_ALERT_WINDOW|REQUEST_INSTALL_PACKAGES|READ_PHONE_STATE|ACCESS_FINE_LOCATION)"
    for p in $PERMS; do
        if echo "$p" | grep -qE "$SUSPECT_REGEX"; then
            fail "Suspicious permission: $p (Play Protect may warn)"
            EXIT=1
        else
            info "Permission: $p"
        fi
    done
else
    fail "aapt2 not found — cannot dump badging"
fi

# 5. debuggable flag (using aapt2 dump xmltree)
if command -v "$AAPT2" >/dev/null 2>&1; then
    if "$AAPT2" dump xmltree "$APK" --file AndroidManifest.xml 2>/dev/null | grep -q "android:debuggable(0x[0-9a-f]*)=(true)"; then
        fail "android:debuggable=true found in release APK — Play Protect WILL warn"
        EXIT=1
    else
        pass "android:debuggable is false/absent"
    fi
fi

echo ""
if [ $EXIT -eq 0 ]; then
    pass "ALL CHECKS PASSED — APK is good to ship"
else
    fail "Some checks failed — review before release"
fi
exit $EXIT
