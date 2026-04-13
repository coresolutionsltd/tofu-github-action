import { describe, expect, it } from 'vitest';
import { getActionInputMap } from '../../src/action-inputs.js';

describe('getActionInputMap', () => {
  it('reads underscored composite-action env vars for hyphenated inputs', () => {
    process.env.INPUT_COMMENT_IDENTIFIER = 'dogfood';
    process.env.INPUT_SUMMARY_MODE = 'off';
    process.env.INPUT_SKIP_PLAN_UPLOAD = 'false';

    const inputs = getActionInputMap();

    expect(inputs['comment-identifier']).toBe('dogfood');
    expect(inputs['summary-mode']).toBe('off');
    expect(inputs['skip-plan-upload']).toBe('false');

    delete process.env.INPUT_COMMENT_IDENTIFIER;
    delete process.env.INPUT_SUMMARY_MODE;
    delete process.env.INPUT_SKIP_PLAN_UPLOAD;
  });
});
