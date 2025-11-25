"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RuleProcessor_1 = require("../../../src/core/RuleProcessor");
describe("RuleProcessor", () => {
	it("concatenates and formats rule content with source markers", () => {
		const files = [
			{ path: "/project/.claude/a.md", content: "A rule" },
			{ path: "/project/.claude/b.md", content: "B rule" },
		];
		jest.spyOn(process, "cwd").mockReturnValue("/project");
		const result = (0, RuleProcessor_1.concatenateRules)(files);
		expect(result).toContain("<!-- Source: .claude/a.md -->");
		expect(result).toContain("A rule");
		expect(result).toContain("<!-- Source: .claude/b.md -->");
		expect(result).toContain("B rule");
	});
});
