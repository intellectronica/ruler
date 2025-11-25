import { setupTestProject, teardownTestProject, runSkillerAll } from "./harness";

/**
 * Ensures CLI emits legacy mcp.json warning during apply even if unified config path misses it.
 */
describe("CLI legacy mcp.json warning", () => {
	let testProject: { projectRoot: string };
	const warningText = "Using legacy .claude/mcp.json";

	beforeEach(async () => {
		testProject = await setupTestProject({
			".claude/instructions.md": "# Legacy rules",
			".claude/mcp.json": '{"mcpServers":{}}',
		});
	});

	afterEach(async () => {
		await teardownTestProject(testProject.projectRoot);
	});

	it("prints warning", async () => {
		const { projectRoot } = testProject;
		const output = runSkillerAll("apply", projectRoot);
		expect(output).toContain(warningText);
	});
});
