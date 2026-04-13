#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function read(path) {
  return readFile(path, 'utf8');
}

function extractActionDefault(text, inputName) {
  const pattern = new RegExp(`${inputName}:\\n(?:.+\\n)+?\\s+default: ([^\\n]+)`);
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`Could not find default for ${inputName} in action.yml`);
  }
  return match[1].trim().replace(/^'|'$/g, '');
}

function expectMatch(text, pattern, description) {
  if (!pattern.test(text)) {
    throw new Error(`Validation failed: ${description}`);
  }
}

async function expectExists(path) {
  await access(path, constants.F_OK);
}

async function main() {
  const action = await read(join(root, 'action.yml'));
  const inputs = await read(join(root, 'src', 'inputs.ts'));
  const readme = await read(join(root, 'README.md'));
  const installTofu = await read(join(root, 'scripts', 'install-opentofu.sh'));
  const installTflint = await read(join(root, 'scripts', 'install-tflint.sh'));
  const installTrivy = await read(join(root, 'scripts', 'install-trivy.sh'));
  const checkovLockPath = join(root, 'security', 'checkov', 'requirements-py312-linux-x86_64.txt');
  const checkovLock = await read(checkovLockPath);

  const tofuVersion = extractActionDefault(action, 'version');
  const tflintVersion = extractActionDefault(action, 'tflint-version');
  const trivyVersion = extractActionDefault(action, 'trivy-version');
  const checkovVersion = extractActionDefault(action, 'checkov-version');

  expectMatch(inputs, new RegExp(`version\\.trim\\(\\) \\|\\| '${tofuVersion}'`), 'src/inputs.ts tofu default is stale');
  expectMatch(inputs, new RegExp(`tflintVersion: tflintVersion\\.trim\\(\\) \\|\\| '${tflintVersion}'`), 'src/inputs.ts tflint default is stale');
  expectMatch(inputs, new RegExp(`trivyVersion: trivyVersion\\.trim\\(\\) \\|\\| '${trivyVersion}'`), 'src/inputs.ts trivy default is stale');
  expectMatch(inputs, new RegExp(`checkovVersion: checkovVersion\\.trim\\(\\) \\|\\| '${checkovVersion}'`), 'src/inputs.ts checkov default is stale');

  expectMatch(installTofu, new RegExp(`DEFAULT_VERSION="${tofuVersion}"`), 'install-opentofu.sh default is stale');
  expectMatch(installTflint, new RegExp(`DEFAULT_VERSION="${tflintVersion}"`), 'install-tflint.sh default is stale');
  expectMatch(installTrivy, new RegExp(`DEFAULT_VERSION="${trivyVersion}"`), 'install-trivy.sh default is stale');

  const tofuChecksums = join(root, 'security', 'opentofu', `v${tofuVersion}`, 'checksums.txt');
  const tflintChecksums = join(root, 'security', 'tflint', `v${tflintVersion}`, 'checksums.txt');
  const trivyChecksums = join(root, 'security', 'trivy', `v${trivyVersion}`, 'checksums.txt');
  await Promise.all([expectExists(tofuChecksums), expectExists(tflintChecksums), expectExists(trivyChecksums), expectExists(checkovLockPath)]);

  const tofuChecksumText = await read(tofuChecksums);
  const tflintChecksumText = await read(tflintChecksums);
  const trivyChecksumText = await read(trivyChecksums);

  for (const asset of [
    `tofu_${tofuVersion}_darwin_amd64.zip`,
    `tofu_${tofuVersion}_darwin_arm64.zip`,
    `tofu_${tofuVersion}_linux_amd64.zip`,
    `tofu_${tofuVersion}_linux_arm64.zip`,
  ]) {
    expectMatch(tofuChecksumText, new RegExp(`^[a-f0-9]{64}  ${asset}$`, 'm'), `missing OpenTofu checksum for ${asset}`);
  }

  for (const asset of ['tflint_darwin_amd64.zip', 'tflint_darwin_arm64.zip', 'tflint_linux_amd64.zip', 'tflint_linux_arm64.zip']) {
    expectMatch(tflintChecksumText, new RegExp(`^[a-f0-9]{64}  ${asset}$`, 'm'), `missing TFLint checksum for ${asset}`);
  }

  for (const asset of [
    `trivy_${trivyVersion}_Linux-64bit.tar.gz`,
    `trivy_${trivyVersion}_Linux-ARM64.tar.gz`,
    `trivy_${trivyVersion}_macOS-64bit.tar.gz`,
    `trivy_${trivyVersion}_macOS-ARM64.tar.gz`,
  ]) {
    expectMatch(trivyChecksumText, new RegExp(`^[a-f0-9]{64}  ${asset}$`, 'm'), `missing Trivy checksum for ${asset}`);
  }

  expectMatch(checkovLock, new RegExp(`^checkov==${checkovVersion} --hash=sha256:[a-f0-9]{64}$`, 'm'), 'missing hash-locked Checkov entry');
  expectMatch(action, new RegExp(`INPUT_CHECKOV_VERSION" != "${checkovVersion}`), 'action.yml Checkov guard is stale');
  expectMatch(readme, new RegExp(`\\| \`${tofuVersion}\` \\|`), 'README tofu default is stale');
  expectMatch(readme, new RegExp(`\\| \`${tflintVersion}\` \\|`), 'README tflint default is stale');
  expectMatch(readme, new RegExp(`\\| \`${trivyVersion}\` \\|`), 'README trivy default is stale');
  expectMatch(readme, new RegExp(`\\| \`${checkovVersion}\` \\|`), 'README checkov default is stale');

  console.log(`Security assets validated:
- OpenTofu ${tofuVersion}
- TFLint ${tflintVersion}
- Trivy ${trivyVersion}
- Checkov ${checkovVersion}`);
}

await main();
