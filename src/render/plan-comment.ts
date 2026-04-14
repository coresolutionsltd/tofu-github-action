import type { ParsedConfig } from '../types.js';
import { buildMarker } from '../github/markers.js';
import { redactText } from '../util/redact.js';

type PlanCommentData =
  | {
      status: 'pass';
      counts: {
        create: number;
        update: number;
        destroy: number;
      };
    }
  | {
      status: 'fail' | 'skip';
      reason: string;
    };

export function renderPlanComment(config: ParsedConfig, data: PlanCommentData): string {
  const marker = buildMarker(config.commentIdentifier, 'plan', config.envSlug);
  const heading = `### 🏗️ Tofu Plan${config.env ? ` (${config.env})` : ''}`;

  if (data.status !== 'pass') {
    const status = data.status === 'skip' ? '⚠️ Skipped' : '❌ Fail';
    return `${marker}
${heading}
**Status:** ${status}
**Reason:** ${redactText(data.reason)}`.trimEnd();
  }

  return `${marker}
${heading}
| Action | Count |
|--------|-------|
| ➕ Create | ${data.counts.create} |
| 🔄 Update | ${data.counts.update} |
| ❌ Destroy | ${data.counts.destroy} |`;
}
