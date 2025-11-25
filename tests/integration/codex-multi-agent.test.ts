import * as fs from "fs/promises";
import * as path from "path";
import {
	setupTestProject,
	teardownTestProject,
	runSkillerWithInheritedStdio,
} from "../harness";

describe("Codex config generation with multiple AGENTS.md writers", () => {
	let project: { projectRoot: string };

	beforeAll(async () => {
		project = await setupTestProject({
			".claude/a.md": "Rule A",
			".claude/b.md": "Rule B",
			// Provide MCP servers so Codex has something to write into config.toml
			".claude/mcp.json": JSON.stringify({
				mcpServers: {
					example_server: { command: "uvx", args: ["example-mcp"] },
				},
			}),
		});
	});

	afterAll(async () => {
		await teardownTestProject(project.projectRoot);
	});

	beforeEach(async () => {
		// Clean previous outputs
		await fs.rm(path.join(project.projectRoot, "AGENTS.md"), { force: true });
		await fs.rm(path.join(project.projectRoot, ".codex"), {
			recursive: true,
			force: true,
		});
	});

	it("writes .codex/config.toml when running jules,codex", async () => {
		runSkillerWithInheritedStdio(
			"apply --agents jules,codex",
			project.projectRoot,
		);
		const codexToml = path.join(project.projectRoot, ".codex", "config.toml");
		const content = await fs.readFile(codexToml, "utf8");
		expect(content).toMatch(/\[mcp_servers\.example_server\]/);
	});

	it("writes .codex/config.toml when running codex,jules", async () => {
		runSkillerWithInheritedStdio(
			"apply --agents codex,jules",
			project.projectRoot,
		);
		const codexToml = path.join(project.projectRoot, ".codex", "config.toml");
		const content = await fs.readFile(codexToml, "utf8");
		expect(content).toMatch(/\[mcp_servers\.example_server\]/);
	});
});
