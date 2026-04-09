import type { SummaryRow } from '../types.js';

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

export function renderTable(rows: SummaryRow[]): string {
  const header = [
    '| Check | Status | Details |',
    '|-------|--------|---------|',
  ];

  return [
    ...header,
    ...rows.map((row) => `| ${escapeCell(row.check)} | ${escapeCell(row.status)} | ${escapeCell(row.details)} |`),
  ].join('\n');
}
