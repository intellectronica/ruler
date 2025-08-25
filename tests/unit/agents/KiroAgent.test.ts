import { KiroAgent } from '../../../src/agents/KiroAgent';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';

jest.mock('../../../src/core/FileSystemUtils');

describe('KiroAgent', () => {
    let agent: KiroAgent;

    beforeEach(() => {
        agent = new KiroAgent();
        jest.clearAllMocks();
    });

    it('should return the correct identifier', () => {
        expect(agent.getIdentifier()).toBe('kiro');
    });

    it('should return the correct name', () => {
        expect(agent.getName()).toBe('Kiro');
    });

    it('should return correct default output path', () => {
        expect(agent.getDefaultOutputPath('/root')).toBe('/root/.kiro/steering/ruler_kiro_instructions.md');
    });

    it('should apply ruler config to the default output path', async () => {
        const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');
        await agent.applyRulerConfig('rules', '/root', null);
        expect(writeGeneratedFile).toHaveBeenCalledWith('/root/.kiro/steering/ruler_kiro_instructions.md', 'rules');
    });

    it('should apply ruler config to a custom output path', async () => {
        const writeGeneratedFile = jest.spyOn(FileSystemUtils, 'writeGeneratedFile');
        await agent.applyRulerConfig('rules', '/root', null, { outputPath: 'CUSTOM.md' });
        expect(writeGeneratedFile).toHaveBeenCalledWith('/root/CUSTOM.md', 'rules');
    });
});