import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { discoverSkills } from "../src/core/SkillsProcessor";
import { SKILL_MD_FILENAME } from "../src/constants";

describe("Skills Discovery and Validation", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiller-skills-test-"));
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	describe("discoverSkills", () => {
		it("discovers skills with SKILL.md in flat structure", async () => {
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			const skill2 = path.join(skillsDir, "skill2");

			await fs.mkdir(skill1, { recursive: true });
			await fs.mkdir(skill2, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");
			await fs.writeFile(path.join(skill2, SKILL_MD_FILENAME), "# Skill 2");

			const result = await discoverSkills(tmpDir);

			expect(result.skills).toHaveLength(2);
			expect(result.skills[0].name).toBe("skill1");
			expect(result.skills[0].hasSkillMd).toBe(true);
			expect(result.skills[0].valid).toBe(true);
			expect(result.skills[1].name).toBe("skill2");
			expect(result.skills[1].hasSkillMd).toBe(true);
			expect(result.skills[1].valid).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		it("discovers skills in nested structure", async () => {
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const category = path.join(skillsDir, "category");
			const nestedSkill = path.join(category, "nested-skill");

			await fs.mkdir(nestedSkill, { recursive: true });
			await fs.writeFile(
				path.join(nestedSkill, SKILL_MD_FILENAME),
				"# Nested Skill",
			);

			const result = await discoverSkills(tmpDir);

			expect(result.skills).toHaveLength(1);
			expect(result.skills[0].name).toBe("nested-skill");
			expect(result.skills[0].hasSkillMd).toBe(true);
			expect(result.skills[0].valid).toBe(true);
			expect(result.warnings).toHaveLength(0);
		});

		it("warns about directories without SKILL.md and no sub-skills", async () => {
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const validSkill = path.join(skillsDir, "valid-skill");
			const invalidDir = path.join(skillsDir, "invalid-dir");

			await fs.mkdir(validSkill, { recursive: true });
			await fs.mkdir(invalidDir, { recursive: true });
			await fs.writeFile(
				path.join(validSkill, SKILL_MD_FILENAME),
				"# Valid Skill",
			);
			await fs.writeFile(path.join(invalidDir, "README.md"), "# Not a skill");

			const result = await discoverSkills(tmpDir);

			expect(result.skills).toHaveLength(1);
			expect(result.skills[0].name).toBe("valid-skill");
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0]).toContain("invalid-dir");
		});

		it("allows grouping directories with no SKILL.md if they contain sub-skills", async () => {
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const category = path.join(skillsDir, "category");
			const subSkill1 = path.join(category, "sub-skill-1");
			const subSkill2 = path.join(category, "sub-skill-2");

			await fs.mkdir(subSkill1, { recursive: true });
			await fs.mkdir(subSkill2, { recursive: true });
			await fs.writeFile(
				path.join(subSkill1, SKILL_MD_FILENAME),
				"# Sub Skill 1",
			);
			await fs.writeFile(
				path.join(subSkill2, SKILL_MD_FILENAME),
				"# Sub Skill 2",
			);

			const result = await discoverSkills(tmpDir);

			expect(result.skills).toHaveLength(2);
			expect(result.warnings).toHaveLength(0);
		});

		it("returns empty result when .claude/skills does not exist", async () => {
			const result = await discoverSkills(tmpDir);

			expect(result.skills).toHaveLength(0);
			expect(result.warnings).toHaveLength(0);
		});
	});

	describe("copySkillsDirectory", () => {
		it("copies .claude/skills to destination preserving structure", async () => {
			const { copySkillsDirectory } = await import("../src/core/SkillsUtils");
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			const nested = path.join(skillsDir, "category", "nested-skill");

			await fs.mkdir(skill1, { recursive: true });
			await fs.mkdir(nested, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");
			await fs.writeFile(path.join(skill1, "helper.py"), 'print("helper")');
			await fs.writeFile(
				path.join(nested, SKILL_MD_FILENAME),
				"# Nested Skill",
			);

			const destDir = path.join(tmpDir, ".claude", "skills");
			await copySkillsDirectory(skillsDir, destDir);

			const copiedSkill1 = path.join(destDir, "skill1", SKILL_MD_FILENAME);
			const copiedHelper = path.join(destDir, "skill1", "helper.py");
			const copiedNested = path.join(
				destDir,
				"category",
				"nested-skill",
				SKILL_MD_FILENAME,
			);

			expect(await fs.readFile(copiedSkill1, "utf8")).toBe("# Skill 1");
			expect(await fs.readFile(copiedHelper, "utf8")).toBe('print("helper")');
			expect(await fs.readFile(copiedNested, "utf8")).toBe("# Nested Skill");
		});

		it("creates destination directory if it does not exist", async () => {
			const { copySkillsDirectory } = await import("../src/core/SkillsUtils");
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");

			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			const destDir = path.join(tmpDir, ".claude", "skills");
			await copySkillsDirectory(skillsDir, destDir);

			const copiedSkill1 = path.join(destDir, "skill1", SKILL_MD_FILENAME);
			expect(await fs.readFile(copiedSkill1, "utf8")).toBe("# Skill 1");
		});
	});

	describe("propagateSkillsForSkillz", () => {
		it("copies .claude/skills to .claude/skills preserving structure", async () => {
			const { propagateSkillsForSkillz } = await import(
				"../src/core/SkillsProcessor"
			);
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");

			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			await propagateSkillsForSkillz(tmpDir, { dryRun: false });

			const claudeSkillsDir = path.join(tmpDir, ".claude", "skills");
			const copiedSkill = path.join(
				claudeSkillsDir,
				"skill1",
				SKILL_MD_FILENAME,
			);
			expect(await fs.readFile(copiedSkill, "utf8")).toBe("# Skill 1");
		});

		it("creates .claude directory if it does not exist", async () => {
			const { propagateSkillsForSkillz } = await import(
				"../src/core/SkillsProcessor"
			);
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");

			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			await propagateSkillsForSkillz(tmpDir, { dryRun: false });

			const skillerDir = path.join(tmpDir, ".claude");
			const stats = await fs.stat(skillerDir);
			expect(stats.isDirectory()).toBe(true);
		});

		it("uses atomic replace when overwriting existing skills", async () => {
			const { propagateSkillsForSkillz } = await import(
				"../src/core/SkillsProcessor"
			);
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			const skillzDir = path.join(tmpDir, ".skillz");
			const oldSkill = path.join(skillzDir, "old-skill");

			// Create old skills in .skillz (destination)
			await fs.mkdir(oldSkill, { recursive: true });
			await fs.writeFile(path.join(oldSkill, SKILL_MD_FILENAME), "# Old Skill");

			// Create new skills in .claude/skills (source)
			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			await propagateSkillsForSkillz(tmpDir, { dryRun: false });

			// New skill should be copied to .skillz
			const copiedSkill = path.join(skillzDir, "skill1", SKILL_MD_FILENAME);
			expect(await fs.readFile(copiedSkill, "utf8")).toBe("# Skill 1");

			// Old skill in .skillz should not exist (replaced)
			await expect(fs.access(oldSkill)).rejects.toThrow();
		});

		it("includes operations in dry-run preview without executing", async () => {
			const { propagateSkillsForSkillz } = await import(
				"../src/core/SkillsProcessor"
			);
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");

			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			const steps = await propagateSkillsForSkillz(tmpDir, { dryRun: true });

			expect(steps.length).toBeGreaterThan(0);
			expect(steps.some((step) => step.includes(".claude/skills"))).toBe(true);

			// Should not have actually copied to .skillz destination
			const skillzDir = path.join(tmpDir, ".skillz");
			await expect(fs.access(skillzDir)).rejects.toThrow();
		});

		it("no-ops gracefully when .claude/skills does not exist", async () => {
			const { propagateSkillsForSkillz } = await import(
				"../src/core/SkillsProcessor"
			);

			const steps = await propagateSkillsForSkillz(tmpDir, { dryRun: true });

			expect(steps).toHaveLength(0);
		});
	});

	describe("propagateSkills - agent exclusion", () => {
		it("does not create .skillz when only Claude Code agent is present", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { ClaudeAgent } = await import("../src/agents/ClaudeAgent");

			// Create skills in .claude/skills
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			// Run with only Claude Code agent
			await propagateSkills(tmpDir, [new ClaudeAgent()], true, false, false);

			// Verify .claude/skills was created
			const claudeSkillsDir = path.join(tmpDir, ".claude", "skills");
			await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();

			// Verify .skillz was NOT created
			const skillzDir = path.join(tmpDir, ".skillz");
			await expect(fs.access(skillzDir)).rejects.toThrow();
		});

		it("does not create .skillz when only Cursor agent is present", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { CursorAgent } = await import("../src/agents/CursorAgent");

			// Create skills in .claude/skills
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			// Run with only Cursor agent
			await propagateSkills(tmpDir, [new CursorAgent()], true, false, false);

			// Verify .skillz was NOT created (Cursor uses .cursor/rules)
			const skillzDir = path.join(tmpDir, ".skillz");
			await expect(fs.access(skillzDir)).rejects.toThrow();
		});

		it("creates .skillz when MCP agent (Windsurf) is present", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { WindsurfAgent } = await import("../src/agents/WindsurfAgent");

			// Create skills in .claude/skills
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			// Run with Windsurf agent (supports MCP)
			await propagateSkills(tmpDir, [new WindsurfAgent()], true, false, false);

			// Verify .skillz was created
			const skillzDir = path.join(tmpDir, ".skillz");
			await expect(fs.access(skillzDir)).resolves.toBeUndefined();
		});

		it("does not create .skillz when only Claude Code and Cursor are present", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { ClaudeAgent } = await import("../src/agents/ClaudeAgent");
			const { CursorAgent } = await import("../src/agents/CursorAgent");

			// Create skills in .claude/skills
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			// Run with both Claude Code and Cursor agents
			await propagateSkills(
				tmpDir,
				[new ClaudeAgent(), new CursorAgent()],
				true,
				false,
				false,
			);

			// Verify .skillz was NOT created (both have native support)
			const skillzDir = path.join(tmpDir, ".skillz");
			await expect(fs.access(skillzDir)).rejects.toThrow();
		});

		it("creates .skillz when MCP agent is present alongside Claude Code", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { ClaudeAgent } = await import("../src/agents/ClaudeAgent");
			const { WindsurfAgent } = await import("../src/agents/WindsurfAgent");

			// Create skills in .claude/skills
			const skillsDir = path.join(tmpDir, ".claude", "skills");
			const skill1 = path.join(skillsDir, "skill1");
			await fs.mkdir(skill1, { recursive: true });
			await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), "# Skill 1");

			// Run with both Claude Code and Windsurf agents
			await propagateSkills(
				tmpDir,
				[new ClaudeAgent(), new WindsurfAgent()],
				true,
				false,
				false,
			);

			// Verify .skillz was created for Windsurf
			const skillzDir = path.join(tmpDir, ".skillz");
			await expect(fs.access(skillzDir)).resolves.toBeUndefined();
		});
	});

	describe("propagateSkills - cleanup when disabled", () => {
		it("removes .claude/skills and .skillz when skills are disabled", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { allAgents } = await import("../src/lib");
			const claudeSkillsDir = path.join(tmpDir, ".claude", "skills");
			const skillzDir = path.join(tmpDir, ".skillz");

			// Create existing skills directories (as if they were from previous run)
			const claudeOldSkill = path.join(claudeSkillsDir, "old-skill");
			const skillzOldSkill = path.join(skillzDir, "old-skill");
			await fs.mkdir(claudeOldSkill, { recursive: true });
			await fs.mkdir(skillzOldSkill, { recursive: true });
			await fs.writeFile(
				path.join(claudeOldSkill, SKILL_MD_FILENAME),
				"# Old Skill",
			);
			await fs.writeFile(
				path.join(skillzOldSkill, SKILL_MD_FILENAME),
				"# Old Skill",
			);

			// Verify directories exist before cleanup
			await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();
			await expect(fs.access(skillzDir)).resolves.toBeUndefined();

			// Run propagateSkills with skillsEnabled = false
			await propagateSkills(tmpDir, allAgents, false, false, false);

			// Verify directories were removed
			await expect(fs.access(claudeSkillsDir)).rejects.toThrow();
			await expect(fs.access(skillzDir)).rejects.toThrow();
		});

		it("logs cleanup in dry-run mode without actually removing directories", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { allAgents } = await import("../src/lib");
			const claudeSkillsDir = path.join(tmpDir, ".claude", "skills");
			const skillzDir = path.join(tmpDir, ".skillz");

			// Create existing skills directories
			await fs.mkdir(claudeSkillsDir, { recursive: true });
			await fs.mkdir(skillzDir, { recursive: true });

			// Run propagateSkills with skillsEnabled = false in dry-run mode
			await propagateSkills(tmpDir, allAgents, false, true, true);

			// Verify directories still exist (dry-run doesn't remove)
			await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();
			await expect(fs.access(skillzDir)).resolves.toBeUndefined();
		});

		it("handles cleanup gracefully when directories do not exist", async () => {
			const { propagateSkills } = await import("../src/core/SkillsProcessor");
			const { allAgents } = await import("../src/lib");

			// Run propagateSkills with skillsEnabled = false when no directories exist
			await expect(
				propagateSkills(tmpDir, allAgents, false, false, false),
			).resolves.toBeUndefined();
		});
	});
});
