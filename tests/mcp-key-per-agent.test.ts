import * as fs from "fs/promises";
import * as path from "path";
import os from "os";
import { execSync } from "child_process";
import {
	setupTestProject,
	teardownTestProject,
	runSkillerWithInheritedStdio,
} from "./harness";

describe("mcp-key-per-agent", () => {
	let testProject: { projectRoot: string };

	beforeEach(async () => {
		// Create skiller MCP config
		const skillerMcp = {
			mcpServers: { skiller_server: { url: "http://skiller.com" } },
		};

		// Create Copilot MCP config using 'servers' key
		const copilotNative = {
			servers: { native_copilot_server: { url: "http://copilot.com" } },
		};

		// Create Cursor MCP config using 'mcpServers' key
		const cursorNative = {
			mcpServers: { native_cursor_server: { url: "http://cursor.com" } },
		};

		testProject = await setupTestProject({
			".claude/mcp.json": JSON.stringify(skillerMcp, null, 2) + "\n",
			".vscode/mcp.json": JSON.stringify(copilotNative, null, 2) + "\n",
			".cursor/mcp.json": JSON.stringify(cursorNative, null, 2) + "\n",
		});
	});

	afterEach(async () => {
		await teardownTestProject(testProject.projectRoot);
	});

	it('should use "servers" key for Copilot and "mcpServers" key for Cursor', async () => {
		const { projectRoot } = testProject;

		runSkillerWithInheritedStdio("apply --agents copilot,cursor", projectRoot);

		// Verify Copilot MCP config uses 'servers' key
		const copilotResultText = await fs.readFile(
			path.join(projectRoot, ".vscode", "mcp.json"),
			"utf8",
		);
		const copilotResult = JSON.parse(copilotResultText);

		// Should have 'servers' key, not 'mcpServers'
		expect(copilotResult.servers).toBeDefined();
		expect(copilotResult.mcpServers).toBeUndefined();

		// Should contain both native and skiller servers
		expect(Object.keys(copilotResult.servers).sort()).toEqual([
			"native_copilot_server",
			"skiller_server",
		]);

		// Verify Cursor MCP config uses 'mcpServers' key
		const cursorResultText = await fs.readFile(
			path.join(projectRoot, ".cursor", "mcp.json"),
			"utf8",
		);
		const cursorResult = JSON.parse(cursorResultText);

		// Should have 'mcpServers' key
		expect(cursorResult.mcpServers).toBeDefined();

		// Should contain both native and skiller servers
		expect(Object.keys(cursorResult.mcpServers).sort()).toEqual([
			"native_cursor_server",
			"skiller_server",
		]);
	});
});
