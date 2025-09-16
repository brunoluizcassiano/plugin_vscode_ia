"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZephyrPanel = void 0;
const vscode = __importStar(require("vscode"));
const zephyrView_1 = require("../view/zephyr/zephyrView");
const featureGenerator_1 = require("../generators/features/featureGenerator");
const stepsGenerator_1 = require("../generators/steps/stepsGenerator");
// ===== Helpers: aplicar filtros somente para SELECTs (sem Coverage/Owner/Label) =====
function _zNorm(v) {
    if (v === null || v === undefined)
        return '';
    if (typeof v === 'string')
        return v.trim();
    return String(v).trim();
}
function _zEqualsCi(a, b) {
    return _zNorm(a).toLowerCase() === _zNorm(b).toLowerCase();
}
function _zFrom(t, keys, cfKeys = []) {
    var _a, _b, _c, _d, _e, _f;
    for (const k of keys) {
        const v = t === null || t === void 0 ? void 0 : t[k];
        if (v !== undefined && v !== null && v !== '')
            return _zNorm(v);
    }
    const cf = (_b = (_a = t === null || t === void 0 ? void 0 : t.details) === null || _a === void 0 ? void 0 : _a.customFields) !== null && _b !== void 0 ? _b : t === null || t === void 0 ? void 0 : t.customFields;
    if (cf && typeof cf === 'object') {
        for (const name of cfKeys) {
            const c = (_e = (_c = cf[name]) !== null && _c !== void 0 ? _c : cf[(_d = name === null || name === void 0 ? void 0 : name.toLowerCase) === null || _d === void 0 ? void 0 : _d.call(name)]) !== null && _e !== void 0 ? _e : cf[(_f = name === null || name === void 0 ? void 0 : name.toUpperCase) === null || _f === void 0 ? void 0 : _f.call(name)];
            if (c !== undefined && c !== null && c !== '')
                return _zNorm(c);
        }
    }
    return '';
}
function _zNormAutomation(s) {
    const v = _zNorm(s).toLowerCase();
    if (!v || v === 'n/a')
        return '';
    if (v === 'automated' || v === 'automation')
        return 'automated';
    if (v === 'not automated' || v === 'not automation' || v === 'manual')
        return 'not automated';
    if (v === 'not applicable')
        return 'not applicable';
    return v;
}
/**
 * Aplica SOMENTE os filtros dos SELECTs cujo valor != 'N/A'
 * Campos: automationStatus, status, testType, testClass, testGroup
 */
