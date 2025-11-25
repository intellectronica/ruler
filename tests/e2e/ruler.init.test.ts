import * as fs from "fs/promises";
import * as path from "path";
import os from "os";
import { execSync } from "child_process";
import {
	setupTestProject,
	teardownTestProject,
	runSkillerWithInheritedStdio,
} from "../harness";

describe("End-to-End skiller init command", () => {
	let testProject: { projectRoot: string };

	beforeAll(async () => {
		testProject = await setupTestProject();
	});

	afterAll(async () => {
		await teardownTestProject(testProject.projectRoot);
	});

	it("creates .claude directory and default files", async () => {
		const { projectRoot } = testProject;

		runSkillerWithInheritedStdio("init", projectRoot);

		const skillerDir = path.join(projectRoot, ".claude");
		const instr = path.join(skillerDir, "AGENTS.md");
		const toml = path.join(skillerDir, "skiller.toml");
		const mcpJson = path.join(skillerDir, "mcp.json");

		await expect(fs.stat(skillerDir)).resolves.toBeDefined();
		await expect(fs.readFile(instr, "utf8")).resolves.toMatch(/^# AGENTS\.md/);

		const tomlContent = await fs.readFile(toml, "utf8");
		expect(tomlContent).toMatch(/^# Skiller Configuration File/);
		expect(tomlContent).toContain("# --- MCP Servers ---");
		expect(tomlContent).toContain("[mcp_servers.example_stdio]");
		expect(tomlContent).toContain("[mcp_servers.example_remote]");

		// Verify mcp.json is NOT created
		await expect(fs.stat(mcpJson)).rejects.toThrow();
	});

	it("does not overwrite existing files", async () => {
		const { projectRoot } = testProject;
		const skillerDir = path.join(projectRoot, ".claude");
		const instr = path.join(skillerDir, "AGENTS.md");
		const toml = path.join(skillerDir, "skiller.toml");
		// Prepopulate with markers
		await fs.writeFile(instr, "KEEP");
		await fs.writeFile(toml, "KEEP");
		runSkillerWithInheritedStdio("init", projectRoot);
		expect(await fs.readFile(instr, "utf8")).toBe("KEEP");
		expect(await fs.readFile(toml, "utf8")).toBe("KEEP");
	});

	it("creates AGENTS.md alongside legacy instructions.md if legacy exists", async () => {
		// create isolated new project root to not interfere with earlier tests
		const { projectRoot } = await setupTestProject();
		const skillerDir = path.join(projectRoot, ".claude");
		await fs.mkdir(skillerDir, { recursive: true });
		const legacyPath = path.join(skillerDir, "instructions.md");
		await fs.writeFile(legacyPath, "LEGACY");
		await runSkillerWithInheritedStdio("init", projectRoot);
		const newPath = path.join(skillerDir, "AGENTS.md");
		await expect(fs.readFile(legacyPath, "utf8")).resolves.toBe("LEGACY");
		await expect(fs.readFile(newPath, "utf8")).resolves.toMatch(
			/^# AGENTS\.md/,
		);
		await teardownTestProject(projectRoot);
	});
});
