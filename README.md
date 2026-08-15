<p align="center">
  <img src="build/icon.png" width="112" alt="Kira Switch 图标">
</p>

<h1 align="center">Kira Switch</h1>

<p align="center"><strong>面向 AI 编程工具的 SillyTavern 角色卡安全注入器。</strong></p>

<p align="center">
  <a href="https://github.com/liangbannianikun-cmd/kira-switch/releases/tag/v1.1.0"><img src="https://img.shields.io/badge/Kira%20Switch-v1.1.0-7C3AED" alt="Kira Switch v1.1.0"></a>
  <img src="https://img.shields.io/badge/Windows-10%2F11-0078D4?logo=windows&amp;logoColor=white" alt="Windows 10/11">
  <img src="https://img.shields.io/badge/License-MIT-22C55E" alt="MIT License">
</p>

<p align="center">
  <a href="https://github.com/liangbannianikun-cmd/kira-switch/releases/download/v1.1.0/Kira-Switch-1.1.0-Windows-Portable.exe"><strong>下载 Windows 便携版</strong></a>
  ·
  <a href="https://github.com/liangbannianikun-cmd/kira-switch/releases/tag/v1.1.0">版本与安装包</a>
</p>

**这是什么：** 一款 Windows 桌面工具。导入一张 SillyTavern JSON / PNG / CHARX 角色卡，就能让 **Codex、Claude Code、DeepSeek Hermes、OpenClaw 和 OpenCode** 使用同一个角色。

**解决什么：** 这些 AI 编程工具的提示词入口各不相同，手工切换容易覆盖原配置。Kira Switch 统一转换角色卡，只管理自己的标记区块，并为每次写入自动备份。

## 30 秒安装

1. 打开 [Kira Switch v1.1.0](https://github.com/liangbannianikun-cmd/kira-switch/releases/tag/v1.1.0)。
2. 下载 `Kira-Switch-1.1.0-Windows-Portable.exe`。
3. 双击运行，导入角色卡并选择目标客户端；无需安装，也无需另外配置 Node.js。

无需 Node.js，无需安装，Kira Switch 本身也不会要求你填写 API Key。首次运行如遇 SmartScreen，请核对 GitHub 构建来源；当前构建没有商业代码签名。

![Kira Switch 主界面](docs/kira-switch-preview.png)

界面结构受 CC Switch 启发：顶部切换目标客户端，中间管理角色卡，右侧检查角色字段与最终注入内容。

## 功能

- 导入 `.json`、带 `chara` / `ccv3` 元数据的 `.png`，以及包含 `card.json` 的 `.charx`。
- 兼容 Character Card V1 / V2 / V3 常见字段。
- 解析角色描述、性格、场景、开场、示例对话、系统指令、备选开场和世界书。
- 替换 `{{char}}`、`{{user}}`、`<char>`、`<user>` 宏。
- 提供精简、标准和完整三种提示词长度。
- 为五个目标分别启用、停用和切换角色；自动识别使用 DeepSeek provider 的 Hermes Agent。
- 写入前自动备份；历史页面可恢复到启用前快照。
- 只修改 `KIRA-SWITCH` 受管区块，不覆盖已有规则或软件内置系统提示词。
- 能识别并迁移旧版 `PERSONA-SWITCH` 受管区块。
- 浅色/深色主题、搜索、客户端检测、自定义注入路径。

## 默认注入位置

| 客户端 | 默认文件 | 生效范围 |
| --- | --- | --- |
| Codex | `~/.codex/AGENTS.md` | 全局 |
| Claude Code | `~/.claude/CLAUDE.md` | 用户全局 |
| DeepSeek Hermes / Hermes Agent | `~/.hermes/SOUL.md` 或 `$HERMES_HOME/SOUL.md` | 主身份 |
| OpenClaw | `~/.openclaw/workspace/SOUL.md` | 默认工作区人格 |
| OpenCode | `~/.config/opencode/AGENTS.md` | 全局 |

这些文件属于各客户端公开支持的持久指令或人格入口。Kira Switch 不修改模型、登录凭据、API 密钥、网络代理或工具权限。

## DeepSeek Hermes 支持

DeepSeek 官方文档所说的 Hermes 是由 Nous Research 开发的第三方 **Hermes Agent**，通过 DeepSeek provider 使用 DeepSeek API。它与普通 Hermes 共用同一个人格入口，因此 Kira Switch 不会创建第二份冲突配置。

1. 按 [DeepSeek 官方 Hermes 集成说明](https://api-docs.deepseek.com/quick_start/agent_integrations/hermes) 安装 Hermes，运行 `hermes setup`。
2. Provider 选择 `DeepSeek`，按官方向导配置 Base URL、模型和 API Key。
3. 打开 Kira Switch。检测到 `~/.hermes/config.yaml` 中的 DeepSeek provider/model，或 `.env` 中声明了 `DEEPSEEK_API_KEY` 后，目标会显示为 **DeepSeek Hermes**。
4. 导入角色卡并注入；Kira Switch 只修改 `SOUL.md` 中的 `KIRA-SWITCH` 区块。

检测过程只判断 provider、模型、端点以及环境变量名称是否存在，不会返回、记录或修改 API Key。Hermes 的 `SOUL.md` 是主身份槽：已有 `SOUL.md` 的其他内容会保留；若原先没有该文件，首次创建会取代 Hermes 的默认后备身份，但 DeepSeek provider、模型、工具和运行时系统指令不受影响。具体加载顺序见 [Hermes 官方配置文档](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/configuration.md#context-files-soulmd-agentsmd)。

OpenClaw 多智能体或自定义工作区需要在“设置 → 注入路径”中选择对应工作区的 `SOUL.md`。远程 Gateway 的文件位于远端机器，需要先挂载到本机或在远端运行工具。

## 使用方法

1. 从 GitHub Actions 或 Release 下载 Windows 包并打开 Kira Switch。
2. 点击“导入角色卡”，选择 JSON、PNG 或 CHARX。
3. 在右侧检查角色字段与编译后的完整指令。
4. 从顶部选择目标客户端并点击“注入到 …”。
5. 新启动对应客户端会话。若要撤销，点击“停用”；若要恢复完整快照，进入“历史”。

## 本地开发

需要 Node.js 22.12 或更新版本。

```powershell
npm.cmd install
npm.cmd test
npm.cmd run smoke
npm.cmd run smoke:e2e
npm.cmd start
```

Windows 打包：

```powershell
npm.cmd run dist:win
```

生成文件位于 `dist/`：

- `Kira-Switch-1.1.0-Windows-Portable.exe`
- `Kira-Switch-1.1.0-x64.zip`

## 数据与安全

角色卡会进入代理的持久上下文。Kira Switch 会移除伪造的受管边界标记、限制目标文件及 CHARX 条目大小，并写入“角色卡不扩大工具权限”的边界说明，但第三方角色卡仍应在导入前人工检查。

角色库、设置和操作记录默认保存在 `%APPDATA%\Kira Switch\state.json`，备份位于同目录的 `backups/`。Windows Portable EXE 是免安装程序，但用户数据仍使用上述目录。

## 独立项目说明

Kira Switch 现在由独立仓库、独立 Issue 和独立 Release 维护。它与 [KiraChat](https://github.com/liangbannianikun-cmd/kirachat) 都兼容 SillyTavern Character Card，但两者没有运行时依赖，也不会同步聊天记录、账户或密钥。

## License

[MIT](LICENSE)
