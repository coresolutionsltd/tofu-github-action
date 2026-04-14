import { redactText } from '../util/redact.js';

type PlanSummaryData =
  | {
      status: 'pass';
      counts: {
        create: number;
        update: number;
        destroy: number;
      };
      details?: string;
    }
  | {
      status: 'fail' | 'skip';
      reason: string;
    };

function renderDetailsBlock(details: string | undefined): string {
  if (!details?.trim()) return '';
  return `

<details><summary>Show full plan</summary>

\`\`\`text
${redactText(details.trimEnd())}
\`\`\`

</details>
`;
}

export function renderPlanSummary(data: PlanSummaryData, env: string): string {
  if (data.status !== 'pass') {
    const status = data.status === 'skip' ? '⚠️ Skipped' : '❌ Fail';
    return `## 🏗️ Tofu Plan${env ? ` (${env})` : ''}

**Status:** ${status}
**Reason:** ${redactText(data.reason)}
`;
  }

  return `## 🏗️ Tofu Plan${env ? ` (${env})` : ''}

| Action | Count |
|--------|-------|
| ➕ Create | ${data.counts.create} |
| 🔄 Update | ${data.counts.update} |
| ❌ Destroy | ${data.counts.destroy} |${renderDetailsBlock(data.details)}
`;
}
