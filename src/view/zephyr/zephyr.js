const vscode = acquireVsCodeApi();

let nomeRecebido = false;
let testesRecebido = false;
let issueId = "";
let issueKey = "";
let sugestoesIA = [];
let testesZephyrRaw = [];
let pastasPrincipaisCache = [];
let caminhoPasta = null;

/* ===== Fluxo por projeto (refs) ===== */
const projectFlow = {
    root: document.getElementById('projectFlow'),
    select: document.getElementById('projectSelect'),
    structure: document.getElementById('projectStructure'),
    folderTree: document.getElementById('folderTree'),
    btnApply: document.getElementById('btnApplyStructure'),
    loading: document.getElementById('projLoading')
};

// IDs reais dos filtros
const FILTER_IDS = {
    automationStatus: 'fltAutomationStatus',
    status: 'fltStatus',
    testType: 'fltTestType',
    testClass: 'fltTestClass',
    testGroup: 'fltTestGroup',
    clearBtn: 'btnClearFilters',
};

// Nós DOM (JS puro – sem type assertions)
const $filters = {
    automationStatus: document.getElementById(FILTER_IDS.automationStatus),
    status: document.getElementById(FILTER_IDS.status),
    testType: document.getElementById(FILTER_IDS.testType),
    testClass: document.getElementById(FILTER_IDS.testClass),
    testGroup: document.getElementById(FILTER_IDS.testGroup),
    clearBtn: document.getElementById(FILTER_IDS.clearBtn),
};

// Helpers
const NA = 'N/A';

function normalize(v) { return v === NA ? '' : (v || ''); }

function getFiltersFromUI() {
    return {
        automationStatus: normalize($filters.automationStatus && $filters.automationStatus.value),
        status: normalize($filters.status && $filters.status.value),
        testType: normalize($filters.testType && $filters.testType.value),
        testClass: normalize($filters.testClass && $filters.testClass.value),
        testGroup: normalize($filters.testGroup && $filters.testGroup.value),
    };
}

function applyFiltersToUI(filters) {
    if (!filters) return;
    if ($filters.automationStatus) $filters.automationStatus.value = filters.automationStatus || NA;
    if ($filters.status) $filters.status.value = filters.status || NA;
    if ($filters.testType) $filters.testType.value = filters.testType || NA;
    if ($filters.testClass) $filters.testClass.value = filters.testClass || NA;
    if ($filters.testGroup) $filters.testGroup.value = filters.testGroup || NA;
}

function saveFiltersToState() {
    const s = vscode.getState() || {};
    vscode.setState({ ...s, filtros: getFiltersFromUI() });
}

function getFiltersFromState() {
    const s = vscode.getState() || {};
    return s.filtros || {};
}

// Encapsula binding (chame no Boot, depois de montar a UI)
function bindFilterListeners() {
    [$filters.automationStatus, $filters.status, $filters.testType, $filters.testClass, $filters.testGroup]
        .forEach((el) => {
            if (!el) return;
            el.addEventListener('change', () => {
                saveFiltersToState();
                if (_projetoSelecionado && _selectedFolderId) {
                    vscode.postMessage({
                        type: 'carregarTestesDaPasta',
                        projectKey: _projetoSelecionado,
                        folderId: _selectedFolderId,
                        filtros: getFiltersFromState(),
                    });
                }
            });
        });

    if ($filters.clearBtn) {
        $filters.clearBtn.addEventListener('click', () => {
            applyFiltersToUI({});
            saveFiltersToState();
            if (_projetoSelecionado && _selectedFolderId) {
                vscode.postMessage({
                    type: 'carregarTestesDaPasta',
                    projectKey: _projetoSelecionado,
                    folderId: _selectedFolderId,
                    filtros: getFiltersFromState(),
                });
            }
        });
    }
}

function bindButtons() {
  const byId = (id) => document.getElementById(id);

  byId('btnAnalisar')?.addEventListener('click', analisarIA);
  byId('btnAdicionar')?.addEventListener('click', adicionarCenario);
  byId('btnSelecionarTodos')?.addEventListener('click', selecionarTodos);
  byId('btnEnviarIA')?.addEventListener('click', enviarCriacaoCenariosIA);
  byId('btnEnviarAtualizacaoIA')?.addEventListener('click', enviarAtualizacao);
  byId('btnCriarScripts')?.addEventListener('click', enviarCriarScripts);
  byId('selecionarPasta')?.addEventListener('click', selecionarPasta);
  
}

function bindFeatureForm() {
  const form = document.getElementById('formulario');
  if (form) {
    form.addEventListener('submit', handleSubmit); // <-- sem inline, compatível com CSP
  }
}

let _todosProjetos = [];
let _projetoSelecionado = '';
let _selectedFolderId = null;

function show(el) { if (el) el.style.display = 'block'; }
function hide(el) { if (el) el.style.display = 'none'; }

function showProjectFlow() {
    document.getElementById('issueHeader').style.display = 'none';
    document.getElementById('issueTests').style.display = 'none';
    const tb = document.querySelector('.toolbar');
    if (tb) tb.style.display = 'none';
    const form = document.getElementById('formulario');
    if (form) form.style.display = 'none';

    show(projectFlow.root);
    hide(projectFlow.structure);
    projectFlow.btnApply.disabled = true;
}

function showIssueFlow() {
    document.getElementById('issueHeader').style.display = 'block';
    document.getElementById('issueTests').style.display = 'block';
    const tb = document.querySelector('.toolbar');
    if (tb) tb.style.display = 'flex';
    hide(projectFlow.root);
}

function setProjLoading(on, text) {
    if (on) {
        projectFlow.loading.textContent = text || 'Carregando...';
        show(projectFlow.loading);
    } else {
        hide(projectFlow.loading);
    }
}

function mountProjetos(list) {
    _todosProjetos = Array.isArray(list) ? list : [];
    projectFlow.select.innerHTML = '<option value="">Selecione...</option>' +
        _todosProjetos.map(p => '<option value="' + (p.id || p.key) + '">' + (p.name || p.key || '') + (p.key ? ' (' + p.key + ')' : '') + '</option>').join('');

    setAppState({ projetosCache: _todosProjetos });
}


/* ========= Árvore de pastas (sem checkbox) ========= */
function ensureTree(list) {
    // aceita lista já aninhada (com children) ou plana (id, parentId, name)
    if (!Array.isArray(list)) return [];
    if (list.length && list[0] && Array.isArray(list[0].children)) return list;

    const map = {};
    list.forEach(n => { map[n.id] = { id: n.id, name: n.name, parentId: n.parentId ?? null, children: [] }; });
    const roots = [];
    list.forEach(n => {
        const node = map[n.id];
        const parentId = n.parentId ?? null;
        if (parentId == null || !map[parentId]) roots.push(node);
        else map[parentId].children.push(node);
    });
    return roots;
}

