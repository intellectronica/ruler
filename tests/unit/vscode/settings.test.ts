import {
  clone,
  mergeAugmentMcpServers,
  transformRulerToAugmentMcp,
  type VSCodeSettings,
  type AugmentMcpServer,
} from '../../../src/vscode/settings';

describe('clone', () => {
  it('should deep clone a simple object', () => {
    const original = { a: 1, b: 2 };
    const cloned = clone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should deep clone nested objects', () => {
    const original = {
      a: 1,
      b: {
        c: 2,
        d: { e: 3 },
      },
    };
    const cloned = clone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.b.d).not.toBe(original.b.d);
  });

  it('should deep clone arrays', () => {
    const original = { items: [1, 2, 3] };
    const cloned = clone(original);

    expect(cloned).toEqual(original);
    expect(cloned.items).not.toBe(original.items);
  });

  it('should deep clone VSCodeSettings', () => {
    const original: VSCodeSettings = {
      'editor.fontSize': 14,
      'augment.advanced': {
        mcpServers: [
          { name: 'test', command: 'node', args: ['server.js'] },
        ],
      },
    };
    const cloned = clone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned['augment.advanced']).not.toBe(original['augment.advanced']);
  });
});

describe('mergeAugmentMcpServers', () => {
  it('should not mutate the original settings', () => {
    const existingSettings: VSCodeSettings = {
      'editor.fontSize': 14,
      'augment.advanced': {
        mcpServers: [{ name: 'existing', command: 'test' }],
      },
    };
    const originalCopy = JSON.parse(JSON.stringify(existingSettings));
    const newServers: AugmentMcpServer[] = [
      { name: 'new', command: 'new-test' },
    ];

    mergeAugmentMcpServers(existingSettings, newServers, 'merge');

    expect(existingSettings).toEqual(originalCopy);
  });

  it('should overwrite servers when strategy is overwrite', () => {
    const existingSettings: VSCodeSettings = {
      'editor.fontSize': 14,
      'augment.advanced': {
        mcpServers: [{ name: 'existing', command: 'test' }],
      },
    };
    const newServers: AugmentMcpServer[] = [
      { name: 'new', command: 'new-test' },
    ];

    const result = mergeAugmentMcpServers(
      existingSettings,
      newServers,
      'overwrite',
    );

    expect(result['augment.advanced']?.mcpServers).toEqual(newServers);
    expect(result['augment.advanced']?.mcpServers?.length).toBe(1);
  });

  it('should merge servers when strategy is merge', () => {
    const existingSettings: VSCodeSettings = {
      'editor.fontSize': 14,
      'augment.advanced': {
        mcpServers: [{ name: 'existing', command: 'test' }],
      },
    };
    const newServers: AugmentMcpServer[] = [
      { name: 'new', command: 'new-test' },
    ];

    const result = mergeAugmentMcpServers(existingSettings, newServers, 'merge');

    expect(result['augment.advanced']?.mcpServers?.length).toBe(2);
    expect(result['augment.advanced']?.mcpServers).toContainEqual({
      name: 'existing',
      command: 'test',
    });
    expect(result['augment.advanced']?.mcpServers).toContainEqual({
      name: 'new',
      command: 'new-test',
    });
  });

  it('should update existing server when merging with same name', () => {
    const existingSettings: VSCodeSettings = {
      'augment.advanced': {
        mcpServers: [{ name: 'test', command: 'old-command' }],
      },
    };
    const newServers: AugmentMcpServer[] = [
      { name: 'test', command: 'new-command', args: ['arg1'] },
    ];

    const result = mergeAugmentMcpServers(existingSettings, newServers, 'merge');

    expect(result['augment.advanced']?.mcpServers?.length).toBe(1);
    expect(result['augment.advanced']?.mcpServers?.[0]).toEqual({
      name: 'test',
      command: 'new-command',
      args: ['arg1'],
    });
  });

  it('should create augment.advanced if it does not exist', () => {
    const existingSettings: VSCodeSettings = {
      'editor.fontSize': 14,
    };
    const newServers: AugmentMcpServer[] = [
      { name: 'new', command: 'test' },
    ];

    const result = mergeAugmentMcpServers(
      existingSettings,
      newServers,
      'overwrite',
    );

    expect(result['augment.advanced']).toBeDefined();
    expect(result['augment.advanced']?.mcpServers).toEqual(newServers);
  });

  it('should preserve other settings in augment.advanced', () => {
    const existingSettings: VSCodeSettings = {
      'augment.advanced': {
        mcpServers: [],
        otherSetting: 'value',
      },
    };
    const newServers: AugmentMcpServer[] = [
      { name: 'new', command: 'test' },
    ];

    const result = mergeAugmentMcpServers(
      existingSettings,
      newServers,
      'overwrite',
    );

    expect(result['augment.advanced']?.otherSetting).toBe('value');
  });
});

describe('transformRulerToAugmentMcp', () => {
  it('should transform ruler MCP config to Augment format', () => {
    const rulerMcp = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['server.js'],
          env: { KEY: 'value' },
        },
      },
    };

    const result = transformRulerToAugmentMcp(rulerMcp);

    expect(result).toEqual([
      {
        name: 'test-server',
        command: 'node',
        args: ['server.js'],
        env: { KEY: 'value' },
      },
    ]);
  });

  it('should handle servers without args or env', () => {
    const rulerMcp = {
      mcpServers: {
        'simple-server': {
          command: 'python',
        },
      },
    };

    const result = transformRulerToAugmentMcp(rulerMcp);

    expect(result).toEqual([
      {
        name: 'simple-server',
        command: 'python',
      },
    ]);
  });

  it('should return empty array for empty mcpServers', () => {
    const rulerMcp = {
      mcpServers: {},
    };

    const result = transformRulerToAugmentMcp(rulerMcp);

    expect(result).toEqual([]);
  });

  it('should return empty array when mcpServers is missing', () => {
    const rulerMcp = {};

    const result = transformRulerToAugmentMcp(rulerMcp);

    expect(result).toEqual([]);
  });
});
