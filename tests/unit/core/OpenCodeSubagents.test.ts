import * as yaml from 'js-yaml';
import { buildOpenCodeFile } from '../../../src/core/OpenCodeSubagents';
import type { SubagentInfo } from '../../../src/types';

function sub(overrides: Record<string, unknown> = {}): SubagentInfo {
  return {
    name: 'reviewer',
    path: '/tmp/reviewer.md',
    valid: true,
    body: 'Review the code.\n',
    frontmatter: {
      name: 'reviewer',
      description: 'Reviews code',
      ...overrides,
    },
  } as SubagentInfo;
}

function meta(content: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);
  if (!match) throw new Error('missing frontmatter');
  expect(match[2]).toBe('Review the code.\n');
  return yaml.load(match[1]) as Record<string, unknown>;
}

describe('buildOpenCodeFile', () => {
  it('emits native frontmatter without source-only keys', () => {
    const { content, warnings } = buildOpenCodeFile(sub());
    expect(meta(content)).toEqual({
      description: 'Reviews code',
      mode: 'subagent',
    });
    expect(warnings).toEqual([]);
  });

  it('uses target model, supporting custom providers and model paths', () => {
    const { content } = buildOpenCodeFile(
      sub({
        model: 'shared/model',
        targets: { opencode: { model: 'custom/model/family/v2' } },
      }),
    );
    expect(meta(content).model).toBe('custom/model/family/v2');
  });

  it('uses the shared model when no OpenCode model is set', () => {
    expect(
      meta(buildOpenCodeFile(sub({ model: 'shared/model' })).content).model,
    ).toBe('shared/model');
  });

  it('omits an inherited shared model', () => {
    expect(
      meta(buildOpenCodeFile(sub({ model: 'inherit' })).content),
    ).not.toHaveProperty('model');
  });

  it('omits model when explicit target override says inherit', () => {
    expect(
      meta(
        buildOpenCodeFile(
          sub({
            model: 'shared/model',
            targets: { opencode: { model: 'inherit' } },
          }),
        ).content,
      ),
    ).not.toHaveProperty('model');
  });

  it.each([
    'missing-slash',
    '/model',
    'provider/',
    'provider//model',
    'provider/a//b',
    'provider/a b',
    'provider /model',
    '',
  ])('rejects malformed selected model %j', (model) => {
    expect(() =>
      buildOpenCodeFile(sub({ targets: { opencode: { model } } })),
    ).toThrow(/OpenCode model/);
  });

  it('isolates invalid OpenCode model from common parsing', () => {
    expect(() =>
      buildOpenCodeFile(
        sub({
          model: 'shared/model',
          targets: { opencode: { model: 'broken' } },
        }),
      ),
    ).toThrow(/OpenCode model/);
  });

  it('throws a stored OpenCode-only validation error', () => {
    const agent = sub({ model: 'shared/model' });
    agent.targetErrors = {
      opencode: 'invalid "targets.opencode.permission.bash" field',
    };
    expect(() => buildOpenCodeFile(agent)).toThrow(
      /OpenCode.*permission\.bash/,
    );
  });

  it('maps tools with deny-all and warns on unknown tools', () => {
    const { content, warnings } = buildOpenCodeFile(
      sub({
        tools: [
          'Read',
          'Grep',
          'Glob',
          'Bash',
          'Edit',
          'Write',
          'WebFetch',
          'WebSearch',
          'Task',
          'Skill',
          'TodoWrite',
          'Mystery',
        ],
      }),
    );
    expect(meta(content).permission).toEqual({
      '*': 'deny',
      read: 'allow',
      grep: 'allow',
      glob: 'allow',
      bash: 'allow',
      edit: 'allow',
      webfetch: 'allow',
      websearch: 'allow',
      task: 'allow',
      skill: 'allow',
      todowrite: 'allow',
    });
    expect(warnings.join(' ')).toMatch(/Mystery/);
  });

  it('keeps explicit empty tools deny-all', () => {
    expect(
      meta(buildOpenCodeFile(sub({ tools: [] })).content).permission,
    ).toEqual({ '*': 'deny' });
  });

  it('allows native overrides with nested rules in caller order', () => {
    const { content } = buildOpenCodeFile(
      sub({
        tools: ['Bash'],
        targets: {
          opencode: {
            permission: {
              bash: { 'git status*': 'allow', '*': 'ask', 'rm *': 'deny' },
              read: 'allow',
            },
          },
        },
      }),
    );
    const permission = meta(content).permission as Record<string, unknown>;
    expect(permission).toEqual({
      '*': 'deny',
      bash: { 'git status*': 'allow', '*': 'ask', 'rm *': 'deny' },
      read: 'allow',
    });
    expect(Object.keys(permission.bash as object)).toEqual([
      'git status*',
      '*',
      'rm *',
    ]);
  });

  it.each([
    [{ 'sensitive-*': 'deny', '*': 'allow' }, ['sensitive-*', '*']],
    [{ '*': 'allow', 'sensitive-*': 'deny' }, ['*', 'sensitive-*']],
  ])('preserves native nested permission rule order', (rules, expectedKeys) => {
    const { content } = buildOpenCodeFile(
      sub({ targets: { opencode: { permission: { bash: rules } } } }),
    );
    const permission = meta(content).permission as Record<
      string,
      Record<string, string>
    >;
    expect(Object.keys(permission.bash)).toEqual(expectedKeys);
  });

  it('treats inherited object names as unknown source tools', () => {
    const result = buildOpenCodeFile(sub({ tools: ['toString', '__proto__'] }));
    expect(meta(result.content).permission).toEqual({ '*': 'deny' });
    expect(result.warnings.join(' ')).toMatch(/toString.*__proto__/);
  });

  it('preserves an explicit __proto__ native permission rule as data', () => {
    const permission = Object.fromEntries([
      ['__proto__', 'deny'],
      ['read', 'allow'],
    ]);
    const result = buildOpenCodeFile(
      sub({ targets: { opencode: { permission } } }),
    );
    const rendered = meta(result.content).permission as Record<string, unknown>;
    expect(Object.keys(rendered)).toEqual(['__proto__', 'read']);
    expect(Object.getOwnPropertyDescriptor(rendered, '__proto__')?.value).toBe(
      'deny',
    );
  });

  it('keeps native permission when source tools are absent', () => {
    expect(
      meta(
        buildOpenCodeFile(
          sub({ targets: { opencode: { permission: { read: 'ask' } } } }),
        ).content,
      ).permission,
    ).toEqual({ read: 'ask' });
  });

  it('places an explicit wildcard override after mapped tool permissions', () => {
    const result = buildOpenCodeFile(
      sub({
        tools: ['Read'],
        targets: { opencode: { permission: { '*': 'deny' } } },
      }),
    );
    const permission = meta(result.content).permission as Record<
      string,
      unknown
    >;
    expect(Object.keys(permission)).toEqual(['read', '*']);
    expect(permission).toEqual({ read: 'allow', '*': 'deny' });
  });

  it('applies mixed native overrides in exact caller order after defaults', () => {
    const result = buildOpenCodeFile(
      sub({
        tools: ['Read'],
        targets: { opencode: { permission: { read: 'ask', '*': 'deny' } } },
      }),
    );
    const permission = meta(result.content).permission as Record<
      string,
      unknown
    >;
    expect(Object.keys(permission)).toEqual(['read', '*']);
    expect(permission).toEqual({ read: 'ask', '*': 'deny' });
  });

  it('enforces a conservative readonly policy and warns on dropped tools', () => {
    const { content, warnings } = buildOpenCodeFile(
      sub({ readonly: true, tools: ['Read', 'Bash', 'Task', 'Skill', 'Edit'] }),
    );
    expect(meta(content).permission).toEqual({
      '*': 'deny',
      read: 'allow',
      skill: 'allow',
    });
    expect(warnings.join(' ')).toMatch(/Bash.*Task.*Edit/);
  });

  it('permits safe read-only overrides but rejects contradictory ones', () => {
    const safe = buildOpenCodeFile(
      sub({
        readonly: true,
        targets: {
          opencode: {
            permission: {
              read: { 'private/*': 'deny', '*': 'allow' },
              list: 'allow',
            },
          },
        },
      }),
    );
    expect(meta(safe.content).permission).toEqual({
      '*': 'deny',
      read: { 'private/*': 'deny', '*': 'allow' },
      glob: 'allow',
      grep: 'allow',
      list: 'allow',
      skill: 'allow',
      webfetch: 'allow',
      websearch: 'allow',
    });
    expect(() =>
      buildOpenCodeFile(
        sub({
          readonly: true,
          targets: { opencode: { permission: { bash: 'allow' } } },
        }),
      ),
    ).toThrow(/readonly.*bash/i);
    expect(() =>
      buildOpenCodeFile(
        sub({
          readonly: true,
          targets: { opencode: { permission: { '*': 'allow' } } },
        }),
      ),
    ).toThrow(/readonly.*\*/i);
  });

  it('warns that source background mode has no static equivalent', () => {
    const result = buildOpenCodeFile(sub({ is_background: true }));
    expect(result.warnings.join(' ')).toMatch(/background/i);
    expect(meta(result.content)).not.toHaveProperty('is_background');
  });

  it('rejects readonly shell exceptions but accepts explicitly denied patterns', () => {
    const configure = (rule: Record<string, string>) =>
      sub({
        readonly: true,
        targets: { opencode: { permission: { bash: rule } } },
      });
    expect(() =>
      buildOpenCodeFile(configure({ '*': 'deny', 'git push*': 'allow' })),
    ).toThrow(/readonly.*bash/);
    expect(() =>
      buildOpenCodeFile(configure({ '*': 'deny', 'git push*': 'ask' })),
    ).toThrow(/readonly.*bash/);
    expect(
      meta(buildOpenCodeFile(configure({ '*': 'deny' })).content).permission,
    ).toMatchObject({ '*': 'deny', bash: { '*': 'deny' } });
  });

  it.each([{}, { 'protected/*': 'deny' }])(
    'rejects readonly wildcard rules without a deny-all pattern: %j',
    (rule) => {
      expect(() =>
        buildOpenCodeFile(
          sub({
            readonly: true,
            targets: { opencode: { permission: { '*': rule } } },
          }),
        ),
      ).toThrow(/readonly.*\*/i);
    },
  );

  it('accepts a readonly wildcard rule with an explicit deny-all pattern', () => {
    const { content } = buildOpenCodeFile(
      sub({
        readonly: true,
        targets: { opencode: { permission: { '*': { '*': 'deny' } } } },
      }),
    );
    expect(meta(content).permission).toMatchObject({ '*': { '*': 'deny' } });
  });
});
