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
const child_process_1 = require("child_process");
describe('End-to-End Ruler CLI', () => {
    let tmpDir;
    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os_1.default.tmpdir(), 'ruler-e2e-'));
        const rulerDir = path.join(tmpDir, '.ruler');
        await fs.mkdir(rulerDir, { recursive: true });
        await fs.writeFile(path.join(rulerDir, 'a.md'), 'Rule A');
        await fs.writeFile(path.join(rulerDir, 'b.md'), 'Rule B');
    });
    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    it('generates configuration files for all agents', () => {
        // Ensure latest build
        (0, child_process_1.execSync)('npm run build', { stdio: 'inherit' });
        // Run the CLI
        (0, child_process_1.execSync)(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });
        // Check some generated files contain concatenated rules
        const copilotPath = path.join(tmpDir, '.github', 'copilot-instructions.md');
        const claudePath = path.join(tmpDir, 'CLAUDE.md');
        const codexPath = path.join(tmpDir, 'AGENTS.md');
        const cursorPath = path.join(tmpDir, '.cursor', 'rules', 'ruler_cursor_instructions.md');
        const windsurfPath = path.join(tmpDir, '.windsurf', 'rules', 'ruler_windsurf_instructions.md');
        const clinePath = path.join(tmpDir, '.clinerules');
        const aiderMd = path.join(tmpDir, 'ruler_aider_instructions.md');
        const aiderCfg = path.join(tmpDir, '.aider.conf.yml');
        return Promise.all([
            expect(fs.readFile(copilotPath, 'utf8')).resolves.toContain('Rule A'),
            expect(fs.readFile(claudePath, 'utf8')).resolves.toContain('Rule B'),
            expect(fs.readFile(codexPath, 'utf8')).resolves.toContain('Rule A'),
            expect(fs.readFile(cursorPath, 'utf8')).resolves.toContain('Rule B'),
            expect(fs.readFile(windsurfPath, 'utf8')).resolves.toContain('Rule A'),
            expect(fs.readFile(clinePath, 'utf8')).resolves.toContain('Rule B'),
            expect(fs.readFile(aiderMd, 'utf8')).resolves.toContain('Rule A'),
            expect(fs.readFile(aiderCfg, 'utf8')).resolves.toContain('ruler_aider_instructions.md'),
        ]);
    });
});
