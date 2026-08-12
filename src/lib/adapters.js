const os = require('node:os');
const path = require('node:path');

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
      name: 'Hermes',
      shortName: 'HE',
      accent: '#8357d9',
      path: path.join(hermesHome, 'SOUL.md'),
      command: 'hermes',
      fileLabel: '主身份 SOUL.md',
      scope: 'Hermes 全局身份',
      note: 'SOUL.md 位于系统提示词的主身份槽，建议保持标准长度。'
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

module.exports = { createAdapters };
