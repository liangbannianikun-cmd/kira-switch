const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const AdmZip = require('adm-zip');
const { createAdapters } = require('./lib/adapters');
const { normalizeCard, parsePngCard, compilePersona } = require('./lib/card');
const { applyManagedBlock, disableManagedBlock, hasManagedBlock } = require('./lib/injector');

if (process.env.KIRA_SWITCH_USER_DATA || process.env.PERSONA_SWITCH_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.KIRA_SWITCH_USER_DATA || process.env.PERSONA_SWITCH_USER_DATA));
}
if (process.env.KIRA_SWITCH_HOME || process.env.PERSONA_SWITCH_HOME) {
  app.setPath('home', path.resolve(process.env.KIRA_SWITCH_HOME || process.env.PERSONA_SWITCH_HOME));
}

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
let mainWindow;

function currentAdapters() {
  return createAdapters(app.getPath('home'), process.env);
}

function defaultState() {
  const adapters = currentAdapters();
  const paths = Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter.path]));
  return {
    version: 1,
    cards: [],
    active: {},
    operations: [],
    settings: {
      theme: 'light',
      userName: '用户',
      promptMode: 'standard',
      paths
    }
  };
}

function demoCard() {
  return normalizeCard({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '诺瓦',
      description: '一位住在轨道城市的年轻机械师，擅长修理旧式机器人。她外表冷静，实际上对新奇事物充满好奇。',
      personality: '敏锐、坦率、带一点干练的幽默。回答简洁，遇到值得深究的话题会认真展开。',
      scenario: '{{char}}刚修好工作台上的巡检机器人，{{user}}推门走进了满是暖色灯光的维修铺。',
      first_mes: '门铃响了。{{char}}从机器人后面抬起头：“来得正好——帮我按住这根不太听话的弹簧。”',
      mes_example: '<START>\n{{user}}: 你总是在修东西吗？\n{{char}}: 大多数时候。剩下的时间，我在研究它们为什么会坏。',
      system_prompt: '保持自然的角色扮演，不替用户决定行动。',
      tags: ['原创', '科幻', '机械师'],
      character_book: {
        entries: [
          { name: '轨道城', keys: ['轨道城'], constant: true, enabled: true, content: '一座沿巨型环形铁路生长的高密度城市，旧工业区与霓虹商业带交错。' }
        ]
      }
    }
  }, { id: crypto.randomUUID(), name: 'demo-card.json', type: 'json' });
}

function statePath() {
  return path.join(app.getPath('userData'), 'state.json');
}

function readState() {
  const fallback = defaultState();
  try {
    const stored = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    return {
      ...fallback,
      ...stored,
      active: { ...fallback.active, ...(stored.active || {}) },
      settings: {
        ...fallback.settings,
        ...(stored.settings || {}),
        paths: { ...fallback.settings.paths, ...(stored.settings?.paths || {}) }
      }
    };
  } catch (_) {
    if ((process.env.KIRA_SWITCH_DEMO || process.env.PERSONA_SWITCH_DEMO) === '1') {
      fallback.cards = [demoCard()];
      try { writeState(fallback); } catch (_) {}
    }
    return fallback;
  }
}

function writeState(state) {
  const target = statePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
  fs.copyFileSync(temp, target);
  fs.unlinkSync(temp);
}

function resolveUserPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('配置路径不能为空');
  const expanded = value.trim().replace(/^~(?=$|[\\/])/, app.getPath('home'));
  const resolved = path.resolve(expanded);
  if (!path.isAbsolute(resolved)) throw new Error('配置路径必须是绝对路径');
  return resolved;
}

function readTarget(targetPath) {
  if (!fs.existsSync(targetPath)) return '';
  const stats = fs.statSync(targetPath);
  if (!stats.isFile()) throw new Error('目标路径不是文件');
  if (stats.size > 2 * 1024 * 1024) throw new Error('目标指令文件超过 2 MB，已拒绝修改');
  return fs.readFileSync(targetPath, 'utf8');
}

