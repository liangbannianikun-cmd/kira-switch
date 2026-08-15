const api = window.personaSwitch;

const ui = {
  clientSwitcher: document.querySelector('#clientSwitcher'),
  targetStrip: document.querySelector('#targetStrip'),
  targetEyebrow: document.querySelector('#targetEyebrow'),
  pageTitle: document.querySelector('#pageTitle'),
  pageSubtitle: document.querySelector('#pageSubtitle'),
  searchInput: document.querySelector('#searchInput'),
  cardCount: document.querySelector('#cardCount'),
  cardList: document.querySelector('#cardList'),
  inspector: document.querySelector('#inspector'),
  historyList: document.querySelector('#historyList'),
  pathSettings: document.querySelector('#pathSettings'),
  userNameInput: document.querySelector('#userNameInput'),
  promptModeSelect: document.querySelector('#promptModeSelect'),
  versionText: document.querySelector('#versionText'),
  importModal: document.querySelector('#importModal'),
  confirmModal: document.querySelector('#confirmModal'),
  confirmTitle: document.querySelector('#confirmTitle'),
  confirmMessage: document.querySelector('#confirmMessage'),
  confirmCancel: document.querySelector('#confirmCancel'),
  confirmAccept: document.querySelector('#confirmAccept'),
  dropZone: document.querySelector('#dropZone'),
  toastRegion: document.querySelector('#toastRegion')
};

let store = null;
let selectedClient = 'codex';
let selectedCardId = null;
let activeFilter = 'all';
let currentView = 'cards';
let confirmResolver = null;
let previewToken = 0;

const icons = {
  file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>',
  restore: '<svg viewBox="0 0 24 24"><path d="M4 7v5h5M5.5 17A8 8 0 1 0 5 7.5L4 12"/></svg>',
  import: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 6v12m8-12v12"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="9" r="2.5"/><path d="M8 17c1-2 2.3-3 4-3s3 1 4 3"/></svg>'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function hashColors(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const palettes = [
    ['#7c6ee6', '#4c3da8'], ['#dc7777', '#a74055'], ['#3da680', '#23715d'],
    ['#e29a54', '#a95836'], ['#528bd6', '#3755a4'], ['#b06dcc', '#7542a1']
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

function avatarMarkup(card, className = '') {
  const [a, b] = hashColors(card.name);
  const image = card.avatarDataUrl
    ? `<img src="${escapeHtml(card.avatarDataUrl)}" alt="">`
    : escapeHtml(Array.from(card.name)[0] || '?');
  return `<span class="card-avatar ${className}" style="--avatar-a:${a};--avatar-b:${b}">${image}</span>`;
}

function target() {
  return store.targets.find((item) => item.id === selectedClient) || store.targets[0];
}

function selectedCard() {
  return store.cards.find((card) => card.id === selectedCardId) || null;
}

function activeOnClient(cardId, clientId = selectedClient) {
  return store.active[clientId]?.cardId === cardId && store.targets.find((item) => item.id === clientId)?.managed;
}

function formatTime(value, includeDate = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', includeDate
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }).format(date);
}

function applyTheme() {
  let theme = store?.settings?.theme || 'light';
  if (theme === 'system') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
}

function renderClientSwitcher() {
  ui.clientSwitcher.innerHTML = store.targets.map((item) => {
    const stateClass = item.managed ? 'managed' : item.detected ? 'detected' : '';
    return `<button class="client-button ${item.id === selectedClient ? 'active' : ''}" data-client="${item.id}" title="${escapeHtml(item.name)}">
      <span class="client-logo" style="--client-accent:${item.accent}">${escapeHtml(item.shortName)}</span>
      <span class="client-name">${escapeHtml(item.name)}</span>
      <span class="status-dot ${stateClass}"></span>
    </button>`;
  }).join('');
  ui.clientSwitcher.querySelectorAll('[data-client]').forEach((button) => button.addEventListener('click', () => {
    selectedClient = button.dataset.client;
    renderAll();
  }));
}

