type ViewArgs = {
  webview: import('vscode').Webview;
  nonce: string;
  styleUri: string;
  scriptUri?: string;
};

export function getZephyrViewContent({ webview, nonce, styleUri, scriptUri }: ViewArgs): string {
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
  <!-- CSS externo -->
  <link rel="stylesheet" href="${styleUri}">
  
  </head>
  <body class="zephyr-view">
  <div id="loading">
    <img src="https://cssbud.com/wp-content/uploads/2021/08/beepboop.gif" alt="Carregando..." />
    <p>Carregando dados do Zephyr...</p>
  </div>
  
  <div class="container plugin-shell zephyr-shell">
    <div class="plugin-header zephyr-header">
      <div class="plugin-eyebrow">PLARD - Quality Engineering</div>
      <h2 id="ola" class="plugin-title">Zephyr</h2>
      <p class="plugin-subtitle">Explore testes existentes, organize cenários e prepare insumos para os próximos passos do fluxo.</p>
    </div>
  
    <div id="issueHeader" class="issue-header plugin-section" style="display:none;"></div>
    <div id="issueTests" class="issue-tests plugin-section" style="display:none;"></div>

    <!-- =================== Fluxo por PROJETO (simplificado) =================== -->
    <div id="projectFlow" class="plugin-section zephyr-project-flow" style="display:none; margin-bottom:1rem;">
      <div class="plugin-section-title">Explorar testes por projeto</div>
      <div class="plugin-grid zephyr-project-grid">
        <div class="plugin-field">
          <label class="muted">Projeto (Jira)</label>
          <select id="projectSelect"><option value="">Selecione...</option></select>
        </div>
      </div>

      <div id="projectStructure" class="zephyr-project-structure" style="display:none; margin-top:1rem;">
        <div>
          <div class="muted">Estrutura de pastas (Zephyr)</div>
          
          <!-- Filtros (Zephyr) -->
          <div id="filtersPanel" class="filters-panel plugin-section">
            <div class="filters-title">Filtros</div>
            <div class="filters-grid">
              <div class="field plugin-field">
                <label for="fltAutomationStatus">Automation status</label>
                <select id="fltAutomationStatus">
                  <option value="N/A">N/A</option>
                  <option value="Automated">Automated</option>
                  <option value="Not automated">Not Automated</option>
                  <option value="Not applicable">Not Applicable</option>
                </select>
              </div>
              <div class="field plugin-field">
                <label for="fltTestType">Test Type</label>
                <select id="fltTestType">
                  <option value="N/A">N/A</option>
                  <option value="Acceptance">Acceptance</option>
                  <option value="End To End">End To End</option>
                  <option value="Regression">Regression</option>
                  <option value="Sanity">Sanity</option>
                  <option value="Security">Security</option>
                  <option value="Performance">Performance</option>
                  <option value="UI">UI</option>
                </select>
              </div>
              <div class="field plugin-field">
                <label for="fltTestClass">Test Class</label>
                <select id="fltTestClass">
                  <option value="N/A">N/A</option>
                  <option value="Positive">Positive</option>
                  <option value="Negative">Negative</option>
                </select>
              </div>
              <div class="field plugin-field">
                <label for="fltTestGroup">Test Group</label>
                <select id="fltTestGroup">
                  <option value="N/A">N/A</option>
                  <option value="Backend">Backend</option>
                  <option value="Desktop">Desktop</option>
                  <option value="Front-End">Front-End</option>
                </select>
              </div>
            </div>
            <div class="filters-row-actions plugin-toolbar">
              <button id="btnClearFilters" type="button" class="btn btn-ide btn-ide-ghost">Limpar filtros</button>
            </div>
          </div>

          <div id="folderTree" class="folder-tree"></div>
        </div>

        <div class="actions-row plugin-toolbar">
          <button id="btnApplyStructure" type="button" class="btn-ide btn-ide-primary" disabled>Aplicar seleção</button>
        </div>

        <div id="projLoading" style="display:none; margin-top:.5rem; color:#ccc;">Carregando...</div>
      </div>
    </div>
    <!-- =================== /Fluxo por PROJETO =================== -->
  
    <!-- toolbar 1: ações principais -->
    <div class="toolbar plugin-section plugin-toolbar zephyr-main-toolbar" role="toolbar">
      <button id="btnAnalisar" class="hidden btn-ide btn-ide-primary">
        <span class="icon"></span> Analisar com IA QA
      </button>
      <button id="btnAdicionar" style="display: none;" class="hidden btn-ide btn-ide-secondary">
        <span class="icon"></span> Adicionar cenário
      </button>
      <button id="btnSelecionarTodos" style="display: none;" class="hidden btn-ide btn-ide-secondary">
        <span class="icon"></span> Selecionar todos
      </button>
      <button id="btnEnviarIA" style="display: none;" class="hidden btn-ide btn-ide-primary">
        <span class="icon"></span> Criar cenários no Zephyr
      </button>
      <button id="btnEnviarAtualizacaoIA" style="display: none;" class="hidden btn-ide btn-ide-secondary">
        <span class="icon"></span> Sincronizar com Zephyr
      </button>
      <button id="btnCriarScripts" style="display: none;" class="hidden btn-ide btn-ide-ghost">
        <span class="icon"></span> Criar scripts
      </button>
    </div>
  
    <!-- Formulário (padrão backend) -->
    <form id="formulario" class="form plugin-section zephyr-form-shell">
      <div class="plugin-section-title">Gerar arquivo .feature</div>
      <div class="form__row plugin-field">
        <label>Nome da Feature:</label>
        <input type="text" id="featureName" placeholder="Ex.: Onboarding Gluon" />
      </div>
      <div class="form__row plugin-field">
        <label>Rule (opcional):</label>
        <textarea id="ruleName" placeholder="Ex.: Regra opcional aqui" rows="3"></textarea>
      </div>
      <div class="form__row plugin-field">
        <label>Nome do arquivo:</label>
        <input type="text" id="fileBaseName" placeholder="Ex.: TRBC-25284 ou onboarding (sem .feature)" />
      </div>
      <div class="form__row plugin-field">
        <label>Tribo:</label>
        <input type="text" id="tribeName" placeholder="Ex.: contratos" />
      </div>
      <div class="form__row plugin-field">
        <label>Tags extras:</label>
        <input type="text" id="extraTags" placeholder="Ex.: @regressivo @rest @autorFulano" />
      </div>
      <div class="form__row plugin-field">
        <label>Pasta de destino:</label>
        <div>
          <button id="selecionarPasta" type="button" class="hidden btn-ide btn-ide-secondary"><span>Selecionar pasta</span></button>
          <span id="pastaSelecionada" class="info"></span>
        </div>
      </div>
      <div class="note">As opções acima serão usadas como metadados do arquivo .feature (cabeçalho e tags) e para o nome do arquivo.</div>
      <button class="btn--full btn-ide btn-ide-primary" type="submit">Gerar arquivo .feature</button>
      <div id="formError" class="error">Preencha ao menos o nome do arquivo ou selecione uma pasta.</div>
      <div id="stepsFeedback" style="margin-top:12px"></div>
    </form>
  
    <div id="iaLoading">A IA está analisando os cenários...</div>
  </div>
  
  <!-- Carrega o JS externo (se fornecido) -->
  ${scriptUri ? `<script src="${scriptUri}" nonce="${nonce}"></script>` : ''}
  </body>
  </html>
  `;
}