const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const executable = path.resolve(process.argv[2] || '');
if (!fs.existsSync(executable)) throw new Error(`Executable not found: ${executable}`);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-switch-package-'));
const screenshotPath = path.join(tempRoot, 'packaged.png');
const child = spawn(executable, [], {
  windowsHide: true,
  env: {
    ...process.env,
    KIRA_SWITCH_HOME: path.join(tempRoot, 'home'),
    KIRA_SWITCH_USER_DATA: path.join(tempRoot, 'user-data'),
    KIRA_SWITCH_DEMO: '1',
    KIRA_SWITCH_SCREENSHOT_PATH: screenshotPath,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const timeout = setTimeout(() => {
  child.kill();
  process.stderr.write(`Packaged smoke test timed out: ${executable}\n`);
  process.exitCode = 1;
}, 45000);

child.on('error', (error) => {
  clearTimeout(timeout);
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code !== 0 || !fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size < 10_000) {
    process.stderr.write(stderr || `Packaged app exited with code ${code}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${screenshotPath}\n`);
});