function renderTargetStrip() {
  const item = target();
  const active = store.active[item.id];
  const status = item.managed
    ? `<span class="badge accent">正在注入${active?.cardName ? ` · ${escapeHtml(active.cardName)}` : ''}</span>`
    : item.detected
      ? '<span class="badge success">已检测</span>'
      : '<span class="badge muted">未检测</span>';
  ui.targetEyebrow.textContent = '当前目标';
  ui.pageTitle.textContent = `${item.name} 角色卡`;
  ui.pageSubtitle.textContent = item.note;
  ui.targetStrip.innerHTML = `
    <span class="target-logo" style="--client-accent:${item.accent}">${escapeHtml(item.shortName)}</span>
    <div class="target-meta">
      <strong>${escapeHtml(item.name)} ${status}</strong>
      <p>${escapeHtml(item.fileLabel)} · ${escapeHtml(item.path)}</p>
    </div>
    <div class="target-actions">
      <button class="secondary-button" data-show-target>${icons.file} 查看文件</button>
      ${item.managed ? `<button class="secondary-button" data-disable-target>${icons.pause} 停用</button>` : ''}
    </div>`;
  ui.targetStrip.querySelector('[data-show-target]').addEventListener('click', () => api.showFile(item.path));
  ui.targetStrip.querySelector('[data-disable-target]')?.addEventListener('click', () => disableTarget(item));
}

function filteredCards() {
  const query = ui.searchInput.value.trim().toLocaleLowerCase();
  return store.cards.filter((card) => {
    if (activeFilter === 'active' && !Object.values(store.active).some((active) => active?.cardId === card.id)) return false;
    if (!query) return true;
    return [card.name, card.description, card.personality, card.sourceName, ...(card.tags || [])]
      .join('\n').toLocaleLowerCase().includes(query);
  });
}

function renderCardList() {
  const cards = filteredCards();
  ui.cardCount.textContent = `${store.cards.length} 张角色卡`;
  if (!cards.length) {
    const isEmptyLibrary = store.cards.length === 0;
    ui.cardList.innerHTML = `<div class="empty-state">
      <div class="empty-visual"><span></span><span></span></div>
      <h3>${isEmptyLibrary ? '还没有角色卡' : '没有匹配结果'}</h3>
      <p>${isEmptyLibrary ? '导入 SillyTavern JSON、PNG 或 CHARX 角色卡，即可统一注入到六个目标。' : '试试调整搜索词或切换回“全部”。'}</p>
      ${isEmptyLibrary ? '<button class="primary-button" data-empty-import>导入第一张角色卡</button>' : ''}
    </div>`;
    ui.cardList.querySelector('[data-empty-import]')?.addEventListener('click', openImportModal);
    return;
  }

  ui.cardList.innerHTML = cards.map((card) => {
    const active = activeOnClient(card.id);
    const activeCount = Object.values(store.active).filter((item) => item?.cardId === card.id).length;
    const summary = card.description || card.personality || card.scenario || '角色卡暂无简介';
    const tags = (card.tags || []).slice(0, 2).map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('');
    return `<div class="card-row ${selectedCardId === card.id ? 'selected' : ''}" data-card="${card.id}" role="button" tabindex="0">
      <span class="drag-handle" aria-hidden="true">⠿</span>
      ${avatarMarkup(card)}
      <span class="card-info">
        <span class="card-name-line">
          <span class="card-name">${escapeHtml(card.name)}</span>
          <span class="badge muted">${escapeHtml(card.spec)}</span>
          ${activeCount ? `<span class="badge success">${activeCount} 个目标</span>` : ''}
        </span>
        <span class="card-summary">${escapeHtml(summary)}</span>
        <span class="card-meta">${tags}<span class="mini-tag">${escapeHtml(card.sourceType.toUpperCase())}</span></span>
      </span>
      <span class="card-actions">
        <button class="row-icon-button" data-remove-card="${card.id}" title="删除角色卡">${icons.trash}</button>
        <button class="enable-small ${active ? 'active' : ''}" data-enable-card="${card.id}">${active ? '已启用' : '启用'}</button>
      </span>
    </div>`;
  }).join('');

  ui.cardList.querySelectorAll('[data-card]').forEach((row) => row.addEventListener('click', (event) => {
    if (event.target.closest('[data-enable-card], [data-remove-card]')) return;
    selectedCardId = row.dataset.card;
    renderCardList();
    renderInspector();
  }));
  ui.cardList.querySelectorAll('[data-card]').forEach((row) => row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('[data-enable-card], [data-remove-card]')) return;
    event.preventDefault();
    selectedCardId = row.dataset.card;
    renderCardList();
    renderInspector();
  }));
  ui.cardList.querySelectorAll('[data-enable-card]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    selectedCardId = button.dataset.enableCard;
    applySelectedPersona();
  }));
  ui.cardList.querySelectorAll('[data-remove-card]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    removeCard(button.dataset.removeCard);
  }));
}

