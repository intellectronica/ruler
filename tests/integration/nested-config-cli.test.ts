import * as fs from "fs/promises";
import * as path from "path";
import {
	setupTestProject,
	teardownTestProject,
	runSkillerWithInheritedStdio,
} from "../harness";

describe("CLI nested toggle precedence", () => {
	let projectRoot: string;

	async function writeNestedProjectConfig(options: {
		nestedTomlValue: boolean;
		includeSubmodule?: boolean;
	}): Promise<void> {
		const { nestedTomlValue, includeSubmodule = true } = options;

		const rootSkillerDir = path.join(projectRoot, ".claude");
		await fs.mkdir(rootSkillerDir, { recursive: true });
		await fs.writeFile(
			path.join(rootSkillerDir, "AGENTS.md"),
			"# Root Rules\n\nThese apply at the root.",
		);
		await fs.writeFile(
			path.join(rootSkillerDir, "skiller.toml"),
			`nested = ${nestedTomlValue}`,
		);

		if (includeSubmodule) {
			const moduleDir = path.join(projectRoot, "module");
			await fs.mkdir(path.join(moduleDir, ".claude"), { recursive: true });
			await fs.writeFile(
				path.join(moduleDir, ".claude", "AGENTS.md"),
				"# Module Rules\n\nThese apply inside module.",
			);
			// Create skiller.toml to make it a valid skiller directory
			await fs.writeFile(
				path.join(moduleDir, ".claude", "skiller.toml"),
				"",
			);
		}
	}

	beforeEach(async () => {
		const testProject = await setupTestProject();
		projectRoot = testProject.projectRoot;
	});

	afterEach(async () => {
		await teardownTestProject(projectRoot);
	});

	it("activates nested processing when config sets nested = true", async () => {
		await writeNestedProjectConfig({ nestedTomlValue: true });

		runSkillerWithInheritedStdio("apply --agents claude", projectRoot);

		await expect(
			fs.readFile(path.join(projectRoot, "module", "CLAUDE.md"), "utf8"),
		).resolves.toContain("@.claude/AGENTS.md");
	});

	it("remains flat when config sets nested = false and CLI omits --nested", async () => {
		await writeNestedProjectConfig({ nestedTomlValue: false });

		runSkillerWithInheritedStdio("apply --agents claude", projectRoot);

		await expect(
			fs.stat(path.join(projectRoot, "module", "CLAUDE.md")),
		).rejects.toThrow();
	});

	it("prefers CLI --nested over a config that sets nested = false", async () => {
		await writeNestedProjectConfig({ nestedTomlValue: false });

		runSkillerWithInheritedStdio("apply --agents claude --nested", projectRoot);

		await expect(
			fs.readFile(path.join(projectRoot, "module", "CLAUDE.md"), "utf8"),
		).resolves.toContain("@.claude/AGENTS.md");
	});
});
