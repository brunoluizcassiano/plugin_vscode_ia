"use strict";
// // src/panel/SettingsPanel.ts
// import * as vscode from 'vscode';
// import { getSettingsViewContent } from '../view/settingsView';
// const SETTING_KEYS = [
//  'plugin.jira.domain',
//  'plugin.jira.email',
//  'plugin.jira.token',
//  'plugin.zephyr.domain',
//  'plugin.zephyr.token',
//  'plugin.projectMap',
//  'plugin.projectMap.strict'
// ] as const;
// type SettingsMap = Partial<Record<(typeof SETTING_KEYS)[number], string>>;
// export class SettingsPanel {
//  public static currentPanel: SettingsPanel | undefined;
//  private readonly panel: vscode.WebviewPanel;
//  private constructor(panel: vscode.WebviewPanel) {
//    this.panel = panel;
//    this.panel.webview.html = getSettingsViewContent();
//    this.registerMessageHandlers();
//    this.panel.onDidDispose(() => (SettingsPanel.currentPanel = undefined));
//  }
//  public static createOrShow(extensionUri: vscode.Uri) {
//    if (SettingsPanel.currentPanel) {
//      SettingsPanel.currentPanel.panel.reveal();
//      return;
//    }
//    const panel = vscode.window.createWebviewPanel(
//      'settingsView',
//      'Settings',
//      vscode.ViewColumn.One,
//      { enableScripts: true }
//    );
//    SettingsPanel.currentPanel = new SettingsPanel(panel);
//  }
//  // ===== helpers =====
//  private readAll(): SettingsMap {
//    const cfg = vscode.workspace.getConfiguration();
//    const out: SettingsMap = {};
//    for (const key of SETTING_KEYS) out[key] = cfg.get<string>(key) ?? '';
//    return out;
//  }
//  private async writeAll(values: SettingsMap) {
//    const cfg = vscode.workspace.getConfiguration();
//    await Promise.all(
//      Object.entries(values).map(([key, val]) =>
//        cfg.update(key, val ?? '', vscode.ConfigurationTarget.Global) // User settings
//      )
//    );
//  }
//  private post(type: string, payload: any = {}) {
//    this.panel.webview.postMessage({ type, ...payload });
//  }
//  private registerMessageHandlers() {
//    this.panel.webview.onDidReceiveMessage(async (message: any) => {
//      try {
//        if (message.type === 'loadSettings') {
//          const values = this.readAll();
//          this.post('currentSettings', { values });
//          return;
//        }
//        if (message.type === 'saveSettings') {
//          const values = (message.settings ?? {}) as SettingsMap;
//          await this.writeAll(values);
//          this.post('status', { message: '✅ Configurações salvas em User settings.' });
//          return;
//        }
//        if (message.type === 'openSettingsJson') {
//          await vscode.commands.executeCommand('workbench.action.openSettingsJson');
//          return;
//        }
//      } catch (err: any) {
//        vscode.window.showErrorMessage(`Erro nos settings: ${err?.message || err}`);
//        this.post('status', { message: '❌ Ocorreu um erro ao processar a ação.' });
//      }
//    });
//  }
// }
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
const vscode = __importStar(require("vscode"));
const settingsView_1 = require("../view/settingsView");
const copilotLmBridge_1 = require("../copilot/copilotLmBridge");
const SETTING_KEYS = [
    'plugin.jira.domain',
    'plugin.jira.email',
    'plugin.jira.token',
    'plugin.jira.projectCategoryId',
    'plugin.ai.provider',
    'plugin.ai.vendor',
    'plugin.ai.modelFamily',
    'plugin.zephyr.ownerId',
    'plugin.zephyr.domain',
    'plugin.zephyr.token',
    'plugin.projectMap',
    'plugin.projectMap.strict'
];
class SettingsPanel {
    constructor(panel) {
        this.panel = panel;
        this.panel.webview.html = (0, settingsView_1.getSettingsViewContent)();
        this.registerMessageHandlers();
        this.panel.onDidDispose(() => (SettingsPanel.currentPanel = undefined));
    }
    static createOrShow(_extensionUri) {
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel('settingsView', 'Settings', vscode.ViewColumn.One, { enableScripts: true });
        SettingsPanel.currentPanel = new SettingsPanel(panel);
    }
    // ===== helpers =====
    config() {
        return vscode.workspace.getConfiguration();
    }
    /** Verifica se a chave está registrada no package.json. */
    isRegistered(key) {
        return !!this.config().inspect(key);
    }
    /** Lê tudo com tipos/defaults corretos. */
    readAll() {
        const cfg = this.config();
        return {
            'plugin.jira.domain': cfg.get('plugin.jira.domain', ''),
            'plugin.jira.email': cfg.get('plugin.jira.email', ''),
            'plugin.jira.token': cfg.get('plugin.jira.token', ''),
            'plugin.jira.projectCategoryId': cfg.get('plugin.jira.projectCategoryId', ''),
            'plugin.ai.provider': cfg.get('plugin.ai.provider', 'auto'),
            'plugin.ai.vendor': cfg.get('plugin.ai.vendor', ''),
            'plugin.ai.modelFamily': cfg.get('plugin.ai.modelFamily', ''),
            'plugin.zephyr.ownerId': cfg.get('plugin.zephyr.ownerId', ''),
            'plugin.zephyr.domain': cfg.get('plugin.zephyr.domain', ''),
            'plugin.zephyr.token': cfg.get('plugin.zephyr.token', ''),
            'plugin.projectMap': cfg.get('plugin.projectMap', {}),
            'plugin.projectMap.strict': cfg.get('plugin.projectMap.strict', false)
        };
    }
    /** Normaliza/valida os valores vindos da webview. */
    sanitize(values) {
        const out = Object.assign({}, values);
        // boolean pode vir como string
        if (typeof out['plugin.projectMap.strict'] === 'string') {
            out['plugin.projectMap.strict'] =
                out['plugin.projectMap.strict'].toLowerCase() === 'true';
        }
        // projectMap pode vir como string JSON; normaliza em objeto e UPPERCASE
        const rawMap = out['plugin.projectMap'];
        let mapObj = {};
        if (typeof rawMap === 'string' && rawMap.trim()) {
            try {
                mapObj = JSON.parse(rawMap);
            }
            catch (_a) {
                mapObj = {};
            }
        }
        else if (rawMap && typeof rawMap === 'object') {
            mapObj = rawMap;
        }
        // uppercase em chaves/valores
        const norm = {};
        Object.entries(mapObj).forEach(([k, v]) => {
            const key = String(k).trim().toUpperCase();
            const val = String(v !== null && v !== void 0 ? v : '').trim().toUpperCase();
            if (key && val)
                norm[key] = val;
        });
        out['plugin.projectMap'] = norm;
        // strings comuns: trim
        [
            'plugin.jira.domain',
            'plugin.jira.email',
            'plugin.jira.token',
            'plugin.jira.projectCategoryId',
            'plugin.ai.provider',
            'plugin.ai.vendor',
            'plugin.ai.modelFamily',
            'plugin.zephyr.ownerId',
            'plugin.zephyr.domain',
            'plugin.zephyr.token'
        ].forEach(k => {
            const val = out[k];
            if (typeof val === 'string')
                out[k] = val.trim();
        });
        return out;
    }
    /**
     * Escreve tudo. Se a chave ainda não existir no settings, `update` cria.
     * Se não estiver registrada no package.json, informa o usuário.
     */
    writeAll(values) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __awaiter(this, void 0, void 0, function* () {
            const cfg = this.config();
            const data = this.sanitize(values);
            // antes de gravar, checa registro das duas novas chaves
            const missing = [];
            ['plugin.projectMap', 'plugin.projectMap.strict', 'plugin.ai.provider', 'plugin.ai.vendor', 'plugin.ai.modelFamily'].forEach(k => {
                if (!this.isRegistered(k))
                    missing.push(k);
            });
            if (missing.length) {
                throw new Error(`As chaves ${missing.join(', ')} não estão registradas em contributes.configuration. `
                    + `Adicione no package.json e recarregue a janela.`);
            }
            // gravação (cria se não existir)
            yield Promise.all([
                cfg.update('plugin.jira.domain', (_a = data['plugin.jira.domain']) !== null && _a !== void 0 ? _a : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.jira.email', (_b = data['plugin.jira.email']) !== null && _b !== void 0 ? _b : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.jira.token', (_c = data['plugin.jira.token']) !== null && _c !== void 0 ? _c : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.jira.projectCategoryId', (_d = data['plugin.jira.projectCategoryId']) !== null && _d !== void 0 ? _d : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.ai.provider', (_e = data['plugin.ai.provider']) !== null && _e !== void 0 ? _e : 'auto', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.ai.vendor', (_f = data['plugin.ai.vendor']) !== null && _f !== void 0 ? _f : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.ai.modelFamily', (_g = data['plugin.ai.modelFamily']) !== null && _g !== void 0 ? _g : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.zephyr.ownerId', (_h = data['plugin.zephyr.ownerId']) !== null && _h !== void 0 ? _h : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.zephyr.domain', (_j = data['plugin.zephyr.domain']) !== null && _j !== void 0 ? _j : '', vscode.ConfigurationTarget.Global),
                cfg.update('plugin.zephyr.token', (_k = data['plugin.zephyr.token']) !== null && _k !== void 0 ? _k : '', vscode.ConfigurationTarget.Global),
                // tipos corretos:
                cfg.update('plugin.projectMap', (_l = data['plugin.projectMap']) !== null && _l !== void 0 ? _l : {}, vscode.ConfigurationTarget.Global),
                cfg.update('plugin.projectMap.strict', Boolean(data['plugin.projectMap.strict']), vscode.ConfigurationTarget.Global)
            ]);
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
                    this.post('status', { ok: true, message: '✅ Configurações salvas em User settings.' });
                    return;
                }
                if (message.type === 'openSettingsJson') {
                    yield vscode.commands.executeCommand('workbench.action.openSettingsJson');
                    return;
                }
                if (message.type === 'detectAiModels') {
                    const models = yield (0, copilotLmBridge_1.listAvailableLmModels)();
                    this.post('aiModels', { models });
                    return;
                }
            }
            catch (err) {
                const msg = `Erro nos settings: ${(err === null || err === void 0 ? void 0 : err.message) || err}`;
                vscode.window.showErrorMessage(msg);
                this.post('status', { err: true, message: '❌ Ocorreu um erro ao processar a ação.' });
            }
        }));
    }
}
exports.SettingsPanel = SettingsPanel;
