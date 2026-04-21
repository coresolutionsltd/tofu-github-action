import type { ExecResult } from '../exec/process.js';

// Print captured stdout/stderr to the runner log when a step fails.
// The action stores process output in strings so it can render rich
// summaries, but that hides the real error from the plain CI log until
// operators click into the step summary UI. Emitting the raw output
// inline — between visible markers — puts the diagnostic right next to
// the ##[error] marker where debugging instinct leads first.
//
// Both streams are printed because tofu writes the pass/fail summary to
// stdout but diagnostics (╷│└─ blocks) to stderr; showing only one
// routinely loses the actual error message.
export function echoFailureOutput(label: string, result: ExecResult): void {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (!stdout && !stderr) return;
  if (stdout) {
    process.stdout.write(`\n----- ${label} stdout -----\n${stdout}\n`);
  }
  if (stderr) {
    process.stdout.write(`\n----- ${label} stderr -----\n${stderr}\n`);
  }
  process.stdout.write(`----- end ${label} output -----\n`);
}
