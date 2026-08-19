#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const OPEN_TOFU_ASSETS = [
  'tofu_%VERSION%_darwin_amd64.zip',
  'tofu_%VERSION%_darwin_arm64.zip',
  'tofu_%VERSION%_linux_amd64.zip',
  'tofu_%VERSION%_linux_arm64.zip',
  'tofu_%VERSION%_windows_amd64.zip',
];

const TFLINT_ASSETS = [
  'tflint_darwin_amd64.zip',
  'tflint_darwin_arm64.zip',
  'tflint_linux_386.zip',
  'tflint_linux_amd64.zip',
  'tflint_linux_arm.zip',
  'tflint_linux_arm64.zip',
  'tflint_windows_386.zip',
  'tflint_windows_amd64.zip',
];

const TRIVY_ASSETS = [
  'trivy_%VERSION%_FreeBSD-64bit.tar.gz',
  'trivy_%VERSION%_Linux-32bit.tar.gz',
  'trivy_%VERSION%_Linux-64bit.tar.gz',
  'trivy_%VERSION%_Linux-ARM.tar.gz',
  'trivy_%VERSION%_Linux-ARM64.tar.gz',
  'trivy_%VERSION%_Linux-PPC64LE.tar.gz',
  'trivy_%VERSION%_Linux-s390x.tar.gz',
  'trivy_%VERSION%_macOS-64bit.tar.gz',
  'trivy_%VERSION%_macOS-ARM64.tar.gz',
];

function parseArgs(argv) {
  const overrides = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    const key = arg.slice(2);
    switch (key) {
      case 'tofu-version':
        overrides.tofuVersion = next;
        break;
      case 'tflint-version':
        overrides.tflintVersion = next;
        break;
      case 'trivy-version':
        overrides.trivyVersion = next;
        break;
      case 'checkov-version':
        overrides.checkovVersion = next;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
    index += 1;
  }
  return overrides;
}

function renderAsset(template, version) {
  return template.replaceAll('%VERSION%', version);
}

async function fetchText(url, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'tofu-github-action-maintainer-script',
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const text = await fetchText(url, {
    accept: 'application/vnd.github+json',
  });
  return JSON.parse(text);
}

function filterChecksumLines(raw, assetNames) {
  const wanted = new Set(assetNames);
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const parts = line.split(/\s+/);
      return wanted.has(parts[1] ?? '');
    });

  if (lines.length !== assetNames.length) {
    const found = new Set(lines.map((line) => line.split(/\s+/)[1]));
    const missing = assetNames.filter((asset) => !found.has(asset));
    throw new Error(`Missing checksums for: ${missing.join(', ')}`);
  }

  return `${lines.join('\n')}\n`;
}

async function writeFileEnsured(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
}

async function updateOpenTofuChecksums(version) {
  const assetNames = OPEN_TOFU_ASSETS.map((asset) => renderAsset(asset, version));
  const release = await fetchJson(`https://api.github.com/repos/opentofu/opentofu/releases/tags/v${version}`);
  const digestByName = new Map();

  for (const asset of release.assets ?? []) {
    if (assetNames.includes(asset.name) && typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')) {
      digestByName.set(asset.name, asset.digest.slice('sha256:'.length));
    }
  }

  const lines = assetNames.map((name) => {
    const digest = digestByName.get(name);
    if (!digest) {
      throw new Error(`Missing OpenTofu digest for ${name}`);
    }
    return `${digest}  ${name}`;
  });

  await writeFileEnsured(
    join(root, 'security', 'opentofu', `v${version}`, 'checksums.txt'),
    `${lines.join('\n')}\n`,
  );
}

async function updateTflintChecksums(version) {
  const assetNames = TFLINT_ASSETS;
  const raw = await fetchText(`https://github.com/terraform-linters/tflint/releases/download/v${version}/checksums.txt`);
  await writeFileEnsured(
    join(root, 'security', 'tflint', `v${version}`, 'checksums.txt'),
    filterChecksumLines(raw, assetNames),
  );
}

async function updateTrivyChecksums(version) {
  const assetNames = TRIVY_ASSETS.map((asset) => renderAsset(asset, version));
  const raw = await fetchText(
    `https://github.com/aquasecurity/trivy/releases/download/v${version}/trivy_${version}_checksums.txt`,
  );
  await writeFileEnsured(
    join(root, 'security', 'trivy', `v${version}`, 'checksums.txt'),
    filterChecksumLines(raw, assetNames),
  );
}

function runCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr}`));
    });
  });
}

async function sha256(path) {
  const buffer = await readFile(path);
  return createHash('sha256').update(buffer).digest('hex');
}

async function updateCheckovLock(version) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'tofu-checkov-'));
  try {
    await runCommand('python3', [
      '-m',
      'pip',
      'download',
      '--only-binary=:all:',
      '--platform',
      'manylinux2014_x86_64',
      '--python-version',
      '3.12',
      '--implementation',
      'cp',
      '--abi',
      'cp312',
      '-d',
      tempRoot,
      `checkov==${version}`,
    ]);

    const wheels = (await readdir(tempRoot))
      .filter((name) => name.endsWith('.whl'))
      .sort((left, right) => left.localeCompare(right));

    const lines = [];
    for (const wheel of wheels) {
      const parts = wheel.slice(0, -4).split('-');
      if (parts.length < 5) {
        throw new Error(`Unexpected wheel filename: ${wheel}`);
      }

      const dist = parts[0].replaceAll('_', '-').toLowerCase();
      const wheelVersion = parts[1];
      const digest = await sha256(join(tempRoot, wheel));
      lines.push(`${dist}==${wheelVersion} --hash=sha256:${digest}`);
    }

    await writeFileEnsured(
      join(root, 'security', 'checkov', 'requirements-py312-linux-x86_64.txt'),
      `${lines.join('\n')}\n`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function replaceOrThrow(source, pattern, replacement, description) {
  if (!pattern.test(source)) {
    throw new Error(`Could not update ${description}`);
  }
  return source.replace(pattern, replacement);
}

function extractActionDefault(text, inputName) {
  const pattern = new RegExp(`${inputName}:\\n(?:.+\\n)+?\\s+default: ([^\\n]+)`);
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`Could not find default for ${inputName} in action.yml`);
  }
  return match[1].trim().replace(/^'|'$/g, '');
}

// The versions currently pinned, read from action.yml — the single source the
// validator also reads — so every other reference is updated by exact
// old-version -> new-version replacement instead of series-specific regexes.
async function readCurrentVersions() {
  const action = await readFile(join(root, 'action.yml'), 'utf8');
  return {
    tofuVersion: extractActionDefault(action, 'version'),
    tflintVersion: extractActionDefault(action, 'tflint-version'),
    trivyVersion: extractActionDefault(action, 'trivy-version'),
    checkovVersion: extractActionDefault(action, 'checkov-version'),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function replaceInFile(file, pairs) {
  let text = await readFile(file, 'utf8');
  for (const [from, to] of pairs) {
    if (from === to) continue;
    text = text.replaceAll(from, to);
  }
  await writeFile(file, text, 'utf8');
}

async function listFiles(dir, predicate) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path, predicate)));
    } else if (predicate(path)) {
      files.push(path);
    }
  }
  return files;
}

async function updateVersionReferences(current, versions) {
  // Exact-string replacement sites keyed by tool. Each tool's version only
  // appears in these files in contexts that unambiguously refer to it
  // (quoted literals, install-script defaults, action.yml defaults, README
  // tables/examples), so exact replacement is safe and series-agnostic.
  const tools = [
    ['tofuVersion', ['src/inputs.ts', 'action.yml', 'README.md', 'scripts/install-opentofu.sh']],
    ['tflintVersion', ['src/inputs.ts', 'action.yml', 'README.md', 'scripts/install-tflint.sh']],
    ['trivyVersion', ['src/inputs.ts', 'action.yml', 'README.md', 'scripts/install-trivy.sh']],
    ['checkovVersion', ['src/inputs.ts', 'action.yml', 'README.md']],
  ];

  const testFiles = await listFiles(join(root, 'test'), (path) => path.endsWith('.ts'));

  for (const [key, files] of tools) {
    const from = current[key];
    const to = versions[key];
    if (from === to) continue;
    for (const file of [...files.map((file) => join(root, file)), ...testFiles]) {
      await replaceInFile(file, [[from, to]]);
    }
  }

  // Guard against a silently missed reference: every file the validator
  // checks must now carry the new version.
  const action = await readFile(join(root, 'action.yml'), 'utf8');
  for (const [inputName, key] of [
    ['version', 'tofuVersion'],
    ['tflint-version', 'tflintVersion'],
    ['trivy-version', 'trivyVersion'],
    ['checkov-version', 'checkovVersion'],
  ]) {
    if (extractActionDefault(action, inputName) !== versions[key]) {
      throw new Error(`action.yml default for ${inputName} was not updated to ${versions[key]}`);
    }
  }
  for (const [script, key] of [
    ['scripts/install-opentofu.sh', 'tofuVersion'],
    ['scripts/install-tflint.sh', 'tflintVersion'],
    ['scripts/install-trivy.sh', 'trivyVersion'],
  ]) {
    const text = await readFile(join(root, script), 'utf8');
    if (!new RegExp(`DEFAULT_VERSION="${escapeRegExp(versions[key])}"`).test(text)) {
      throw new Error(`${script} DEFAULT_VERSION was not updated to ${versions[key]}`);
    }
    if (!text.includes(`/v${versions[key]}/checksums.txt`)) {
      throw new Error(`${script} BUNDLED_CHECKSUMS path was not updated to v${versions[key]}`);
    }
  }
}

async function main() {
  const current = await readCurrentVersions();
  const versions = { ...current, ...parseArgs(process.argv.slice(2)) };

  await updateOpenTofuChecksums(versions.tofuVersion);
  await updateTflintChecksums(versions.tflintVersion);
  await updateTrivyChecksums(versions.trivyVersion);
  // The checkov lock is produced by a full pip resolution, which can move
  // transitive pins even for the same checkov release; only regenerate it when
  // the checkov version itself changes so a tofu/tflint/trivy bump stays
  // reviewable.
  if (versions.checkovVersion !== current.checkovVersion) {
    await updateCheckovLock(versions.checkovVersion);
  }
  await updateVersionReferences(current, versions);

  console.log(`Updated security assets:
- OpenTofu ${current.tofuVersion} -> ${versions.tofuVersion}
- TFLint ${current.tflintVersion} -> ${versions.tflintVersion}
- Trivy ${current.trivyVersion} -> ${versions.trivyVersion}
- Checkov ${current.checkovVersion} -> ${versions.checkovVersion}${versions.checkovVersion === current.checkovVersion ? ' (lock unchanged)' : ''}`);
}

await main();
