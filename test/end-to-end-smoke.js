const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const electronPath = require('electron');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-switch-e2e-'));
const homePath = path.join(tempRoot, 'home');
const userData = path.join(tempRoot, 'user-data');
const resultPath = path.join(tempRoot, 'result.json');
const targetPath = path.join(homePath, '.codex', 'AGENTS.md');
const hermesPath = path.join(homePath, '.hermes', 'SOUL.md');
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, '# 用户原有规则\n\n- 保留这条规则\n', 'utf8');
fs.mkdirSync(path.dirname(hermesPath), { recursive: true });
fs.writeFileSync(hermesPath, '# Hermes 原有身份\n\n- 保留这条身份规则\n', 'utf8');
fs.writeFileSync(path.join(homePath, '.hermes', 'config.yaml'), 'model:\n  default: deepseek-v4-pro\n  provider: deepseek\n  base_url: https://api.deepseek.com\n', 'utf8');
fs.writeFileSync(path.join(homePath, '.hermes', '.env'), 'DEEPSEEK_API_KEY=untouched-test-secret\n', 'utf8');

const preloadState = {
  version: 1,
  cards: [
    {
      id: 'smoke-card', name: '测试角色', description: '一位用于验证注入链路的测试角色。', personality: '准确、简洁。',
      scenario: '{{user}}正在运行验收测试。', firstMessage: '开始验证。', messageExample: '', systemPrompt: '保持测试角色身份。',
      postHistoryInstructions: '', creatorNotes: '', creator: '', characterVersion: '1.0', alternateGreetings: [], tags: ['测试'], lorebook: [],
      spec: 'V2', declaredSpec: 'chara_card_v2', declaredVersion: '2.0', warnings: [], sourceName: 'smoke.json', sourceType: 'json',
      raw: { spec: 'chara_card_v2', data: { name: '测试角色' } }, importedAt: new Date().toISOString(), sourcePath: 'smoke.json', avatarDataUrl: ''
    }
  ],
  active: {}, operations: [], settings: {
    theme: 'light', userName: '验收用户', promptMode: 'standard',
    paths: {
      codex: targetPath,
      claude: path.join(homePath, '.claude', 'CLAUDE.md'),
      hermes: hermesPath,
      openclaw: path.join(homePath, '.openclaw', 'workspace', 'SOUL.md'),
      opencode: path.join(homePath, '.config', 'opencode', 'AGENTS.md')
    }
  }
};
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(userData, 'state.json'), JSON.stringify(preloadState), 'utf8');

const child = spawn(electronPath, [projectRoot], {
  cwd: projectRoot,
  windowsHide: true,
  env: {
    ...process.env,
    KIRA_SWITCH_HOME: homePath,
    KIRA_SWITCH_USER_DATA: userData,
    KIRA_SWITCH_E2E_PAYLOAD: JSON.stringify([
      { cardId: 'smoke-card', clientId: 'codex', mode: 'standard', userName: '验收用户' },
      { cardId: 'smoke-card', clientId: 'hermes', mode: 'standard', userName: '验收用户' }
    ]),
    KIRA_SWITCH_E2E_RESULT: resultPath,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const timeout = setTimeout(() => {
  child.kill();
  process.stderr.write('End-to-end smoke test timed out.\n');
  process.exitCode = 1;
}, 20000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  try {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    const target = fs.readFileSync(targetPath, 'utf8');
    const hermesTarget = fs.readFileSync(hermesPath, 'utf8');
    const hermesEnv = fs.readFileSync(path.join(homePath, '.hermes', '.env'), 'utf8');
    const stored = JSON.parse(fs.readFileSync(path.join(userData, 'state.json'), 'utf8'));
    const codexBackups = fs.readdirSync(path.join(userData, 'backups', 'codex'));
    const hermesBackups = fs.readdirSync(path.join(userData, 'backups', 'hermes'));
    const hermesStatus = result.targets.find((item) => item.id === 'hermes');
    if (code !== 0 || !result.ok || result.charCount < 100 || !target.includes('保留这条规则') ||
        !target.includes('KIRA-SWITCH:BEGIN') || !target.includes('激活角色：测试角色') ||
        !hermesTarget.includes('保留这条身份规则') || !hermesTarget.includes('KIRA-SWITCH:BEGIN') ||
        stored.active.codex?.cardId !== 'smoke-card' || stored.active.hermes?.cardId !== 'smoke-card' ||
        hermesStatus?.name !== 'DeepSeek Hermes' || !hermesStatus?.deepseekConfigured ||
        hermesEnv !== 'DEEPSEEK_API_KEY=untouched-test-secret\n' ||
        codexBackups.length < 1 || hermesBackups.length < 1) {
      throw new Error(`E2E assertions failed: ${JSON.stringify({ code, result, codexBackups: codexBackups.length, hermesBackups: hermesBackups.length })}`);
    }
    process.stdout.write(`${targetPath}\n${hermesPath}\n`);
  } catch (error) {
    process.stderr.write(`${stderr}${error.stack}\n`);
    process.exitCode = 1;
  }
});
