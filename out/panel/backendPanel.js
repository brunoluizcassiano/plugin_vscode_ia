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
exports.BackendPanel = void 0;
const vscode = __importStar(require("vscode"));
const backendViewForm_1 = require("../view/backendViewForm");
const schema_1 = require("../generators/schema/schema");
const index_1 = require("../generators/app/index");
const index_2 = require("../generators/model/index");
const generateFromCurl_1 = require("../generators/api/generateFromCurl");
class BackendPanel {
    constructor(panel) {
        this.panel = panel;
        this.panel.webview.html = (0, backendViewForm_1.getBackendviewContent)();
        this.registerMessageHandlers();
        this.panel.onDidDispose(() => {
            BackendPanel.currentPanel = undefined;
        });
    }
    static createOrShow(extensionUri) {
        if (BackendPanel.currentPanel) {
            BackendPanel.currentPanel.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel('backendview', 'Backend', vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [extensionUri] });
        BackendPanel.currentPanel = new BackendPanel(panel);
    }
    registerMessageHandlers() {
        this.panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            try {
                switch (message.type) {
                    case 'selecionarArquivoSchema':
                        this.handleSelecionarArquivoSchema();
                        break;
                    case 'selecionarPastaDestino':
                        this.handleSelecionarPastaDestino();
                        break;
                    case 'formularioPreenchido':
                        this.handleFormularioPreenchido(message.dados);
                        break;
                    default:
                        vscode.window.showWarningMessage(`Tipo de mensagem desconhecido: ${message.type}`);
                        break;
                }
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro nos settings: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            }
        }));
    }
    handleSelecionarArquivoSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fileUri = yield vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: 'Selecionar arquivo schema',
                });
                if (!fileUri || fileUri.length === 0)
                    return;
                const caminho = fileUri[0].fsPath;
                yield (0, schema_1.loadDocumentation)(caminho);
                const endpoints = yield (0, schema_1.listEndpointsWithMethods)();
                yield (0, schema_1.unloadDocumentation)();
                this.panel.webview.postMessage({
                    type: 'schemaSelecionado',
                    caminho,
                    endpoints,
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao selecionar schema: ${error.message}`);
            }
        });
    }
    handleSelecionarPastaDestino() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const folderUri = yield vscode.window.showOpenDialog({
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false,
                    openLabel: 'Selecionar pasta destino',
                });
                if (!folderUri || folderUri.length === 0)
                    return;
                this.panel.webview.postMessage({
                    type: 'pastaSelecionada',
                    caminho: folderUri[0].fsPath,
                });
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao selecionar pasta: ${error.message}`);
            }
        });
    }
    handleFormularioPreenchido(dados) {
        return __awaiter(this, void 0, void 0, function* () {
            const { tipo, curl, endPointUri, arquivo, pasta, gerar } = dados !== null && dados !== void 0 ? dados : {};
            try {
                if (tipo === 'curl') {
                    if (gerar === null || gerar === void 0 ? void 0 : gerar.appDriverCurl) {
                        yield (0, generateFromCurl_1.generateAppDriverFromCurl)(curl, pasta);
                    }
                    if (gerar === null || gerar === void 0 ? void 0 : gerar.modelCurl) {
                        yield (0, generateFromCurl_1.generateModelFromCurl)(curl, pasta);
                    }
                }
                else if (tipo === 'schema') {
                    if (gerar === null || gerar === void 0 ? void 0 : gerar.schema) {
                        vscode.window.showInformationMessage(`Gerando schema a partir de: ${arquivo}`);
                        yield (0, schema_1.loadDocumentation)(arquivo);
                        yield (0, schema_1.generateFromOpenAPI)(pasta);
                        yield (0, schema_1.unloadDocumentation)();
                    }
                    if (gerar === null || gerar === void 0 ? void 0 : gerar.appDriver) {
                        yield (0, index_1.generateAppDriversFromOpenAPI)(arquivo, endPointUri, pasta);
                    }
                    if (gerar === null || gerar === void 0 ? void 0 : gerar.model) {
                        yield (0, index_2.generateModelFromOpenAPI)(arquivo, endPointUri, pasta);
                    }
                }
                else {
                    vscode.window.showWarningMessage('Tipo não reconhecido no formulário.');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao processar formulário: ${error.message}`);
            }
        });
    }
}
exports.BackendPanel = BackendPanel;
