import type { ParsedConfig } from '../types.js';
import { registerSecret } from './redact.js';

export function registerConfigSecrets(config: ParsedConfig): void {
  for (const source of [config.tfvars, config.backendConfigVars, config.testTfvars]) {
    for (const { value } of source) {
      registerSecret(value);
    }
  }
}
