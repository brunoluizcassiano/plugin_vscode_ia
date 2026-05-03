"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJiraViewContent = void 0;
function getJiraViewContent({ webview, nonce, styleUri, scriptUri }) {
    return `
  <!DOCTYPE html>
  <html lang="pt-br">
  <head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      img-src ${webview.cspSource} https: data:;
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource} https:;
      script-src 'nonce-${nonce}';
    ">
  <link rel="stylesheet" href="${styleUri}">
  </head>
  <body class="jira-view">
  <div id="loading">
    <img src="https://cssbud.com/wp-content/uploads/2021/08/beepboop.gif" alt="Carregando..." />
    <p>Carregando dados do Jira...</p>
  </div>

  <div class="container plugin-shell jira-shell">
    <div class="plugin-header jira-header">
      <div class="plugin-eyebrow">PLARD - Quality Engineering</div>
      <h2 id="ola" class="plugin-title">Jira</h2>
      <p class="plugin-subtitle">Consulte issues, avalie a story, epic e funcionalidade com a visão de um QA e prepare insumos para refinamento, testes e próximos passos do fluxo.</p>
    </div>

    <div class="plugin-section jira-search-section">
      <div class="plugin-section-title">Buscar issue</div>
      <div class="plugin-grid jira-search-grid">
        <div class="plugin-field">
          <label>Projeto Jira</label>
          <select id="projetos"><option value="">Carregando...</option></select>
        </div>

        <div class="plugin-field jira-issue-field">
          <label for="issueKey">Issue</label>
          <div class="relative">
            <input type="text" id="issueKey" placeholder="Ex: SGC-123" autocomplete="off" />
            <div id="autocompleteList"></div>
          </div>
        </div>
      </div>
      <div class="jira-search-spacer"></div>
      <div class="plugin-toolbar jira-toolbar">
        <button class="btn-ide btn-ide-primary" id="btnBuscarIssue">Buscar</button>
      </div>
      <div id="mensagemErro" class="plugin-status jira-status-error" style="display: none;"></div>
    </div>

    <div id="detalhesIssue" class="issue-detail plugin-section" style="display:none;">
      <div class="plugin-section-title">Detalhes da issue</div>
      <div id="issueHeader" class="issue-header"></div>
      <div id="issueDescription" class="issue-description"></div>
      <div id="issueBDDSpecification" class="issue-BDDSpecification"></div>
      <div id="issueAttachments" class="issue-attachments"></div>

      <div class="plugin-toolbar jira-toolbar">
        <button class="btn-ide btn-ide-primary" id="btnAnalisarIa">Analisar com IA QA</button>
        <button class="btn-ide btn-ide-secondary" id="btnZephyrTopo" data-tooltip="Veja o final da página após a análise">Zephyr</button>
      </div>

      <div id="iaLoading">A IA está analisando a sua issue...</div>
      <div id="iaResultado" style="display: none;"></div>

      <textarea id="iaTexto" style="display:none;"></textarea>
      <div class="plugin-toolbar jira-toolbar jira-toolbar-footer">
        <button class="btn-ide btn-ide-secondary" id="btnEditarComentario" style="display:none;">Editar</button>
        <button class="btn-ide btn-ide-primary" id="btnEnviarComentario" style="display:none;">Enviar comentários para a issue</button>
        <button class="btn-ide btn-ide-ghost" id="btnZephyrFinal" style="display:none;">Zephyr</button>
      </div>
    </div>
  </div>

  ${scriptUri ? `<script src="${scriptUri}" nonce="${nonce}"></script>` : ''}
  </body>
  </html>
  `;
}
exports.getJiraViewContent = getJiraViewContent;
