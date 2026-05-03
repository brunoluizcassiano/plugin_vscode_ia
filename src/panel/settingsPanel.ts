import * as vscode from 'vscode';
import { getSettingsViewContent } from '../view/settings/settingsView';
import { listAvailableLanguageModels } from '../ai/model/languageModelBridge';
import { getHostContext, getLanguageModelPermissionHint } from '../platform/hostContext';

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
// ---- Tipos ----
type FlatSettings = {
 'plugin.jira.domain'?: string;
 'plugin.jira.email'?: string;
 'plugin.jira.token'?: string;
 'plugin.jira.projectCategoryId'?: string;
 'plugin.ai.provider'?: string;
 'plugin.ai.vendor'?: string;
 'plugin.ai.modelFamily'?: string;
 'plugin.ai.devinOrgSlug'?: string;
 'plugin.ai.devinApiKey'?: string;
 'plugin.zephyr.ownerId'?: string;
 'plugin.zephyr.domain'?: string;
 'plugin.zephyr.token'?: string;
 'plugin.projectMap'?: Record<string, string> | string; // aceita string JSON também
 'plugin.projectMap.strict'?: boolean | string;         // aceita "true"/"false"
};
const SETTING_KEYS = [
 'plugin.jira.domain',
 'plugin.jira.email',
 'plugin.jira.token',
 'plugin.jira.projectCategoryId',
 'plugin.ai.provider',
 'plugin.ai.vendor',
 'plugin.ai.modelFamily',
 'plugin.ai.devinOrgSlug',
 'plugin.ai.devinApiKey',
 'plugin.zephyr.ownerId',
 'plugin.zephyr.domain',
 'plugin.zephyr.token',
 'plugin.projectMap',
 'plugin.projectMap.strict'
] as const;
export class SettingsPanel {
 public static currentPanel: SettingsPanel | undefined;
 private readonly panel: vscode.WebviewPanel;
 private readonly extensionUri: vscode.Uri;
 private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
   this.panel = panel;
   this.extensionUri = extensionUri;
   const webview = this.panel.webview;
   const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style', 'style.css'));
   const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'settings', 'settings.js'));
   const nonce = getNonce();
   this.panel.webview.html = getSettingsViewContent({
     webview,
     nonce,
     styleUri: String(styleUri),
     scriptUri: String(scriptUri)
   });
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
     { enableScripts: true, localResourceRoots: [extensionUri] }
   );
   SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
 }
 // ===== helpers =====
 private config() {
   return vscode.workspace.getConfiguration();
 }
 /** Verifica se a chave está registrada no package.json. */
 private isRegistered(key: string): boolean {
   return !!this.config().inspect(key);
 }
 /** Lê tudo com tipos/defaults corretos. */
 private readAll(): FlatSettings {
   const cfg = this.config();
   return {
     'plugin.jira.domain':   cfg.get<string>('plugin.jira.domain', ''),
     'plugin.jira.email':    cfg.get<string>('plugin.jira.email', ''),
     'plugin.jira.token':    cfg.get<string>('plugin.jira.token', ''),
     'plugin.jira.projectCategoryId': cfg.get<string>('plugin.jira.projectCategoryId', ''),
     'plugin.ai.provider': cfg.get<string>('plugin.ai.provider', 'auto'),
     'plugin.ai.vendor': cfg.get<string>('plugin.ai.vendor', ''),
     'plugin.ai.modelFamily': cfg.get<string>('plugin.ai.modelFamily', ''),
     'plugin.ai.devinOrgSlug': cfg.get<string>('plugin.ai.devinOrgSlug', ''),
     'plugin.ai.devinApiKey': cfg.get<string>('plugin.ai.devinApiKey', ''),
     'plugin.zephyr.ownerId': cfg.get<string>('plugin.zephyr.ownerId', ''),
     'plugin.zephyr.domain': cfg.get<string>('plugin.zephyr.domain', ''),
     'plugin.zephyr.token':  cfg.get<string>('plugin.zephyr.token', ''),
     'plugin.projectMap':    cfg.get<Record<string, string>>('plugin.projectMap', {}), // objeto
     'plugin.projectMap.strict': cfg.get<boolean>('plugin.projectMap.strict', false)
   };
 }
 /** Normaliza/valida os valores vindos da webview. */
 private sanitize(values: FlatSettings): FlatSettings {
   const out: FlatSettings = { ...values };
   // boolean pode vir como string
   if (typeof out['plugin.projectMap.strict'] === 'string') {
     out['plugin.projectMap.strict'] =
       (out['plugin.projectMap.strict'] as string).toLowerCase() === 'true';
   }
   // projectMap pode vir como string JSON; normaliza em objeto e UPPERCASE
   const rawMap = out['plugin.projectMap'];
   let mapObj: Record<string, string> = {};
   if (typeof rawMap === 'string' && rawMap.trim()) {
     try { mapObj = JSON.parse(rawMap); } catch { mapObj = {}; }
   } else if (rawMap && typeof rawMap === 'object') {
     mapObj = rawMap as Record<string, string>;
   }
   // uppercase em chaves/valores
   const norm: Record<string, string> = {};
   Object.entries(mapObj).forEach(([k, v]) => {
     const key = String(k).trim().toUpperCase();
     const val = String(v ?? '').trim().toUpperCase();
     if (key && val) norm[key] = val;
   });
   out['plugin.projectMap'] = norm;
   // strings comuns: trim
   ([
     'plugin.jira.domain',
     'plugin.jira.email',
     'plugin.jira.token',
     'plugin.jira.projectCategoryId',
     'plugin.ai.provider',
     'plugin.ai.vendor',
     'plugin.ai.modelFamily',
     'plugin.ai.devinOrgSlug',
     'plugin.ai.devinApiKey',
     'plugin.zephyr.ownerId',
     'plugin.zephyr.domain',
     'plugin.zephyr.token'
   ] as const).forEach(k => {
     const val = out[k];
     if (typeof val === 'string') out[k] = val.trim();
   });
   return out;
 }
 /**
  * Escreve tudo. Se a chave ainda não existir no settings, `update` cria.
  * Se não estiver registrada no package.json, informa o usuário.
  */
 private async writeAll(values: FlatSettings) {
   const cfg = this.config();
   const data = this.sanitize(values);
   // antes de gravar, checa registro das duas novas chaves
   const missing: string[] = [];
   ['plugin.projectMap', 'plugin.projectMap.strict', 'plugin.ai.provider', 'plugin.ai.vendor', 'plugin.ai.modelFamily', 'plugin.ai.devinOrgSlug', 'plugin.ai.devinApiKey'].forEach(k => {
     if (!this.isRegistered(k)) missing.push(k);
   });
   if (missing.length) {
     throw new Error(
       `As chaves ${missing.join(', ')} não estão registradas em contributes.configuration. `
       + `Adicione no package.json e recarregue a janela.`
     );
   }
   // gravação (cria se não existir)
   await Promise.all([
     cfg.update('plugin.jira.domain',   data['plugin.jira.domain'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.jira.email',    data['plugin.jira.email'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.jira.token',    data['plugin.jira.token'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.jira.projectCategoryId', data['plugin.jira.projectCategoryId'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.ai.provider', data['plugin.ai.provider'] ?? 'auto', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.ai.vendor', data['plugin.ai.vendor'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.ai.modelFamily', data['plugin.ai.modelFamily'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.ai.devinOrgSlug', data['plugin.ai.devinOrgSlug'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.ai.devinApiKey', data['plugin.ai.devinApiKey'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.zephyr.ownerId', data['plugin.zephyr.ownerId'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.zephyr.domain', data['plugin.zephyr.domain'] ?? '', vscode.ConfigurationTarget.Global),
     cfg.update('plugin.zephyr.token',  data['plugin.zephyr.token'] ?? '', vscode.ConfigurationTarget.Global),
     // tipos corretos:
     cfg.update('plugin.projectMap',         (data['plugin.projectMap'] as Record<string, string>) ?? {}, vscode.ConfigurationTarget.Global),
     cfg.update('plugin.projectMap.strict',  Boolean(data['plugin.projectMap.strict']), vscode.ConfigurationTarget.Global)
   ]);
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
         this.post('hostContext', {
           host: getHostContext(),
           permissionHint: getLanguageModelPermissionHint(),
         });
         return;
       }
       if (message.type === 'saveSettings') {
         const values = (message.settings ?? {}) as FlatSettings;
         await this.writeAll(values);
         this.post('status', { ok: true, message: 'Configurações salvas em User settings.' });
         return;
       }
       if (message.type === 'openSettingsJson') {
         await vscode.commands.executeCommand('workbench.action.openSettingsJson');
         return;
       }
       if (message.type === 'detectAiModels') {
         const models = await listAvailableLanguageModels();
         this.post('aiModels', { models });
         return;
       }
     } catch (err: any) {
       const msg = `Erro nos settings: ${err?.message || err}`;
       vscode.window.showErrorMessage(msg);
       this.post('status', { err: true, message: 'Ocorreu um erro ao processar a ação.' });
     }
   });
 }
}