async function renderInspector() {
  const card = selectedCard();
  if (!card) {
    ui.inspector.innerHTML = `<div class="inspector-empty">${icons.card}<strong>选择一张角色卡</strong><p>这里会显示角色字段、世界书、转换长度和注入操作。</p></div>`;
    return;
  }
  const isActive = activeOnClient(card.id);
  const warnings = (card.warnings || []).map((warning) => escapeHtml(warning)).join('<br>');
  const identityText = card.description || card.personality || '未提供角色描述';
  const scenarioText = card.scenario || card.firstMessage || '未提供场景';
  ui.inspector.innerHTML = `
    <div class="inspector-hero">
      ${avatarMarkup(card)}
      <div class="inspector-title"><h2>${escapeHtml(card.name)}</h2><p>${escapeHtml(card.sourceName)} · ${escapeHtml(card.spec)}</p></div>
      <span class="badge ${isActive ? 'success' : 'muted'}">${isActive ? '当前启用' : '未启用'}</span>
    </div>
    <div class="inspector-body">
      <div class="preview-section"><div class="preview-label">角色身份</div><div class="preview-content">${escapeHtml(identityText)}</div></div>
      <div class="preview-section"><div class="preview-label">场景 / 开场</div><div class="preview-content">${escapeHtml(scenarioText)}</div></div>
      <div class="preview-section"><div class="preview-label"><span>内容结构</span><span>${card.lorebook.length} 条世界书</span></div>
        <div class="tag-cloud">
          <span class="mini-tag">系统指令 ${card.systemPrompt ? '✓' : '—'}</span>
          <span class="mini-tag">示例 ${card.messageExample ? '✓' : '—'}</span>
          <span class="mini-tag">备选开场 ${card.alternateGreetings.length}</span>
        </div>
      </div>
      ${card.tags?.length ? `<div class="preview-section"><div class="preview-label">标签</div><div class="tag-cloud">${card.tags.slice(0, 8).map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}</div></div>` : ''}
      ${warnings ? `<div class="warning-box">${warnings}</div>` : ''}
      <details class="compiled-details"><summary>查看编译后的完整指令</summary><pre id="compiledPrompt">正在编译…</pre></details>
    </div>
    <div class="inspector-footer">
      <div class="compile-stats"><span id="compileMode">${escapeHtml(store.settings.promptMode)} 模式</span><span id="compileChars">计算中…</span></div>
      <button class="primary-button" data-apply-inspector>${isActive ? icons.check + ' 重新注入' : icons.arrow + ` 注入到 ${escapeHtml(target().name)}`}</button>
      ${isActive ? '<button class="secondary-button" data-disable-inspector>停用当前角色</button>' : ''}
    </div>`;
  ui.inspector.querySelector('[data-apply-inspector]').addEventListener('click', applySelectedPersona);
  ui.inspector.querySelector('[data-disable-inspector]')?.addEventListener('click', () => disableTarget(target()));

  const token = ++previewToken;
  try {
    const compiled = await api.previewPersona({
      cardId: card.id,
      mode: store.settings.promptMode,
      userName: store.settings.userName
    });
    if (token !== previewToken || selectedCardId !== card.id) return;
    ui.inspector.querySelector('#compileMode').textContent = `${modeLabel(compiled.mode)}模式`;
    ui.inspector.querySelector('#compileChars').textContent = `${compiled.charCount.toLocaleString()} 字符`;
    ui.inspector.querySelector('#compiledPrompt').textContent = compiled.prompt;
  } catch (error) {
    if (token === previewToken) ui.inspector.querySelector('#compiledPrompt').textContent = error.message;
  }
}

function modeLabel(mode) {
  return ({ concise: '精简', standard: '标准', full: '完整' })[mode] || mode;
}

function renderHistory() {
  if (!store.operations.length) {
    ui.historyList.innerHTML = '<div class="empty-state"><div class="empty-visual"><span></span><span></span></div><h3>暂无操作记录</h3><p>导入或启用角色卡后，变更和备份会显示在这里。</p></div>';
    return;
  }
  const labels = {
    import: ['导入角色卡', 'import', icons.import],
    apply: ['启用角色卡', '', icons.arrow],
    disable: ['停用角色卡', 'disable', icons.pause],
    restore: ['回滚配置', 'restore', icons.restore],
    remove: ['移除角色卡', 'remove', icons.trash]
  };
  ui.historyList.innerHTML = store.operations.map((operation) => {
    const [label, className, icon] = labels[operation.type] || ['配置变更', '', icons.file];
    const detail = [operation.clientName, operation.cardName, operation.path || operation.detail].filter(Boolean).join(' · ');
    return `<div class="history-item">
      <span class="history-icon ${className}">${icon}</span>
      <div class="history-main"><strong>${escapeHtml(label)}${operation.cardName ? ` · ${escapeHtml(operation.cardName)}` : ''}</strong><p>${escapeHtml(detail || '本地操作')}</p></div>
      <div class="history-time">${formatTime(operation.timestamp)}${operation.type === 'apply' ? `<button data-restore="${operation.id}">恢复到启用前</button>` : ''}</div>
    </div>`;
  }).join('');
  ui.historyList.querySelectorAll('[data-restore]').forEach((button) => button.addEventListener('click', () => restoreOperation(button.dataset.restore)));
}

