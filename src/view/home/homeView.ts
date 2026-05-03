type ViewArgs = {
  webview: import('vscode').Webview;
  nonce: string;
  styleUri: string;
  scriptUri: string;
};

export function getHomeViewContent({ webview, nonce, styleUri, scriptUri }: ViewArgs): string {
  return `
   <!DOCTYPE html>
   <html lang="pt-BR">
   <head>
   <meta charset="UTF-8">
   <title>CoE Qualidade - Home</title>
   <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      img-src ${webview.cspSource} https: data:;
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource} https:;
      script-src 'nonce-${nonce}';
    ">
   <link rel="stylesheet" href="${styleUri}">
   </head>
   <body class="home-view">
   <div class="container home-container plugin-shell">
   <div class="plugin-header">
   <div class="plugin-eyebrow">PLARD - Quality Engineering</div>
   <h2 class="plugin-title">QE Studio</h2>
   <p class="plugin-subtitle">Centralize análise de histórias, geração de artefatos e apoio ao fluxo de QA diretamente na sua IDE, sem sair do contexto do projeto.</p>
   </div>
   <div class="plugin-section home-launcher">
   <div class="plugin-section-title">Fluxos disponíveis</div>
   <p class="home-launcher-intro">Selecione um fluxo para continuar com análise, geração de artefatos ou configuração do ambiente.</p>
   <div class="home-action-list">
   <button class="btn home-btn btn-ide btn-ide-primary home-action-card" id="btnHomeJira">
   <span class="home-action-title">Jira</span>
   <span class="home-action-description">Consultar issues e preparar análise funcional e de QA.</span>
   </button>
   <button class="btn home-btn btn-ide btn-ide-secondary home-action-card" id="btnHomeZephyr">
   <span class="home-action-title">Zephyr</span>
   <span class="home-action-description">Explorar cenários, revisar testes e trabalhar sugestões da IA.</span>
   </button>
   <button class="btn home-btn btn-ide btn-ide-secondary home-action-card" id="btnHomeBackend">
   <span class="home-action-title">Backend</span>
   <span class="home-action-description">Gerar artefatos a partir de curl, schema e endpoints.</span>
   </button>
   <button class="btn home-btn btn-ide btn-ide-secondary home-action-card" id="btnHomeWeb">
   <span class="home-action-title">Web</span>
   <span class="home-action-description">Acessar fluxos voltados para automação e apoio à camada web.</span>
   </button>
   <button class="btn home-btn btn-ide btn-ide-ghost home-action-card" id="btnHomeSettings">
   <span class="home-action-title">Configurações</span>
   <span class="home-action-description">Ajustar integrações, modelos e preferências do plugin.</span>
   </button>
   </div>
   </div>
   </div>
   <script src="${scriptUri}" nonce="${nonce}"></script>
   </body>
   </html>
    `;
}
