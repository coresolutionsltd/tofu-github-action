import type { ParsedConfig } from '../types.js';
import { execFileSafe, type ExecOptions, type ExecResult } from './process.js';

export function buildBackendConfigArgs(config: ParsedConfig): string[] {
  return [
    ...config.backendConfigVarFiles.map((file) => `-backend-config=${file}`),
    ...config.backendConfigVars.map(({ key, value }) => `-backend-config=${key}=${value}`),
  ];
}

export function buildVarArgs(config: ParsedConfig, scope: 'default' | 'test' = 'default'): string[] {
  const varFiles = scope === 'test' ? config.testTfvarFiles : config.tfvarFiles;
  const vars = scope === 'test' ? config.testTfvars : config.tfvars;

  return [
    ...varFiles.map((file) => `-var-file=${file}`),
    ...vars.map(({ key, value }) => `-var=${key}=${value}`),
  ];
}

export function buildTofuCommonArgs(config: ParsedConfig): string[] {
  const args: string[] = [];

  if (config.lockTimeout) {
    args.push(`-lock-timeout=${config.lockTimeout}`);
  }

  if (config.parallelism) {
    args.push(`-parallelism=${config.parallelism}`);
  }

  return args;
}

export function buildPlanArgs(config: ParsedConfig): string[] {
  const args = [...buildTofuCommonArgs(config)];

  if (config.refresh !== undefined) {
    args.push(`-refresh=${config.refresh ? 'true' : 'false'}`);
  }

  for (const target of config.targets) {
    args.push(`-target=${target}`);
  }

  return args;
}

export async function runTofu(args: string[], options: ExecOptions = {}): Promise<ExecResult> {
  return await execFileSafe('tofu', args, options);
}
