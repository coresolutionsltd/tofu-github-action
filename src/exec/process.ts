import { spawn } from 'node:child_process';

export type ExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ExecOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowFailure?: boolean;
};

export async function execFileSafe(command: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
  return await new Promise<ExecResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      const result: ExecResult = {
        exitCode: code ?? 1,
        stdout,
        stderr,
      };

      if (!options.allowFailure && result.exitCode !== 0) {
        const error = new Error(
          `${command} ${args.join(' ')} failed with exit code ${result.exitCode}\n${stderr || stdout}`,
        );
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}
