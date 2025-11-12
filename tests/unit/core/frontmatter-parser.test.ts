import { parseFrontmatter } from '../../../src/core/FrontmatterParser';

describe('FrontmatterParser', () => {
  describe('parseFrontmatter', () => {
    it('should parse valid frontmatter with all fields', () => {
      const content = `---
description: My custom rule
globs:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: true
---
# Rule Content

This is the rule body.`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        description: 'My custom rule',
        globs: ['**/*.ts', '**/*.tsx'],
        alwaysApply: true,
      });
      expect(result.body).toBe('# Rule Content\n\nThis is the rule body.');
    });

    it('should parse frontmatter with only description', () => {
      const content = `---
description: Simple rule
---
Body content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        description: 'Simple rule',
      });
      expect(result.body).toBe('Body content');
    });

    it('should parse frontmatter with only alwaysApply', () => {
      const content = `---
alwaysApply: true
---
Rule content here`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        alwaysApply: true,
      });
      expect(result.body).toBe('Rule content here');
    });

    it('should handle globs as single string', () => {
      const content = `---
globs: "**/*.ts"
alwaysApply: false
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        globs: ['**/*.ts'],
        alwaysApply: false,
      });
    });

    it('should return null frontmatter when no frontmatter present', () => {
      const content = `# Regular Markdown

No frontmatter here.`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toBeNull();
      expect(result.body).toBe(content);
    });

    it('should return null frontmatter when frontmatter is malformed', () => {
      const content = `---
this is not valid yaml: [
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toBeNull();
      expect(result.body).toBe(content);
    });

    it('should ignore frontmatter not at start of file', () => {
      const content = `Some content before

---
description: This should be ignored
---
More content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toBeNull();
      expect(result.body).toBe(content);
    });

    it('should handle empty frontmatter block', () => {
      const content = `---
---
Body content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe('Body content');
    });

    it('should filter out invalid globs array elements', () => {
      const content = `---
globs:
  - "**/*.ts"
  - 123
  - "**/*.js"
  - null
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        globs: ['**/*.ts', '**/*.js'],
      });
    });

    it('should ignore unknown fields', () => {
      const content = `---
description: My rule
unknownField: value
alwaysApply: true
anotherUnknown: 123
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        description: 'My rule',
        alwaysApply: true,
      });
    });

    it('should handle whitespace variations in delimiters', () => {
      const content = `---
description: Rule with spaces
---
Body`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        description: 'Rule with spaces',
      });
      expect(result.body).toBe('Body');
    });

    it('should handle multiline content in body', () => {
      const content = `---
alwaysApply: true
---
# Title

Paragraph 1

Paragraph 2

- List item 1
- List item 2`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        alwaysApply: true,
      });
      expect(result.body).toContain('# Title');
      expect(result.body).toContain('- List item 2');
    });

    it('should handle complex YAML structures gracefully', () => {
      const content = `---
description: Complex rule
nested:
  field: value
arrayOfObjects:
  - name: test
    value: 123
alwaysApply: true
---
Content`;

      const result = parseFrontmatter(content);

      // Should extract known fields, ignore complex structures
      expect(result.frontmatter).toEqual({
        description: 'Complex rule',
        alwaysApply: true,
      });
    });

    it('should handle comma-separated unquoted globs (lenient parsing)', () => {
      const content = `---
description: React patterns
globs: *.tsx,**/globals.css
alwaysApply: true
---
Content`;

      const result = parseFrontmatter(content);

      // Should parse the comma-separated globs correctly
      expect(result.frontmatter).toEqual({
        description: 'React patterns',
        globs: ['*.tsx', '**/globals.css'],
        alwaysApply: true,
      });
      expect(result.body).toBe('Content');
    });

    it('should handle comma-separated globs with spaces', () => {
      const content = `---
description: Test
globs: *.ts , **/*.tsx , src/**/*.js
alwaysApply: false
---
Body`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        description: 'Test',
        globs: ['*.ts', '**/*.tsx', 'src/**/*.js'],
        alwaysApply: false,
      });
    });

    it('should handle single unquoted glob pattern', () => {
      const content = `---
description: Single glob
globs: *.tsx
alwaysApply: true
---
Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        description: 'Single glob',
        globs: ['*.tsx'],
        alwaysApply: true,
      });
    });
  });
});
