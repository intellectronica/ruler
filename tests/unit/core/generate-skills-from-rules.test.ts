import * as fs from "fs/promises";
import * as path from "path";
import { generateSkillsFromRules } from "../../../src/core/SkillsProcessor";
import { setupTestProject, teardownTestProject } from "../../harness";

describe("generateSkillsFromRules", () => {
	let testProject: { projectRoot: string };

	beforeEach(async () => {
		testProject = await setupTestProject();
	});

	afterEach(async () => {
		await teardownTestProject(testProject.projectRoot);
	});

	it("generates skills from .mdc files with frontmatter", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// Create a .mdc file with frontmatter
		const mdcContent = `---
description: Use when working on AI features
globs:
  - '**/*.ts'
  - '**/*.tsx'
alwaysApply: false
---

# AI Guidelines

Always use TypeScript for AI features.
`;

		await fs.writeFile(path.join(skillerDir, "rules", "ai.mdc"), mdcContent);

		// Generate skills
		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Check that skill was generated
		const skillFile = path.join(skillerDir, "skills", "ai", "SKILL.md");
		const skillContent = await fs.readFile(skillFile, "utf8");

		// Verify frontmatter
		expect(skillContent).toContain("name: ai");
		expect(skillContent).toContain(
			"description: Use when working on AI features",
		);
		expect(skillContent).toContain(
			"Applies to files matching: **/*.ts, **/*.tsx",
		);

		// Verify @filename reference
		expect(skillContent).toContain("@.claude/rules/ai.mdc");
	});

	it("handles .mdc files without frontmatter", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// Create a .mdc file without frontmatter
		const mdcContent = `# Plain MDC

This is just a plain MDC file without frontmatter.
`;

		await fs.writeFile(path.join(skillerDir, "rules", "plain.mdc"), mdcContent);

		// Generate skills
		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Check that no skill was generated
		const skillFile = path.join(skillerDir, "skills", "plain", "SKILL.md");
		await expect(fs.access(skillFile)).rejects.toThrow();
	});

	it("skips files with alwaysApply: true", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// Create a .mdc file with alwaysApply: true
		const mdcContent = `---
description: Security guidelines
alwaysApply: true
---

# Security

Always validate user input.
`;

		await fs.writeFile(
			path.join(skillerDir, "rules", "security.mdc"),
			mdcContent,
		);

		// Generate skills
		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Check that skill was NOT generated (alwaysApply: true files are merged into AGENTS.md)
		const skillFile = path.join(skillerDir, "skills", "security", "SKILL.md");
		await expect(fs.access(skillFile)).rejects.toThrow();
	});

	it("generates skills with alwaysApply: false", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// Create a .mdc file with alwaysApply: false
		const mdcContent = `---
description: Context-specific guidelines
globs:
  - '**/*.ts'
alwaysApply: false
---

# Context Guidelines

Apply when working on specific contexts.
`;

		await fs.writeFile(path.join(skillerDir, "rules", "context.mdc"), mdcContent);

		// Generate skills
		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Check that skill WAS generated
		const skillFile = path.join(skillerDir, "skills", "context", "SKILL.md");
		const skillContent = await fs.readFile(skillFile, "utf8");

		expect(skillContent).toContain("name: context");
		expect(skillContent).toContain("description: Context-specific guidelines");
		expect(skillContent).toContain("Applies to files matching: **/*.ts");
		expect(skillContent).toContain("@.claude/rules/context.mdc");
	});

	it("works in dry-run mode", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// Create a .mdc file with frontmatter
		const mdcContent = `---
description: Test rule
---

# Test
`;

		await fs.writeFile(path.join(skillerDir, "rules", "test.mdc"), mdcContent);

		// Generate skills in dry-run mode
		await generateSkillsFromRules(projectRoot, skillerDir, false, true);

		// Check that no skill was actually created
		const skillFile = path.join(skillerDir, "skills", "test", "SKILL.md");
		await expect(fs.access(skillFile)).rejects.toThrow();
	});

	it("removes existing skill when alwaysApply changes to true", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// First: Create a .mdc file with alwaysApply: false and generate skill
		const mdcContent1 = `---
description: Dynamic rule
globs:
  - '**/*.ts'
alwaysApply: false
---

# Dynamic Rule
`;

		await fs.writeFile(
			path.join(skillerDir, "rules", "dynamic.mdc"),
			mdcContent1,
		);

		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Verify skill was generated
		const skillFile = path.join(skillerDir, "skills", "dynamic", "SKILL.md");
		await expect(fs.readFile(skillFile, "utf8")).resolves.toContain(
			"@.claude/rules/dynamic.mdc",
		);

		// Second: Change the .mdc file to alwaysApply: true
		const mdcContent2 = `---
description: Dynamic rule
globs:
  - '**/*.ts'
alwaysApply: true
---

# Dynamic Rule
`;

		await fs.writeFile(
			path.join(skillerDir, "rules", "dynamic.mdc"),
			mdcContent2,
		);

		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Verify skill was removed
		await expect(fs.access(skillFile)).rejects.toThrow();
	});

	it("uses .claude directory when in claude mode", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");

		// Create .claude directory structure
		await fs.mkdir(path.join(skillerDir, "rules"), { recursive: true });

		// Create a .mdc file with frontmatter
		const mdcContent = `---
description: Claude-specific rule
globs:
  - '*.md'
---

# Claude Guidelines
`;

		await fs.writeFile(
			path.join(skillerDir, "rules", "claude-rule.mdc"),
			mdcContent,
		);

		// Generate skills
		await generateSkillsFromRules(projectRoot, skillerDir, false, false);

		// Check that skill was generated in .claude/skills
		const skillFile = path.join(skillerDir, "skills", "claude-rule", "SKILL.md");
		const skillContent = await fs.readFile(skillFile, "utf8");

		// Verify @filename reference uses .claude path
		expect(skillContent).toContain("@.claude/rules/claude-rule.mdc");
	});
});
