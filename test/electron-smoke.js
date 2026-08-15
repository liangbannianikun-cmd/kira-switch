const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = require('electron');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-switch-smoke-'));
const screenshotPath = process.env.KIRA_SWITCH_SMOKE_SCREENSHOT || path.join(tempRoot, 'kira-switch-smoke.png');
const homePath = path.join(tempRoot, 'home');
fs.mkdirSync(path.join(homePath, '.dsh'), { recursive: true });
fs.writeFileSync(path.join(homePath, '.dsh', 'AGENTS.md'), '# DeepSeek Harness 全局规则\n', 'utf8');

const child = spawn(electronPath, [projectRoot], {
  cwd: projectRoot,
  windowsHide: true,
  env: {
    ...process.env,
    KIRA_SWITCH_HOME: homePath,
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
  process.stderr.write('Electron smoke test timed out.\n');
  process.exitCode = 1;
}, 20000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code !== 0 || !fs.existsSync(screenshotPath) || fs.statSync(screenshotPath).size < 10_000) {
    process.stderr.write(stderr || `Electron exited with code ${code}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${screenshotPath}\n`);
});
