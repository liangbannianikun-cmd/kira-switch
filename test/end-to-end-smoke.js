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
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, '# 用户原有规则\n\n- 保留这条规则\n', 'utf8');

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
      hermes: path.join(homePath, '.hermes', 'SOUL.md'),
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
    KIRA_SWITCH_E2E_PAYLOAD: JSON.stringify({ cardId: 'smoke-card', clientId: 'codex', mode: 'standard', userName: '验收用户' }),
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
    const stored = JSON.parse(fs.readFileSync(path.join(userData, 'state.json'), 'utf8'));
    const backups = fs.readdirSync(path.join(userData, 'backups', 'codex'));
    if (code !== 0 || !result.ok || result.charCount < 100 || !target.includes('保留这条规则') ||
        !target.includes('KIRA-SWITCH:BEGIN') || !target.includes('激活角色：测试角色') ||
        stored.active.codex?.cardId !== 'smoke-card' || backups.length < 1) {
      throw new Error(`E2E assertions failed: ${JSON.stringify({ code, result, backups: backups.length })}`);
    }
    process.stdout.write(`${targetPath}\n`);
  } catch (error) {
    process.stderr.write(`${stderr}${error.stack}\n`);
    process.exitCode = 1;
  }
});