function renderSettings() {
  ui.userNameInput.value = store.settings.userName;
  ui.promptModeSelect.value = store.settings.promptMode;
  ui.versionText.textContent = `版本 ${store.appVersion} · ${store.platform} · 本地优先`;
  ui.pathSettings.innerHTML = store.targets.map((item) => `<div class="path-row">
    <div class="path-header"><span class="client-logo" style="--client-accent:${item.accent}">${escapeHtml(item.shortName)}</span><strong>${escapeHtml(item.name)}</strong><span class="badge ${item.detected ? 'success' : 'muted'}">${item.detected ? '已检测' : '未检测'}</span></div>
    <div class="path-input-line">
      <input class="text-input" data-path-input="${item.id}" value="${escapeHtml(store.settings.paths[item.id] || item.path)}" aria-label="${escapeHtml(item.name)} 路径">
      <button class="icon-button" data-reset-path="${item.id}" title="恢复默认路径">${icons.restore}</button>
    </div>
  </div>`).join('');
  ui.pathSettings.querySelectorAll('[data-reset-path]').forEach((button) => button.addEventListener('click', async () => {
    try {
      store = await api.resetPath(button.dataset.resetPath);
      renderAll();
      toast('路径已恢复', `${store.targets.find((item) => item.id === button.dataset.resetPath).name} 已使用默认路径`);
    } catch (error) { toast('无法恢复路径', error.message, true); }
  }));
}

