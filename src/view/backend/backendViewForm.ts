type ViewArgs = {
  webview: import('vscode').Webview;
  nonce: string;
  styleUri: string;
  scriptUri: string;
};

export function getBackendviewContent({ webview, nonce, styleUri, scriptUri }: ViewArgs): string {
  return `
 <!DOCTYPE html>
 <html lang="pt-BR">
 <head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>Formulário Dinâmico</title>
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline' https:; font-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';" />
 <link rel="stylesheet" href="${styleUri}" />
 </head>
 <body class="backend-view">
 <div class="container backend-container plugin-shell">
 <div class="plugin-header backend-header">
 <div class="plugin-eyebrow">PLARD - Quality Engineering</div>
 <h2 class="plugin-title">Backend</h2>
 <div class="plugin-subtitle">Gere artefatos a partir de curl ou schema com o mesmo padrão visual das demais telas do plugin.</div>
 </div>
 <form id="formulario" class="plugin-section backend-form-shell">
 <div class="plugin-section-title">Configuração</div>
 <div class="plugin-field">
 <label for="tipo">Escolha o tipo</label>
 <select id="tipo" name="tipo">
 <option value="">Selecione</option>
 <option value="curl">Curl</option>
 <option value="schema">Schema</option>
 </select>
 </div>
 <div id="campo-curl" class="hidden">
 <div class="plugin-field">
 <label for="curl">Cole o comando curl</label>
 <textarea id="curl" name="curl" rows="6" style="width: 100%;"></textarea>
 </div>
 <div class="plugin-field">
 <label>Selecione os itens que deseja gerar</label>
 <div class="checkbox-group">
 <label><input type="checkbox" id="modelCurl" name="modelCurl" value="modeluCurl"> Model</label>
 <label><input type="checkbox" id="appDriverCurl" name="appDriverCurl" value="appDriverCurl"> AppDriver</label> 
 </div>
 </div>
 </div>
 <div id="campo-schema" class="hidden">
 <div class="file-picker plugin-field">
 <label>Arquivo schema</label>
 <button type="button" id="btnSelecionarArquivo" class="btn-ide btn-ide-secondary file-button">
 Selecionar arquivo
 </button>
 <div id="arquivoSelecionado" class="file-path"></div>
 </div>
 <div class="plugin-field">
 <label for="tipo">Selecione o endpoint</label>
 <select id="selectEndpoint" name="endpoint" style="width: 100%; margin-bottom: 1rem;">
 <option value="">-- Selecione um endpoint --</option>
 </select>
 </div>
 <div id="methodsContainer" style="margin-top: 1rem;">
 <!-- Os checkboxes dos métodos HTTP aparecerão aqui -->
 </div>
 <div class="plugin-field">
 <label for="tipo">Selecione os itens que deseja gerar</label>
 <div id="methodsContainer" style="margin-top: 1rem;">
 <div class="method-checkbox">
 <label><input type="checkbox" id="schema" name="schema" value="schema"> Schema</label>
  </div>
  <div class="method-checkbox">
 <label><input type="checkbox" id="model" name="model" value="model"> Model</label>
 </div>
  <div class="method-checkbox">
 <label><input type="checkbox" id="appDriver" name="appDriver" value="appDriver"> AppDriver</label>
 </div>
 </div>
 </div>
 </div>
 <div class="plugin-field">
 <label>Pasta de destino</label>
 <button type="button" class="folder-button btn-ide btn-ide-secondary" id="btnSelecionarPasta">
 Selecionar pasta
 </button>
 <span id="pastaSelecionada" class="info"></span>
 </div>
 <div class="plugin-toolbar backend-toolbar">
 <button type="submit" class="btn-ide btn-ide-primary">Enviar</button>
 </div>
 </form>
 </div>
 <script src="${scriptUri}" nonce="${nonce}"></script>
 </body>
 </html>
  `;
}