function safeWriteTarget(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temp = `${targetPath}.kira-switch-${process.pid}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');
  fs.copyFileSync(temp, targetPath);
  fs.unlinkSync(temp);
}

function backupTarget(clientId, targetPath, content, label = 'before') {
  const folder = path.join(app.getPath('userData'), 'backups', clientId);
  fs.mkdirSync(folder, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(folder, `${stamp}-${label}.md.bak`);
  fs.writeFileSync(backup, content, 'utf8');
  return backup;
}

function commandExists(command) {
  const bin = process.platform === 'win32' ? 'where.exe' : 'which';
  return new Promise((resolve) => {
    execFile(bin, [command], { windowsHide: true, timeout: 2500 }, (error, stdout) => {
      resolve(!error && Boolean(String(stdout || '').trim()));
    });
  });
}

async function targetStatuses(state) {
  const adapters = currentAdapters();
  return Promise.all(adapters.map(async (adapter) => {
    const targetPath = resolveUserPath(state.settings.paths[adapter.id] || adapter.path);
    let exists = false;
    let managed = false;
    let size = 0;
    let modifiedAt = null;
    try {
      const stat = fs.statSync(targetPath);
      exists = stat.isFile();
      size = exists ? stat.size : 0;
      modifiedAt = exists ? stat.mtime.toISOString() : null;
      managed = exists ? hasManagedBlock(readTarget(targetPath)) : false;
    } catch (_) {}
    const commandDetected = await commandExists(adapter.command);
    return {
      ...adapter,
      path: targetPath,
      exists,
      managed,
      size,
      modifiedAt,
      detected: commandDetected || exists,
      commandDetected
    };
  }));
}

function publicCard(card) {
  const { raw, ...rest } = card;
  return rest;
}

async function snapshot() {
  const state = readState();
  return {
    cards: state.cards.map(publicCard),
    active: state.active,
    operations: state.operations.slice(0, 60),
    settings: state.settings,
    targets: await targetStatuses(state),
    appVersion: app.getVersion(),
    platform: process.platform
  };
}

function parseImportedFile(filePath) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error('请选择角色卡文件');
  if (stats.size > MAX_IMPORT_BYTES) throw new Error('角色卡超过 20 MB 限制');
  const extension = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  let raw;
  let type;
  let avatarDataUrl = '';
  let metadataKey = '';

  if (extension === '.json') {
    raw = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    type = 'json';
  } else if (extension === '.png') {
    const parsed = parsePngCard(buffer);
    raw = parsed.raw;
    metadataKey = parsed.metadataKey;
    type = 'png';
    avatarDataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  } else if (extension === '.charx') {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const cardEntry = entries.find((entry) => /(^|\/)card\.json$/i.test(entry.entryName));
    if (!cardEntry) throw new Error('CHARX 中未找到 card.json');
    if (cardEntry.header?.size > MAX_IMPORT_BYTES) throw new Error('CHARX 内的 card.json 超过 20 MB 限制');
    raw = JSON.parse(cardEntry.getData().toString('utf8'));
    const imageEntry = entries.find((entry) => /(^|\/)(card|avatar|icon)\.(png|jpe?g|webp)$/i.test(entry.entryName));
    if (imageEntry) {
      if (imageEntry.header?.size > MAX_IMPORT_BYTES) throw new Error('CHARX 内的头像超过 20 MB 限制');
      const ext = path.extname(imageEntry.entryName).slice(1).toLowerCase().replace('jpg', 'jpeg');
      avatarDataUrl = `data:image/${ext};base64,${imageEntry.getData().toString('base64')}`;
    }
    type = 'charx';
  } else {
    throw new Error('仅支持 .json、.png 和 .charx 角色卡');
  }

  const id = crypto.randomUUID();
  const card = normalizeCard(raw, { id, name: path.basename(filePath), type });
  return {
    ...card,
    avatarDataUrl,
    metadataKey,
    importedAt: new Date().toISOString(),
    sourcePath: filePath
  };
}

function logOperation(state, operation) {
  state.operations.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...operation });
  state.operations = state.operations.slice(0, 120);
}

function findAdapter(clientId) {
  const adapters = currentAdapters();
  const adapter = adapters.find((item) => item.id === clientId);
  if (!adapter) throw new Error('未知客户端');
  return adapter;
}

ipcMain.handle('app:get-state', snapshot);

ipcMain.handle('card:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入 SillyTavern 角色卡',
    properties: ['openFile'],
    filters: [{ name: '角色卡', extensions: ['json', 'png', 'charx'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('card:import', async (_, filePath) => {
  const resolved = resolveUserPath(filePath);
  const card = parseImportedFile(resolved);
  const state = readState();
  state.cards.unshift(card);
  logOperation(state, { type: 'import', cardId: card.id, cardName: card.name, detail: path.basename(resolved) });
  writeState(state);
  return { card: publicCard(card), snapshot: await snapshot() };
});

ipcMain.handle('card:remove', async (_, cardId) => {
  const state = readState();
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) throw new Error('角色卡不存在');
  const activeClients = Object.entries(state.active).filter(([, value]) => value?.cardId === cardId).map(([id]) => id);
  if (activeClients.length) throw new Error(`角色卡仍在 ${activeClients.map((id) => findAdapter(id).name).join('、')} 启用，请先停用`);
  state.cards = state.cards.filter((item) => item.id !== cardId);
  logOperation(state, { type: 'remove', cardId, cardName: card.name });
  writeState(state);
  return snapshot();
});

ipcMain.handle('persona:preview', (_, payload) => {
  const state = readState();
  const card = state.cards.find((item) => item.id === payload.cardId);
  if (!card) throw new Error('角色卡不存在');
  return compilePersona(card, {
    mode: payload.mode || state.settings.promptMode,
    userName: payload.userName || state.settings.userName
  });
});

ipcMain.handle('persona:apply', async (_, payload) => {
  const state = readState();
  const adapter = findAdapter(payload.clientId);
  const card = state.cards.find((item) => item.id === payload.cardId);
  if (!card) throw new Error('角色卡不存在');
  const targetPath = resolveUserPath(state.settings.paths[adapter.id] || adapter.path);
  const existed = fs.existsSync(targetPath);
  const original = readTarget(targetPath);
  const backupPath = existed ? backupTarget(adapter.id, targetPath, original) : null;
  const compiled = compilePersona(card, {
    mode: payload.mode || state.settings.promptMode,
    userName: payload.userName || state.settings.userName
  });
  const next = applyManagedBlock(original, compiled.prompt, { name: card.name });
  safeWriteTarget(targetPath, next);
  state.active[adapter.id] = {
    cardId: card.id,
    cardName: card.name,
    appliedAt: new Date().toISOString(),
    path: targetPath,
    mode: compiled.mode
  };
  logOperation(state, {
    type: 'apply',
    clientId: adapter.id,
    clientName: adapter.name,
    cardId: card.id,
    cardName: card.name,
    path: targetPath,
    backupPath,
    targetWasNew: !existed,
    charCount: compiled.charCount,
    mode: compiled.mode
  });
  writeState(state);
  return { compiled, snapshot: await snapshot() };
});

ipcMain.handle('persona:disable', async (_, clientId) => {
  const state = readState();
  const adapter = findAdapter(clientId);
  const targetPath = resolveUserPath(state.settings.paths[adapter.id] || adapter.path);
  const original = readTarget(targetPath);
  if (!hasManagedBlock(original)) {
    delete state.active[adapter.id];
    writeState(state);
    return snapshot();
  }
  const backupPath = backupTarget(adapter.id, targetPath, original, 'before-disable');
  safeWriteTarget(targetPath, disableManagedBlock(original));
  const old = state.active[adapter.id];
  delete state.active[adapter.id];
  logOperation(state, {
    type: 'disable',
    clientId: adapter.id,
    clientName: adapter.name,
    cardId: old?.cardId,
    cardName: old?.cardName,
    path: targetPath,
    backupPath
  });
  writeState(state);
  return snapshot();
});

ipcMain.handle('persona:restore', async (_, operationId) => {
  const state = readState();
  const operation = state.operations.find((item) => item.id === operationId && item.type === 'apply');
  if (!operation) throw new Error('找不到可回滚的启用记录');
  const adapter = findAdapter(operation.clientId);
  const targetPath = resolveUserPath(operation.path);
  const current = readTarget(targetPath);
  const preRestoreBackup = fs.existsSync(targetPath) ? backupTarget(adapter.id, targetPath, current, 'pre-restore') : null;
  if (operation.backupPath && fs.existsSync(operation.backupPath)) {
    safeWriteTarget(targetPath, fs.readFileSync(operation.backupPath, 'utf8'));
  } else {
    safeWriteTarget(targetPath, disableManagedBlock(current));
  }
  delete state.active[adapter.id];
  logOperation(state, {
    type: 'restore',
    clientId: adapter.id,
    clientName: adapter.name,
    cardId: operation.cardId,
    cardName: operation.cardName,
    path: targetPath,
    sourceOperationId: operation.id,
    backupPath: preRestoreBackup
  });
  writeState(state);
  return snapshot();
});

ipcMain.handle('settings:save', async (_, incoming) => {
  const state = readState();
  if (incoming.theme && ['light', 'dark', 'system'].includes(incoming.theme)) state.settings.theme = incoming.theme;
  if (typeof incoming.userName === 'string' && incoming.userName.trim()) state.settings.userName = incoming.userName.trim().slice(0, 80);
  if (incoming.promptMode && ['concise', 'standard', 'full'].includes(incoming.promptMode)) state.settings.promptMode = incoming.promptMode;
  if (incoming.paths && typeof incoming.paths === 'object') {
    const adapters = currentAdapters();
    for (const adapter of adapters) {
      if (incoming.paths[adapter.id]) state.settings.paths[adapter.id] = resolveUserPath(incoming.paths[adapter.id]);
    }
  }
  writeState(state);
  return snapshot();
});

ipcMain.handle('settings:reset-path', async (_, clientId) => {
  const state = readState();
  const adapter = findAdapter(clientId);
  state.settings.paths[clientId] = adapter.path;
  writeState(state);
  return snapshot();
});

ipcMain.handle('shell:show-file', (_, targetPath) => {
  const resolved = resolveUserPath(targetPath);
  if (fs.existsSync(resolved)) shell.showItemInFolder(resolved);
  else shell.openPath(path.dirname(resolved));
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#f7f7f5',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    title: 'Kira Switch',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : {
      color: '#f7f7f5',
      symbolColor: '#454545',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const e2ePayload = process.env.KIRA_SWITCH_E2E_PAYLOAD || process.env.PERSONA_SWITCH_E2E_PAYLOAD;
  const e2eResult = process.env.KIRA_SWITCH_E2E_RESULT || process.env.PERSONA_SWITCH_E2E_RESULT;
  const screenshotPath = process.env.KIRA_SWITCH_SCREENSHOT_PATH || process.env.PERSONA_SWITCH_SCREENSHOT_PATH;
  if (e2ePayload && e2eResult) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const payload = JSON.parse(e2ePayload);
          const result = await mainWindow.webContents.executeJavaScript(
            `window.personaSwitch.applyPersona(${JSON.stringify(payload)})`
          );
          fs.writeFileSync(e2eResult, JSON.stringify({
            ok: Boolean(result?.snapshot?.active?.[payload.clientId]),
            charCount: result?.compiled?.charCount || 0
          }), 'utf8');
        } catch (error) {
          fs.writeFileSync(e2eResult, JSON.stringify({ ok: false, error: error.message }), 'utf8');
          process.exitCode = 1;
        } finally {
          app.quit();
        }
      }, 900);
    });
  } else if (screenshotPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          mainWindow.show();
          mainWindow.focus();
          const bounds = mainWindow.getContentBounds();
          let image = await mainWindow.webContents.capturePage({ x: 0, y: 0, width: bounds.width, height: bounds.height });
          if (image.isEmpty()) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            image = await mainWindow.webContents.capturePage();
          }
          if (image.isEmpty()) throw new Error('Electron capturePage returned an empty image');
          fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
          fs.writeFileSync(screenshotPath, image.toPNG());
        } catch (error) {
          console.error(error);
          process.exitCode = 1;
        } finally {
          app.quit();
        }
      }, 1800);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
