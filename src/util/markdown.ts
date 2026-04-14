import type { SummaryRow } from '../types.js';
import { redactText } from './redact.js';

function escapeCell(value: string): string {
  return redactText(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
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
