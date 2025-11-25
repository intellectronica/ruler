import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { updateGitignore } from "../../../src/core/GitignoreUtils";

describe("GitignoreUtils - Root Anchored Paths", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "skiller-gitignore-anchored-"),
		);
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	it("should anchor all paths to repository root with leading /", async () => {
		const paths = [
			"AGENTS.md",
			"subdir/AGENTS.md",
			".codex/config.toml",
			".aider/config.yml",
		];

		await updateGitignore(tmpDir, paths);

		const gitignorePath = path.join(tmpDir, ".gitignore");
		const content = await fs.readFile(gitignorePath, "utf8");

		expect(content).toContain("/AGENTS.md");
		expect(content).toContain("/subdir/AGENTS.md");
		expect(content).toContain("/.codex/config.toml");
		expect(content).toContain("/.aider/config.yml");

		// Should not contain unanchored patterns
		expect(content).not.toContain("\nAGENTS.md\n");
		expect(content).not.toContain("\nconfig.toml\n");
	});

	it("should filter out paths inside .claude directories", async () => {
		const paths = [
			"AGENTS.md",
			".claude/AGENTS.md", // Should be filtered out
			"subdir/.claude/config.toml", // Should be filtered out
			".codex/config.toml",
		];

		await updateGitignore(tmpDir, paths);

		const gitignorePath = path.join(tmpDir, ".gitignore");
		const content = await fs.readFile(gitignorePath, "utf8");

		expect(content).toContain("/AGENTS.md");
		expect(content).toContain("/.codex/config.toml");

		// Should not contain .claude paths
		expect(content).not.toContain(".claude/AGENTS.md");
		expect(content).not.toContain(".claude/config.toml");
	});

	it("should create specific backup patterns instead of broad wildcards", async () => {
		const paths = [
			"AGENTS.md",
			"AGENTS.md.bak",
			".codex/config.toml",
			".codex/config.toml.bak",
		];

		await updateGitignore(tmpDir, paths);

		const gitignorePath = path.join(tmpDir, ".gitignore");
		const content = await fs.readFile(gitignorePath, "utf8");

		expect(content).toContain("/AGENTS.md.bak");
		expect(content).toContain("/.codex/config.toml.bak");

		// Should not contain broad wildcard
		expect(content).not.toContain("*.bak");
	});

	it("should handle nested scenario with multiple .claude directories", async () => {
		// Simulate nested .claude directories with generated outputs at multiple levels
		const paths = [
			"AGENTS.md", // Root level generated
			"subpkg/AGENTS.md", // Nested generated
			".codex/config.toml", // Root level MCP config
			"subpkg/.codex/config.toml", // Nested MCP config
			".claude/AGENTS.md", // Input (should be filtered)
			"subpkg/.claude/AGENTS.md", // Nested input (should be filtered)
		];

		await updateGitignore(tmpDir, paths);

		const gitignorePath = path.join(tmpDir, ".gitignore");
		const content = await fs.readFile(gitignorePath, "utf8");

		// Should contain root-anchored generated files
		expect(content).toContain("/AGENTS.md");
		expect(content).toContain("/subpkg/AGENTS.md");
		expect(content).toContain("/.codex/config.toml");
		expect(content).toContain("/subpkg/.codex/config.toml");

		// Should NOT contain input files inside .claude directories
		expect(content).not.toContain(".claude/AGENTS.md");
	});

	it("should maintain sorting and deduplication", async () => {
		const paths = [
			"z-file.md",
			"a-file.md",
			"b-file.md",
			"a-file.md", // duplicate
		];

		await updateGitignore(tmpDir, paths);

		const gitignorePath = path.join(tmpDir, ".gitignore");
		const content = await fs.readFile(gitignorePath, "utf8");
		const lines = content.split("\n");
		const startIndex = lines.findIndex(
			(line) => line === "# START Skiller Generated Files",
		);
		const endIndex = lines.findIndex(
			(line) => line === "# END Skiller Generated Files",
		);
		const skillerLines = lines
			.slice(startIndex + 1, endIndex)
			.filter((line) => line.trim());

		// Should be sorted and deduplicated
		expect(skillerLines).toEqual(["/a-file.md", "/b-file.md", "/z-file.md"]);
	});

	it("should migrate legacy unanchored patterns to root-anchored ones", async () => {
		const paths = ["AGENTS.md", ".codex/config.toml"];

		// Create an existing .gitignore with legacy unanchored patterns
		const gitignorePath = path.join(tmpDir, ".gitignore");
		const legacyContent = `node_modules/
# START Skiller Generated Files
AGENTS.md
.codex/config.toml
# END Skiller Generated Files
*.log`;
		await fs.writeFile(gitignorePath, legacyContent);

		// Update with the same paths
		await updateGitignore(tmpDir, paths);

		const content = await fs.readFile(gitignorePath, "utf8");

		// Should now contain root-anchored versions
		expect(content).toContain("/AGENTS.md");
		expect(content).toContain("/.codex/config.toml");

		// Should preserve non-Skiller content
		expect(content).toContain("node_modules/");
		expect(content).toContain("*.log");

		// Should still only have one Skiller block
		const skillerBlockCount = (
			content.match(/# START Skiller Generated Files/g) || []
		).length;
		expect(skillerBlockCount).toBe(1);
	});
});
