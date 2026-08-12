const BEGIN_MARKER = '<!-- KIRA-SWITCH:BEGIN -->';
const END_MARKER = '<!-- KIRA-SWITCH:END -->';
const LEGACY_BEGIN_MARKER = '<!-- PERSONA-SWITCH:BEGIN -->';
const LEGACY_END_MARKER = '<!-- PERSONA-SWITCH:END -->';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function managedBlockPattern() {
  return new RegExp(
    `(?:${escapeRegExp(BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}|${escapeRegExp(LEGACY_BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(LEGACY_END_MARKER)})(?:\\r?\\n)?`,
    'g'
  );
}

function detectNewline(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function stripManagedBlock(content = '') {
  return content.replace(managedBlockPattern(), '').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
}

function hasManagedBlock(content = '') {
  return (content.includes(BEGIN_MARKER) && content.includes(END_MARKER)) ||
    (content.includes(LEGACY_BEGIN_MARKER) && content.includes(LEGACY_END_MARKER));
}

function renderManagedBlock(prompt, metadata = {}, newline = '\n') {
  const safePrompt = String(prompt || '')
    .replaceAll(BEGIN_MARKER, '[Kira Switch 起始标记已移除]')
    .replaceAll(END_MARKER, '[Kira Switch 结束标记已移除]')
    .replaceAll(LEGACY_BEGIN_MARKER, '[旧版起始标记已移除]')
    .replaceAll(LEGACY_END_MARKER, '[旧版结束标记已移除]');
  const lines = [
    BEGIN_MARKER,
    `# Kira Switch · ${metadata.name || '未命名角色'}`,
    '',
    '> 此区块由 Kira Switch 管理。请在应用内切换或停用，不要手动改动标记。',
    '',
    safePrompt.trim(),
    END_MARKER
  ];
  return lines.join(newline);
}

function applyManagedBlock(content = '', prompt, metadata = {}) {
  const newline = detectNewline(content);
  const base = stripManagedBlock(content);
  const block = renderManagedBlock(prompt, metadata, newline);
  return base ? `${base}${newline}${newline}${block}${newline}` : `${block}${newline}`;
}

function disableManagedBlock(content = '') {
  const newline = detectNewline(content);
  const stripped = stripManagedBlock(content);
  return stripped ? `${stripped}${newline}` : '';
}

module.exports = {
  BEGIN_MARKER,
  END_MARKER,
  applyManagedBlock,
  disableManagedBlock,
  hasManagedBlock,
  renderManagedBlock,
  stripManagedBlock
};
