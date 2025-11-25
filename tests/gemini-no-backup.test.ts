import { promises as fs } from "fs";
import * as path from "path";
import {
	setupTestProject,
	teardownTestProject,
	runSkiller,
} from "../tests/harness";

describe("Gemini Backup Behavior Test", () => {
	let projectRoot: string;

	beforeAll(async () => {
		const tmp = await setupTestProject({
			".claude/AGENTS.md": "Rule A\nRule B\n",
			".claude/mcp.json": JSON.stringify({
				mcpServers: {
					"test-server": {
						command: "echo",
						args: ["hello"],
						type: "stdio",
					},
				},
			}),
		});
		projectRoot = tmp.projectRoot;
	});

	afterAll(async () => {
		await teardownTestProject(projectRoot);
	});

	it("should not create backup files when MCP is handled correctly in applySkillerConfig", async () => {
		// Run skiller apply with only gemini-cli
		await runSkiller("apply --agents gemini-cli", projectRoot);

		const settingsPath = path.join(projectRoot, ".gemini", "settings.json");
		const settingsBakPath = settingsPath + ".bak";

		// Check that settings.json exists with correct content
		expect(
			await fs
				.access(settingsPath)
				.then(() => true)
				.catch(() => false),
		).toBe(true);

		const settingsContent = await fs.readFile(settingsPath, "utf8");
		const settings = JSON.parse(settingsContent);

		expect(settings.contextFileName).toBe("AGENTS.md");
		expect(settings.mcpServers).toBeDefined();
		expect(settings.mcpServers["test-server"]).toBeDefined();

		// Check that no backup file was created (the key test)
		const backupExists = await fs
			.access(settingsBakPath)
			.then(() => true)
			.catch(() => false);
		expect(backupExists).toBe(false);
	});
});
