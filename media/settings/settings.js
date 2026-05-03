const vscode = acquireVsCodeApi();

const KEYS = [
  'plugin.jira.domain',
  'plugin.jira.email',
  'plugin.jira.token',
  'plugin.jira.projectCategoryId',
  'plugin.ai.provider',
  'plugin.ai.modelFamily',
  'plugin.ai.devinOrgSlug',
  'plugin.ai.devinApiKey',
  'plugin.zephyr.ownerId',
  'plugin.zephyr.domain',
  'plugin.zephyr.token'
];

function uid() { return Math.random().toString(36).slice(2); }

function upcase(el) {
  el.addEventListener('change', () => { el.value = (el.value || '').trim().toUpperCase(); });
}

function setStatus(msg, ok = false, err = false) {
  const s = document.getElementById('status');
  s.textContent = msg || '';
  s.className = ok ? 'hint ok' : (err ? 'hint err' : 'hint');
}

function renderHostContext(payload) {
  return payload;
}

const mapList = document.getElementById('mapList');
const mapEmpty = document.getElementById('mapEmptyHint');
const strictChk = document.getElementById('plugin.projectMap.strict');
let currentSettings = {};
let availableModels = [];

function renderEmptyHint() {
  mapEmpty.style.display = mapList.children.length ? 'none' : 'block';
}

function addMapRow(jiraKey = '', zephyrKey = '') {
  const id = uid();
  const row = document.createElement('div');
  row.className = 'map-row';
  row.dataset.id = id;
  row.innerHTML = `
<input class="jiraKey" placeholder="JIRA (ex.: TBTX)" maxlength="20" value="${jiraKey}">
<div class="arrow">→</div>
<input class="zephyrKey" placeholder="ZEPHYR (ex.: SQTC)" maxlength="20" value="${zephyrKey}">
<button class="minus btn-ide btn-ide-ghost" title="Remover" type="button">Remover</button>
 `;
  const j = row.querySelector('.jiraKey');
  const z = row.querySelector('.zephyrKey');
  upcase(j);
  upcase(z);
  row.querySelector('.minus').addEventListener('click', () => {
    row.remove();
    renderEmptyHint();
  });
  mapList.appendChild(row);
  renderEmptyHint();
}

const KEY_RE = /^[A-Z0-9_-]{1,20}$/;

function renderMap(obj) {
  mapList.innerHTML = '';
  if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([jira, val]) => {
      if (!KEY_RE.test(String(jira).toUpperCase())) return;
      if (String(jira).toUpperCase() === 'STRICT') return;
      const zephyr = (typeof val === 'string') ? val : (val && val.zephyrKey) ? val.zephyrKey : '';
      if (!zephyr) return;
      addMapRow(String(jira).toUpperCase(), String(zephyr).toUpperCase());
    });
  }
  renderEmptyHint();
}

function collectMap() {
  const map = {};
  let hasDup = false;
  const seen = new Set();
  Array.from(mapList.querySelectorAll('.map-row')).forEach(row => {
    const jira = (row.querySelector('.jiraKey').value || '').trim().toUpperCase();
    const zep = (row.querySelector('.zephyrKey').value || '').trim().toUpperCase();
    if (!jira || !zep) return;
    if (seen.has(jira)) {
      hasDup = true;
    }
    seen.add(jira);
    map[jira] = zep;
  });
  return { map, hasDup };
}

function fill(values) {
  currentSettings = values || {};
  KEYS.forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = values?.[k] ?? '';
  });
  strictChk.checked = !!values?.['plugin.projectMap.strict'];
  renderMap(values?.['plugin.projectMap'] || {});
  vscode.postMessage({ type: 'detectAiModels' });
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function renderAiOptions() {
  const providerSelect = document.getElementById('plugin.ai.provider');
  const modelSelect = document.getElementById('plugin.ai.modelFamily');
  const savedProvider = currentSettings?.['plugin.ai.provider'] || 'auto';
  const savedModel = currentSettings?.['plugin.ai.modelFamily'] || '';
  const vendors = unique(availableModels.map(m => m.vendor));
  const providerOptions = [
    { value: 'auto', label: 'auto' },
    ...vendors.map(vendor => ({ value: vendor, label: vendor }))
  ];

  providerSelect.innerHTML = '';
  providerOptions.forEach(entry => {
    const opt = document.createElement('option');
    opt.value = entry.value;
    opt.textContent = entry.label;
    providerSelect.appendChild(opt);
  });
  providerSelect.disabled = false;
  modelSelect.disabled = false;
  providerSelect.value = providerOptions.some(o => o.value === savedProvider) ? savedProvider : 'auto';
  renderModelOptions(savedModel);
}

function renderModelOptions(savedModel) {
  const providerSelect = document.getElementById('plugin.ai.provider');
  const modelSelect = document.getElementById('plugin.ai.modelFamily');
  const provider = providerSelect.value;
  const models = provider === 'auto'
    ? availableModels
    : availableModels.filter(m => m.vendor === provider);
  modelSelect.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = provider === 'auto' ? 'Modelo padrao do provider/host' : 'Modelo padrao';
  modelSelect.appendChild(empty);
  const seen = new Set();
  models.forEach(model => {
    const value = model.family || model.id || model.name || '';
    if (!value || seen.has(value)) return;
    seen.add(value);
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = [model.family, model.name || model.id, model.vendor].filter(Boolean).join(' - ');
    modelSelect.appendChild(opt);
  });
  const values = Array.from(modelSelect.options).map(o => o.value);
  modelSelect.value = values.includes(savedModel) ? savedModel : '';
}

vscode.postMessage({ type: 'loadSettings' });

document.getElementById('btnSave').addEventListener('click', () => {
  const settings = {};
  KEYS.forEach(k => {
    const el = document.getElementById(k);
    settings[k] = el ? el.value.trim() : '';
  });
  const { map, hasDup } = collectMap();
  settings['plugin.projectMap'] = map;
  settings['plugin.projectMap.strict'] = !!strictChk.checked;
  if (hasDup) {
    setStatus('Existem chaves Jira duplicadas no mapeamento. Corrija antes de salvar.', false, true);
    return;
  }
  vscode.postMessage({ type: 'saveSettings', settings });
});

document.getElementById('btnReload').addEventListener('click', () => {
  vscode.postMessage({ type: 'loadSettings' });
});

document.getElementById('btnOpenJson').addEventListener('click', () => {
  vscode.postMessage({ type: 'openSettingsJson' });
});

document.getElementById('btnDetectModels').addEventListener('click', () => {
  vscode.postMessage({ type: 'detectAiModels' });
});

document.getElementById('plugin.ai.provider').addEventListener('change', () => {
  renderModelOptions('');
});

document.getElementById('btnAddMap').addEventListener('click', () => {
  addMapRow();
});

document.querySelectorAll('.eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.target;
    const input = document.getElementById(id);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
  });
});

window.addEventListener('message', ev => {
  const msg = ev.data;
  if (msg.type === 'currentSettings') fill(msg.values);
  if (msg.type === 'hostContext') {
    renderHostContext(msg);
  }
  if (msg.type === 'status') {
    setStatus(msg.message || '', !!msg.ok, !!msg.err);
  }
  if (msg.type === 'aiModels') {
    availableModels = Array.isArray(msg.models) ? msg.models : [];
    renderAiOptions();
  }
});