function buildTreeHTML(nodes) {
    if (!nodes || !nodes.length) return '<div style="color:#ccc;">Nenhuma pasta encontrada.</div>';
    let html = '';
    const walk = (n) => {
        const hasChildren = n.children && n.children.length;
        if (hasChildren) {
            html += '<details>';
            html += '<summary data-id="' + n.id + '">' + escapeHTML(n.name || '(sem nome)') + '</summary>';
            n.children.forEach(child => walk(child));
            html += '</details>';
        } else {
            html += '<div class="leaf" data-id="' + n.id + '">' + escapeHTML(n.name || '(sem nome)') + '</div>';
        }
    };
    nodes.forEach(walk);
    return html;
}

function escapeHTML(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderFolderTree(list) {
    const tree = ensureTree(list || []);
    projectFlow.folderTree.innerHTML = buildTreeHTML(tree);
    _selectedFolderId = null;
    projectFlow.btnApply.disabled = true;
}

function selectFolderById(id) {
    // persist selected folder id
    setAppState({ selectedFolderId: id });
    _selectedFolderId = id;
    projectFlow.btnApply.disabled = !id;

    // limpa seleção anterior
    projectFlow.folderTree.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    // marca selecionado (summary ou leaf)
    const target = projectFlow.folderTree.querySelector('[data-id="' + id + '"]');
    if (target) target.classList.add('selected');
}

function getSelectedFolderIds() {
    return _selectedFolderId ? [_selectedFolderId] : [];
}

/* ===================== State helpers ====================== */
function getAppState() { return vscode.getState() || {}; }
function setAppState(patch) { const cur = getAppState(); vscode.setState({ ...cur, ...patch }); }

/* -------- Form state -------- */
function saveFormState(patch = {}) {
    const form = {
        featureName: document.getElementById('featureName')?.value ?? '',
        ruleName: document.getElementById('ruleName')?.value ?? '',
        fileBaseName: document.getElementById('fileBaseName')?.value ?? '',
        tribeName: document.getElementById('tribeName')?.value ?? '',
        extraTags: document.getElementById('extraTags')?.value ?? '',
        caminhoPasta: caminhoPasta || null,
        formVisible: document.getElementById('formulario')?.style.display !== 'none'
    };
    setAppState({ form: { ...form, ...patch } });
}

function loadFormState() {
    const { form } = getAppState();
    if (!form) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    setVal('featureName', form.featureName);
    setVal('ruleName', form.ruleName);
    setVal('fileBaseName', form.fileBaseName);
    setVal('tribeName', form.tribeName);
    setVal('extraTags', form.extraTags);
    if (typeof form.caminhoPasta === 'string') {
        caminhoPasta = form.caminhoPasta;
        const span = document.getElementById('pastaSelecionada');
        if (span) span.innerText = caminhoPasta;
    }
    const formEl = document.getElementById('formulario');
    if (formEl) formEl.style.display = form.formVisible ? 'block' : 'none';
}

/* -------- Zephyr Keys state (persistido) -------- */
function getZephyrKeysState() { return getAppState().zephyrKeys || {}; }
function setZephyrKeysState(map) { setAppState({ zephyrKeys: map }); }
function upsertZephyrKey(idx, zephyrKey) {
    const map = { ...getZephyrKeysState(), [idx]: zephyrKey };
    setZephyrKeysState(map);
    applyZephyrKeys();
}

function applyZephyrKeys() {
    const map = getZephyrKeysState();
    Object.keys(map).forEach(i => {
        const el = document.getElementById(`cenarioLabel-${i}`);
      if (el) el.innerHTML = `📝 Cenário (IA): ${map[i]}`;
    });
  }
  
  /* -------- Pastas / Seleções por cenário (persistido) -------- */
  function getFolderSelections() { return getAppState().folderSelections || {}; }
  function setFolderSelections(map) { setAppState({ folderSelections: map }); }
  function saveFolderSelection(idx, level, value) {
    const map = { ...getFolderSelections() };
    const cur = map[idx] || { f1: '', f2: '', f3: '' };
    if (level === 1) { cur.f1 = value; cur.f2 = ''; cur.f3 = ''; }
    if (level === 2) { cur.f2 = value; cur.f3 = ''; }
    if (level === 3) { cur.f3 = value; }
    map[idx] = cur;
    setFolderSelections(map);
  }

  // function applyFolderSelectionsToDOM(idx) {
  //   const selMap = getFolderSelections();
  //   const sel = selMap[idx] || {};
  //   const s1 = document.getElementById(`folder1-${idx}`);
  //   const s2 = document.getElementById(`folder2-${idx}`);
  //   const s3 = document.getElementById(`folder3-${idx}`);
  
  //   if (s1 && s1.options.length <= 1) {
  //     s1.innerHTML = '<option value="">Selecione...</option>';
  //     pastasPrincipaisCache.forEach(p => {
  //       if (p.parentId == null) {
  //         const opt = document.createElement('option');
  //         opt.value = p.key;
  //         opt.textContent = p.name;
  //         s1.appendChild(opt);
  //       }
  //     });
  //   }
  //   if (s1 && s1.value !== String(sel.f1)) s1.value = (sel.f1 ?? '');
  
  //   if (s2) {
  //     s2.innerHTML = '<option value="">Selecione...</option>';
  //     if (sel.f1) {
  //       pastasPrincipaisCache.forEach(p => {
  //         if (p.parentId == Number(sel.f1)) {
  //           const opt = document.createElement('option');
  //           opt.value = p.key;
  //           opt.textContent = p.name;
  //           s2.appendChild(opt);
  //         }
  //       });
  //       s2.style.display = 'inline-block';
  //       if (sel.f2 != null && sel.f2 !== '') s2.value = String(sel.f2);
  //     } else {
  //       s2.style.display = 'none';
  //     }
  //   }
  
  //   if (s3) {
  //     s3.innerHTML = '<option value="">Selecione...</option>';
  //     if (sel.f2) {
  //       pastasPrincipaisCache.forEach(p => {
  //         if (p.parentId == Number(sel.f2)) {
  //           const opt = document.createElement('option');
  //           opt.value = p.key;
  //           opt.textContent = p.name;
  //           s3.appendChild(opt);
  //         }
  //       });
  //       s3.style.display = 'inline-block';
  //       if (sel.f3 != null && sel.f3 !== '') s3.value = String(sel.f3);
  //     } else {
  //       s3.style.display = 'none';
  //     }
  //   }
  // }

  function applyFolderSelectionsToDOM(idx) {
  const s1 = document.getElementById(`folder1-${idx}`);
  const s2 = document.getElementById(`folder2-${idx}`);
  const s3 = document.getElementById(`folder3-${idx}`);
  if (!s1 || !s2 || !s3) return;

  // limpa e recomeça
  s1.innerHTML = `<option value="">Selecione...</option>`;
  s2.innerHTML = `<option value="">Selecione...</option>`;
  s3.innerHTML = `<option value="">Selecione...</option>`;
  s2.style.display = 'none';
  s3.style.display = 'none';

  // ROOT (Produto) — use ID!
  (pastasPrincipaisCache || []).forEach(p => {
    if (!p.parentId) {
      const opt = document.createElement('option');
      opt.value = String(p.id);             // <<<<<<<<<<<<<< AQUI
      opt.textContent = p.name || '';
      s1.appendChild(opt);
    }
  });

  // Se já havia seleção salva, reconstituir (opcional)
  const sel = getFolderSelection(idx) || {}; // { f1, f2, f3 } salvos no state
  if (sel.f1) {
    s1.value = String(sel.f1);
    // filhos de f1 para o Sub-Produto
    (pastasPrincipaisCache || []).forEach(p => {
      if (p.parentId == Number(sel.f1)) {
        const opt = document.createElement('option');
        opt.value = String(p.id);           // <<<<<<<<<<<<<< AQUI
        opt.textContent = p.name || '';
        s2.appendChild(opt);
      }
    });
    if (s2.options.length > 1) s2.style.display = 'inline-block';
  }
  if (sel.f2) {
    s2.value = String(sel.f2);
    // filhos de f2 para a Funcionalidade
    (pastasPrincipaisCache || []).forEach(p => {
      if (p.parentId == Number(sel.f2)) {
        const opt = document.createElement('option');
        opt.value = String(p.id);           // <<<<<<<<<<<<<< AQUI
        opt.textContent = p.name || '';
        s3.appendChild(opt);
      }
    });
    if (s3.options.length > 1) s3.style.display = 'inline-block';
  }
  if (sel.f3) {
    s3.value = String(sel.f3);
  }
}


  function rehydrateAllFolderSelections() {
    const selMap = getFolderSelections();
    Object.keys(selMap).forEach(i => applyFolderSelectionsToDOM(Number(i)));
  }
  
  /* ===================== Util Gherkin ====================== */
  function extrairGherkin(texto) {
    if (!texto || typeof texto !== "string") return "";
    const regex = /\\`\\`\\`gherkin\\s*([\\s\\S]*?)\\`\\`\\`/i;
    const match = texto.match(regex);
    let conteudo = match ? match[1] : texto;
    const linhas = conteudo.split('\\n').map(l => l.replace(/^\\s+/, '')).filter(l => l.trim() !== '');
    return linhas.join('\\n');
  }

  function extrairScenarioGherkin(texto) {
    if (!texto || typeof texto !== "string") return "";
    const regex = /\\`\\`\\`gherkin\\s*([\\s\\S]*?Scenario)\\`\\`\\`/i;
    const match = texto.match(regex);
    let conteudo = match ? match[1] : texto;
    const linhas = conteudo.split('\\n').map(l => l.replace(/^\\s+/, '')).filter(l => l.trim() !== '');
    return linhas.join('\\n');
  }

  function extrairTitulosDosCenarios(texto) {
    if (typeof texto !== 'string' || !texto.trim()) return '';

    // normaliza quebras para \n
    const t = texto.replace(/\r\n?/g, '\n');

    // pega a linha que começa com Scenario/Scenario Outline/Cenário/Esquema do Cenário
    const m = t.match(
      /^(?:\s*)(?:Scenario(?:\s+Outline)?|Cenário(?:\s+Esquema)?|Esquema do Cenário)\s*:?\s*(.+)\s*$/mi
    );

    return m ? m[1].trim() : '';
  }
  
  /* ===== Remover KEY-1234: do título do cenário ===== */
  function sanitizeScenarioTitle(gherkin, keyHint) {
    if (!gherkin) return '';
    let lines = gherkin.split('\\n');
    const keyPattern = keyHint
      ? new RegExp('(Scenario\\s*:.*?)(?:\\s*' + keyHint.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\$&') + '\\s*:\\s*)', 'i')
      : /(\\bScenario\\s*:.*?)(?:\\s*[A-Z]+-\\d+\\s*:\\s*)/i;
    
    lines = lines.map((ln) => {
      if (/^\\s*Scenario\\s*:/i.test(ln)) {
        return ln.replace(keyPattern, '$1');
      }
      return ln;
    });
    return lines.join('\\n');
  }
  
  /* ===== Garante que haverá "Scenario: <nome>" (insere ou substitui) ===== */
  function ensureScenarioTitle(gherkin, scenarioName) {
    const clean = (gherkin || '').trim();
    const name = (scenarioName || '').trim();
    if (!clean && !name) return '';
    if (!name) return clean;
  
    const hasScenario = /^\\s*Scenario\\s*:/im.test(clean);
    if (!hasScenario) {
      return 'Scenario: ' + name + '\\n' + clean;
    }
    return clean.replace(/^\\s*Scenario\\s*:\\s*.*$/im, 'Scenario: ' + name);
  }
  
  /* ===================== Fluxo UI ====================== */
  function mostrarLoading() {
    document.getElementById('loading').style.display = 'block';
    document.querySelector('.container').style.display = 'none';
  }

  function esconderLoading() {
    document.getElementById('loading').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
  }

  function tentarExibirConteudo() {
    if (nomeRecebido && testesRecebido) esconderLoading();
  }
  
  function analisarIA() {
    document.getElementById('iaLoading').style.display = 'block';
    vscode.postMessage({ type: 'analisarIA', testes: testesZephyrRaw });
  }
  
  function selecionarTodos() {
    document.querySelectorAll('.checkbox-ia').forEach(c => c.checked = true);
    salvarEstado();
  }
  
  function adicionarCenario() {
    const idx = sugestoesIA.length;
    sugestoesIA.push({ key: "Manual_" + idx, suggestion: "" });
    renderizarSugestao(idx, "", "", "", "", true);
    salvarEstado();
  }
  
  function excluirCenario(idx) {
    sugestoesIA.splice(idx, 1);
    document.getElementById('sugestao-' + idx)?.remove();
    salvarEstado();
  }
  
  function enviarCriarScripts() {
    const form = document.getElementById('formulario');
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    saveFormState({ formVisible: true });
  }
  
  function selecionarPasta() { vscode.postMessage({ type: 'selecionarPastaDestino' }); }
  
  /* ========= AJUSTE CRÍTICO AQUI ========= */
  function enviarCriacaoCenariosIA() {
    const selecionados = [];
    document.querySelectorAll('.checkbox-ia:checked').forEach((cb) => {
      const idx = Number(cb.dataset.idx ?? (cb.id || '').replace('checkbox-',''));
      if (Number.isNaN(idx)) return;
    
      const automationStatusEl = document.getElementById('automationStatus-' + idx);
      const testClassEl      = document.getElementById('testClass-' + idx);
      const testTypeEl       = document.getElementById('testType-' + idx);
      const testGroupEl      = document.getElementById('testGroup-' + idx);
      const textareaEl       = document.getElementById('textarea-' + idx);
    
      const automationStatus = automationStatusEl?.textContent?.trim().replace(/\\s+/g, ' ') || '';
      const testClass        = testClassEl?.textContent?.trim().replace(/\\s+/g, ' ') || '';
      const testType         = testTypeEl?.textContent?.trim().replace(/\\s+/g, ' ') || '';
      const testGroup        = testGroupEl?.textContent?.trim().replace(/\\s+/g, ' ') || '';
      const raw              = textareaEl?.value || '';
    
      let folderId = 0;
      const erroDiv = document.getElementById(`erro-folder-${idx}`);
      const f3 = document.getElementById(`folder3-${idx}`);
      const f2 = document.getElementById(`folder2-${idx}`);
      const f1 = document.getElementById(`folder1-${idx}`);

      if (f3 && f3.value) folderId = Number(f3.value);
      else if (f2 && f2.value) folderId = Number(f2.value);
      else if (f1 && f1.value) folderId = Number(f1.value);
      else {
        if (erroDiv) {
          erroDiv.innerText = '⚠️ Você precisa selecionar ao menos uma pasta.';
          erroDiv.style.display = 'block';
        }
        return;
      }

      if (erroDiv) erroDiv.style.display = 'none';
    
      const map = getZephyrKeysState();
      const zephKeyFromMap = map[idx];
      const key = zephKeyFromMap || sugestoesIA[idx]?.key || 'Sem key';
    
      const textoSanit = sanitizeScenarioTitle(raw, key);
    
      selecionados.push({
        key,
        texto: textoSanit,
        issueId,
        issueKey,
        automationStatus, testClass, testType, testGroup, folderId
      });
    });
    
    vscode.postMessage({ type: 'enviarParaZephyr', payload: selecionados });
  }
  
  function enviarAtualizacao() {
    const selecionados = [];
    document.querySelectorAll('.checkbox-ia:checked').forEach((cb) => {
      const idx = Number(cb.dataset.idx ?? (cb.id || '').replace('checkbox-',''));
      if (Number.isNaN(idx)) return;
      const key = cb.dataset.key || 'Sem key';
      const raw = document.getElementById('textarea-' + idx)?.value || '';
      const textoSanit = sanitizeScenarioTitle(raw, key);
      selecionados.push({ key, texto: textoSanit, issueId, issueKey });
    });
    vscode.postMessage({ type: 'enviarAtualizacaoParaZephyr', payload: selecionados });
  }
  
  function handleSubmit(event) {
    event.preventDefault();
    saveFormState();
    
    const featureName = document.getElementById('featureName').value.trim();
    const ruleName = document.getElementById('ruleName').value.trim();
    const fileBaseName = (document.getElementById('fileBaseName').value || issueKey || 'scenarios').trim();
    const tribeName = document.getElementById('tribeName').value.trim();
    const extraTags = document.getElementById('extraTags').value.trim();
    
    if (!caminhoPasta) { window.alert('Selecione uma pasta de destino.'); return; }
    
    const itens = [];
    document.querySelectorAll('.checkbox-ia:checked').forEach((cb) => {
      const idx = Number(cb.dataset.idx ?? (cb.id || '').replace('checkbox-',''));
      if (Number.isNaN(idx)) return;
      const map = getZephyrKeysState();
      const preferredKey = map[idx] || cb.dataset.key || (sugestoesIA && sugestoesIA[idx] && sugestoesIA[idx].key) || `cenario-${idx + 1}`;
      const raw = document.getElementById(`textarea-${idx}`)?.value || '';
      const gherkin = extrairGherkin(raw) || raw;
      const gherkinSanit = sanitizeScenarioTitle(gherkin, preferredKey);
      if (gherkinSanit.trim()) itens.push({ key: preferredKey, gherkin: gherkinSanit, issueId, issueKey });
    });
    
    if (itens.length === 0 && Array.isArray(testesZephyrRaw) && testesZephyrRaw.length > 0) {
      testesZephyrRaw.forEach((t, zIdx) => {
        const key = t?.key || `cenario-${zIdx + 1}`;
        const zephyrName = (t?.details?.name || '').trim();
        const gRaw = extrairGherkin(t?.script || '');
        const gSan = sanitizeScenarioTitle(gRaw, key);
        const finalText = ensureScenarioTitle(gSan, zephyrName);
        if ((finalText || '').trim()) itens.push({ key, gherkin: finalText, issueId, issueKey });
      });
    }
    
    if (itens.length === 0) { window.alert('Marque ao menos um cenário para exportar.'); return; }
    
    vscode.postMessage({
      type: 'criarScriptsEmPasta',
      dados: {
        caminho: caminhoPasta,
        featureName, ruleName, fileBaseName, tribeName, extraTags,
        itens,
      },
    });
  }
  
  /* ===================== Render ====================== */
  function renderDados(i) {
    const container = document.querySelector('.container');
    const header = document.getElementById('issueHeader');
    const tests = document.getElementById('issueTests');
    
    testesZephyrRaw = i.testesZephyr || [];
    
    if (!i) {
      header.innerHTML = "<p>❌ Issue não encontrada.</p>";
      tests.innerHTML = '';
    } else {
      header.innerHTML = `<p><strong>🧪 Testes vinculados (Zephyr):</strong></p>`;
      tests.innerHTML = `
        ${i.testesZephyr.map((t, idx) => `
        <div style="border: 1px solid #444; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem; background-color: #2a2a2a;">
          <h3 style="color: #4fc3f7; margin-bottom: 0.5rem;">
            🔹 ${t.key} (v${t.version}) - ${t.details.name}
          </h3>
          <div style="background-color: #3c3c3c; padding: 0.8rem; border-radius: 6px; margin-bottom: 1rem;">
            <p><strong>🤖 Automation Status: </strong> ${t.details.customFields?.['Automation Status'] || 'N/A'}</p>
            <p><strong>🏷️ Test Class: </strong> ${t.details.customFields?.['Test Class'] || 'N/A'}</p>
            <p><strong>📦 Test Type: </strong> ${t.details.customFields?.['Test Type'] || 'N/A'}</p>
            <p><strong>🧪 Test Group: </strong> ${t.details.customFields?.['Test Group'] || 'N/A'}</p>
          </div>
          <pre style="background-color: #1e1e1e; padding: 1rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; color: #ccc;">${t.script}</pre>
  
          <div id="ia-container-${idx}" style="display:none;">
            <div class="sugestao">
              <h3><span id="cenarioLabel-${idx}"></span></h3>
              <textarea id="textarea-${idx}" oninput="salvarEstado()">Carregando sugestão da IA...</textarea>
            </div>
            <div class="checkbox-container">
              <input
                type="checkbox"
                class="checkbox-ia"
                id="checkbox-${idx}"
                data-idx="${idx}"
                data-key="${t.key}"
                onchange="salvarEstado()"
              />
              <label for="checkbox-${idx}">Aceitar sugestão para este cenário</label>
            </div>
          </div>
        </div>`).join('')}
      `;
      sugestoesIA = i.testesZephyr.map((t, idx) => ({ key: t.key, suggestion: `Sugestão da IA para ${t.key}...` }));
    }
    container.style.display = 'block';
    loadFormState();
    applyZephyrKeys();
    rehydrateAllFolderSelections();
    
    if (testesZephyrRaw && testesZephyrRaw.length > 0) {
      const btn = document.getElementById('btnCriarScripts');
      if (btn) btn.style.display = 'inline-block';
    }
  }
  
  function renderizarSugestao(idx, conteudo, testType, testClass, testGroup, manual = false) {
    const container = document.getElementById('issueTests');
    const div = document.createElement('div');
    div.className = 'sugestao';
    div.id = 'sugestao-' + idx;
    div.style ='border: 1px solid #444; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem; background-color: #2a2a2a';
    div.innerHTML = `
      <h3 style="color: #4fc3f7; margin-bottom: 0.5rem;">
        <span id="cenarioLabel-${idx}">📝 Cenário ${manual ? '(Manual)' : '(IA)'}:</span> ${extrairTitulosDosCenarios(conteudo)}
      </h3>
      <div style="background-color: #3c3c3c; padding: 0.8rem; border-radius: 6px; margin-bottom: 1rem;">
        <p><strong>🤖 Automation Status: </strong><span id="automationStatus-${idx}">Not Automated</span></p>
        <p><strong>🏷️ Test Class: </strong><span id="testClass-${idx}">${testClass}</span></p>
        <p><strong>📦 Test Type: </strong><span id="testType-${idx}">${testType}</span></p>
        <p><strong>🧪 Test Group: </strong><span id="testGroup-${idx}">${testGroup}</span></p>
        <label>📁 Produto:</label>
        <select id="folder1-${idx}" onchange="onFolderChange(${idx}, 1)"><option value="">Selecione...</option></select>
        <label>📁 Sub-Produto:</label>
        <select id="folder2-${idx}" onchange="onFolderChange(${idx}, 2)" style="display:none;"></select>
        <label>📁 Funcionalidade:</label>
        <select id="folder3-${idx}" onchange="onFolderChange(${idx}, 3)" style="display:none;"></select>
      </div>
      <textarea id="textarea-${idx}" oninput="salvarEstado()">${conteudo}</textarea>
      <div class="checkbox-container">
        <input type="checkbox" class="checkbox-ia" id="checkbox-${idx}" data-idx="${idx}" onchange="salvarEstado()" />
        <label for="checkbox-${idx}">Aceitar este cenário</label>
      </div>
      <div id="erro-folder-${idx}" style="display: none; color: red; font-weight: bold; margin-top: 10px;"></div>
      <hr style="margin: 1rem 0; border: 0; border-top: 1px solid #444;" />
      <button class="btn-excluir" onclick="excluirCenario(${idx})">🗑️ Excluir</button>
    `;
    container.appendChild(div);
    applyFolderSelectionsToDOM(idx);
    loadFormState();
    applyZephyrKeys();
  }
  
  /* ======= Handlers dos selects (salvam estado e populam cascata) ======= */
  // function onFolderChange(idx, level) {
  //   const s1 = document.getElementById(`folder1-${idx}`);
  //   const s2 = document.getElementById(`folder2-${idx}`);
  //   const s3 = document.getElementById(`folder3-${idx}`);
    
  //   if (level === 1 && s1) {
  //     const v1 = s1.value || '';
  //     saveFolderSelection(idx, 1, v1);
  //     if (s2) {
  //       s2.innerHTML = '<option value="">Selecione...</option>';
  //       if (v1) {
  //         pastasPrincipaisCache.forEach(p => {
  //           if (p.parentId == Number(v1)) {
  //             const opt = document.createElement('option');
  //             opt.value = p.key;
  //             opt.textContent = p.name;
  //             s2.appendChild(opt);
  //           }
  //         });
  //         s2.style.display = 'inline-block';
  //       } else {
  //         s2.style.display = 'none';
  //       }
  //     }
  //     if (s3) { s3.innerHTML = '<option value="">Selecione...</option>'; s3.style.display = 'none'; }
  //   }
    
  //   if (level === 2 && s2) {
  //     const v2 = s2.value || '';
  //     saveFolderSelection(idx, 2, v2);
  //     if (s3) {
  //       s3.innerHTML = '<option value="">Selecione...</option>';
  //       if (v2) {
  //         pastasPrincipaisCache.forEach(p => {
  //           if (p.parentId == Number(v2)) {
  //             const opt = document.createElement('option');
  //             opt.value = p.key;
  //             opt.textContent = p.name;
  //             s3.appendChild(opt);
  //           }
  //         });
  //         s3.style.display = 'inline-block';
  //       } else {
  //         s3.style.display = 'none';
  //       }
  //     }
  //   }
    
  //   if (level === 3 && s3) {
  //     const v3 = s3.value || '';
  //     saveFolderSelection(idx, 3, v3);
  //   }
  // }

  function onFolderChange(idx, level) {
  const s1 = document.getElementById(`folder1-${idx}`);
  const s2 = document.getElementById(`folder2-${idx}`);
  const s3 = document.getElementById(`folder3-${idx}`);
  if (!s1 || !s2 || !s3) return;

  if (level === 1) {
    // escolheu Produto → preenche Sub-Produto por parentId == ID do produto
    const v1 = s1.value;
    s2.innerHTML = `<option value="">Selecione...</option>`;
    s3.innerHTML = `<option value="">Selecione...</option>`;
    s2.style.display = 'none';
    s3.style.display = 'none';

    (pastasPrincipaisCache || []).forEach(p => {
      if (p.parentId == Number(v1)) {
        const opt = document.createElement('option');
        opt.value = String(p.id);           // <<<<<<<<<<<<<< AQUI
        opt.textContent = p.name || '';
        s2.appendChild(opt);
      }
    });
    if (s2.options.length > 1) s2.style.display = 'inline-block';

    saveFolderSelection(idx, { f1: Number(v1), f2: null, f3: null });
  }

  if (level === 2) {
    // escolheu Sub-Produto → preenche Funcionalidade por parentId == ID do subproduto
    const v2 = s2.value;
    s3.innerHTML = `<option value="">Selecione...</option>`;
    s3.style.display = 'none';

    (pastasPrincipaisCache || []).forEach(p => {
      if (p.parentId == Number(v2)) {
        const opt = document.createElement('option');
        opt.value = String(p.id);           // <<<<<<<<<<<<<< AQUI
        opt.textContent = p.name || '';
        s3.appendChild(opt);
      }
    });
    if (s3.options.length > 1) s3.style.display = 'inline-block';

    saveFolderSelection(idx, { f1: Number(s1.value || 0), f2: Number(v2), f3: null });
  }

  if (level === 3) {
    saveFolderSelection(idx, { f1: Number(s1.value || 0), f2: Number(s2.value || 0), f3: Number(s3.value || 0) });
  }

  // resolve folderId final (o mais específico que tiver)
  let folderId = 0;
  if (s3.value) folderId = Number(s3.value);
  else if (s2.value) folderId = Number(s2.value);
  else if (s1.value) folderId = Number(s1.value);

  setFolderIdForIdx(idx, folderId); // sua função que guarda no state por sugestão
}

  
  /* ===================== Estado de sugestões / checkboxes ====================== */
  function mostrarSugestoesIA() {
    if (!Array.isArray(sugestoesIA) || sugestoesIA.length === 0) return;
    const state = vscode.getState();
    
    if (!testesZephyrRaw || testesZephyrRaw.length === 0) {
      document.getElementById('btnSelecionarTodos').style.display = 'inline-block';
      document.getElementById('btnEnviarIA').style.display = 'inline-block';
      document.getElementById('btnAdicionar').style.display = 'inline-block';
      document.getElementById('btnCriarScripts').style.display = 'inline-block';
      
      sugestoesIA.forEach((item, idx) => {
        renderizarSugestao(
          idx,
          state?.textarea?.[idx] || extrairScenarioGherkin(item.sugestao),
          item.testType, item.testClass, item.testGroup
        );
        document.getElementById('checkbox-' + idx).checked = state?.checkbox?.[idx] || false;
      });
    } else {
      sugestoesIA.forEach((item, idx) => {
        const el = document.getElementById('ia-container-' + idx);
        const textarea = document.getElementById('textarea-' + idx);
        const checkbox = document.getElementById('checkbox-' + idx);
        if (el) el.style.display = 'block';
        if (textarea) textarea.value = state?.textarea?.[idx] || extrairGherkin(item.sugestao || item.suggestion);
        if (checkbox) checkbox.checked = state?.checkbox?.[idx] || false;
      });
      document.getElementById('btnSelecionarTodos').style.display = 'inline-block';
      document.getElementById('btnEnviarAtualizacaoIA').style.display = 'inline-block';
      document.getElementById('btnCriarScripts').style.display = 'inline-block';
    }
    
    applyZephyrKeys();
    rehydrateAllFolderSelections();
  }
  
  function salvarEstado() {
    const textarea = {};
    const checkbox = {};
    sugestoesIA.forEach((_, idx) => {
      textarea[idx] = document.getElementById('textarea-' + idx)?.value || '';
      checkbox[idx] = document.getElementById('checkbox-' + idx)?.checked || false;
    });
    const stateAtual = vscode.getState();
    vscode.setState({ ...stateAtual, textarea, checkbox });
  }
  
  /* ===================== Boot ====================== */
  const state = vscode.getState() || {};

  // Reidrata dados gerais (se existirem)
  if (state?.nome) {
    const el = document.getElementById('ola');
    if (el) el.textContent = '👋 Olá ' + state.nome;
    nomeRecebido = true;
  }
  if (state?.pastasPrincipaisCache) pastasPrincipaisCache = state.pastasPrincipaisCache;
  if (state?.zephyrData) { renderDados(state.zephyrData); testesRecebido = true; }
  if (state?.sugestoesIA) { sugestoesIA = state.sugestoesIA; mostrarSugestoesIA(); }

  // Ids da issue (podem não existir)
  issueId  = state?.issueId  || '';
  issueKey = state?.issueKey || '';
  const hasIssue = Boolean(issueId || issueKey);
  
  // Restaura lista de projetos (cache)
  if (Array.isArray(state.projetosCache) && state.projetosCache.length) {
    // popula o <select> com os projetos em cache
    mountProjetos(state.projetosCache);
    try { esconderLoading(); } catch(e) {}
  }

  // Restaura seleção do fluxo por Projeto (se existir)
  if (state?.projetoSelecionado && projectFlow.select) {
    _projetoSelecionado = state.projetoSelecionado;
    projectFlow.select.value = _projetoSelecionado;
    try { esconderLoading(); } catch(e) {}
  }

  if (Array.isArray(pastasPrincipaisCache) && pastasPrincipaisCache.length) {
    renderFolderTree(pastasPrincipaisCache);
    if (state?.selectedFolderId) selectFolderById(state.selectedFolderId);
    try { esconderLoading(); } catch(e) {}
  }

  // --- Decisão de UI na entrada ---
  if (hasIssue) {
    
    // Modo "por issue"
    tentarExibirConteudo();

  } else {

    // Modo "por projeto/pasta"
    showProjectFlow();

    const precisaProjetos = !Array.isArray(_todosProjetos) || _todosProjetos.length === 0;
    const temCachePastas  = Array.isArray(pastasPrincipaisCache) && pastasPrincipaisCache.length > 0;

    // Só liga loading se vamos realmente buscar algo
    if (precisaProjetos || (_projetoSelecionado && !temCachePastas)) {
      setProjLoading(true, 'Carregando dados do projeto...');
    }

    // Busca projetos se necessário
    if (precisaProjetos) {
      vscode.postMessage({ type: 'carregarProjetos' });
    }

    // Se já tem projeto selecionado mas não tem pastas, busca estrutura
    if (_projetoSelecionado && !temCachePastas) {
      vscode.postMessage({ type: 'carregarEstruturaProjeto', projetoIdOuKey: _projetoSelecionado });
    }

    // Se já tem cache de pastas, mostra estrutura e desliga o loading
    if (temCachePastas) {
      renderFolderTree(pastasPrincipaisCache);
      show(projectFlow.structure);
      setProjLoading(false);
    }

    if (state.filtros) applyFiltersToUI(state.filtros);
    bindFilterListeners();

  }

  // ❌ Remova/Comente a linha abaixo se existir, pois não há handler no painel
  // vscode.postMessage({ type: 'carregarNome' });

  
  /* ===================== Mensagens do host ====================== */
  window.addEventListener('message', event => {
    const message = event.data;
    
    if (message.type === 'nomeUsuario') {
      document.getElementById('ola').textContent = '👋 Olá ' + message.nome;
      nomeRecebido = true;
      vscode.setState({ ...vscode.getState(), nome: message.nome });
      tentarExibirConteudo();
    }
    
    if (message.type === 'zephyrData') {
      esconderLoading();
      renderDados(message.zephyrData);
      testesRecebido = true;
      issueId = message.issueId;
      issueKey = message.issueKey;
      
      if (!pastasPrincipaisCache || pastasPrincipaisCache.length === 0) {
        vscode.postMessage({ type: 'carregarPastaPrincipal', issueKey });
      }
      vscode.setState({ ...vscode.getState(), zephyrData: message.zephyrData, issueId, issueKey });

      if (!issueKey) {
        showProjectFlow();
        setProjLoading(true, 'Carregando projetos...');
        vscode.postMessage({ type: 'listarProjetosJira' });
      } else {
        showIssueFlow();
      }
    }

    /* ======= Projetos e estrutura ======= */
    if (message.type === 'projetosJira') {
      setProjLoading(false);
      mountProjetos(message.projects || []);
      showProjectFlow();
      try { esconderLoading(); } catch(e) {}
    
  setAppState({ projetosCache: _todosProjetos });
}

    if (message.type === 'estruturaProjeto') {
      setProjLoading(false);
      renderFolderTree(message.folders || []);
  setAppState({ pastasPrincipaisCache: Array.isArray(message.folders) ? message.folders : [] });

      show(projectFlow.structure);
    }
    if (message.type === 'aplicarFiltrosProjeto:ok') {
      setProjLoading(false);
      if (message.zephyrDataProjeto) {
        renderDados(message.zephyrDataProjeto);
        showIssueFlow();
      }
    }
    if (message.type === 'zephyrDataProjeto') {
      // alternativa: host pode enviar direto os testes aqui
      renderDados(message.zephyrDataProjeto);
      showIssueFlow();
    }
    
    if (message.type === 'sugestoesIA') {
      sugestoesIA = message.sugestoes;
      document.getElementById('iaLoading').style.display = 'none';
      mostrarSugestoesIA();
      const stateAtual = vscode.getState();
      vscode.setState({ ...stateAtual, sugestoesIA: message.sugestoes });
    }
    
    if (message.type === 'listaPasta') {
      pastasPrincipaisCache = message.pastasPrincipais;
      setAppState({ pastasPrincipaisCache });
      rehydrateAllFolderSelections();
    }
    
    if (message.type === 'atualizarCenariosComZephyrKey') {
      const resultados = Array.isArray(message.payload) ? message.payload : [];
      const selecionadosIdx = Array.from(document.querySelectorAll('.checkbox-ia'))
        .filter(cb => cb && cb.checked)
        .map(cb => Number(cb.dataset.idx ?? (cb.id || '').replace('checkbox-', '')))
        .filter(n => !Number.isNaN(n));
      resultados.forEach(({ zephyrKey }, i) => {
        const targetIdx = selecionadosIdx[i];
        if (typeof targetIdx === 'number' && zephyrKey) {
          upsertZephyrKey(targetIdx, zephyrKey);
          if (sugestoesIA[targetIdx]) {
            sugestoesIA[targetIdx].key = zephyrKey;
          }
        }
    
    if (message.type === 'zephyr:filtersOptions') {
      const setOptions = (id, list) => {
        const sel = document.getElementById(id);
        if (!sel || !Array.isArray(list)) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">Qualquer</option>' + list.map(v => '<option value="'+String(v)+'">'+String(v)+'</option>').join('');
        if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
      };
      const o = message.options || {};
      setOptions('fltAutomationStatus', o.automationStatus);
      setOptions('fltStatus',           o.status);
      setOptions('fltCoverage',         o.coverage);
      setOptions('fltTestType',         o.testType);
      setOptions('fltTestClass',        o.testClass);
      setOptions('fltTestGroup',        o.testGroup);
    }
  });
      const st = vscode.getState();
      vscode.setState({ ...st, sugestoesIA });
    }
    
    if (message.type === 'novoId') {
      mostrarLoading();
      nomeRecebido = false;
      testesRecebido = false;
      document.getElementById('issueHeader').innerHTML = '';
      document.getElementById('issueTests').innerHTML = '';
      document.getElementById('btnAdicionar').style.display = 'none';
      document.getElementById('btnSelecionarTodos').style.display = 'none';
      document.getElementById('btnEnviarIA').style.display = 'none';
      vscode.setState({ ...vscode.getState(), zephyrData: null });
      vscode.postMessage({ type: 'carregarNome' });
    }
    
    if (message.type === 'pastaSelecionada') {
      caminhoPasta = message.caminho;
      document.getElementById('pastaSelecionada').innerText = caminhoPasta;
      saveFormState({ caminhoPasta });
    }
  });
  
  /* ===== Eventos do fluxo por Projeto ===== */
  if (projectFlow.select) projectFlow.select.addEventListener('change', () => {
    // persist selected project
    setAppState({ projetoSelecionado: projectFlow.select.value || '' });
    const val = projectFlow.select.value || '';
    _projetoSelecionado = val;
    _selectedFolderId = null;
    projectFlow.btnApply.disabled = true;
    if (!val) { hide(projectFlow.structure); return; }
    setProjLoading(true, 'Carregando estrutura...');
    hide(projectFlow.structure);
    vscode.postMessage({ type: 'carregarEstruturaProjeto', projetoIdOuKey: _projetoSelecionado });
  });

  // Seleção por clique (summary ou leaf)
  if (projectFlow.folderTree) projectFlow.folderTree.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Element)) return;
    const clickable = target.closest('summary[data-id], .leaf[data-id]');
    if (!clickable) return;
    const id = clickable.getAttribute('data-id');
    if (!id) return;
    selectFolderById(id);
    // O <details> lida com expandir/retrair automaticamente ao clicar no summary
  });

  if (projectFlow.btnApply) projectFlow.btnApply.addEventListener('click', () => {
    if (!_projetoSelecionado || !_selectedFolderId) return;
    setProjLoading(true, 'Aplicando seleção...');
    vscode.postMessage({
      type: 'aplicarFiltrosProjeto',
      projetoIdOuKey: _projetoSelecionado,
      pastaIds: getSelectedFolderIds(), // [id]
      filtroIds: [],                    // sem filtros (compat)
      filtros: getSelectedFilters()
    });
  });

  /* Eventos de input do formulário -> salvam estado sempre */
  ['featureName','ruleName','fileBaseName','tribeName','extraTags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => saveFormState());
  });
  
  /* Restaura valores salvos quando a view abre */
  loadFormState();
  applyZephyrKeys();
  rehydrateAllFolderSelections();
  

