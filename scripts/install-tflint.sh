#!/usr/bin/env bash
set -euo pipefail

DEFAULT_VERSION="0.55.1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION_ROOT="${GITHUB_ACTION_PATH:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
BUNDLED_CHECKSUMS="${ACTION_ROOT}/security/tflint/v0.55.1/checksums.txt"

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
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *)
      echo "Unsupported OS for TFLint: ${os}" >&2
      exit 1
      ;;
  esac

  case "${arch}" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    armv7l|armv6l) arch="arm" ;;
    i386|i686) arch="386" ;;
    *)
      echo "Unsupported architecture for TFLint: ${arch}" >&2
      exit 1
      ;;
  esac

  printf 'tflint_%s_%s.zip' "${os}" "${arch}"
}

main() {
  local version asset checksum_file install_dir archive_path expected actual
  version="${INPUT_TFLINT_VERSION:-${DEFAULT_VERSION}}"
  install_dir="${RUNNER_TEMP:-/tmp}/tofu-github-action/bin"
  mkdir -p "${install_dir}"

  if [[ -n "${INPUT_TFLINT_CHECKSUMS:-}" ]]; then
    checksum_file="$(mktemp)"
    printf '%s\n' "${INPUT_TFLINT_CHECKSUMS}" > "${checksum_file}"
  elif [[ "${version}" == "${DEFAULT_VERSION}" ]]; then
    checksum_file="${BUNDLED_CHECKSUMS}"
  else
    echo "Custom tflint-version values require matching tflint-checksums." >&2
    exit 1
  fi

  asset="$(platform_asset)"
  expected="$(awk -v target="${asset}" '$2 == target { print $1 }' "${checksum_file}")"

  if [[ -z "${expected}" ]]; then
    echo "No checksum found for ${asset} in ${checksum_file}." >&2
    exit 1
  fi

  archive_path="$(mktemp "${RUNNER_TEMP:-/tmp}/tflint-${version}-XXXXXX.zip")"
  curl -fsSL --retry 3 --retry-delay 2 --retry-connrefused "https://github.com/terraform-linters/tflint/releases/download/v${version}/${asset}" -o "${archive_path}"
  actual="$(hash_file "${archive_path}")"

  if [[ "${actual}" != "${expected}" ]]; then
    echo "TFLint checksum verification failed for ${asset}." >&2
    echo "Expected: ${expected}" >&2
    echo "Actual:   ${actual}" >&2
    exit 1
  fi

  unzip -oq "${archive_path}" -d "${install_dir}"
  chmod +x "${install_dir}/tflint"
  if [[ -n "${GITHUB_PATH:-}" ]]; then
    echo "${install_dir}" >> "${GITHUB_PATH}"
  fi
}

main "$@"
