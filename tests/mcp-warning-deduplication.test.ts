import { setupTestProject, teardownTestProject, runSkillerAll } from "./harness";

/**
 * Verifies that the duplicate mcp.json warning issue has been fixed.
 * This test ensures only one warning is shown per skiller apply call.
 */
describe("mcp.json warning deduplication", () => {
	let testProject: { projectRoot: string };
	const warningText = "Using legacy .claude/mcp.json";

	beforeEach(async () => {
		testProject = await setupTestProject({
			".claude/instructions.md": "# Test rules",
			".claude/mcp.json": '{"mcpServers":{}}',
		});
	});

	afterEach(async () => {
		await teardownTestProject(testProject.projectRoot);
	});

	it("shows exactly one warning per apply call", async () => {
		const { projectRoot } = testProject;
		const output = runSkillerAll("apply", projectRoot);

		// Count occurrences of the warning
		const warningMatches = output.match(
			/\[skiller\] Warning: Using legacy \.claude\/mcp\.json/g,
		);
		const warningCount = warningMatches ? warningMatches.length : 0;

		expect(warningCount).toBe(1);
		expect(output).toContain(warningText);
	});
});
