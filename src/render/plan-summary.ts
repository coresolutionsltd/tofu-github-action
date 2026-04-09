type PlanSummaryData =
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

export function renderPlanSummary(data: PlanSummaryData, env: string): string {
  if (data.status !== 'pass') {
    const status = data.status === 'skip' ? '⚠️ Skipped' : '❌ Fail';
    return `## 🏗️ Tofu Plan${env ? ` (${env})` : ''}

**Status:** ${status}
**Reason:** ${data.reason}
`;
  }

  return `## 🏗️ Tofu Plan${env ? ` (${env})` : ''}

| Action | Count |
|--------|-------|
| ➕ Create | ${data.counts.create} |
| 🔄 Update | ${data.counts.update} |
| ❌ Destroy | ${data.counts.destroy} |
`;
}
