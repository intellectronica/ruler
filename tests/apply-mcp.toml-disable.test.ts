import * as fs from "fs/promises";
import * as path from "path";
import { setupTestProject, teardownTestProject, runSkiller } from "./harness";

describe("apply-mcp.toml-disable", () => {
	let testProject: { projectRoot: string };

	beforeEach(async () => {
		const toml = `[mcp]
enabled = false

[mcp_servers.repo]
command = "node"
args = ["scripts/repo-mcp.js"]

[mcp_servers.search]
url = "https://example.com"
`;

		testProject = await setupTestProject({
			".claude/skiller.toml": toml,
			".vscode/mcp.json":
				'{"servers": {"existing": {"command": "existing-cmd"}}}',
		});
	});

	afterEach(async () => {
		await teardownTestProject(testProject.projectRoot);
	});

	it("does not apply TOML MCP servers when MCP is disabled", async () => {
		const { projectRoot } = testProject;

		const nativePath = path.join(projectRoot, ".vscode", "mcp.json");
		const before = await fs.readFile(nativePath, "utf8");

		runSkiller("apply --agents copilot", projectRoot);

		const after = await fs.readFile(nativePath, "utf8");
		expect(after).toEqual(before);
	});
});
