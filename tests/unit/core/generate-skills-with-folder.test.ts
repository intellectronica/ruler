import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('Generate Skills from Rules with Folder Support', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject();
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('copies additional files when .mdc is in a folder with same name', async () => {
    const { projectRoot } = testProject;
    const { generateSkillsFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');

    // Create folder with same name as .mdc file
    const docxRulesDir = path.join(rulesDir, 'docx');
    await fs.mkdir(docxRulesDir, { recursive: true });

    // Create .mdc file with frontmatter
    const mdcContent = `---
description: Handle DOCX file processing
globs: ["**/*.docx"]
alwaysApply: false
---

# DOCX Processing Rule

Use the script.sh helper when processing DOCX files.
`;
    await fs.writeFile(path.join(docxRulesDir, 'docx.mdc'), mdcContent);

    // Create additional files in the folder
    await fs.writeFile(
      path.join(docxRulesDir, 'script.sh'),
      '#!/bin/bash\necho "Processing DOCX"',
    );
    await fs.writeFile(
      path.join(docxRulesDir, 'helper.py'),
      'def process_docx(): pass',
    );

    // Create a subdirectory with files
    const templatesDir = path.join(docxRulesDir, 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, 'template.docx'),
      'template content',
    );

    // Generate skills
    await generateSkillsFromRules(projectRoot, skillerDir, false, false);

    // Verify SKILL.md was generated
    const skillDir = path.join(skillerDir, 'skills', 'docx');
    const skillFile = path.join(skillDir, 'SKILL.md');
    const skillContent = await fs.readFile(skillFile, 'utf8');

    expect(skillContent).toContain('name: docx');
    expect(skillContent).toContain('@.claude/rules/docx/docx.mdc');

    // Verify additional files were copied
    const scriptSh = await fs.readFile(
      path.join(skillDir, 'script.sh'),
      'utf8',
    );
    expect(scriptSh).toBe('#!/bin/bash\necho "Processing DOCX"');

    const helperPy = await fs.readFile(
      path.join(skillDir, 'helper.py'),
      'utf8',
    );
    expect(helperPy).toBe('def process_docx(): pass');

    // Verify subdirectory was copied
    const templateFile = await fs.readFile(
      path.join(skillDir, 'templates', 'template.docx'),
      'utf8',
    );
    expect(templateFile).toBe('template content');

    // Verify .mdc file itself was NOT copied
    await expect(
      fs.access(path.join(skillDir, 'docx.mdc')),
    ).rejects.toThrow();
  });

  it('does not copy additional files when .mdc is not in matching folder', async () => {
    const { projectRoot } = testProject;
    const { generateSkillsFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');

    // Create .mdc file directly in rules (not in a subfolder)
    await fs.mkdir(rulesDir, { recursive: true });
    const mdcContent = `---
description: Simple rule
alwaysApply: false
---

# Simple Rule
`;
    await fs.writeFile(path.join(rulesDir, 'simple.mdc'), mdcContent);

    // Create another file in rules directory (should NOT be copied)
    await fs.writeFile(path.join(rulesDir, 'other-file.txt'), 'other content');

    // Generate skills
    await generateSkillsFromRules(projectRoot, skillerDir, false, false);

    // Verify SKILL.md was generated
    const skillDir = path.join(skillerDir, 'skills', 'simple');
    const skillFile = path.join(skillDir, 'SKILL.md');
    await expect(fs.access(skillFile)).resolves.not.toThrow();

    // Verify other-file.txt was NOT copied (since simple.mdc is not in a "simple" folder)
    await expect(
      fs.access(path.join(skillDir, 'other-file.txt')),
    ).rejects.toThrow();
  });

  it('handles folder with same name but in different directory structure', async () => {
    const { projectRoot } = testProject;
    const { generateSkillsFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure with nested folders
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');

    // Create nested structure: rules/backend/api/api.mdc
    const apiRulesDir = path.join(rulesDir, 'backend', 'api');
    await fs.mkdir(apiRulesDir, { recursive: true });

    const mdcContent = `---
description: API guidelines
alwaysApply: false
---

# API Guidelines
`;
    await fs.writeFile(path.join(apiRulesDir, 'api.mdc'), mdcContent);

    // Create additional file in the api folder
    await fs.writeFile(
      path.join(apiRulesDir, 'api-helper.js'),
      'module.exports = {}',
    );

    // Generate skills
    await generateSkillsFromRules(projectRoot, skillerDir, false, false);

    // Verify SKILL.md was generated
    const skillDir = path.join(skillerDir, 'skills', 'api');
    const skillFile = path.join(skillDir, 'SKILL.md');
    await expect(fs.access(skillFile)).resolves.not.toThrow();

    // Verify api-helper.js was copied (since api.mdc is in an "api" folder)
    const helperContent = await fs.readFile(
      path.join(skillDir, 'api-helper.js'),
      'utf8',
    );
    expect(helperContent).toBe('module.exports = {}');
  });
});
