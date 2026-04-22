import { spawn } from 'node:child_process';
import * as core from '@actions/core';
import { redactText } from '../util/redact.js';

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ExecOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowFailure?: boolean;
  // Optional per-line callback invoked as stdout data arrives. Lets callers
  // stream progress (e.g. humanized tofu -json events to the runner log)
  // while still receiving the full buffered stdout in the ExecResult.
  onStdoutLine?: (line: string) => void;
};

export async function execFileSafe(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
  core.debug(redactText(`exec: ${command} ${args.join(' ')}${options.cwd ? ` (cwd=${options.cwd})` : ''}`));
  return await new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBuffer = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;

      if (options.onStdoutLine) {
        stdoutBuffer += text;
        let newlineIdx: number;
        while ((newlineIdx = stdoutBuffer.indexOf('\n')) !== -1) {
          const line = stdoutBuffer.slice(0, newlineIdx);
          stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);
          options.onStdoutLine(line);
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      // Flush any trailing line without a newline.
      if (options.onStdoutLine && stdoutBuffer.length > 0) {
        options.onStdoutLine(stdoutBuffer);
        stdoutBuffer = '';
      }

      const result: ExecResult = {
        exitCode: code ?? 1,
        stdout,
        stderr,
      };

      if (!options.allowFailure && result.exitCode !== 0) {
        const error = new Error(
          redactText(
            `${command} ${args.join(' ')} failed with exit code ${result.exitCode}\n${stderr || stdout}`,
          ),
        );
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}
