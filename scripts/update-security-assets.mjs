#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEFAULTS = {
  tofuVersion: '1.11.2',
  tflintVersion: '0.55.1',
  trivyVersion: '0.69.3',
  checkovVersion: '3.2.497',
};

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
  return { ...DEFAULTS, ...overrides };
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

async function updateVersionReferences(versions) {
  const files = [
    join(root, 'src', 'inputs.ts'),
    join(root, 'test', 'unit', 'inputs.test.ts'),
    join(root, 'test', 'unit', 'main.test.ts'),
    join(root, 'test', 'unit', 'render.test.ts'),
    join(root, 'action.yml'),
    join(root, 'README.md'),
  ];

  for (const file of files) {
    let text = await readFile(file, 'utf8');

    text = replaceOrThrow(
      text,
      /version\.trim\(\) \|\| '[^']+'/,
      `version.trim() || '${versions.tofuVersion}'`,
      `${file} tofu default`,
    );
    text = replaceOrThrow(
      text,
      /tflintVersion: tflintVersion\.trim\(\) \|\| '[^']+'/,
      `tflintVersion: tflintVersion.trim() || '${versions.tflintVersion}'`,
      `${file} tflint default`,
    );
    text = replaceOrThrow(
      text,
      /trivyVersion: trivyVersion\.trim\(\) \|\| '[^']+'/,
      `trivyVersion: trivyVersion.trim() || '${versions.trivyVersion}'`,
      `${file} trivy default`,
    );
    text = replaceOrThrow(
      text,
      /checkovVersion: checkovVersion\.trim\(\) \|\| '[^']+'/,
      `checkovVersion: checkovVersion.trim() || '${versions.checkovVersion}'`,
      `${file} checkov default`,
    );

    await writeFile(file, text, 'utf8');
  }

  let action = await readFile(join(root, 'action.yml'), 'utf8');
  action = replaceOrThrow(action, /default: [0-9]+\.[0-9]+\.[0-9]+\n  tofu-checksums:/, `default: ${versions.tofuVersion}\n  tofu-checksums:`, 'action.yml tofu input default');
  action = replaceOrThrow(action, /default: [0-9]+\.[0-9]+\.[0-9]+\n  tflint-checksums:/, `default: ${versions.tflintVersion}\n  tflint-checksums:`, 'action.yml tflint input default');
  action = replaceOrThrow(action, /safe `[^`]+` release\.\n    required: false\n    default: [0-9]+\.[0-9]+\.[0-9]+/, `safe \`${versions.trivyVersion}\` release.\n    required: false\n    default: ${versions.trivyVersion}`, 'action.yml trivy default');
  action = replaceOrThrow(action, /supports `[^`]+`\.\n    required: false\n    default: [0-9]+\.[0-9]+\.[0-9]+/, `supports \`${versions.checkovVersion}\`.\n    required: false\n    default: ${versions.checkovVersion}`, 'action.yml checkov default');
  action = replaceOrThrow(action, /if \[ "\$INPUT_CHECKOV_VERSION" != "[^"]+" \]; then/, `if [ "$INPUT_CHECKOV_VERSION" != "${versions.checkovVersion}" ]; then`, 'action.yml checkov guard');
  await writeFile(join(root, 'action.yml'), action, 'utf8');

  let readme = await readFile(join(root, 'README.md'), 'utf8');
  readme = readme
    .replaceAll(/`1\.11\.[0-9]+`/g, `\`${versions.tofuVersion}\``)
    .replaceAll(/`0\.55\.[0-9]+`/g, `\`${versions.tflintVersion}\``)
    .replaceAll(/`0\.69\.[0-9]+`/g, `\`${versions.trivyVersion}\``)
    .replaceAll(/`3\.2\.[0-9]+`/g, `\`${versions.checkovVersion}\``)
    .replaceAll(/Default: 1\.11\.[0-9]+/g, `Default: ${versions.tofuVersion}`)
    .replaceAll(/Default: 0\.55\.[0-9]+/g, `Default: ${versions.tflintVersion}`)
    .replaceAll(/Default: 0\.69\.[0-9]+/g, `Default: ${versions.trivyVersion}`)
    .replaceAll(/Default: 3\.2\.[0-9]+/g, `Default: ${versions.checkovVersion}`)
    .replaceAll(/\| `1\.11\.[0-9]+` \|/g, `| \`${versions.tofuVersion}\` |`)
    .replaceAll(/\| `0\.55\.[0-9]+` \|/g, `| \`${versions.tflintVersion}\` |`)
    .replaceAll(/\| `0\.69\.[0-9]+` \|/g, `| \`${versions.trivyVersion}\` |`)
    .replaceAll(/\| `3\.2\.[0-9]+` \|/g, `| \`${versions.checkovVersion}\` |`);
  await writeFile(join(root, 'README.md'), readme, 'utf8');

  const testFiles = [join(root, 'test', 'unit', 'main.test.ts'), join(root, 'test', 'unit', 'render.test.ts')];
  for (const file of testFiles) {
    let text = await readFile(file, 'utf8');
    text = text
      .replaceAll(/version: '1\.11\.[0-9]+'/g, `version: '${versions.tofuVersion}'`)
      .replaceAll(/tflintVersion: '0\.55\.[0-9]+'/g, `tflintVersion: '${versions.tflintVersion}'`)
      .replaceAll(/trivyVersion: '0\.69\.[0-9]+'/g, `trivyVersion: '${versions.trivyVersion}'`);

    if (!text.includes('checkovVersion:')) {
      text = text.replace("  trivyVersion: '" + versions.trivyVersion + "',\n", `  trivyVersion: '${versions.trivyVersion}',\n  checkovVersion: '${versions.checkovVersion}',\n`);
    } else {
      text = text.replaceAll(/checkovVersion: '3\.2\.[0-9]+'/g, `checkovVersion: '${versions.checkovVersion}'`);
    }

    await writeFile(file, text, 'utf8');
  }
}

async function main() {
  const versions = parseArgs(process.argv.slice(2));
  await updateOpenTofuChecksums(versions.tofuVersion);
  await updateTflintChecksums(versions.tflintVersion);
  await updateTrivyChecksums(versions.trivyVersion);
  await updateCheckovLock(versions.checkovVersion);
  await updateVersionReferences(versions);

  console.log(`Updated security assets:
- OpenTofu ${versions.tofuVersion}
- TFLint ${versions.tflintVersion}
- Trivy ${versions.trivyVersion}
- Checkov ${versions.checkovVersion}`);
}

await main();
