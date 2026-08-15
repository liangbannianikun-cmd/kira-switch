const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const MAX_HERMES_CONFIG_BYTES = 512 * 1024;

function readSmallText(filePath, fsImpl = fs) {
  try {
    const stats = fsImpl.statSync(filePath);
    if (!stats.isFile() || stats.size > MAX_HERMES_CONFIG_BYTES) return '';
    return fsImpl.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
}

function inspectDeepSeekHermes(hermesHome, fsImpl = fs) {
  const configPath = path.join(hermesHome, 'config.yaml');
  const envPath = path.join(hermesHome, '.env');
  const config = readSmallText(configPath, fsImpl);
  const envFile = readSmallText(envPath, fsImpl);
  const activeConfig = config
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  const providerConfigured = /(?:^|\n)\s*provider\s*:\s*["']?deepseek["']?\s*(?:#.*)?$/im.test(activeConfig);
  const modelConfigured = /(?:^|\n)\s*(?:default|model)\s*:\s*["']?[^\n#]*deepseek[^\n#]*/im.test(activeConfig);
  const endpointConfigured = /https?:\/\/api\.deepseek\.com(?:\/v1)?\b/i.test(activeConfig);
  const apiKeyDeclared = /(?:^|\n)\s*DEEPSEEK_API_KEY\s*=/m.test(envFile);

  return {
    configured: providerConfigured || modelConfigured || endpointConfigured || apiKeyDeclared,
    providerConfigured,
    modelConfigured,
    endpointConfigured,
    apiKeyDeclared,
    configExists: Boolean(config),
    soulPath: path.join(hermesHome, 'SOUL.md')
  };
}

function createAdapters(home = os.homedir(), env = process.env) {
  const codexHome = env.CODEX_HOME || path.join(home, '.codex');
  const hermesHome = env.HERMES_HOME || path.join(home, '.hermes');

  return [
    {
      id: 'codex',
      name: 'Codex',
      shortName: 'CX',
      accent: '#111827',
      path: path.join(codexHome, 'AGENTS.md'),
      command: 'codex',
      fileLabel: '全局 AGENTS.md',
      scope: '所有本地 Codex 任务',
      note: '新任务或新会话会读取更新后的全局指令。'
    },
    {
      id: 'claude',
      name: 'Claude Code',
      shortName: 'CL',
      accent: '#d97757',
      path: path.join(home, '.claude', 'CLAUDE.md'),
      command: 'claude',
      fileLabel: '用户级 CLAUDE.md',
      scope: '所有 Claude Code 项目',
      note: '在下一次会话启动时加载；现有会话可用 /memory 检查。'
    },
    {
      id: 'hermes',
      name: 'Hermes / DeepSeek',
      shortName: 'HE',
      accent: '#8357d9',
      path: path.join(hermesHome, 'SOUL.md'),
      hermesHome,
      command: 'hermes',
      fileLabel: '主身份 SOUL.md',
      scope: 'Hermes 全局身份（含 DeepSeek provider）',
      note: '兼容 DeepSeek 官方教程中的 Hermes Agent；只注入 SOUL.md，不修改模型、API Key 或工具配置。'
    },
    {
      id: 'openclaw',
      name: 'OpenClaw',
      shortName: 'OC',
      accent: '#e45454',
      path: path.join(home, '.openclaw', 'workspace', 'SOUL.md'),
      command: 'openclaw',
      fileLabel: '默认工作区 SOUL.md',
      scope: 'OpenClaw 默认智能体',
      note: '若使用自定义或多智能体工作区，请在设置里改成对应 SOUL.md。'
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      shortName: 'OP',
      accent: '#1f9d72',
      path: path.join(home, '.config', 'opencode', 'AGENTS.md'),
      command: 'opencode',
      fileLabel: '全局 AGENTS.md',
      scope: '所有 OpenCode 会话',
      note: '全局规则会在项目规则之外加载，下一次会话生效。'
    }
  ];
}

module.exports = { createAdapters, inspectDeepSeekHermes };
