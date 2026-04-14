# Tofu GitHub Action

<!-- toc -->

* [Description](#description)
* [Inputs](#inputs)
* [Outputs](#outputs)
* [Usage](#usage)
* [Permissions](#permissions)
* [Usage Examples](#usage-examples)
  * [Basic Usage](#basic-usage)
    * [Validate Only](#validate-only)
    * [Plan Only](#plan-only)
    * [Plan and Apply](#plan-and-apply)
  * [Variable Configuration Examples](#variable-configuration-examples)
    * [Using tfvar Files (Comma-separated)](#using-tfvar-files-comma-separated)
    * [Inline Variables (Newline-separated)](#inline-variables-newline-separated)
    * [Mixed Variable Sources](#mixed-variable-sources)
  * [Backend Configuration Examples](#backend-configuration-examples)
    * [Backend Configuration Files](#backend-configuration-files)
    * [Inline Backend Configuration](#inline-backend-configuration)
  * [Approval Gates](#approval-gates)
    * [Separate Plan and Apply Jobs](#separate-plan-and-apply-jobs)
  * [Comment and Summary Controls](#comment-and-summary-controls)
  * [Linting](#linting)
    * [Trivy](#trivy)
    * [Checkov](#checkov)
* [Contributing](#contributing)
  * [Guidelines](#guidelines)
  * [Contribution Workflow](#contribution-workflow)

<!-- Regenerate with "pre-commit run -a markdown-toc" -->

<!-- tocstop -->

<!-- action-docs-description source="action.yml" -->
## Description

This action will validate, plan and apply your OpenTofu configuration.
<!-- action-docs-description source="action.yml" -->

Workflow summaries are automatically updated from each stage, making it easier to see validation issues, planned changes, and apply results. Pull requests are decorated with concise sticky comments so reruns update in place instead of spamming the thread.

<!-- action-docs-inputs source="action.yml" -->
## Inputs

| name | description | required | default |
| --- | --- | --- | --- |
| `version` | <p>Exact OpenTofu version to install.</p> | `false` | `1.11.2` |
| `tofu-checksums` | <p>Optional newline-delimited SHA256 checksums for a custom OpenTofu version. Required when overriding <code>version</code>.</p> | `false` | `""` |
| `workdir` | <p>Path to the OpenTofu configuration directory, relative to the repository root.</p> | `false` | `.` |
| `env` | <p>Logical deployment label used for sticky comment scoping, artifact naming, and plan/apply correlation.</p> | `false` | `""` |
| `steps` | <p>Comma or newline separated steps to run. Allowed values are <code>validate</code>, <code>plan</code>, <code>apply</code>, <code>test</code>, <code>lint</code>, <code>trivy</code>, and <code>checkov</code>.</p> | `false` | `validate,plan` |
| `tfvar-files` | <p>Comma or newline separated list of tfvar files to include.</p> | `false` | `""` |
| `tfvars` | <p>Newline-delimited <code>key=value</code> pairs for Terraform variables.</p> | `false` | `""` |
| `backend-config-var-files` | <p>Comma or newline separated list of backend config files to include.</p> | `false` | `""` |
| `backend-config-vars` | <p>Newline-delimited <code>key=value</code> pairs for backend configuration.</p> | `false` | `""` |
| `test-dir` | <p>Directory containing OpenTofu tests, relative to <code>workdir</code>.</p> | `false` | `tests` |
| `test-tfvar-files` | <p>Comma or newline separated list of tfvar files to include for tests. Defaults to <code>tfvar-files</code>.</p> | `false` | `""` |
| `test-tfvars` | <p>Newline-delimited <code>key=value</code> pairs for test variables. Defaults to <code>tfvars</code>.</p> | `false` | `""` |
| `tflint-version` | <p>Exact TFLint version to install.</p> | `false` | `0.55.1` |
| `tflint-checksums` | <p>Optional newline-delimited SHA256 checksums for a custom TFLint version. Required when overriding <code>tflint-version</code>.</p> | `false` | `""` |
| `trivy-version` | <p>Exact Trivy version to install. Defaults to the post-incident safe <code>0.69.3</code> release.</p> | `false` | `0.69.3` |
| `trivy-checksums` | <p>Optional newline-delimited SHA256 checksums for a custom Trivy version. Required when overriding <code>trivy-version</code>.</p> | `false` | `""` |
| `checkov-version` | <p>Exact Checkov version to install. The bundled lock file currently supports <code>3.2.497</code>.</p> | `false` | `3.2.497` |
| `trivy-scan-type` | <p>Trivy scan type. Allowed values are <code>config</code> and <code>fs</code>.</p> | `false` | `config` |
| `checkov-skip-checks` | <p>Comma or newline separated list of Checkov checks to skip.</p> | `false` | `""` |
| `lock-timeout` | <p>State lock timeout for plan/apply, for example <code>5m</code>.</p> | `false` | `""` |
| `parallelism` | <p>Parallelism for plan/apply.</p> | `false` | `""` |
| `refresh` | <p>Refresh behavior for plan/apply. Allowed values are <code>true</code> and <code>false</code>.</p> | `false` | `""` |
| `targets` | <p>Comma or newline separated list of target resources for plan/apply.</p> | `false` | `""` |
| `artifact-retention-days` | <p>Retention days for uploaded plan artifacts, from 1 to 90. Empty uses the repository default.</p> | `false` | `""` |
| `skip-plan-upload` | <p>Skip uploading the generated plan artifact. Defaults to false so follow-up apply jobs can download it.</p> | `false` | `false` |
| `summary-mode` | <p>Summary mode for validate, lint, trivy, checkov, test, plan, and apply. Allowed values are <code>full</code>, <code>redacted</code>, and <code>off</code>.</p> | `false` | `redacted` |
| `comment-mode` | <p>PR comment mode. Use <code>sticky</code> to update a single comment or <code>off</code> to disable comments.</p> | `false` | `sticky` |
| `comment-identifier` | <p>Identifier used to find and update sticky PR comments.</p> | `false` | `tf-github-action` |
<!-- action-docs-inputs source="action.yml" -->

<!-- action-docs-outputs source="action.yml" -->

<!-- action-docs-outputs source="action.yml" -->

## Outputs

The action exposes per-step status outputs such as `validate_status`, `plan_status`, `apply_status`, `lint_status`, `trivy_status`, `checkov_status`, and `test_status`.

The most useful orchestration outputs are:

- `has_failures`: `true` when any selected step failed.
- `has_changes`: `true` when the plan detected changes.
- `create_count`, `update_count`, `destroy_count`: plan change counts.
- `added`, `changed`, `destroyed`, `imported`, `forgotten`: apply change counts.
- `plan_artifact_name`: uploaded plan artifact name.
- `plan_artifact_sha256`: SHA256 digest for the generated plan artifact.
- `env_slug`: sanitized environment label used for sticky comment scoping and artifact naming.

<!-- action-docs-usage action="action.yml" project="coresolutionsltd/tofu-github-action" version="main" -->
## Usage

```yaml
- uses: coresolutionsltd/tofu-github-action@main
  with:
    version:
    # Exact OpenTofu version to install.
    #
    # Required: false
    # Default: 1.11.2

    tofu-checksums:
    # Optional newline-delimited SHA256 checksums for a custom OpenTofu version. Required when overriding `version`.
    #
    # Required: false
    # Default: ""

    workdir:
    # Path to the OpenTofu configuration directory, relative to the repository root.
    #
    # Required: false
    # Default: .

    env:
    # Logical deployment label used for sticky comment scoping, artifact naming, and plan/apply correlation.
    #
    # Required: false
    # Default: ""

    steps:
    # Comma or newline separated steps to run. Allowed values are `validate`, `plan`, `apply`, `test`, `lint`, `trivy`, and `checkov`.
    #
    # Required: false
    # Default: validate,plan

    tfvar-files:
    # Comma or newline separated list of tfvar files to include.
    #
    # Required: false
    # Default: ""

    tfvars:
    # Newline-delimited `key=value` pairs for Terraform variables.
    #
    # Required: false
    # Default: ""

    backend-config-var-files:
    # Comma or newline separated list of backend config files to include.
    #
    # Required: false
    # Default: ""

    backend-config-vars:
    # Newline-delimited `key=value` pairs for backend configuration.
    #
    # Required: false
    # Default: ""

    test-dir:
    # Directory containing OpenTofu tests, relative to `workdir`.
    #
    # Required: false
    # Default: tests

    test-tfvar-files:
    # Comma or newline separated list of tfvar files to include for tests. Defaults to `tfvar-files`.
    #
    # Required: false
    # Default: ""

    test-tfvars:
    # Newline-delimited `key=value` pairs for test variables. Defaults to `tfvars`.
    #
    # Required: false
    # Default: ""

    tflint-version:
    # Exact TFLint version to install
    #
    # Required: false
    # Default: 0.55.1

    tflint-checksums:
    # Optional newline-delimited SHA256 checksums for a custom TFLint version. Required when overriding `tflint-version`.
    #
    # Required: false
    # Default: ""

    trivy-version:
    # Exact Trivy version to install. Defaults to the post-incident safe `0.69.3` release.
    #
    # Required: false
    # Default: 0.69.3

    trivy-checksums:
    # Optional newline-delimited SHA256 checksums for a custom Trivy version. Required when overriding `trivy-version`.
    #
    # Required: false
    # Default: ""

    checkov-version:
    # Exact Checkov version to install. The bundled lock file currently supports `3.2.497`.
    #
    # Required: false
    # Default: 3.2.497

    trivy-scan-type:
    # Trivy scan type. Allowed values are `config` and `fs`.
    #
    # Required: false
    # Default: config

    checkov-skip-checks:
    # Comma or newline separated list of Checkov checks to skip.
    #
    # Required: false
    # Default: ""

    lock-timeout:
    # State lock timeout for plan/apply, for example `5m`.
    #
    # Required: false
    # Default: ""

    parallelism:
    # Parallelism for plan/apply.
    #
    # Required: false
    # Default: ""

    refresh:
    # Refresh behavior for plan/apply. Allowed values are `true` and `false`.
    #
    # Required: false
    # Default: ""

    targets:
    # Comma or newline separated list of target resources for plan/apply.
    #
    # Required: false
    # Default: ""

    artifact-retention-days:
    # Retention days for uploaded plan artifacts, from 1 to 90. Empty uses the repository default.
    #
    # Required: false
    # Default: ""

    skip-plan-upload:
    # Skip uploading the generated plan artifact.
    #
    # Required: false
    # Default: true

    summary-mode:
    # Summary mode for validate, lint, trivy, checkov, test, plan, and apply. Allowed values are `full`, `redacted`, and `off`.
    #
    # Required: false
    # Default: redacted

    comment-mode:
    # PR comment mode. Use `sticky` to update a single comment or `off` to disable comments.
    #
    # Required: false
    # Default: sticky

    comment-identifier:
    # Identifier used to find and update sticky PR comments.
    #
    # Required: false
    # Default: tf-github-action
```
<!-- action-docs-usage action="action.yml" project="coresolutionsltd/tofu-github-action" version="main" -->

## Permissions

The action can post PR comments and publish releases. Ensure your workflow grants the required permissions.

For PR comments:

```yaml
permissions:
  contents: read
  pull-requests: write
```

For semantic-release publishing:

```yaml
permissions:
  contents: write
  issues: write
  pull-requests: write
```

This action now pins third-party actions to commit SHAs, verifies OpenTofu, TFLint, and Trivy downloads against pinned SHA256 checksums, and installs Checkov from a hash-locked requirements file.

## Usage Examples

This section provides examples of how to use the Tofu GitHub Action in various scenarios, from simple validation to multi-environment deployments with approval gates.

### Basic Usage

#### Validate Only
Perfect for pull requests to ensure OpenTofu configuration is valid without making any changes.

```yaml
name: Validate Only

on:
  pull_request:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8

      - name: Validate Configuration
        uses: coresolutionsltd/tofu-github-action@main
        with:
          workdir: ./infra
          steps: validate
```

#### Plan Only
Generate and review execution plans without applying changes. Useful for code review and change approval processes.

```yaml
name: Plan Only

on:
  pull_request:
    branches:
      - main

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8

      - name: Plan Changes
        uses: coresolutionsltd/tofu-github-action@main
        with:
          workdir: ./infra
          steps: plan
```

#### Plan and Apply
Complete workflow that validates, plans, and applies changes. Best for automated deployments to development environments.

```yaml
name: Deploy to Development

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8

      - name: Deploy to Development Environment
        uses: coresolutionsltd/tofu-github-action@main
        with:
          workdir: ./infra
          env: dev
          steps: validate,plan,apply
```

### Variable Configuration Examples

#### Using tfvar Files (Comma-separated)
Load multiple variable files to configure your infrastructure with shared and environment-specific settings.

```yaml
- name: Deploy with Multiple Variable Files
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    env: dev
    tfvar-files: common.tfvars, prod.tfvars
    steps: validate,plan,apply
```
> `tfvar-files` can be comma or newline separated.

#### Inline Variables (Newline-separated)
Pass variables directly in the workflow for simple configurations or dynamic values.

```yaml
- name: Deploy with Inline Variables
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    env: dev
    tfvars: |
      environment=development
      region=us-west-2
      instance_count=2
    steps: validate,plan,apply
```

#### Mixed Variable Sources
Combine variable files and inline variables for maximum flexibility.

```yaml
- name: Deploy with Mixed Variable Sources
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    env: dev
    tfvar-files: base.tfvars, dev.tfvars
    tfvars: |
      build_number=${{ github.run_number }}
      commit_sha=${{ github.sha }}
      deployed_by=${{ github.actor }}
      deployment_time=${{ github.event.head_commit.timestamp }}
    steps: validate,plan,apply
```

### Backend Configuration Examples

#### Backend Configuration Files
Use configuration files to manage remote state across different environments.

```yaml
- name: Initialize with Backend Configuration Files
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    env: staging
    backend-config-var-files: backend-base.conf, backend-staging.conf
    steps: plan
```

#### Inline Backend Configuration
Configure remote state directly in the workflow for dynamic setups.

```yaml
- name: Configure Remote State Inline
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    backend-config-vars: |
      bucket=my-terraform-state-${{ github.repository_owner }}
      key=${{ github.repository }}/terraform.tfstate
      region=us-west-2
      encrypt=true
    steps: validate,plan,apply
```

### Approval Gates

Public and Enterprise private GitHub repositories can apply deployment protection rules. These can require people or teams to approve a workflow before using a specific environment. Deployment protection rules are an excellent way to require approval before applying changes - we simply separate our plan and apply steps, with the apply step running in a protected environment.

#### Separate Plan and Apply Jobs
This pattern separates planning from applying, allowing for review and approval between steps.

```yaml
name: Infrastructure Deployment with Approval

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  plan:
    name: Plan Infrastructure Changes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8

      - name: Plan Production Changes
        uses: coresolutionsltd/tofu-github-action@main
        with:
          workdir: ./infra
          env: prod
          tfvar-files: base.tfvars, prod.tfvars
          tfvars: build_number=${{ github.run_number }}
          steps: validate,plan

  apply:
    name: Apply Infrastructure Changes
    runs-on: ubuntu-latest
    needs: plan
    environment: prod  # This environment can have protection rules
    steps:
      - uses: actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8

      - name: Apply Production Changes
        uses: coresolutionsltd/tofu-github-action@main
        with:
          workdir: ./infra
          env: prod  # env must match what is planned
          steps: apply  # Only apply, plan artifact is downloaded automatically
```

> [!NOTE]
> Apply-only runs require a plan artifact from a previous job or run. Leave `skip-plan-upload` as `false` when you intend to apply later.

### Comment and Summary Controls

Control PR comments and redact plan/apply output in summaries.

```yaml
- name: Plan with redacted summaries and no PR comment
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    steps: plan
    summary-mode: redacted
    comment-mode: off
    artifact-retention-days: 7
```

Use `comment-identifier` if you want separate sticky comments per workflow or environment.

### Linting

Linting runs `tflint` against `workdir`. Configuration resolution is:

1. `.tflint.hcl` in `workdir`
2. `.tflint.hcl` in the repository root
3. The default `.tflint.hcl` bundled with this action

```yaml
- name: Lint with TFLint
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    steps: lint

### Security Scanning

Trivy and Checkov scans use config files with sensible defaults bundled in this action. You can override them by placing a config file in your repo.

The security tooling is installed in a hardened way by default:
- OpenTofu is downloaded only when its release archive matches a pinned SHA256 checksum.
- TFLint is downloaded only when its release archive matches a pinned SHA256 checksum.
- Trivy defaults to the safe `0.69.3` release and is downloaded only when its archive matches a pinned SHA256 checksum.
- Checkov is installed from a hash-locked Python requirements file instead of an unpinned `pip install`.

### Maintainer Updates

To bump the pinned toolchain safely, run:

```bash
npm run update:security-assets -- \
  --tofu-version 1.11.2 \
  --tflint-version 0.55.1 \
  --trivy-version 0.69.3 \
  --checkov-version 3.2.497
```

That script refreshes:
- vendored checksum manifests for OpenTofu, TFLint, and Trivy
- the hash-locked Checkov requirements file
- version defaults referenced in the action, source, tests, and README

CI runs `npm run validate:security-assets` to catch drift between defaults and the vendored security assets.

Config resolution (highest precedence first):

1. `workdir` (the directory you pass to the action where your Tofu config lives)
2. Repository root (local repo)
3. Default config bundled with this action

Use `.trivy.yaml` and `.checkov.yaml` in your repo to override the defaults.

#### Trivy

Trivy scans IaC configuration using `.trivy.yaml` and `steps: trivy`. The default installer uses the post-incident safe `0.69.3` release. If you override `trivy-version`, you should also provide matching `trivy-checksums`. Use `trivy-scan-type` if you need `fs` instead of `config`.

```yaml
- name: Trivy scan
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    steps: trivy
```

#### Checkov

Checkov scans IaC configuration using `.checkov.yaml` and `steps: checkov`. Use `checkov-skip-checks` for quick exclusions, with additional settings in `.checkov.yaml`. The bundled install path is hash-locked to `checkov==3.2.497`.

```yaml
- name: Checkov scan
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    steps: checkov
    checkov-skip-checks: CKV_AWS_20,CKV_AWS_21
```
```

### Testing

OpenTofu tests run via `tofu test`. Unit tests typically use `command = plan` (no changes applied), while integration tests use `command = apply` to exercise full deployments.

Recommended structure:

```
.
├── main.tf
└── tests/
    ├── unit/
    │   └── validations.tftest.hcl  # Contains command = plan
    └── integration/
        └── deploy_aws.tftest.hcl   # Contains command = apply
```

To run both unit and integration tests, invoke the action twice with `steps: test` and point `test-dir` at the directory you want to execute. `test-tfvars` and `test-tfvar-files` default to `tfvars`/`tfvar-files` unless explicitly set.
If the test directory is missing or contains no `.tftest.hcl` files, the action emits a warning and skips tests.

```yaml
- name: Run unit tests
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    steps: test
    test-dir: tests/unit

- name: Run integration tests
  uses: coresolutionsltd/tofu-github-action@main
  with:
    workdir: ./infra
    steps: test
    test-dir: tests/integration
```

These examples are meant to give you the building blocks for putting together a complete infrastructure deployment workflow. You can mix and match them to create pipelines that validate, plan, and apply your configuration, while also adding steps for review and approval where it makes sense.

Use these patterns as starting points and adapt them to fit the way your team works.

If something doesn’t quite work for you, or there’s a use case we haven’t covered yet, please open an [issue](../../issues) and we’ll look into adding it.

## Contributing

We welcome contributions to improve our GitHub Action!

### Guidelines
- **Issues**
  - Before starting work, please [open an issue](../../issues) to discuss bugs, features, or improvements.

- **Fork & Branch**
  - Fork the repository and create a feature branch from `main`.
  - Use descriptive branch names (e.g., `feat/extend-plan-summary` or `fix/validation-error`).

- **Commits**
  - We use [Conventional Commits](https://www.conventionalcommits.org/) to ensure automated versioning with semantic release.
  - Examples:
    - `feat: add x capability to validate`
    - `fix: resolve y validation issue`
    - `docs: update z usage example`

- **Pre-commit Hooks**
  - Install and enable [pre-commit](https://pre-commit.com/) before committing.
  - Run `pre-commit install` once after cloning to enforce linting, formatting, and checks locally.

- **Pull Requests**
  - Ensure your PR references the related issue (e.g., `Closes #42`).
  - Include tests if adding functionality.
  - Update documentation where relevant.
  - Keep PRs focused and small where possible.

### Contribution Workflow
1. Open an issue to propose a change.
2. Fork the repo and create a feature branch.
3. Make changes, following commit and pre-commit guidelines.
4. Push your branch and open a Pull Request.
5. The maintainers will review, request changes if needed, and merge once approved.
