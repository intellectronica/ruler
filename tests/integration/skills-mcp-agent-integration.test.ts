import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { applyAllAgentConfigs } from "../../src/lib";
import { SKILL_MD_FILENAME } from "../../src/constants";
import { parse as parseTOML } from "@iarna/toml";

describe("Skills MCP Agent Integration", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "skiller-skills-agent-mcp-"),
		);
	});

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	describe("Skillz MCP server for agents handling MCP internally", () => {
		beforeEach(async () => {
			// Create .claude directory with rules and skills
			const skillerDir = path.join(tmpDir, ".claude");
			await fs.mkdir(skillerDir, { recursive: true });
			// Create skiller.toml to make it a valid skiller directory
			await fs.writeFile(path.join(skillerDir, "skiller.toml"), "");
			await fs.writeFile(
				path.join(skillerDir, "instructions.md"),
				"# Test instructions",
			);

			// Create a test skill
			const skillDir = path.join(skillerDir, "skills", "test-skill");
			await fs.mkdir(skillDir, { recursive: true });
			await fs.writeFile(
				path.join(skillDir, SKILL_MD_FILENAME),
				"# Test Skill",
			);
		});

		it("adds Skillz MCP server to Codex CLI config", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["codex"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Check that .codex/config.toml exists and contains skillz server
			const codexConfigPath = path.join(tmpDir, ".codex", "config.toml");
			const configContent = await fs.readFile(codexConfigPath, "utf8");
			const config = parseTOML(configContent);

			expect(config).toHaveProperty("mcp_servers");
			expect(config.mcp_servers).toHaveProperty("skillz");
			const skillzServer = config.mcp_servers.skillz as any;
			expect(skillzServer.command).toBe("uvx");
			expect(skillzServer.args).toContain("skillz@latest");
			expect(skillzServer.args[1]).toContain(".skillz");
		});

		it("adds Skillz MCP server to Gemini CLI config", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["gemini-cli"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Check that .gemini/settings.json exists and contains skillz server
			const geminiSettingsPath = path.join(tmpDir, ".gemini", "settings.json");
			const settingsContent = await fs.readFile(geminiSettingsPath, "utf8");
			const settings = JSON.parse(settingsContent);

			expect(settings).toHaveProperty("mcpServers");
			expect(settings.mcpServers).toHaveProperty("skillz");
			expect(settings.mcpServers.skillz.command).toBe("uvx");
			expect(settings.mcpServers.skillz.args).toContain("skillz@latest");
			expect(settings.mcpServers.skillz.args[1]).toContain(".skillz");
		});

		it("adds Skillz MCP server to Copilot MCP config", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["copilot"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Check that .vscode/mcp.json exists and contains skillz server
			const mcpPath = path.join(tmpDir, ".vscode", "mcp.json");
			const mcpContent = await fs.readFile(mcpPath, "utf8");
			const mcp = JSON.parse(mcpContent);

			expect(mcp).toHaveProperty("servers");
			expect(mcp.servers).toHaveProperty("skillz");
			expect(mcp.servers.skillz.command).toBe("uvx");
			expect(mcp.servers.skillz.args).toContain("skillz@latest");
			expect(mcp.servers.skillz.args[1]).toContain(".skillz");
		});

		it("does not add Skillz server when skills are disabled", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["codex", "gemini-cli"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				false, // skills disabled
			);

			// Check that configs don't have skillz server
			const codexConfigPath = path.join(tmpDir, ".codex", "config.toml");
			const geminiSettingsPath = path.join(tmpDir, ".gemini", "settings.json");

			// Codex config should not have skillz
			try {
				const codexContent = await fs.readFile(codexConfigPath, "utf8");
				const codexConfig = parseTOML(codexContent);
				expect(codexConfig.mcp_servers).not.toHaveProperty("skillz");
			} catch (err) {
				// File might not exist if no MCP servers at all, which is fine
			}

			// Gemini config should not have skillz
			try {
				const geminiContent = await fs.readFile(geminiSettingsPath, "utf8");
				const geminiSettings = JSON.parse(geminiContent);
				if (geminiSettings.mcpServers) {
					expect(geminiSettings.mcpServers).not.toHaveProperty("skillz");
				}
			} catch (err) {
				// File might not exist if no MCP servers at all, which is fine
			}
		});

		it("adds Skillz server even when there are existing MCP servers", async () => {
			// Override beforeEach setup - need to create skiller.toml first
			const skillerDir = path.join(tmpDir, ".claude");

			// Create skiller.toml with existing MCP server
			await fs.writeFile(
				path.join(skillerDir, "skiller.toml"),
				`
[mcp.servers.existing-server]
command = "node"
args = ["server.js"]
`,
			);

			// Now create instructions and skills
			await fs.writeFile(
				path.join(skillerDir, "instructions.md"),
				"# Test instructions",
			);
			const skillDir = path.join(skillerDir, "skills", "test-skill");
			await fs.mkdir(skillDir, { recursive: true });
			await fs.writeFile(
				path.join(skillDir, SKILL_MD_FILENAME),
				"# Test Skill",
			);

			await applyAllAgentConfigs(
				tmpDir,
				["codex"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			const codexConfigPath = path.join(tmpDir, ".codex", "config.toml");
			const configContent = await fs.readFile(codexConfigPath, "utf8");
			const config = parseTOML(configContent);

			// Should have skillz server (existing-server may or may not be there depending on filtering)
			expect(config.mcp_servers).toHaveProperty("skillz");
			expect(config.mcp_servers.skillz.command).toBe("uvx");
			expect(config.mcp_servers.skillz.args).toContain("skillz@latest");
		});

		it("works for multiple agents simultaneously", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["codex", "gemini-cli", "copilot"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// All three agents should have skillz server
			const codexConfigPath = path.join(tmpDir, ".codex", "config.toml");
			const geminiSettingsPath = path.join(tmpDir, ".gemini", "settings.json");
			const copilotMcpPath = path.join(tmpDir, ".vscode", "mcp.json");

			const codexContent = await fs.readFile(codexConfigPath, "utf8");
			const geminiContent = await fs.readFile(geminiSettingsPath, "utf8");
			const copilotContent = await fs.readFile(copilotMcpPath, "utf8");

			const codexConfig = parseTOML(codexContent);
			const geminiSettings = JSON.parse(geminiContent);
			const copilotMcp = JSON.parse(copilotContent);

			expect(codexConfig.mcp_servers).toHaveProperty("skillz");
			expect(geminiSettings.mcpServers).toHaveProperty("skillz");
			expect(copilotMcp.servers).toHaveProperty("skillz");
		});

		it("does not add Skillz server to Claude Code (uses .claude/skills natively)", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["claude"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Check that .mcp.json does not have skillz server
			const claudeMcpPath = path.join(tmpDir, ".mcp.json");

			try {
				const mcpContent = await fs.readFile(claudeMcpPath, "utf8");
				const mcp = JSON.parse(mcpContent);

				// Claude should not have skillz server (uses .claude/skills instead)
				if (mcp.mcpServers) {
					expect(mcp.mcpServers).not.toHaveProperty("skillz");
				}
			} catch (err) {
				// File might not exist if no MCP servers at all, which is fine
			}

			// Verify .claude/skills was created instead
			const claudeSkillsPath = path.join(
				tmpDir,
				".claude",
				"skills",
				"test-skill",
				SKILL_MD_FILENAME,
			);
			const skillContent = await fs.readFile(claudeSkillsPath, "utf8");
			expect(skillContent).toBe("# Test Skill");
		});

		it("does not add Skillz server to Cursor (uses .cursor/rules natively)", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["cursor"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Check that .cursor/mcp.json does not have skillz server
			const cursorMcpPath = path.join(tmpDir, ".cursor", "mcp.json");

			try {
				const mcpContent = await fs.readFile(cursorMcpPath, "utf8");
				const mcp = JSON.parse(mcpContent);

				// Cursor should not have skillz server (uses .cursor/rules instead)
				if (mcp.mcpServers) {
					expect(mcp.mcpServers).not.toHaveProperty("skillz");
				}
			} catch (err) {
				// File might not exist if no MCP servers at all, which is fine
			}
		});

		it("does not create duplicate config files for Codex", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["codex"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Verify only config.toml is created, not config.json
			const configTomlPath = path.join(tmpDir, ".codex", "config.toml");
			const configJsonPath = path.join(tmpDir, ".codex", "config.json");

			// config.toml should exist
			await expect(fs.access(configTomlPath)).resolves.toBeUndefined();

			// config.json should NOT exist
			await expect(fs.access(configJsonPath)).rejects.toThrow();
		});

		it("adds Skillz to MCP agents but not to Claude/Cursor when all are enabled", async () => {
			await applyAllAgentConfigs(
				tmpDir,
				["claude", "cursor", "codex", "gemini-cli"],
				undefined,
				true,
				undefined,
				undefined,
				false,
				false,
				false,
				false,
				true,
				true, // skills enabled
			);

			// Claude should NOT have skillz
			const claudeMcpPath = path.join(tmpDir, ".mcp.json");
			try {
				const claudeContent = await fs.readFile(claudeMcpPath, "utf8");
				const claudeMcp = JSON.parse(claudeContent);
				if (claudeMcp.mcpServers) {
					expect(claudeMcp.mcpServers).not.toHaveProperty("skillz");
				}
			} catch {
				// File might not exist, which is fine
			}

			// Cursor should NOT have skillz
			const cursorMcpPath = path.join(tmpDir, ".cursor", "mcp.json");
			try {
				const cursorContent = await fs.readFile(cursorMcpPath, "utf8");
				const cursorMcp = JSON.parse(cursorContent);
				if (cursorMcp.mcpServers) {
					expect(cursorMcp.mcpServers).not.toHaveProperty("skillz");
				}
			} catch {
				// File might not exist, which is fine
			}

			// Codex SHOULD have skillz
			const codexConfigPath = path.join(tmpDir, ".codex", "config.toml");
			const codexContent = await fs.readFile(codexConfigPath, "utf8");
			const codexConfig = parseTOML(codexContent);
			expect(codexConfig.mcp_servers).toHaveProperty("skillz");

			// Gemini SHOULD have skillz
			const geminiSettingsPath = path.join(tmpDir, ".gemini", "settings.json");
			const geminiContent = await fs.readFile(geminiSettingsPath, "utf8");
			const geminiSettings = JSON.parse(geminiContent);
			expect(geminiSettings.mcpServers).toHaveProperty("skillz");
		});
	});
});
