#!/usr/bin/env bash
# Install CocoaPods for the iOS app (UTF-8 locale avoids CocoaPods encoding errors on some Macs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="${ROOT}/apps/mobile/ios"

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

cd "${IOS_DIR}"
echo "==> pod install (${IOS_DIR})"
exec pod install "$@"
