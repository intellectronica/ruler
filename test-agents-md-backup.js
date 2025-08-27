const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

async function testAgentsMdBackup() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-test-'));
  
  try {
    // Setup test project structure
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    
    // Create test rules
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test Rules\n\nSome test rules here.');
    
    // Create ruler config that includes agentsmd
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), `
default_agents = ["agentsmd"]
`);
    
    // Create existing AGENTS.md file that should be backed up
    await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), '# Existing AGENTS.md\nThis should be backed up (or not).');
    
    console.log('Testing --no-backup flag...');
    
    // Run ruler with --no-backup
    try {
      execSync(`node ${path.join(__dirname, 'dist/cli/index.js')} apply --no-backup`, {
        cwd: tmpDir,
        stdio: 'pipe'
      });
    } catch (error) {
      console.log('Apply command output:', error.stdout?.toString());
      console.log('Apply command error:', error.stderr?.toString());
    }
    
    // Check if backup file exists
    const backupPath = path.join(tmpDir, 'AGENTS.md.bak');
    const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
    
    console.log(`Backup file exists: ${backupExists}`);
    console.log(`Backup path: ${backupPath}`);
    
    // List all files in the directory
    const files = await fs.readdir(tmpDir, { recursive: true });
    console.log('Files in directory:', files);
    
    if (backupExists) {
      console.log('❌ FAILED: AGENTS.md.bak should NOT be created with --no-backup flag');
    } else {
      console.log('✅ PASSED: AGENTS.md.bak correctly NOT created with --no-backup flag');
    }
    
  } finally {
    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

testAgentsMdBackup().catch(console.error);