import {
  validateFrontmatter,
  mapToolsForCopilot,
  parseFrontmatter,
} from '../../../src/core/SubagentsUtils';

describe('SubagentsUtils.validateFrontmatter', () => {
  it('accepts minimal valid frontmatter', () => {
    const result = validateFrontmatter(
      { name: 'reviewer', description: 'reviews code' },
      'reviewer',
    );
    expect('error' in result).toBe(false);
    if ('value' in result) {
      expect(result.value).toEqual({
        name: 'reviewer',
        description: 'reviews code',
      });
    }
  });

  it('rejects when required name is missing', () => {
    const result = validateFrontmatter({ description: 'x' }, 'reviewer');
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/name/);
  });

  it('rejects when required description is missing', () => {
    const result = validateFrontmatter({ name: 'reviewer' }, 'reviewer');
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/description/);
  });

  it('rejects when name does not match filename stem', () => {
    const result = validateFrontmatter(
      { name: 'planner', description: 'x' },
      'reviewer',
    );
    expect('error' in result).toBe(true);
    if ('error' in result)
      expect(result.error).toMatch(/does not match filename stem/);
  });

  it('parses tools as a string array', () => {
    const result = validateFrontmatter(
      {
        name: 'reviewer',
        description: 'x',
        tools: ['Read', 'Grep'],
      },
      'reviewer',
    );
    if ('value' in result) {
      expect(result.value.tools).toEqual(['Read', 'Grep']);
    } else {
      throw new Error('expected success');
    }
  });

  it('parses tools as a comma-separated string', () => {
    const result = validateFrontmatter(
      { name: 'reviewer', description: 'x', tools: ' Read , Grep , Glob ' },
      'reviewer',
    );
    if ('value' in result) {
      expect(result.value.tools).toEqual(['Read', 'Grep', 'Glob']);
    } else {
      throw new Error('expected success');
    }
  });

  it('rejects tools when not array nor string', () => {
    const result = validateFrontmatter(
      { name: 'reviewer', description: 'x', tools: 42 },
      'reviewer',
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/tools/);
  });

  it('rejects model when not a string', () => {
    const result = validateFrontmatter(
      { name: 'reviewer', description: 'x', model: 5 },
      'reviewer',
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/model/);
  });

  it('rejects readonly when not a boolean', () => {
    const result = validateFrontmatter(
      { name: 'reviewer', description: 'x', readonly: 'yes' },
      'reviewer',
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/readonly/);
  });

  it('rejects is_background when not a boolean', () => {
    const result = validateFrontmatter(
      { name: 'reviewer', description: 'x', is_background: 1 },
      'reviewer',
    );
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/is_background/);
  });

  it('preserves valid optional model, readonly, is_background', () => {
    const result = validateFrontmatter(
      {
        name: 'reviewer',
        description: 'x',
        model: 'opus',
        readonly: true,
        is_background: false,
      },
      'reviewer',
    );
    if ('value' in result) {
      expect(result.value.model).toBe('opus');
      expect(result.value.readonly).toBe(true);
      expect(result.value.is_background).toBe(false);
    } else {
      throw new Error('expected success');
    }
  });
});

describe('SubagentsUtils.parseFrontmatter', () => {
  it('returns null when no frontmatter delimiter present', () => {
    expect(parseFrontmatter('# Just markdown\n\nNo YAML.')).toBeNull();
  });

  it('parses valid frontmatter and body', () => {
    const parsed = parseFrontmatter('---\nname: x\ndescription: y\n---\nbody');
    expect(parsed).not.toBeNull();
    expect(parsed!.meta).toEqual({ name: 'x', description: 'y' });
    expect(parsed!.body).toBe('body');
  });

  it('returns empty meta object when YAML is null', () => {
    const parsed = parseFrontmatter('---\n\n---\n');
    expect(parsed).not.toBeNull();
    expect(parsed!.meta).toEqual({});
  });
});

describe('SubagentsUtils.mapToolsForCopilot', () => {
  it('maps known Claude tools to Copilot aliases', () => {
    const { tools, unknown } = mapToolsForCopilot(['Read', 'Bash', 'Edit']);
    expect(tools).toEqual(expect.arrayContaining(['read', 'execute', 'edit']));
    expect(unknown).toEqual([]);
  });

  it('deduplicates aliases when several tools map to the same target', () => {
    const { tools } = mapToolsForCopilot(['Grep', 'Glob']);
    expect(tools).toEqual(['search']);
  });

  it('reports unknown tools without mapping them', () => {
    const { tools, unknown } = mapToolsForCopilot(['Read', 'CustomTool']);
    expect(tools).toEqual(['read']);
    expect(unknown).toEqual(['CustomTool']);
  });

  it('returns empty arrays for empty input', () => {
    expect(mapToolsForCopilot([])).toEqual({ tools: [], unknown: [] });
  });
});