// === Add "Expandir/Recolher tudo" buttons (robust, no logic changes) ===
(function () {
  function setAllDetails(open) {
    document.querySelectorAll(".folder-tree details").forEach(d => d.open = open);
  }
  function makeBtn(text, id) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.className = "btn";
    b.textContent = text;
    return b;
  }
  function addButtonsTo(bar) {
    if (!bar) return;
    if (!bar.querySelector("#btnExpandirTudo")) {
      const btnExpand = makeBtn("Expandir tudo", "btnExpandirTudo");
      btnExpand.addEventListener("click", () => setAllDetails(true));
      bar.prepend(btnExpand);
    }
    if (!bar.querySelector("#btnRecolherTudo")) {
      const btnCollapse = makeBtn("Recolher tudo", "btnRecolherTudo");
      btnCollapse.addEventListener("click", () => setAllDetails(false));
      bar.prepend(btnCollapse);
    }
  }
  function ensureButtons() {
    // Preferir .actions-row existente
    let bar = document.querySelector(".actions-row");
    if (!bar) {
      // Criar uma .actions-row logo após a árvore, se não existir
      const tree = document.querySelector(".folder-tree");
      if (tree && tree.parentElement) {
        bar = document.createElement("div");
        bar.className = "actions-row";
        if (tree.nextSibling) {
          tree.parentElement.insertBefore(bar, tree.nextSibling);
        } else {
          tree.parentElement.appendChild(bar);
        }
      }
    }
    addButtonsTo(bar);
  }
  // Rodar agora...
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureButtons);
  } else {
    ensureButtons();
  }
  // ... e observar mudanças (caso a árvore seja renderizada depois)
  const mo = new MutationObserver(() => ensureButtons());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  // ... e após mensagens (padrão em Webviews)
  window.addEventListener("message", () => setTimeout(ensureButtons, 0));
})();


  // === Filtros (helpers) ===
  function getSelectedFilters(){
    const val = (id) => {
      const el = document.getElementById(id);
      return el ? (el.value || '').trim() : '';
    };
    return {
      automationStatus: val('fltAutomationStatus'),
      status:           val('fltStatus'),
      coverage:         val('fltCoverage'),
      owner:            val('fltOwner'),
      testType:         val('fltTestType'),
      testClass:        val('fltTestClass'),
      testGroup:        val('fltTestGroup'),
      label:            val('fltLabel'),
    };
  }
  function clearFilters(){
    ['fltAutomationStatus','fltStatus','fltCoverage','fltOwner','fltTestType','fltTestClass','fltTestGroup','fltLabel']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }
  (function bindClearFilters(){
    function bind(){
      const btn = document.getElementById('btnClearFilters');
      if (btn && !btn._bound){
        btn.addEventListener('click', clearFilters);
        btn._bound = true;
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
  })();

/* === Filtros: requisitar opções ao painel e preencher selects === */
(function zephyrFiltersBootstrap(){
  // Evita duplicar
  if (window.__zephyrFiltersBootstrap__) return;
  window.__zephyrFiltersBootstrap__ = true;

  function getVs(){
    try { return (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null; }
    catch { return null; }
  }

  // Pede opções com o mesmo contexto usado por "Aplicar Seleção"
  function requestFiltersOptionsNow(){
    try {
      const vs = getVs();
      if (!vs) return;

      // Tente recuperar o projectKey do(s) mesmo(s) lugar(es) usado(s) no seu fluxo
      const projetoIdOuKey =
        (window._projetoSelecionado) ||
        (window.projectFlow && window.projectFlow.projectKey) ||
        (window.projectKey) ||
        '';

      // Use a função existente para pegar a pasta selecionada
      const pastaIds = (typeof getSelectedFolderIds === 'function')
        ? getSelectedFolderIds()
        : [];

      if (!projetoIdOuKey || !pastaIds || !pastaIds.length) return;

      vs.postMessage({
        type: 'zephyr:requestFiltersOptions',
        projetoIdOuKey,
        pastaIds
      });
    } catch {}
  }

  // Popular cada <select>
  function setOptions(id, list){
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    const items = Array.isArray(list) ? list : [];
    sel.innerHTML = '<option value=\"\">Qualquer</option>' +
      items.map(v => '<option value=\"'+String(v)+'\">'+String(v)+'</option>').join('');
    // preserva seleção anterior quando possível
    try {
      if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    } catch {}
  }

  // Listener adicional (não mexe no seu existente)
  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'zephyr:filtersOptions') {
      const o = message.options || {};
      setOptions('fltAutomationStatus', o.automationStatus);
      setOptions('fltStatus',           o.status);
      setOptions('fltCoverage',         o.coverage);
      setOptions('fltTestType',         o.testType);
      setOptions('fltTestClass',        o.testClass);
      setOptions('fltTestGroup',        o.testGroup);
      // Owner e Label permanecem como inputs texto
    }
    // quando os dados do projeto chegam/atualizam, pedimos as opções da pasta atual
    if (message.type === 'zephyrDataProjeto') {
      setTimeout(requestFiltersOptionsNow, 0);
    }
  });

  // Quando a pasta selecionada muda, pedimos as opções novamente
  function wireFolderSelectionChange(){
    // tente pelo id conhecido; se não existir, use o container com a classe
    const tree = document.getElementById('folderTree') || document.querySelector('.folder-tree');
    if (!tree) return;
    tree.addEventListener('click', () => setTimeout(requestFiltersOptionsNow, 0));
    tree.addEventListener('keydown', (ev) => {
      // Enter/Espaço normalmente mudam seleção nos seus itens
      if (ev.key === 'Enter' || ev.key === ' ') setTimeout(requestFiltersOptionsNow, 0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireFolderSelectionChange();
      requestFiltersOptionsNow();
      bindButtons();
      bindFeatureForm();
    });
  } else {
    wireFolderSelectionChange();
    requestFiltersOptionsNow();
    bindButtons();
    bindFeatureForm();
  }
})();