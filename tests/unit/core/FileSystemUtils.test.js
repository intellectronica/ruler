"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os_1 = __importDefault(require("os"));
const FileSystemUtils_1 = require("../../../src/core/FileSystemUtils");
describe('FileSystemUtils', () => {
    let tmpDir;
    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os_1.default.tmpdir(), 'ruler-test-'));
    });
    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    describe('findRulerDir', () => {
        it('finds .ruler in parent directories', async () => {
            const projectDir = path.join(tmpDir, 'project');
            const rulerDir = path.join(projectDir, '.ruler');
            const nestedDir = path.join(projectDir, 'sub', 'child');
            await fs.mkdir(rulerDir, { recursive: true });
            await fs.mkdir(nestedDir, { recursive: true });
            const found = await (0, FileSystemUtils_1.findRulerDir)(nestedDir);
            expect(found).toBe(rulerDir);
        });
        it('returns null if .ruler is not found', async () => {
            const someDir = path.join(tmpDir, 'nofile');
            await fs.mkdir(someDir, { recursive: true });
            const found = await (0, FileSystemUtils_1.findRulerDir)(someDir);
            expect(found).toBeNull();
        });
    });
    describe('readMarkdownFiles', () => {
        it('reads and sorts markdown files', async () => {
            const rulerDir = path.join(tmpDir, '.ruler2');
            const subDir = path.join(rulerDir, 'sub');
            await fs.mkdir(subDir, { recursive: true });
            const fileA = path.join(rulerDir, 'a.md');
            const fileB = path.join(subDir, 'b.md');
            await fs.writeFile(fileA, 'contentA');
            await fs.writeFile(fileB, 'contentB');
            const files = await (0, FileSystemUtils_1.readMarkdownFiles)(rulerDir);
            expect(files.map((f) => f.path)).toEqual([fileA, fileB]);
            expect(files[0].content).toBe('contentA');
            expect(files[1].content).toBe('contentB');
        });
    });
});
