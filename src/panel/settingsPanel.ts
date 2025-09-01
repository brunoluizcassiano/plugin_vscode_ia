// src/panel/SettingsPanel.ts
import * as vscode from 'vscode';
import { getSettingsViewContent } from '../view/settingsView';
const SETTING_KEYS = [
 'plugin.jira.domain',
 'plugin.jira.email',
 'plugin.jira.token',
 'plugin.zephyr.ownerId',
 'plugin.zephyr.domain',
 'plugin.zephyr.token',
 'plugin.copilot.Cookie',
] as const;
type SettingsMap = Partial<Record<(typeof SETTING_KEYS)[number], string>>;
export class SettingsPanel {
 public static currentPanel: SettingsPanel | undefined;
 private readonly panel: vscode.WebviewPanel;
 private constructor(panel: vscode.WebviewPanel) {
   this.panel = panel;
   this.panel.webview.html = getSettingsViewContent();
   this.registerMessageHandlers();
   this.panel.onDidDispose(() => (SettingsPanel.currentPanel = undefined));
 }
 public static createOrShow(extensionUri: vscode.Uri) {
   if (SettingsPanel.currentPanel) {
     SettingsPanel.currentPanel.panel.reveal();
     return;
   }
   const panel = vscode.window.createWebviewPanel(
     'settingsView',
     'Settings',
     vscode.ViewColumn.One,
     { enableScripts: true }
   );
   SettingsPanel.currentPanel = new SettingsPanel(panel);
 }
 // ===== helpers =====
 private readAll(): SettingsMap {
   const cfg = vscode.workspace.getConfiguration();
   const out: SettingsMap = {};
   for (const key of SETTING_KEYS) out[key] = cfg.get<string>(key) ?? '';
   return out;
 }
 private async writeAll(values: SettingsMap) {
   const cfg = vscode.workspace.getConfiguration();
   await Promise.all(
     Object.entries(values).map(([key, val]) =>
       cfg.update(key, val ?? '', vscode.ConfigurationTarget.Global) // User settings
     )
   );
 }
 private post(type: string, payload: any = {}) {
   this.panel.webview.postMessage({ type, ...payload });
 }
 private registerMessageHandlers() {
   this.panel.webview.onDidReceiveMessage(async (message: any) => {
     try {
       if (message.type === 'loadSettings') {
         const values = this.readAll();
         this.post('currentSettings', { values });
         return;
       }
       if (message.type === 'saveSettings') {
         const values = (message.settings ?? {}) as SettingsMap;
         await this.writeAll(values);
         this.post('status', { message: '✅ Configurações salvas em User settings.' });
         return;
       }
       if (message.type === 'openSettingsJson') {
         await vscode.commands.executeCommand('workbench.action.openSettingsJson');
         return;
       }
     } catch (err: any) {
       vscode.window.showErrorMessage(`Erro nos settings: ${err?.message || err}`);
       this.post('status', { message: '❌ Ocorreu um erro ao processar a ação.' });
     }
   });
 }
}
