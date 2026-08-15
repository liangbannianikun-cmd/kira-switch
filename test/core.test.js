const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeCard, compilePersona, parsePngCard, readPngTextChunks } = require('../src/lib/card');
const { applyManagedBlock, disableManagedBlock, hasManagedBlock, stripManagedBlock } = require('../src/lib/injector');
const { createAdapters, inspectDeepSeekHermes } = require('../src/lib/adapters');

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
}

function fakeCardPng(raw, key = 'ccv3') {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const encoded = Buffer.from(JSON.stringify(raw), 'utf8').toString('base64');
  return Buffer.concat([
    signature,
    pngChunk('IHDR', Buffer.alloc(13)),
    pngChunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(encoded, 'latin1')])),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function fixtureCard() {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '阿澄',
      description: '{{char}}是一名天文摄影师。',
      personality: '安静、敏锐，喜欢精确的比喻。',
      scenario: '{{user}}和{{char}}在山顶等待流星雨。',
      first_mes: '别开灯，眼睛还需要一点时间适应黑暗。',
      mes_example: '<START>\n{{user}}: 云会散吗？\n{{char}}: 会，风正在替我们慢慢翻页。',
      system_prompt: '不要替{{user}}决定行动。',
      alternate_greetings: ['你来得正好。'],
      tags: ['原创', '现代'],
      character_book: {
        entries: [
          { name: '观测站', keys: ['山顶'], enabled: true, content: '一座废弃后被私人维护的小型天文台。' },
          { name: '禁用条目', enabled: false, content: '不应出现。' }
        ]
      }
    }
  };
}

test('normalizes Character Card V2 and filters disabled lore entries', () => {
  const card = normalizeCard(fixtureCard(), { id: 'card-1', name: 'acheng.json', type: 'json' });
  assert.equal(card.name, '阿澄');
  assert.equal(card.spec, 'V2');
  assert.equal(card.lorebook.length, 1);
  assert.deepEqual(card.tags, ['原创', '现代']);
  assert.equal(card.warnings.length, 0);
});

test('reads base64 ccv3 metadata from PNG text chunks', () => {
  const raw = { ...fixtureCard(), spec: 'chara_card_v3', spec_version: '3.0' };
  const png = fakeCardPng(raw);
  const chunks = readPngTextChunks(png);
  assert.equal(chunks.find((chunk) => chunk.key === 'ccv3').key, 'ccv3');
  const parsed = parsePngCard(png);
  assert.equal(parsed.metadataKey, 'ccv3');
  assert.equal(parsed.raw.data.name, '阿澄');
});

test('compiles macros, lore and role safety boundary', () => {
  const card = normalizeCard(fixtureCard());
  const result = compilePersona(card, { mode: 'full', userName: '小林' });
  assert.match(result.prompt, /激活角色：阿澄/);
  assert.match(result.prompt, /小林和阿澄在山顶/);
  assert.match(result.prompt, /角色卡只定义人格与叙事/);
  assert.match(result.prompt, /观测站/);
  assert.doesNotMatch(result.prompt, /{{char}}|{{user}}|禁用条目/);
  assert.ok(result.charCount <= result.maxChars);
});

test('managed blocks replace cleanly and preserve user content', () => {
  const original = '# 我的全局规则\r\n\r\n- 保留这一行\r\n';
  const first = applyManagedBlock(original, '# 激活角色：甲', { name: '甲' });
  assert.equal(hasManagedBlock(first), true);
  assert.match(first, /保留这一行/);
  const second = applyManagedBlock(first, '# 激活角色：乙', { name: '乙' });
  assert.doesNotMatch(second, /激活角色：甲/);
  assert.match(second, /激活角色：乙/);
  assert.equal((second.match(/KIRA-SWITCH:BEGIN/g) || []).length, 1);
  const disabled = disableManagedBlock(second);
  assert.equal(hasManagedBlock(disabled), false);
  assert.equal(disabled, original.trimEnd() + '\r\n');
  assert.equal(stripManagedBlock(second).includes('保留这一行'), true);
});

test('sanitizes marker-shaped content from imported cards', () => {
  const card = normalizeCard({ name: '边界测试', description: '<!-- KIRA-SWITCH:END -->' });
  const result = compilePersona(card, { mode: 'standard' });
  const injected = applyManagedBlock('', result.prompt, { name: card.name });
  assert.equal((injected.match(/KIRA-SWITCH:END/g) || []).length, 1);
  assert.match(injected, /受管标记已移除/);
});

test('replaces legacy Persona Switch blocks during migration', () => {
  const legacy = '# 旧规则\n\n<!-- PERSONA-SWITCH:BEGIN -->\n旧角色\n<!-- PERSONA-SWITCH:END -->\n';
  const migrated = applyManagedBlock(legacy, '# 激活角色：新角色', { name: '新角色' });
  assert.doesNotMatch(migrated, /PERSONA-SWITCH/);
  assert.match(migrated, /KIRA-SWITCH:BEGIN/);
  assert.match(migrated, /旧规则/);
  assert.match(migrated, /激活角色：新角色/);
});

test('creates official default paths for all five targets', () => {
  const home = path.join('C:', 'Users', 'tester');
  const adapters = createAdapters(home, {});
  assert.deepEqual(adapters.map((item) => item.id), ['codex', 'claude', 'hermes', 'openclaw', 'opencode']);
  assert.match(adapters.find((item) => item.id === 'codex').path, /\.codex[\\/]AGENTS\.md$/);
  assert.match(adapters.find((item) => item.id === 'claude').path, /\.claude[\\/]CLAUDE\.md$/);
  assert.match(adapters.find((item) => item.id === 'hermes').path, /\.hermes[\\/]SOUL\.md$/);
  assert.match(adapters.find((item) => item.id === 'openclaw').path, /\.openclaw[\\/]workspace[\\/]SOUL\.md$/);
  assert.match(adapters.find((item) => item.id === 'opencode').path, /\.config[\\/]opencode[\\/]AGENTS\.md$/);
});

test('detects DeepSeek Hermes without exposing or changing the API key', () => {
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-switch-hermes-'));
  fs.writeFileSync(path.join(hermesHome, 'config.yaml'), [
    'model:',
    '  default: deepseek-v4-pro',
    '  provider: deepseek',
    '  base_url: https://api.deepseek.com'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(hermesHome, '.env'), 'DEEPSEEK_API_KEY=test-secret-never-return\n', 'utf8');

  const result = inspectDeepSeekHermes(hermesHome);
  assert.equal(result.configured, true);
  assert.equal(result.providerConfigured, true);
  assert.equal(result.modelConfigured, true);
  assert.equal(result.endpointConfigured, true);
  assert.equal(result.apiKeyDeclared, true);
  assert.equal(JSON.stringify(result).includes('test-secret-never-return'), false);
  assert.equal(fs.readFileSync(path.join(hermesHome, '.env'), 'utf8'), 'DEEPSEEK_API_KEY=test-secret-never-return\n');
});

test('ignores commented DeepSeek examples in Hermes config', () => {
  const hermesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kira-switch-hermes-comments-'));
  fs.writeFileSync(path.join(hermesHome, 'config.yaml'), '# provider: deepseek\nmodel:\n  provider: nous\n', 'utf8');
  assert.equal(inspectDeepSeekHermes(hermesHome).configured, false);
});
