const { execSync } = require('child_process');

module.exports = async () => {
  // Build the project once before all tests run
  // This prevents race conditions when multiple tests try to build concurrently
  console.log('Building project for tests...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed.');
};