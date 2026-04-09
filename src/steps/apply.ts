import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { ParsedConfig, StepResult } from '../types.js';
import { buildTofuCommonArgs, runTofu } from '../exec/tofu.js';
import { planArtifactBaseName, resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';

type ApplyEvent = {
  type?: string;
  changes?: {
    add?: number;
    change?: number;
    remove?: number;
    import?: number;
    forget?: number;
  };
  hook?: {
    action?: string;
    resource?: {
      resource_type?: string;
      resource_name?: string;
    };
  };
  outputs?: Record<
    string,
    {
      sensitive?: boolean;
      value?: unknown;
    }
  >;
};

function parseJsonLines(stream: string): ApplyEvent[] {
  return stream
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as ApplyEvent];
      } catch {
        return [];
      }
    });
}

function renderResourceChanges(events: ApplyEvent[]): string {
  const seen = new Set<string>();
  const changes: string[] = [];

  for (const event of events) {
    const resourceType = event.hook?.resource?.resource_type;
    const resourceName = event.hook?.resource?.resource_name;
    const action = event.hook?.action;
    if (!resourceType || !resourceName || !action) {
      continue;
    }

    const actionLabel =
      action === 'create' ? 'created' :
      action === 'update' ? 'updated' :
      action === 'delete' ? 'destroyed' :
      action;
    const line = `- ${resourceType}.${resourceName} (${actionLabel})`;
    if (!seen.has(line)) {
      seen.add(line);
      changes.push(line);
    }
  }

  return changes.length > 0 ? changes.join('\n') : 'No changes';
}

function renderOutputs(events: ApplyEvent[]): string {
  const outputEvent = [...events].reverse().find((event) => event.type === 'outputs' && event.outputs);
  if (!outputEvent?.outputs) {
    return 'No outputs';
  }

  const lines = Object.entries(outputEvent.outputs).map(([key, value]) => {
    if (value.sensitive) {
      return `- **${key}**: <sensitive>`;
    }

    const rendered =
      typeof value.value === 'string'
        ? value.value
        : JSON.stringify(value.value);
    return `- **${key}**: ${rendered}`;
  });

  return lines.length > 0 ? lines.join('\n') : 'No outputs';
}

function buildDetailBody(summaryMode: ParsedConfig['summaryMode'], events: ApplyEvent[]): string | undefined {
  if (summaryMode !== 'full') {
    return undefined;
  }

  return `### Resource Changes
${renderResourceChanges(events)}

### Outputs
${renderOutputs(events)}`;
}

export async function runApplyStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const planName = planArtifactBaseName(config);
  const tfplanPath = `${cwd}/${planName}.tfplan`;
  const gzPath = `${tfplanPath}.gz`;
  const checksumPath = `${gzPath}.sha256`;

  if (!existsSync(tfplanPath) && !existsSync(gzPath)) {
    return createStepResult('apply', 'fail', [
      {
        check: '🚀 Tofu Apply',
        status: '❌ Fail',
        details: `Plan artifact ${planName}.tfplan.gz not found.`,
      },
    ]);
  }

  if (existsSync(gzPath)) {
    if (!existsSync(checksumPath)) {
      return createStepResult('apply', 'fail', [
        {
          check: '🚀 Tofu Apply',
          status: '❌ Fail',
          details: `Checksum file ${planName}.tfplan.gz.sha256 not found.`,
        },
      ]);
    }

    const expectedChecksum = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    const actualChecksum = createHash('sha256').update(readFileSync(gzPath)).digest('hex');
    if (!expectedChecksum || expectedChecksum !== actualChecksum) {
      return createStepResult('apply', 'fail', [
        {
          check: '🚀 Tofu Apply',
          status: '❌ Fail',
          details: `Checksum verification failed for ${planName}.tfplan.gz.`,
        },
      ]);
    }
  }

  if (!existsSync(tfplanPath)) {
    writeFileSync(tfplanPath, gunzipSync(readFileSync(gzPath)));
  }

  const result = await runTofu(
    ['apply', '-input=false', '-auto-approve', '-json', '-concise', ...buildTofuCommonArgs(config), `${planName}.tfplan`],
    { cwd, allowFailure: true },
  );

  const events = parseJsonLines(result.stdout);
  const summary = [...events].reverse().find((event) => event.type === 'change_summary');
  const added = summary?.changes?.add ?? 0;
  const changed = summary?.changes?.change ?? 0;
  const destroyed = summary?.changes?.remove ?? 0;
  const imported = summary?.changes?.import ?? 0;
  const forgotten = summary?.changes?.forget ?? 0;
  const hasChanged = added > 0 || changed > 0 || destroyed > 0;
  const status = result.exitCode === 0 ? 'pass' : 'fail';

  if (existsSync(tfplanPath)) {
    unlinkSync(tfplanPath);
  }

  return createStepResult(
    'apply',
    status,
    [
      {
        check: '🚀 Tofu Apply',
        status: status === 'pass' ? '✅ Pass' : '❌ Fail',
        details:
          status === 'pass'
            ? `${added} added, ${changed} changed, ${destroyed} destroyed`
            : result.stderr.trim() || 'Apply failed before reporting a change summary.',
      },
    ],
    {
      details: buildDetailBody(config.summaryMode, events),
      metrics: {
        added,
        changed,
        destroyed,
        imported,
        forgotten,
        has_changed: hasChanged,
      },
      outputs: {
        added: String(added),
        changed: String(changed),
        destroyed: String(destroyed),
        imported: String(imported),
        forgotten: String(forgotten),
        has_changed: hasChanged ? 'true' : 'false',
      },
    },
  );
}
