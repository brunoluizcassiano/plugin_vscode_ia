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
exports.JiraPanel = void 0;
const vscode = __importStar(require("vscode"));
const jiraView_1 = require("../view/jira/jiraView");
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
class JiraPanel {
    constructor(panel, extensionUri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        const webview = this._panel.webview;
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'view', 'style', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'view', 'jira', 'jira.js'));
        const nonce = getNonce();
        this._panel.webview.html = (0, jiraView_1.getJiraViewContent)({
            webview,
            nonce,
            styleUri: String(styleUri),
            scriptUri: String(scriptUri)
        });
        // &#x1f3a7; Ouvindo mensagens do HTML
        this._panel.webview.onDidReceiveMessage(this.handleMessage.bind(this));
        // &#x1f9f9; Limpa referência ao fechar
        this._panel.onDidDispose(() => {
            JiraPanel.currentPanel = undefined;
        });
        // &#x1f680; Envia nome do usuário assim que carrega
        this.sendNomeUsuario();
    }
    static createOrShow(extensionUri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (JiraPanel.currentPanel) {
                JiraPanel.currentPanel._panel.reveal();
            }
            else {
                const panel = vscode.window.createWebviewPanel('jiraView', 'Jira', vscode.ViewColumn.One, {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'out', 'view')]
                });
                JiraPanel.currentPanel = new JiraPanel(panel, extensionUri);
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
    // ===== IA JSON parsing helpers (robusto + compatível) =====
    tryExtractJsonObject(text) {
        if (!text || typeof text !== 'string')
            return null;
        let s = text.trim();
        // Remove fences caso venham (```json ... ```)
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
        // Caso seja JSON puro
        if (s.startsWith('{') && s.endsWith('}')) {
            try {
                return JSON.parse(s);
            }
            catch (_a) {
                // tenta heurística abaixo
            }
        }
        // Heurística: pega do primeiro { ao último }
        const first = s.indexOf('{');
        const last = s.lastIndexOf('}');
        if (first >= 0 && last > first) {
            const candidate = s.slice(first, last + 1);
            try {
                return JSON.parse(candidate);
            }
            catch (_b) {
                return null;
            }
        }
        return null;
    }
    handleMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (message.type) {
                case 'configurarJira': {
                    vscode.window.showInformationMessage('Abrindo configuração do Jira...');
                    break;
                }
                case 'carregarProjetos': {
                    const projetos = yield vscode.commands.executeCommand('plugin-vscode.getJiraProjects');
                    this._panel.webview.postMessage({
                        type: 'listaProjetos',
                        projetos: projetos || [],
                    });
                    break;
                }
                case 'buscarSugestoesIssue': {
                    const { texto, projeto } = message;
                    const sugestoes = yield vscode.commands.executeCommand('plugin-vscode.buscarSugestoesIssue', texto, projeto);
                    this._panel.webview.postMessage({
                        type: 'sugestoesIssue',
                        sugestoes: sugestoes || [],
                    });
                    break;
                }
                case 'issuePrefixInvalido': {
                    vscode.window.showWarningMessage(`O código ${message.issueKey} não pertence ao projeto selecionado (${message.selectedProjectKey})`);
                    break;
                }
                case 'buscarIssue': {
                    const { key } = message;
                    const issue = yield vscode.commands.executeCommand('plugin-vscode.getJiraIssue', key);
                    console.log('&#x1f50d; Resultado da issue:', issue);
                    if (issue && typeof issue === 'object' && 'key' in issue) {
                        this._panel.webview.postMessage({ type: 'detalhesIssue', issue });
                    }
                    else {
                        this._panel.webview.postMessage({
                            type: 'erroIssue',
                            mensagem: '❌ Issue não encontrada.',
                        });
                    }
                    break;
                }
                case 'analisarIA': {
                    try {
                        const response = yield vscode.commands.executeCommand('plugin-vscode.analiseIaQa', message.description, message.bdd);
                        const aiText = typeof response === 'string' ? response : (response === null || response === void 0 ? void 0 : response.message) || 'Sem resposta da IA.';
                        const parsed = this.tryExtractJsonObject(aiText);
                        // Compatível: sempre manda "resultado" (string). Se parsear, manda também resultadoJson.
                        this._panel.webview.postMessage({
                            type: 'resultadoIA',
                            resultado: aiText,
                            resultadoJson: parsed && typeof parsed === 'object' ? parsed : null,
                        });
                    }
                    catch (error) {
                        this._panel.webview.postMessage({
                            type: 'resultadoIA',
                            resultado: 'Erro ao consultar a IA.',
                            resultadoJson: null,
                        });
                    }
                    break;
                }
                case 'openZephyr': {
                    vscode.commands.executeCommand('plugin-vscode.openZephyr', message.issueId, message.issueKey, message.comentario, message.description, message.bddSpecification);
                    break;
                }
                case 'enviarComentarioIa': {
                    const { issueKey, comentario } = message;
                    try {
                        yield vscode.commands.executeCommand('plugin-vscode.enviarComentarioIssue', issueKey, comentario);
                        vscode.window.showInformationMessage(`Comentário enviado com sucesso para ${issueKey}`);
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`Erro ao enviar comentário: ${error}`);
                    }
                    break;
                }
            }
        });
    }
}
exports.JiraPanel = JiraPanel;
