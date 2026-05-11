import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { revertAllAgentConfigs } from '../../../src/revert';
import { writeVSCodeSettings, readVSCodeSettings, getVSCodeSettingsPath } from '../../../src/vscode/settings';

describe('VSCode Settings Revert', () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ruler-vscode-settings-test-'));
    projectRoot = tempDir;
    
    // Create .ruler directory
    await fs.mkdir(path.join(projectRoot, '.ruler'), { recursive: true });
    
    // Create a minimal ruler.config.json
    const configPath = path.join(projectRoot, '.ruler', 'ruler.config.json');
    await fs.writeFile(configPath, JSON.stringify({
      defaultAgents: ['augmentcode'],
      agentConfigs: {
        augmentcode: {
          enabled: true
        }
      }
    }));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should preserve existing VSCode settings when reverting', async () => {
    // Create .vscode directory and settings.json with existing user settings
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    
    const settingsPath = getVSCodeSettingsPath(projectRoot);
    const originalSettings = {
      'editor.fontSize': 14,
      'editor.tabSize': 2,
      'files.autoSave': 'afterDelay',
      'augment.advanced': {
        mcpServers: [
          { name: 'test-server', command: 'test' }
        ]
      }
    };
    
    await writeVSCodeSettings(settingsPath, originalSettings);
    
    // Run revert
    await revertAllAgentConfigs(projectRoot, undefined, undefined, false, true, false, true);
    
    // Check that user settings are preserved but augment.advanced is removed
    const resultSettings = await readVSCodeSettings(settingsPath);
    
    expect(resultSettings).toEqual({
      'editor.fontSize': 14,
      'editor.tabSize': 2,
      'files.autoSave': 'afterDelay'
    });
    
    expect(resultSettings['augment.advanced']).toBeUndefined();
  });

  it('should restore from backup when backup exists', async () => {
    // Create .vscode directory
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    
    const settingsPath = getVSCodeSettingsPath(projectRoot);
    const backupPath = `${settingsPath}.bak`;
    
    // Create backup with original settings
    const originalSettings = {
      'editor.fontSize': 16,
      'workbench.colorTheme': 'Dark+'
    };
    await writeVSCodeSettings(backupPath, originalSettings);
    
    // Create current settings with ruler modifications
    const currentSettings = {
      'editor.fontSize': 16,
      'workbench.colorTheme': 'Dark+',
      'augment.advanced': {
        mcpServers: [
          { name: 'test-server', command: 'test' }
        ]
      }
    };
    await writeVSCodeSettings(settingsPath, currentSettings);
    
    // Run revert
    await revertAllAgentConfigs(projectRoot, undefined, undefined, false, false, false, true);
    
    // Check that original settings are restored
    const resultSettings = await readVSCodeSettings(settingsPath);
    
    expect(resultSettings).toEqual(originalSettings);
    expect(resultSettings['augment.advanced']).toBeUndefined();
  });

  it('should handle missing settings.json gracefully', async () => {
    // Create .vscode directory but no settings.json
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    
    // Run revert (should not throw error)
    await expect(revertAllAgentConfigs(projectRoot, undefined, undefined, false, false, false, true))
      .resolves.not.toThrow();
  });

  it('should handle settings.json without augment.advanced gracefully', async () => {
    // Create .vscode directory and settings.json without augment.advanced
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    
    const settingsPath = getVSCodeSettingsPath(projectRoot);
    const userSettings = {
      'editor.fontSize': 14,
      'editor.tabSize': 2
    };
    
    await writeVSCodeSettings(settingsPath, userSettings);
    
    // Run revert
    await revertAllAgentConfigs(projectRoot, undefined, undefined, false, false, false, true);
    
    // Check that user settings are unchanged
    const resultSettings = await readVSCodeSettings(settingsPath);
    
    expect(resultSettings).toEqual(userSettings);
  });
});
