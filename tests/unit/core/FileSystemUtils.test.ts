import * as fs from "fs/promises";
import os from "os";
import * as path from "path";
import {
	findSkillerDir,
	readMarkdownFiles,
} from "../../../src/core/FileSystemUtils";

describe("FileSystemUtils", () => {
	let tmpDir: string;
	beforeAll(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skiller-test-"));
	});
	afterAll(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true });
	});

	describe("findSkillerDir", () => {
		it("finds .claude in parent directories", async () => {
			const projectDir = path.join(tmpDir, "project");
			const skillerDir = path.join(projectDir, ".claude");
			const nestedDir = path.join(projectDir, "sub", "child");
			await fs.mkdir(skillerDir, { recursive: true });
			await fs.mkdir(nestedDir, { recursive: true });
			// Create skiller.toml to make it a valid skiller directory
			await fs.writeFile(path.join(skillerDir, "skiller.toml"), "");
			const found = await findSkillerDir(nestedDir);
			expect(found).toBe(skillerDir);
		});

		it("returns null if .claude is not found", async () => {
			const someDir = path.join(tmpDir, "nofile");
			await fs.mkdir(someDir, { recursive: true });
			const found = await findSkillerDir(someDir, false); // Don't check global config
			expect(found).toBeNull();
		});
	});

	describe("readMarkdownFiles", () => {
		it("reads and sorts markdown files", async () => {
			const skillerDir = path.join(tmpDir, ".claude2");
			const subDir = path.join(skillerDir, "sub");
			await fs.mkdir(subDir, { recursive: true });
			const fileA = path.join(skillerDir, "a.md");
			const fileB = path.join(subDir, "b.md");
			await fs.writeFile(fileA, "contentA");
			await fs.writeFile(fileB, "contentB");
			const files = await readMarkdownFiles(skillerDir);
			expect(files.map((f) => f.path)).toEqual([fileA, fileB]);
			expect(files[0].content).toBe("contentA");
			expect(files[1].content).toBe("contentB");
		});
	});
});
