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
exports.SettingsPanel = void 0;
// src/panel/SettingsPanel.ts
const vscode = __importStar(require("vscode"));
const settingsView_1 = require("../view/settingsView");
const SETTING_KEYS = [
    'plugin.jira.domain',
    'plugin.jira.email',
    'plugin.jira.token',
    'plugin.zephyr.ownerId',
    'plugin.zephyr.domain',
    'plugin.zephyr.token',
    'plugin.copilot.Cookie',
];
class SettingsPanel {
    constructor(panel) {
        this.panel = panel;
        this.panel.webview.html = (0, settingsView_1.getSettingsViewContent)();
        this.registerMessageHandlers();
        this.panel.onDidDispose(() => (SettingsPanel.currentPanel = undefined));
    }
    static createOrShow(extensionUri) {
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel('settingsView', 'Settings', vscode.ViewColumn.One, { enableScripts: true });
        SettingsPanel.currentPanel = new SettingsPanel(panel);
    }
    // ===== helpers =====
    readAll() {
        var _a;
        const cfg = vscode.workspace.getConfiguration();
        const out = {};
        for (const key of SETTING_KEYS)
            out[key] = (_a = cfg.get(key)) !== null && _a !== void 0 ? _a : '';
        return out;
    }
    writeAll(values) {
        return __awaiter(this, void 0, void 0, function* () {
            const cfg = vscode.workspace.getConfiguration();
            yield Promise.all(Object.entries(values).map(([key, val]) => cfg.update(key, val !== null && val !== void 0 ? val : '', vscode.ConfigurationTarget.Global) // User settings
            ));
        });
    }
    post(type, payload = {}) {
        this.panel.webview.postMessage(Object.assign({ type }, payload));
    }
    registerMessageHandlers() {
        this.panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (message.type === 'loadSettings') {
                    const values = this.readAll();
                    this.post('currentSettings', { values });
                    return;
                }
                if (message.type === 'saveSettings') {
                    const values = ((_a = message.settings) !== null && _a !== void 0 ? _a : {});
                    yield this.writeAll(values);
                    this.post('status', { message: '✅ Configurações salvas em User settings.' });
                    return;
                }
                if (message.type === 'openSettingsJson') {
                    yield vscode.commands.executeCommand('workbench.action.openSettingsJson');
                    return;
                }
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro nos settings: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                this.post('status', { message: '❌ Ocorreu um erro ao processar a ação.' });
            }
        }));
    }
}
exports.SettingsPanel = SettingsPanel;
