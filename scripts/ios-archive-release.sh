#!/usr/bin/env bash
# Local Release archive (and optional .ipa export for Transporter) using Xcode/xcodebuild directly.
#
# Alternative (Expo): from apps/mobile, with eas-cli installed and `eas login` + project linked:
#   eas build --platform ios --profile production --local
# See package.json scripts ios:eas:local / ios:eas:cloud.
#
# Usage (from repo root):
#   bash scripts/ios-archive-release.sh
#   bash scripts/ios-archive-release.sh --clean
#   bash scripts/ios-archive-release.sh --export-ipa
#   bash scripts/ios-archive-release.sh --clean --export-ipa
#   bash scripts/ios-archive-release.sh --skip-pods
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="${ROOT}/apps/mobile/ios"
WORKSPACE="LionsGateBridge.xcworkspace"
SCHEME="LionsGateBridge"
CONFIG="Release"
ARCHIVE_NAME="LionsGateBridge.xcarchive"
ARCHIVE_PATH="${IOS_DIR}/build/${ARCHIVE_NAME}"
EXPORT_DIR="${IOS_DIR}/build/ipa"
EXPORT_PLIST="${IOS_DIR}/ExportOptions-AppStore.plist"

CLEAN=0
EXPORT_IPA=0
SKIP_PODS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean) CLEAN=1 ;;
    --export-ipa) EXPORT_IPA=1 ;;
    --skip-pods) SKIP_PODS=1 ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if [[ "${CLEAN}" -eq 1 ]]; then
  echo "==> Cleaning ${IOS_DIR}/build"
  rm -rf "${IOS_DIR}/build"
fi

if [[ "${SKIP_PODS}" -eq 0 ]]; then
  echo "==> pod install"
  (cd "${ROOT}" && bash scripts/ios-pod-install.sh)
else
  echo "==> skipping pod install (--skip-pods)"
fi

mkdir -p "${IOS_DIR}/build"

echo "==> xcodebuild archive (Release, generic iOS device)"
# Single-line command avoids backslash-continuation issues on some environments.
xcodebuild -workspace "${IOS_DIR}/${WORKSPACE}" -scheme "${SCHEME}" -configuration "${CONFIG}" -destination 'generic/platform=iOS' -archivePath "${ARCHIVE_PATH}" archive

echo "==> Archive ready: ${ARCHIVE_PATH}"
echo "    Open in Xcode: open \"${ARCHIVE_PATH}\""

if [[ "${EXPORT_IPA}" -eq 1 ]]; then
  if [[ ! -f "${EXPORT_PLIST}" ]]; then
    echo "Missing ${EXPORT_PLIST}" >&2
    exit 1
  fi
  echo "==> App Store export requires:"
  echo "    - Apple Distribution certificate in Keychain"
  echo "    - App Store provisioning profiles for app and widget targets"
  rm -rf "${EXPORT_DIR}"
  mkdir -p "${EXPORT_DIR}"
  echo "==> xcodebuild -exportArchive (App Store IPA)"
  xcodebuild -exportArchive -archivePath "${ARCHIVE_PATH}" -exportPath "${EXPORT_DIR}" -exportOptionsPlist "${EXPORT_PLIST}"
  echo "==> IPA folder: ${EXPORT_DIR}"
  echo "    Upload the .ipa in that folder with Transporter"
fi
