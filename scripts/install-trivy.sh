#!/usr/bin/env bash
set -euo pipefail

DEFAULT_VERSION="0.69.3"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION_ROOT="${GITHUB_ACTION_PATH:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
BUNDLED_CHECKSUMS="${ACTION_ROOT}/security/trivy/v0.69.3/checksums.txt"

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

platform_asset() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "${os}" in
    Linux) os="Linux" ;;
    Darwin) os="macOS" ;;
    *)
      echo "Unsupported OS for Trivy: ${os}" >&2
      exit 1
      ;;
  esac

  case "${arch}" in
    x86_64|amd64) arch="64bit" ;;
    arm64|aarch64) arch="ARM64" ;;
    armv7l|armv6l) arch="ARM" ;;
    *)
      echo "Unsupported architecture for Trivy: ${arch}" >&2
      exit 1
      ;;
  esac

  printf 'trivy_%s_%s-%s.tar.gz' "${INPUT_TRIVY_VERSION:-${DEFAULT_VERSION}}" "${os}" "${arch}"
}

main() {
  local version asset checksum_file install_dir archive_path extract_dir expected actual
  version="${INPUT_TRIVY_VERSION:-${DEFAULT_VERSION}}"
  install_dir="${RUNNER_TEMP:-/tmp}/tofu-github-action/bin"
  mkdir -p "${install_dir}"

  if [[ -n "${INPUT_TRIVY_CHECKSUMS:-}" ]]; then
    checksum_file="$(mktemp)"
    printf '%s\n' "${INPUT_TRIVY_CHECKSUMS}" > "${checksum_file}"
  elif [[ "${version}" == "${DEFAULT_VERSION}" ]]; then
    checksum_file="${BUNDLED_CHECKSUMS}"
  else
    echo "Custom trivy-version values require matching trivy-checksums." >&2
    exit 1
  fi

  asset="$(platform_asset)"
  expected="$(awk -v target="${asset}" '$2 == target { print $1 }' "${checksum_file}")"

  if [[ -z "${expected}" ]]; then
    echo "No checksum found for ${asset} in ${checksum_file}." >&2
    exit 1
  fi

  archive_path="$(mktemp "${RUNNER_TEMP:-/tmp}/trivy-${version}-XXXXXX.tar.gz")"
  extract_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/trivy-${version}-XXXXXX")"
  curl -fsSL --retry 3 --retry-delay 2 --retry-connrefused "https://github.com/aquasecurity/trivy/releases/download/v${version}/${asset}" -o "${archive_path}"
  actual="$(hash_file "${archive_path}")"

  if [[ "${actual}" != "${expected}" ]]; then
    echo "Trivy checksum verification failed for ${asset}." >&2
    echo "Expected: ${expected}" >&2
    echo "Actual:   ${actual}" >&2
    exit 1
  fi

  tar -xzf "${archive_path}" -C "${extract_dir}" trivy
  install -m 0755 "${extract_dir}/trivy" "${install_dir}/trivy"
  if [[ -n "${GITHUB_PATH:-}" ]]; then
    echo "${install_dir}" >> "${GITHUB_PATH}"
  fi
}

main "$@"