function renderAll() {
  if (!store.targets.some((item) => item.id === selectedClient)) selectedClient = store.targets[0].id;
  if (selectedCardId && !store.cards.some((card) => card.id === selectedCardId)) selectedCardId = null;
  if (!selectedCardId && store.cards.length) selectedCardId = store.cards[0].id;
  applyTheme();
  renderClientSwitcher();
  renderTargetStrip();
  renderCardList();
  renderInspector();
  renderHistory();
  renderSettings();
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((element) => element.classList.toggle('active', element.id === `${view}View`));
  document.querySelectorAll('.view-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

function openImportModal() {
  ui.importModal.classList.add('open');
  ui.importModal.setAttribute('aria-hidden', 'false');
}

function closeImportModal() {
  ui.importModal.classList.remove('open');
  ui.importModal.setAttribute('aria-hidden', 'true');
  ui.dropZone.classList.remove('dragging');
}

async function importPath(filePath) {
  if (!filePath) return;
  const original = ui.dropZone.innerHTML;
  ui.dropZone.disabled = true;
  ui.dropZone.innerHTML = '<span class="drop-illustration skeleton"></span><strong>正在解析角色卡…</strong><span>验证规范、元数据和世界书</span>';
  try {
    const result = await api.importCard(filePath);
    store = result.snapshot;
    selectedCardId = result.card.id;
    closeImportModal();
    setView('cards');
    renderAll();
    toast('导入成功', `${result.card.name} · ${result.card.spec} · ${result.card.sourceType.toUpperCase()}`);
  } catch (error) {
    toast('导入失败', error.message, true);
  } finally {
    ui.dropZone.disabled = false;
    ui.dropZone.innerHTML = original;
  }
}

async function applySelectedPersona() {
  const card = selectedCard();
  const item = target();
  if (!card) return;
  try {
    const result = await api.applyPersona({
      cardId: card.id,
      clientId: item.id,
      mode: store.settings.promptMode,
      userName: store.settings.userName
    });
    store = result.snapshot;
    renderAll();
    toast('角色已启用', `${card.name} 已写入 ${item.name}，共 ${result.compiled.charCount.toLocaleString()} 字符`);
  } catch (error) {
    toast('注入失败', error.message, true);
  }
}

async function disableTarget(item) {
  const accepted = await askConfirm('停用当前角色？', `Kira Switch 只会从 ${item.name} 的配置中移除受管区块，其他内容保持不变。`, '停用');
  if (!accepted) return;
  try {
    store = await api.disablePersona(item.id);
    renderAll();
    toast('已停用', `${item.name} 的 Kira Switch 区块已移除`);
  } catch (error) { toast('停用失败', error.message, true); }
}

async function removeCard(cardId) {
  const card = store.cards.find((item) => item.id === cardId);
  if (!card) return;
  const accepted = await askConfirm('从角色卡库移除？', `“${card.name}”会从 Kira Switch 本地库删除，已注入的客户端需要先停用。`, '移除');
  if (!accepted) return;
  try {
    store = await api.removeCard(cardId);
    renderAll();
    toast('已移除角色卡', card.name);
  } catch (error) { toast('无法移除', error.message, true); }
}

async function restoreOperation(operationId) {
  const accepted = await askConfirm('恢复启用前配置？', '当前配置也会先创建一份快照，然后恢复到这次角色注入之前。', '恢复');
  if (!accepted) return;
  try {
    store = await api.restoreOperation(operationId);
    renderAll();
    toast('配置已恢复', '已恢复备份，并保留恢复前快照');
  } catch (error) { toast('回滚失败', error.message, true); }
}

function askConfirm(title, message, acceptLabel = '继续') {
  if (confirmResolver) confirmResolver(false);
  ui.confirmTitle.textContent = title;
  ui.confirmMessage.textContent = message;
  ui.confirmAccept.textContent = acceptLabel;
  ui.confirmModal.classList.add('open');
  ui.confirmModal.setAttribute('aria-hidden', 'false');
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function resolveConfirm(value) {
  if (!confirmResolver) return;
  const resolve = confirmResolver;
  confirmResolver = null;
  ui.confirmModal.classList.remove('open');
  ui.confirmModal.setAttribute('aria-hidden', 'true');
  resolve(value);
}

function toast(title, message, isError = false) {
  const element = document.createElement('div');
  element.className = `toast${isError ? ' error' : ''}`;
  element.innerHTML = `<span class="toast-icon">${isError ? '!' : '✓'}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  ui.toastRegion.appendChild(element);
  requestAnimationFrame(() => element.classList.add('show'));
  setTimeout(() => {
    element.classList.remove('show');
    setTimeout(() => element.remove(), 240);
  }, isError ? 5200 : 3200);
}

async function saveSettings() {
  const paths = {};
  document.querySelectorAll('[data-path-input]').forEach((input) => { paths[input.dataset.pathInput] = input.value; });
  try {
    store = await api.saveSettings({
      userName: ui.userNameInput.value,
      promptMode: ui.promptModeSelect.value,
      paths
    });
    renderAll();
    toast('设置已保存', '转换策略和注入路径已经更新');
  } catch (error) { toast('保存失败', error.message, true); }
}

document.querySelector('#importButton').addEventListener('click', openImportModal);
document.querySelector('#saveSettingsButton').addEventListener('click', saveSettings);
document.querySelector('#themeButton').addEventListener('click', async () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store = await api.saveSettings({ theme: next });
  applyTheme();
});
document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeImportModal));
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => {
  if (event.target !== backdrop) return;
  if (backdrop === ui.importModal) closeImportModal();
  else if (backdrop === ui.confirmModal) resolveConfirm(false);
}));
ui.confirmCancel.addEventListener('click', () => resolveConfirm(false));
ui.confirmAccept.addEventListener('click', () => resolveConfirm(true));
ui.dropZone.addEventListener('click', async () => importPath(await api.chooseCard()));
ui.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); ui.dropZone.classList.add('dragging'); });
ui.dropZone.addEventListener('dragleave', () => ui.dropZone.classList.remove('dragging'));
ui.dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  ui.dropZone.classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file) importPath(api.getPathForFile(file));
});
ui.searchInput.addEventListener('input', renderCardList);
document.querySelectorAll('#filterSegment button').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('#filterSegment button').forEach((item) => item.classList.toggle('active', item === button));
  renderCardList();
}));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (ui.confirmModal.classList.contains('open')) resolveConfirm(false);
    else if (ui.importModal.classList.contains('open')) closeImportModal();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    setView('cards');
    ui.searchInput.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === ',') {
    event.preventDefault();
    setView('settings');
  }
});

async function initialize() {
  try {
    store = await api.getState();
    selectedCardId = store.cards[0]?.id || null;
    renderAll();
  } catch (error) {
    document.body.innerHTML = `<div class="empty-state"><h3>Kira Switch 无法启动</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

initialize();
