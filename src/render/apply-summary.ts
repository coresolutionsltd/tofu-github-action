type ApplySummaryData =
  | {
      status: 'pass';
      counts: {
        added: number;
        changed: number;
        destroyed: number;
        imported: number;
        forgotten: number;
      };
      details?: string;
    }
  | {
      status: 'fail' | 'skip';
      reason: string;
      details?: string;
    };

export function renderApplySummary(env: string, data: ApplySummaryData): string {
  if (data.status !== 'pass') {
    const status = data.status === 'skip' ? '⚠️ Skipped' : '❌ Fail';
    return `## 🚀 Tofu Apply${env ? ` (${env})` : ''}

**Status:** ${status}
**Reason:** ${data.reason}
${data.details ? `\n\n${data.details}` : ''}
`;
  }

  return `## 🚀 Tofu Apply${env ? ` (${env})` : ''}

### Summary
**Resources:** ${data.counts.added} added, ${data.counts.changed} changed, ${data.counts.destroyed} destroyed
${data.counts.imported > 0 ? `\n**Imported:** ${data.counts.imported}` : ''}
${data.counts.forgotten > 0 ? `\n**Forgotten:** ${data.counts.forgotten}` : ''}
${data.details ? `\n\n${data.details}` : ''}
`;
}
