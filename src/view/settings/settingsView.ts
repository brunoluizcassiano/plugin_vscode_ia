type ViewArgs = {
 webview: import('vscode').Webview;
 nonce: string;
 styleUri: string;
 scriptUri: string;
};

export function getSettingsViewContent({ webview, nonce, styleUri, scriptUri }: ViewArgs): string {
 return /* html */ `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; font-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Settings — Plugin QA</title>
<link rel="stylesheet" href="${styleUri}"/>
</head>
<body class="settings-view">
<div class="container plugin-shell settings-shell">
<div class="plugin-header">
<div class="plugin-eyebrow">PLARD - Quality Engineering</div>
<h2 class="plugin-title">Settings</h2>
<div class="plugin-subtitle">Configure integrações, IA e mapeamentos no mesmo padrão visual das demais telas do plugin.</div>
</div>
<div class="grid plugin-grid">
<!-- JIRA -->
<details class="plugin-section settings-collapsible">
<summary class="plugin-section-title settings-collapsible-summary">Jira</summary>
<div class="settings-collapsible-body">
<div class="two">
<div class="plugin-field">
<label for="plugin.jira.domain">Jira Domain</label>
<input id="plugin.jira.domain" placeholder="ex.: group-project-org.atlassian.net" />
</div>
<div class="plugin-field">
<label for="plugin.jira.email">Jira Email</label>
<input id="plugin.jira.email" placeholder="nome@empresa.com" />
</div>
</div>
<div class="pw plugin-field">
<label for="plugin.jira.token">Jira Token</label>
<div class="pw-control">
<input id="plugin.jira.token" type="password" placeholder="********"/>
<button class="eye btn-ide btn-ide-ghost" type="button" data-target="plugin.jira.token" title="Mostrar ou ocultar">Mostrar</button>
</div>
</div>
<div class="plugin-field">
<label for="plugin.jira.projectCategoryId">Jira Project Category ID</label>
<input id="plugin.jira.projectCategoryId" placeholder="ex.: 10018 (deixe vazio para listar todos)" />
<div class="hint">Quando preenchido, usa <code>/project/search?categoryId=...</code>. Quando vazio, usa <code>/project</code>.</div>
</div>
</div>
</details>
<!-- ZEPHYR -->
<!-- IA -->
<details class="plugin-section map-card settings-collapsible">
<summary class="plugin-section-title settings-collapsible-summary">IA</summary>
<div class="settings-collapsible-body">
<div class="map-header">
<div class="title">
<div class="hint">Usa a API <code>vscode.lm</code>, funcionando com modelos expostos por VS Code ou Windsurf.</div>
</div>
</div>
<div class="two">
<div>
<label for="plugin.ai.provider">Provider</label>
<select id="plugin.ai.provider"></select>
</div>
<div>
<label for="plugin.ai.modelFamily">Modelo / Family</label>
<select id="plugin.ai.modelFamily"></select>
</div>
</div>
<div class="actions plugin-toolbar">
<button class="btn-ide btn-ide-secondary" id="btnDetectModels" type="button">Atualizar modelos</button>
</div>
<div class="two" style="margin-top:12px;">
<div class="plugin-field">
<label for="plugin.ai.devinOrgSlug">Devin Organization</label>
<input id="plugin.ai.devinOrgSlug" placeholder="ex.: sei-software-engineering-intelligence" />
</div>
<div class="pw plugin-field">
<label for="plugin.ai.devinApiKey">Devin API Key</label>
<div class="pw-control">
<input id="plugin.ai.devinApiKey" type="password" placeholder="apk_user_..."/>
<button class="eye btn-ide btn-ide-ghost" type="button" data-target="plugin.ai.devinApiKey" title="Mostrar ou ocultar">Mostrar</button>
</div>
</div>
</div>
<div class="hint">Configure o Devin Enterprise para uso de IA no Windsurf. Gere a API key em Settings > API Keys no painel do Devin.</div>
</div>
</details>
<!-- ZEPHYR -->
<details class="plugin-section settings-collapsible">
<summary class="plugin-section-title settings-collapsible-summary">Zephyr</summary>
<div class="settings-collapsible-body">
<div class="two">
<div class="plugin-field">
<label for="plugin.zephyr.domain">Zephyr Domain</label>
<input id="plugin.zephyr.domain" placeholder="ex.: api.zephyrscale.smartbear.com" />
</div>
<div class="plugin-field">
<label for="plugin.zephyr.ownerId">Owner ID</label>
<input id="plugin.zephyr.ownerId" placeholder="ex.: 7122005-..." />
</div>
</div>
<div class="pw plugin-field">
<label for="plugin.zephyr.token">Zephyr Token</label>
<div class="pw-control">
<input id="plugin.zephyr.token" type="password" placeholder="********"/>
<button class="eye btn-ide btn-ide-ghost" type="button" data-target="plugin.zephyr.token" title="Mostrar ou ocultar">Mostrar</button>
</div>
</div>
</div>
</details>
<!-- DE/PARA -->
<details class="plugin-section map-card settings-collapsible">
<summary class="plugin-section-title settings-collapsible-summary">Mapeamento de projetos</summary>
<div class="settings-collapsible-body">
<div class="map-header">
<div class="title">
<h3 style="margin:0;">Mapeamento de projetos <span class="badge">Jira para Zephyr</span></h3>
<div class="hint">Se não houver mapeamento para um projeto, o plugin usa o mesmo key do Jira.</div>
<label class="switch">
<input type="checkbox" id="plugin.projectMap.strict"/>
<span>Exigir de/para (modo estrito)</span>
</label>
</div>
<div class="map-actions">
<button id="btnAddMap" class="btn-ide btn-ide-secondary" title="Adicionar mapeamento">Adicionar</button>
</div>
</div>
<div id="mapList"></div>
<div class="empty-hint" id="mapEmptyHint" style="display:none;">Nenhum mapeamento cadastrado. O plugin manterá o mesmo key do Jira no Zephyr.</div>
</div>
</details>
<div class="actions plugin-toolbar">
<button class="btn-ide btn-ide-primary" id="btnSave">Salvar</button>
<button class="btn-ide btn-ide-secondary" id="btnReload">Recarregar</button>
<button class="btn-ide btn-ide-ghost" id="btnOpenJson">Abrir settings.json</button>
</div>
<div class="hint plugin-status" id="status"></div>
</div>
</div>
<script src="${scriptUri}" nonce="${nonce}"></script>
</body>
</html>
`;
}
