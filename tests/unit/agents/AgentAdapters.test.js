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
const js_yaml_1 = __importDefault(require("js-yaml"));
const CopilotAgent_1 = require("../../../src/agents/CopilotAgent");
const ClaudeAgent_1 = require("../../../src/agents/ClaudeAgent");
const CodexCliAgent_1 = require("../../../src/agents/CodexCliAgent");
const CursorAgent_1 = require("../../../src/agents/CursorAgent");
const WindsurfAgent_1 = require("../../../src/agents/WindsurfAgent");
const ClineAgent_1 = require("../../../src/agents/ClineAgent");
const AiderAgent_1 = require("../../../src/agents/AiderAgent");
describe('Agent Adapters', () => {
    let tmpDir;
    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os_1.default.tmpdir(), 'ruler-agent-'));
    });
    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });
    describe('CopilotAgent', () => {
        it('backs up and writes copilot-instructions.md', async () => {
            const agent = new CopilotAgent_1.CopilotAgent();
            const githubDir = path.join(tmpDir, '.github');
            await fs.mkdir(githubDir, { recursive: true });
            const target = path.join(githubDir, 'copilot-instructions.md');
            await fs.writeFile(target, 'old copilot');
            await agent.applyRulerConfig('new copilot', tmpDir);
            const backup = await fs.readFile(`${target}.bak`, 'utf8');
            const content = await fs.readFile(target, 'utf8');
            expect(backup).toBe('old copilot');
            expect(content).toBe('new copilot');
        });
    });
    describe('ClaudeAgent', () => {
        it('backs up and writes CLAUDE.md', async () => {
            const agent = new ClaudeAgent_1.ClaudeAgent();
            const target = path.join(tmpDir, 'CLAUDE.md');
            await fs.writeFile(target, 'old claude');
            await agent.applyRulerConfig('new claude', tmpDir);
            expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old claude');
            expect(await fs.readFile(target, 'utf8')).toBe('new claude');
        });
    });
    describe('CodexCliAgent', () => {
        it('backs up and writes AGENTS.md', async () => {
            const agent = new CodexCliAgent_1.CodexCliAgent();
            const target = path.join(tmpDir, 'AGENTS.md');
            await fs.writeFile(target, 'old codex');
            await agent.applyRulerConfig('new codex', tmpDir);
            expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old codex');
            expect(await fs.readFile(target, 'utf8')).toBe('new codex');
        });
    });
    describe('CursorAgent', () => {
        it('backs up and writes ruler_cursor_instructions.md', async () => {
            const agent = new CursorAgent_1.CursorAgent();
            const rulesDir = path.join(tmpDir, '.cursor', 'rules');
            await fs.mkdir(rulesDir, { recursive: true });
            const target = path.join(rulesDir, 'ruler_cursor_instructions.md');
            await fs.writeFile(target, 'old cursor');
            await agent.applyRulerConfig('new cursor', tmpDir);
            expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old cursor');
            expect(await fs.readFile(target, 'utf8')).toBe('new cursor');
        });
    });
    describe('WindsurfAgent', () => {
        it('backs up and writes ruler_windsurf_instructions.md', async () => {
            const agent = new WindsurfAgent_1.WindsurfAgent();
            const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
            await fs.mkdir(rulesDir, { recursive: true });
            const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');
            await fs.writeFile(target, 'old windsurf');
            await agent.applyRulerConfig('new windsurf', tmpDir);
            expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old windsurf');
            expect(await fs.readFile(target, 'utf8')).toBe('new windsurf');
        });
    });
    describe('ClineAgent', () => {
        it('backs up and writes .clinerules', async () => {
            const agent = new ClineAgent_1.ClineAgent();
            const target = path.join(tmpDir, '.clinerules');
            await fs.writeFile(target, 'old cline');
            await agent.applyRulerConfig('new cline', tmpDir);
            expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old cline');
            expect(await fs.readFile(target, 'utf8')).toBe('new cline');
        });
    });
    describe('AiderAgent', () => {
        it('creates and updates .aider.conf.yml', async () => {
            const agent = new AiderAgent_1.AiderAgent();
            // No existing config
            await agent.applyRulerConfig('aider rules', tmpDir);
            const mdFile = path.join(tmpDir, 'ruler_aider_instructions.md');
            expect(await fs.readFile(mdFile, 'utf8')).toBe('aider rules');
            const cfg = js_yaml_1.default.load(await fs.readFile(path.join(tmpDir, '.aider.conf.yml'), 'utf8'));
            expect(cfg.read).toContain('ruler_aider_instructions.md');
            // Existing config with read not array
            const cfgPath = path.join(tmpDir, '.aider.conf.yml');
            await fs.writeFile(cfgPath, 'read: outdated');
            await agent.applyRulerConfig('new aider', tmpDir);
            const updated = js_yaml_1.default.load(await fs.readFile(cfgPath, 'utf8'));
            expect(Array.isArray(updated.read)).toBe(true);
            expect(updated.read).toContain('ruler_aider_instructions.md');
        });
    });
});
