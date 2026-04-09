import type { ParsedConfig } from '../types.js';
import { buildMarker } from '../github/markers.js';

type ApplyCommentData =
  | {
      status: 'pass';
      counts: {
        added: number;
        changed: number;
        destroyed: number;
        imported: number;
        forgotten: number;
      };
    }
  | {
      status: 'fail' | 'skip';
      reason: string;
    };

export function renderApplyComment(
  config: ParsedConfig,
  data: ApplyCommentData,
): string {
  const marker = buildMarker(config.commentIdentifier, 'apply', config.envSlug);
  const heading = `### 🚀 Tofu Apply${config.env ? ` (${config.env})` : ''}`;

  if (data.status !== 'pass') {
    const status = data.status === 'skip' ? '⚠️ Skipped' : '❌ Fail';
    return `${marker}
${heading}
**Status:** ${status}
**Reason:** ${data.reason}`.trimEnd();
  }

  return `${marker}
${heading}
**Resources:** ${data.counts.added} added, ${data.counts.changed} changed, ${data.counts.destroyed} destroyed
${data.counts.imported > 0 ? `**Imported:** ${data.counts.imported}` : ''}
${data.counts.forgotten > 0 ? `**Forgotten:** ${data.counts.forgotten}` : ''}`.trimEnd();
}