function applyZephyrSelectFilters(rawTests, filtros) {
    if (!Array.isArray(rawTests) || !filtros || typeof filtros !== 'object')
        return rawTests || [];
    const sel = {
        automationStatus: _zNorm(filtros.automationStatus),
        status: _zNorm(filtros.status),
        testType: _zNorm(filtros.testType),
        testClass: _zNorm(filtros.testClass),
        testGroup: _zNorm(filtros.testGroup),
    };
    const use = (val) => (val && val.toUpperCase() !== 'N/A');
    const out = [];
    for (const t of rawTests) {
        const aut = _zNormAutomation(_zFrom(t, ['automationStatus', 'automation', 'automated'], ['Automation status', 'Automation Status', 'Automação']));
        const stat = _zFrom(t, ['status', 'state'], ['Status']);
        const ttype = _zFrom(t, ['testType', 'type'], ['Test Type', 'Tipo']);
        const tclass = _zFrom(t, ['testClass', 'class'], ['Test Class', 'Classe']);
        const tgroup = _zFrom(t, ['testGroup', 'group'], ['Test Group', 'Grupo']);
        if (use(sel.automationStatus)) {
            const want = _zNormAutomation(sel.automationStatus);
            if (!want || want !== aut)
                continue;
        }
        if (use(sel.status) && !_zEqualsCi(stat, sel.status))
            continue;
        if (use(sel.testType) && !_zEqualsCi(ttype, sel.testType))
            continue;
        if (use(sel.testClass) && !_zEqualsCi(tclass, sel.testClass))
            continue;
        if (use(sel.testGroup) && !_zEqualsCi(tgroup, sel.testGroup))
            continue;
        out.push(t);
    }
    return out;
}
class ZephyrPanel {
    constructor(panel, extensionUri, issueId, issueKey, comentario) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.issueId = issueId;
        this.issueKey = issueKey;
        this.comentario = comentario;
        this._panel.webview.html = (0, zephyrView_1.getZephyrViewContent)();
        // 🎧 Ouvindo mensagens do HTML
        this._panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));
        // 🧹 Limpa referência ao fechar
        this._panel.onDidDispose(() => {
            ZephyrPanel.currentPanel = undefined;
        });
        function extrairTodosCenariosGherkin(texto) {
            const regexBloco = /```gherkin\s+([\s\S]*?)```/gi;
            const blocos = [...texto.matchAll(regexBloco)];
            const cenarios = [];
            for (const bloco of blocos) {
                const conteudo = bloco[1]
                    .split('\n')
                    .map(l => l.trimStart())
                    .filter(l => l.trim() !== '');
                let buffer = [];
                for (const linha of conteudo) {
                    if (linha.toLowerCase().startsWith('scenario:')) {
                        if (buffer.length) {
                            cenarios.push(buffer.join('\n'));
                            buffer = [];
                        }
                    }
                    buffer.push(linha);
                }
                if (buffer.length) {
                    cenarios.push(buffer.join('\n'));
                }
            }
            return cenarios;
        }
        function extractTestType(texto) {
            const regex = /\*\*Test Type:\*\*\s*(.+)/g;
            const matches = [];
            let match;
            while ((match = regex.exec(texto)) !== null) {
                matches.push(match[1].trim());
            }
            return matches;
        }
        function extractTestClass(texto) {
            const regex = /\*\*Test Class:\*\*\s*(.+)/g;
            const matches = [];
            let match;
            while ((match = regex.exec(texto)) !== null) {
                matches.push(match[1].trim());
            }
            return matches;
        }
        function extractTestGroup(texto) {
            const regex = /\*\*Test Group:\*\*\s*(.+)/g;
            const matches = [];
            let match;
            while ((match = regex.exec(texto)) !== null) {
                matches.push(match[1].trim());
            }
            return matches;
        }
        this._panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            if (message.type === 'analisarIA') {
                try {
                    const testes = message.testes || [];
                    const sugestoesIA = [];
                    if (testes.length === 0) {
                        const resposta = yield vscode.commands.executeCommand('plugin-vscode.criarCenariosIaQa', comentario || '', testes || '');
                        const respostaRaw = typeof resposta === 'string' ? resposta : ((resposta === null || resposta === void 0 ? void 0 : resposta.message) || 'Sem resposta da IA.');
                        // Detectar se existem múltiplos cenários Gherkin
                        if (respostaRaw.includes('Scenario:')) {
                            const cenariosSeparados = extrairTodosCenariosGherkin(respostaRaw);
                            const testTypes = extractTestType(respostaRaw);
                            const testClasses = extractTestClass(respostaRaw);
                            const testGroups = extractTestGroup(respostaRaw);
                            cenariosSeparados.forEach((texto, idx) => {
                                sugestoesIA.push({
                                    key: `cenario-gerado-${idx + 1}`,
                                    sugestao: texto,
                                    testType: testTypes[idx] || '',
                                    testClass: testClasses[idx] || '',
                                    testGroup: testGroups[idx] || ''
                                });
                                console.log(`Cenário: ${texto}`);
                                console.log(`Type: ${testTypes[idx]}`);
                                console.log(`Class: ${testClasses[idx]}`);
                                console.log(`Group: ${testGroups[idx]}`);
                            });
                        }
                        else {
                            sugestoesIA.push({
                                key: 'cenario-unico',
                                sugestao: respostaRaw,
                                testType: extractTestType(respostaRaw)[0] || '',
                                testClass: extractTestClass(respostaRaw)[0] || '',
                                testGroup: extractTestGroup(respostaRaw)[0] || ''
                            });
                        }
                    }
                    else {
                        for (const t of testes) {
                            const resposta = yield vscode.commands.executeCommand('plugin-vscode.analiseCenariosIaQa', comentario || '', t.script || '');
                            sugestoesIA.push({
                                key: t.key,
                                sugestao: typeof resposta === 'string' ? resposta : ((resposta === null || resposta === void 0 ? void 0 : resposta.message) || 'Sem resposta da IA.')
                            });
                        }
                    }
                    this._panel.webview.postMessage({
                        type: 'sugestoesIA',
                        sugestoes: sugestoesIA
                    });
                }
                catch (error) {
                    console.error('Erro ao consultar IA:', error);
                    this._panel.webview.postMessage({
                        type: 'sugestoesIA',
                        sugestoes: []
                    });
                }
            }
            else if (message.type === 'enviarParaZephyr') {
                const { payload } = message;
                try {
                    const resultados = yield Promise.all(payload.map(({ key, texto, automationStatus, testClass, testType, testGroup, folderId }) => __awaiter(this, void 0, void 0, function* () {
                        vscode.window.showInformationMessage(`texto: ${texto}`);
                        const zephyrKey = yield vscode.commands.executeCommand('plugin-vscode.criarTesteZephyr', texto, issueId, issueKey, automationStatus, testClass, testType, testGroup, folderId);
                        return { key, zephyrKey };
                    })));
                    this._panel.webview.postMessage({
                        type: 'atualizarCenariosComZephyrKey',
                        payload: resultados,
                    });
                    vscode.window.showInformationMessage(`Cenários sincronizados com sucesso no Zephyr`);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Erro ao sincronizar com Zephyr: ${error}`);
                }
            }
            else if (message.type === 'enviarAtualizacaoParaZephyr') {
                const { payload } = message;
                try {
                    const resultados = yield Promise.all(payload.map(({ key, texto, issueId, issueKey }) => __awaiter(this, void 0, void 0, function* () {
                        const zephyrKey = yield vscode.commands.executeCommand('plugin-vscode.atualizarTesteZephyr', key, texto, issueId, issueKey);
                        return { key, zephyrKey };
                    })));
                    // this._panel.webview.postMessage({
                    //   type: 'atualizarCenariosComZephyrKey',
                    //   payload: resultados,
                    // });
                    vscode.window.showInformationMessage(`Cenários sincronizados com sucesso no Zephyr`);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Erro ao sincronizar com Zephyr: ${error}`);
                }
            }
            else if (message.type === 'carregarPastaPrincipal') {
                const issueKey = message.issueKey;
                const pastasPrincipais = yield vscode.commands.executeCommand('plugin-vscode.getZephyrFolders', issueKey);
                this._panel.webview.postMessage({
                    type: 'listaPasta',
                    pastasPrincipais
                });
            }
            else if (message.type === 'selecionarPastaDestino') {
                const folderUri = yield vscode.window.showOpenDialog({
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false,
                    openLabel: 'Selecionar pasta destino'
                });
                if (folderUri && folderUri[0]) {
                    this._panel.webview.postMessage({
                        type: 'pastaSelecionada',
                        caminho: folderUri[0].fsPath
                    });
                }
            }
            else if (message.type === 'criarScriptsEmPasta') {
                vscode.window.showWarningMessage(`message.dados: ${JSON.stringify(message.dados)}`);
                const caminho = message.dados.caminho;
                const itens = message.dados.itens;
                const featureName = message.dados.featureName;
                const ruleName = message.dados.ruleName;
                const fileBaseName = message.dados.fileBaseName;
                const tribeName = message.dados.tribeName;
                const extraTags = message.dados.extraTags;
                if (!caminho) {
                    vscode.window.showWarningMessage('Selecione uma pasta de destino antes de enviar.');
                    return;
                }
                if (!(itens === null || itens === void 0 ? void 0 : itens.length)) {
                    vscode.window.showWarningMessage('Nenhum cenário selecionado para gerar script.');
                    return;
                }
                yield (0, featureGenerator_1.generateFeatures)(caminho, itens, {
                    featureName: featureName,
                    ruleName: ruleName,
                    fileBaseName: fileBaseName,
                    tribeName: tribeName,
                    extraTags: extraTags
                });
                yield (0, stepsGenerator_1.generateSteps)(caminho, itens, {
                    featureName: featureName,
                    ruleName: ruleName,
                    fileBaseName: fileBaseName,
                    tribeName: tribeName,
                    extraTags: extraTags
                });
            }
            else if (message.type === 'listarProjetosJira') {
                try {
                    // Chama o comando já registrado no extension.ts
                    // Ele retorna algo como: [{ key: 'ABC', name: 'Meu Projeto' }, ...]
                    const projects = yield vscode.commands.executeCommand('plugin-vscode.getJiraProjects');
                    // Devolve para a webview exatamente no formato que ela espera
                    this._panel.webview.postMessage({
                        type: 'projetosJira',
                        projects: Array.isArray(projects) ? projects : []
                    });
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Erro ao listar projetos do Jira: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                    this._panel.webview.postMessage({ type: 'projetosJira', projects: [] });
                }
            }
            else if (message.type === 'carregarEstruturaProjeto') {
                try {
                    const projectKey = message.projetoIdOuKey || '';
                    const resultado = yield vscode.commands.executeCommand('plugin-vscode.getZephyrFoldersByProject', projectKey // já é a KEY
                    );
                    this._panel.webview.postMessage({
                        type: 'estruturaProjeto',
                        folders: (resultado === null || resultado === void 0 ? void 0 : resultado.folders) || [],
                        flat: (resultado === null || resultado === void 0 ? void 0 : resultado.flat) || [],
                        projectKey: (resultado === null || resultado === void 0 ? void 0 : resultado.projectKey) || projectKey
                    });
                }
                catch (e) {
                    vscode.window.showErrorMessage(`Erro ao carregar estrutura do projeto: ${e.message || e}`);
                    this._panel.webview.postMessage({ type: 'estruturaProjeto', folders: [], flat: [], projectKey: '' });
                }
            }
            else if (message.type === 'aplicarFiltrosProjeto') {
                // 👉 novo caso: ao aplicar seleção, buscar "todos os testes que estão naquela pasta"
                try {
                    const projectKey = message.projetoIdOuKey || '';
                    const pastaIds = Array.isArray(message.pastaIds) ? message.pastaIds : [];
                    const folderId = pastaIds[0]; // seleção única (pela UI nova)
                    if (!projectKey || !folderId) {
                        throw new Error('Projeto e pasta são obrigatórios.');
                    }
                    // Chame seu comando que retorna os testes de UMA pasta.
                    // Se o seu já aceita múltiplas pastas, passe o array completo.
                    // Ajuste o nome do command se o seu for diferente.
                    const rawTests = yield vscode.commands.executeCommand('plugin-vscode.getZephyrTestsByFolder', projectKey, folderId, { recursive: false } // se quiser incluir subpastas, troque para true no seu command
                    );
                    const filtros = (message && message.filtros) ? message.filtros : {};
                    const _raw = Array.isArray(rawTests) ? rawTests : [];
                    const testesZephyr = applyZephyrSelectFilters(_raw, filtros).map(mapZephyrTestsForWebview);
                    // Enviamos direto no formato que a webview já trata e renderiza
                    this._panel.webview.postMessage({
                        type: 'zephyrDataProjeto',
                        zephyrDataProjeto: { testesZephyr },
                        projectKey,
                        folderId
                    });
                }
                catch (e) {
                    vscode.window.showErrorMessage(`Erro ao carregar testes da pasta: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
                    this._panel.webview.postMessage({
                        type: 'zephyrDataProjeto',
                        zephyrDataProjeto: { testesZephyr: [] },
                        projectKey: message.projetoIdOuKey || '',
                        folderId: (Array.isArray(message.pastaIds) && message.pastaIds[0]) || null
                    });
                }
            }
        }));
        // Envia nome do usuário assim que carrega
        this.sendNomeUsuario();
        // Envia dados do Zephyr
        this.zephyr(issueId, issueKey, comentario);
    }
    static createOrShow(extensionUri, issueId, issueKey, comentario) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const column = ((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.viewColumn) || vscode.ViewColumn.One;
            if (ZephyrPanel.currentPanel) {
                ZephyrPanel.currentPanel._panel.reveal(column);
                // Se a issueKey for diferente, atualiza
                if (ZephyrPanel.currentPanel.issueKey !== issueKey) {
                    ZephyrPanel.currentPanel.issueKey = issueKey;
                    // Limpa estado da tela e reinicia o carregamento
                    ZephyrPanel.currentPanel._panel.webview.postMessage({
                        type: 'novoId',
                        issueKey,
                        comentario
                    });
                    // Reenvia os dados com novo issueKey
                    ZephyrPanel.currentPanel.sendNomeUsuario();
                    ZephyrPanel.currentPanel.zephyr(issueId, issueKey, comentario);
                }
            }
            else {
                const panel = vscode.window.createWebviewPanel('zephyrView', 'Zephyr', column, { enableScripts: true });
                ZephyrPanel.currentPanel = new ZephyrPanel(panel, extensionUri, issueId, issueKey, comentario);
            }
        });
    }
    sendNomeUsuario() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const nome = yield vscode.commands.executeCommand('plugin-vscode.getJiraUser');
                this._panel.webview.postMessage({ type: 'nomeUsuario', nome });
            }
            catch (error) {
                console.error('Erro ao obter nome do usuário do Jira:', error);
            }
        });
    }
    zephyr(issueId, issueKey, comentario) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const zephyrData = yield vscode.commands.executeCommand('plugin-vscode.getZephyrTestToIssue', issueKey);
                this._panel.webview.postMessage({ type: 'zephyrData', issueId, issueKey, zephyrData, comentario });
            }
            catch (error) {
                console.error('Erro ao obter dados do Zephyr:', error);
            }
        });
    }
    handleMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            if (message.type === 'buscarIssue') {
                const { key } = message;
                const issue = yield vscode.commands.executeCommand('plugin-vscode.getZephyrTestToIssue', key);
                console.log('🔍 Resultado da issue:', issue);
                if (issue && typeof issue === 'object' && 'key' in issue) {
                    this._panel.webview.postMessage({ type: 'detalhesIssue', issue });
                }
                else {
                    this._panel.webview.postMessage({
                        type: 'erroIssue',
                        mensagem: '❌ Issue não encontrada.'
                    });
                }
            }
        });
    }
}
exports.ZephyrPanel = ZephyrPanel;
// (opcional, mas recomendado) — normaliza o shape dos testes pro que a webview espera
function mapZephyrTestsForWebview(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    if (!raw || typeof raw !== 'object')
        return raw;
    // Ajuste aqui conforme o shape real dos testes vindos do seu command
    return {
        key: (_c = (_b = (_a = raw.key) !== null && _a !== void 0 ? _a : raw.testKey) !== null && _b !== void 0 ? _b : raw.name) !== null && _c !== void 0 ? _c : 'SemKey',
        version: (_e = (_d = raw.version) !== null && _d !== void 0 ? _d : raw.versionNumber) !== null && _e !== void 0 ? _e : 1,
        details: {
            name: (_h = (_g = (_f = raw.details) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : raw.name) !== null && _h !== void 0 ? _h : '',
            customFields: (_l = (_k = (_j = raw.details) === null || _j === void 0 ? void 0 : _j.customFields) !== null && _k !== void 0 ? _k : raw.customFields) !== null && _l !== void 0 ? _l : {}
        },
        script: (_q = (_p = (_m = raw.script) !== null && _m !== void 0 ? _m : (_o = raw.steps) === null || _o === void 0 ? void 0 : _o.gherkin) !== null && _p !== void 0 ? _p : raw.steps) !== null && _q !== void 0 ? _q : ''
    };
}
