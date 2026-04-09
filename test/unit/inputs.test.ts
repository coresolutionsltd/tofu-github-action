import { describe, expect, it } from 'vitest';
import { parseInputs } from '../../src/inputs.js';

describe('parseInputs', () => {
  it('keeps env as the canonical deployment label', () => {
    const parsed = parseInputs({
      version: '1.11.2',
      workdir: '.',
      env: 'prod eu-west-1',
      steps: 'validate,plan',
      'tfvar-files': '',
      tfvars: '',
      'backend-config-var-files': '',
      'backend-config-vars': '',
      'test-dir': 'tests',
      'test-tfvar-files': '',
      'test-tfvars': '',
      'tflint-version': '0.55.1',
      'trivy-version': '0.69.3',
      'checkov-version': '3.2.497',
      'trivy-scan-type': 'config',
      'checkov-skip-checks': '',
      'lock-timeout': '',
      parallelism: '',
      refresh: '',
      targets: '',
      'artifact-retention-days': '',
      'skip-plan-upload': 'true',
      'summary-mode': 'redacted',
      'comment-mode': 'sticky',
      'comment-identifier': 'tf-github-action',
    });

    expect(parsed.env).toBe('prod eu-west-1');
    expect(parsed.envSlug).toBe('prod-eu-west-1');
  });

  it('fails on unknown steps', () => {
    expect(() =>
      parseInputs({
        version: '1.11.2',
        workdir: '.',
        env: '',
        steps: 'validate,explode',
        'tfvar-files': '',
        tfvars: '',
        'backend-config-var-files': '',
        'backend-config-vars': '',
        'test-dir': 'tests',
        'test-tfvar-files': '',
        'test-tfvars': '',
        'tflint-version': '0.55.1',
        'trivy-version': '0.69.3',
        'checkov-version': '3.2.497',
        'trivy-scan-type': 'config',
        'checkov-skip-checks': '',
        'lock-timeout': '',
        parallelism: '',
        refresh: '',
        targets: '',
        'artifact-retention-days': '',
        'skip-plan-upload': 'true',
        'summary-mode': 'redacted',
        'comment-mode': 'sticky',
        'comment-identifier': 'tf-github-action',
      }),
    ).toThrow('Unknown step: explode');
  });

  it('rejects v1-style all and space-separated step inputs', () => {
    expect(() =>
      parseInputs({
        version: '1.11.2',
        workdir: '.',
        env: '',
        steps: 'all',
        'tfvar-files': '',
        tfvars: '',
        'backend-config-var-files': '',
        'backend-config-vars': '',
        'test-dir': 'tests',
        'test-tfvar-files': '',
        'test-tfvars': '',
        'tflint-version': '',
        'trivy-version': '',
        'checkov-version': '',
        'trivy-scan-type': 'config',
        'checkov-skip-checks': '',
        'lock-timeout': '',
        parallelism: '',
        refresh: '',
        targets: '',
        'artifact-retention-days': '',
        'skip-plan-upload': 'true',
        'summary-mode': 'redacted',
        'comment-mode': 'sticky',
        'comment-identifier': 'tf-github-action',
      }),
    ).toThrow('Unknown step: all');

    expect(() =>
      parseInputs({
        version: '1.11.2',
        workdir: '.',
        env: '',
        steps: 'validate plan',
        'tfvar-files': '',
        tfvars: '',
        'backend-config-var-files': '',
        'backend-config-vars': '',
        'test-dir': 'tests',
        'test-tfvar-files': '',
        'test-tfvars': '',
        'tflint-version': '',
        'trivy-version': '',
        'checkov-version': '',
        'trivy-scan-type': 'config',
        'checkov-skip-checks': '',
        'lock-timeout': '',
        parallelism: '',
        refresh: '',
        targets: '',
        'artifact-retention-days': '',
        'skip-plan-upload': 'true',
        'summary-mode': 'redacted',
        'comment-mode': 'sticky',
        'comment-identifier': 'tf-github-action',
      }),
    ).toThrow('Unknown step: validate plan');
  });

  it('uses strict defaults for current parsing rules', () => {
    const parsed = parseInputs({
      version: '1.11.2',
      workdir: '.',
      env: '',
      steps: '',
      'tfvar-files': '',
      tfvars: '',
      'backend-config-var-files': '',
      'backend-config-vars': '',
      'test-dir': 'tests',
      'test-tfvar-files': '',
      'test-tfvars': '',
      'tflint-version': '',
      'trivy-version': '',
      'checkov-version': '',
      'trivy-scan-type': 'config',
      'checkov-skip-checks': '',
      'lock-timeout': '',
      parallelism: '',
      refresh: '',
      targets: '',
      'artifact-retention-days': '',
      'skip-plan-upload': 'true',
      'summary-mode': 'redacted',
      'comment-mode': 'sticky',
      'comment-identifier': 'tf-github-action',
    });

    expect(parsed.version).toBe('1.11.2');
    expect(parsed.steps).toEqual(['validate', 'plan']);
    expect(parsed.tflintVersion).toBe('0.55.1');
    expect(parsed.trivyVersion).toBe('0.69.3');
    expect(parsed.checkovVersion).toBe('3.2.497');
  });
});
