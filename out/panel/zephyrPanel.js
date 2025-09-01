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
