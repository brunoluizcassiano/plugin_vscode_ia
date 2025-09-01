export function getJiraViewContent(): string {
  return `
  <!DOCTYPE html>
  <html lang="pt-br">
  <head>
  <meta charset="UTF-8" />
  <style>
  /* ... seu CSS original ... */
  body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background-color: #1e1e1e;
  color: #ffffff;
  padding: 2rem;
  }
  .container { background-color: #2d2d2d; padding: 2rem; border-radius: 10px; max-width: 800px; margin: 0 auto; display: none; }
  #loading { text-align: center; font-size: 1.2rem; margin-top: 100px; }
  #loading img { width: 100px; margin-bottom: 1rem; }
  h2 { margin-top: 0; color: #4fc3f7; }
  label { display: block; margin: 1.2rem 0 0.4rem; font-weight: bold; }
  select, input[type="text"] { width: 100%; padding: 0.6rem; border-radius: 6px; border: none; margin-bottom: 1rem; background-color: #3c3c3c; color: #ffffff; }
  #autocompleteList { background-color: #3c3c3c; border-radius: 6px; max-height: 150px; overflow-y: auto; position: absolute; z-index: 999; width: 100%; border: 1px solid #555; }
  #autocompleteList div { padding: 8px; border-bottom: 1px solid #555; cursor: pointer; }
  #autocompleteList div:hover { background-color: #555; }
  button { background-color: #007acc; color: white; padding: 0.6rem 1rem; border: none; border-radius: 6px; cursor: pointer; margin-top: 0.5rem; margin-right: 0.5rem; transition: background-color 0.2s; }
  button:hover { background-color: #005f9e; }
  button[disabled] { background-color: #666 !important; cursor: not-allowed; position: relative; }
  button[disabled]::after { content: attr(data-tooltip); position: absolute; top: -2rem; left: 0; width: max-content; background: #444; color: #fff; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; opacity: 0; transition: opacity 0.2s; pointer-events: none; white-space: nowrap; }
  button[disabled]:hover::after { opacity: 1; }
  .relative { position: relative; }
  .issue-detail { margin-top: 2rem; background-color: #1b1b1b; border-left: 4px solid #4fc3f7; padding: 1rem; border-radius: 6px; }
  .issue-header p { margin: 0.3rem 0; color: #ccc; }
  .issue-description, .issue-BDDSpecification { margin-top: 1rem; max-height: 200px; overflow-y: auto; background-color: #2d2d2d; padding: 1rem; border-radius: 6px; border-left: 4px solid #4fc3f7; }
  .issue-attachments { margin-top: 1rem; padding: 0.5rem 0; border-top: 1px dashed #4fc3f7; }
  .issue-attachments a { display: block; margin: 0.3rem 0; color: #64b5f6; text-decoration: none; }
  .issue-attachments a:hover { text-decoration: underline; }
  textarea { width: 95%; background-color: #111; color: #fff; padding: 1rem; border-radius: 6px; border: 1px solid #555; margin-top: 1rem; min-height: 150px; }
  .tooltip { position: relative; display: inline-block; }
  .tooltip .tooltiptext { visibility: hidden; width: 200px; background-color: #333; color: #fff; text-align: center; border-radius: 6px; padding: 0.5rem; position: absolute; z-index: 1; bottom: 125%; left: 50%; margin-left: -100px; opacity: 0; transition: opacity 0.3s; }
  .tooltip:hover .tooltiptext { visibility: visible; opacity: 1; }
  #iaResultado { margin-top: 2rem; background-color: #111; padding: 1rem; border-radius: 6px; white-space: pre-wrap; border-left: 4px solid #9ccc65; }
  #iaLoading { display: none; margin-top: 2rem; padding: 1rem; background-color: #111; border-left: 4px solid #fbc02d; border-radius: 6px; color: #fff176; font-style: italic; }
  </style>
  </head>
  <body>
  <div id="loading">
  <img src="https://cssbud.com/wp-content/uploads/2021/08/beepboop.gif" alt="Carregando..." />
  <p>🔄 Carregando dados do Jira...</p>
  </div>
  <div class="container">
  <h2 id="ola"></h2>
  
  <label>📁 Projeto Jira:</label>
  <select id="projetos"><option value="">Carregando...</option></select>
  
  <label for="issueKey">🔍 Buscar Issue:</label>
  <div class="relative">
    <input type="text" id="issueKey" placeholder="Ex: SGC-123" autocomplete="off" />
    <div id="autocompleteList"></div>
  </div>
  <button onclick="buscarIssue()">Buscar</button>
  
  <div id="mensagemErro" style="display: none; color: #ff4f4f; margin-top: 1rem;"></div>
  
  <div id="detalhesIssue" class="issue-detail" style="display:none;">
    <div id="issueHeader" class="issue-header"></div>
    <div id="issueDescription" class="issue-description"></div>
    <div id="issueBDDSpecification" class="issue-BDDSpecification"></div>
    <div id="issueAttachments" class="issue-attachments"></div>
  
    <button onclick="analisarIA()">🧠 Analisar com IA QA</button>
    <button onclick="abrirZephyr()" id="btnZephyrTopo" data-tooltip="👀 Veja o final da página após a análise">📝 Zephyr</button>
  
    <div id="iaLoading">🔍 A IA está analisando a sua issue...</div>
    <div id="iaResultado" style="display: none;"></div>
    <textarea id="iaTexto" style="display:none;"></textarea>
    <button id="btnEditarComentario" style="display:none;" onclick="habilitarEdicao()">✏️ Editar</button>
    <button id="btnEnviarComentario" style="display:none;" onclick="enviarComentarioIssue()">📤 Enviar comentários para a issue</button>
    <button id="btnZephyrFinal" style="display:none;" onclick="abrirZephyr()">📝 Zephyr</button>
  </div>
  </div>
  
  <script>
  const vscode = acquireVsCodeApi();
  let nomeRecebido = false;
  let projetosRecebidos = false;
  let timeout;
  let issueId;
  
  // ===== restauração de estado =====
  const state = vscode.getState();
  if (state?.nome) {
    document.getElementById('ola').textContent = '👋 Olá ' + state.nome;
    nomeRecebido = true;
  }
  if (state?.issue) {
    preencherDetalhesIssue(state.issue);
    document.getElementById('issueKey').value = state.issue.key || '';
  }
  // [ADD] restaura issueId salvo anteriormente (ou do objeto issue)
  if (state?.issueId) {
    issueId = state.issueId;
  } else if (state?.issue?.id) {
    issueId = state.issue.id;
  }
  
  if (state?.iaRespostaQa) {
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    document.getElementById('iaResultado').style.display = 'block';
    document.getElementById('iaResultado').innerHTML = '<h4>💡 Sugestões da IA:</h4>' + state.iaRespostaQa;
    document.getElementById('btnEditarComentario').style.display = 'inline-block';
    document.getElementById('btnEnviarComentario').style.display = 'inline-block';
    document.getElementById('btnZephyrFinal').style.display = 'inline-block';
  }
  
  vscode.postMessage({ type: 'carregarNome' });
  vscode.postMessage({ type: 'carregarProjetos' });
  
  function abrirZephyr() {
    const issueKey = document.getElementById('issueKey').value;
    const comentario = document.getElementById('iaTexto').value;
  
    if (comentario && comentario.trim() !== '') {
      vscode.postMessage({ type: 'openZephyr', issueId, issueKey, comentario });
    } else {
      const description = document.getElementById('issueDescription')?.innerText || '';
      const bddSpecification = document.getElementById('issueBDDSpecification')?.innerText || '';
      vscode.postMessage({ type: 'openZephyr', issueId, issueKey, description, bddSpecification });
    }
  }
  
  function enviarComentarioIssue() {
    const issueKey = document.getElementById('issueKey').value;
    const comentario = document.getElementById('iaTexto').value;
    vscode.postMessage({ type: 'enviarComentarioIa', issueKey, comentario });
  }
  function habilitarEdicao() { document.getElementById('iaTexto').style.display = 'block'; }
  function mostrarLoading() { document.getElementById('loading').style.display = 'block'; document.querySelector('.container').style.display = 'none'; }
  function esconderLoading() { document.getElementById('loading').style.display = 'none'; document.querySelector('.container').style.display = 'block'; }
  function mostrarMensagemErro(mensagem) { const e = document.getElementById('mensagemErro'); e.innerText = mensagem; e.style.display = 'block'; }
  function esconderMensagemErro() { const e = document.getElementById('mensagemErro'); e.innerText=''; e.style.display='none'; }
  
  function buscarIssue() {
    const issueKey = document.getElementById('issueKey').value.trim().toUpperCase();
    const selectedProjectKey = document.getElementById('projetos').value.trim().toUpperCase();
    esconderMensagemErro();
    if (!issueKey) return;
    const [prefix] = issueKey.split('-');
    if (prefix !== selectedProjectKey) {
      vscode.postMessage({ type: 'issuePrefixInvalido', issueKey, selectedProjectKey });
      return;
    }
    vscode.setState({ ...vscode.getState(), iaRespostaQa: undefined });
    document.getElementById('iaResultado').style.display = 'none';
    document.getElementById('iaResultado').innerHTML = '';
    mostrarLoading();
    vscode.postMessage({ type: 'buscarIssue', key: issueKey });
  }
  
  function tentarExibirConteudo() { if (nomeRecebido && projetosRecebidos) esconderLoading(); }
  
  function analisarIA() {
    const desc = document.getElementById('issueDescription')?.innerText || '';
    const bdd = document.getElementById('issueBDDSpecification')?.innerText || '';
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    document.getElementById('iaResultado').style.display = 'none';
    document.getElementById('iaLoading').style.display = 'block';
    vscode.postMessage({ type: 'analisarIA', description: desc, bdd });
  }
  
  function preencherDetalhesIssue(i) {
    const container = document.getElementById('detalhesIssue');
    const header = document.getElementById('issueHeader');
    const desc = document.getElementById('issueDescription');
    const bddSpecification = document.getElementById('issueBDDSpecification');
    const attach = document.getElementById('issueAttachments');
  
    if (!i) {
      header.innerHTML = "<p>❌ Issue não encontrada.</p>";
      desc.innerHTML = '';
      attach.innerHTML = '';
      return;
    }
  
    header.innerHTML = \`
      <h3>\${i.key}: \${i.summary}</h3>
      <p><strong>Status:</strong> \${i.status || '<i>Não informado</i>'}</p>
      <p><strong>Type:</strong> \${i.issuetype || '<i>Desconhecido</i>'}</p>
      <p><strong>Responsável:</strong> \${i.assignee || '<i>Não atribuído</i>'}</p>
      <p><strong>Reportado por:</strong> \${i.reporter || '<i>Desconhecido</i>'}</p>
    \`;
  
    desc.innerHTML = \`
      <p><strong>Descrição:</strong></p>
      <p>\${i.description || '<i>Sem descrição</i>'}</p>
    \`;
  
    function formatJiraText(text) {
      if (!text) return '<i>Sem descrição</i>';
      return text
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/^h1\\. (.*)$/gm, '<h3>$1</h3>')
        .replace(/^# (.*)$/gm, '<li>$1</li>')
        .replace(/^\\d+\\. (.*)$/gm, '<li>$1</li>')
        .replace(/\\n/g, '<br>');
    }
  
    bddSpecification.innerHTML = \`
      <p><strong>BDD Specification:</strong></p>
      <div>\${formatJiraText(i.bddSpecification)}</div>
    \`;
  
    attach.innerHTML = \`
      <p><strong>Anexos:</strong></p>
      \${
        Array.isArray(i.attachments) && i.attachments.length > 0
          ? i.attachments.map(att => \`<a href="\${att.url}" target="_blank">📎 \${att.filename}</a>\`).join('')
          : '<i>Sem anexos</i>'
      }
    \`;
  
    container.style.display = 'block';
  }
  
  window.addEventListener('message', event => {
    const message = event.data;
  
    if (message.type === 'nomeUsuario') {
      document.getElementById('ola').textContent = '👋 Olá ' + message.nome;
      nomeRecebido = true;
      vscode.setState({ ...vscode.getState(), nome: message.nome });
      tentarExibirConteudo();
    }
  
    if (message.type === 'listaProjetos') {
      const select = document.getElementById('projetos');
      select.innerHTML = '';
      message.projetos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
      if (state?.issue) { select.value = state.issue.key.split('-')[0]; }
      projetosRecebidos = true;
      tentarExibirConteudo();
    }
  
    if (message.type === 'sugestoesIssue') {
      const list = document.getElementById('autocompleteList');
      list.innerHTML = '';
      message.sugestoes.forEach(issue => {
        const div = document.createElement('div');
        div.textContent = issue.key + ' - ' + issue.summary;
        div.onclick = () => {
          document.getElementById('issueKey').value = issue.key;
          list.innerHTML = '';
          buscarIssue();
        };
        list.appendChild(div);
      });
    }
  
    if (message.type === 'erroIssue') {
      esconderLoading();
      mostrarMensagemErro(message.mensagem || '❌ Erro ao buscar a issue.');
      document.getElementById('detalhesIssue').style.display = 'none';
    }
  
    if (message.type === 'detalhesIssue') {
      esconderLoading();
      esconderMensagemErro();
  
      // [CHANGE] salva a issue inteira E o issueId no state
      const prev = vscode.getState() || {};
      vscode.setState({ ...prev, issue: message.issue, issueId: message.issue?.id }); // <-- salva issueId
  
      preencherDetalhesIssue(message.issue);
      document.getElementById('issueKey').value = message.issue.key;
  
      issueId = message.issue.id; // mantém variável local também
    }
  
    if (message.type === 'resultadoIA') {
      document.getElementById('iaLoading').style.display = 'none';
      const div = document.getElementById('iaResultado');
      div.style.display = 'block';
      div.innerHTML = '<h4>💡 Sugestões da IA:</h4>' + message.resultado;
      document.getElementById('iaTexto').value = message.resultado;
      document.getElementById('btnEditarComentario').style.display = 'inline-block';
      document.getElementById('btnEnviarComentario').style.display = 'inline-block';
      document.getElementById('btnZephyrFinal').style.display = 'inline-block';
      vscode.setState({ ...vscode.getState(), iaRespostaQa: message.resultado });
    }
  });
  
  document.getElementById('issueKey').addEventListener('input', (e) => {
    clearTimeout(timeout);
    const texto = e.target.value;
    const projeto = document.getElementById('projetos').value;
    if (texto.length < 2 || !projeto) return;
    timeout = setTimeout(() => {
      vscode.postMessage({ type: 'buscarSugestoesIssue', texto, projeto });
    }, 400);
  });
  
  document.getElementById('projetos').addEventListener('change', () => {
    document.getElementById('issueKey').value = '';
    document.getElementById('autocompleteList').innerHTML = '';
    document.getElementById('detalhesIssue').style.display = 'none';
    document.getElementById('mensagemErro').style.display = 'none';
    document.getElementById('iaResultado').style.display = 'none';
    document.getElementById('iaResultado').innerHTML = '';
  
    const zephyrButton = document.getElementById('btnZephyrTopo');
    if (zephyrButton) {
      zephyrButton.disabled = false;
      zephyrButton.classList.remove('disabled');
      zephyrButton.title = '';
      zephyrButton.style.opacity = '1';
    }
  
    document.getElementById('btnEditarComentario').style.display = 'none';
    document.getElementById('btnEnviarComentario').style.display = 'none';
    document.getElementById('btnZephyrFinal').style.display = 'none';
  
    // [CHANGE] ao trocar projeto, limpamos também o issueId do state
    const previousState = vscode.getState() || {};
    vscode.setState({ ...previousState, issue: undefined, issueId: undefined, iaRespostaQa: undefined });
  });
  </script>
  </body>
  </html>
  `;
  }
// export function getJiraViewContent(): string {
//   return `
//   <!DOCTYPE html>
//   <html lang="pt-br">
//   <head>
//   <meta charset="UTF-8" />
//   <style>
//   body {
//   font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
//   background-color: #1e1e1e;
//   color: #ffffff;
//   padding: 2rem;
//   }
//   .container {
//   background-color: #2d2d2d;
//   padding: 2rem;
//   border-radius: 10px;
//   max-width: 800px;
//   margin: 0 auto;
//   display: none;
//   }
//   #loading {
//   text-align: center;
//   font-size: 1.2rem;
//   margin-top: 100px;
//   }
//   #loading img {
//   width: 100px;
//   margin-bottom: 1rem;
//   }
//   h2 {
//   margin-top: 0;
//   color: #4fc3f7;
//   }
//   label {
//   display: block;
//   margin: 1.2rem 0 0.4rem;
//   font-weight: bold;
//   }
//   select, input[type="text"] {
//   width: 100%;
//   padding: 0.6rem;
//   border-radius: 6px;
//   border: none;
//   margin-bottom: 1rem;
//   background-color: #3c3c3c;
//   color: #ffffff;
//   }
//   #autocompleteList {
//   background-color: #3c3c3c;
//   border-radius: 6px;
//   max-height: 150px;
//   overflow-y: auto;
//   position: absolute;
//   z-index: 999;
//   width: 100%;
//   border: 1px solid #555;
//   }
//   #autocompleteList div {
//   padding: 8px;
//   border-bottom: 1px solid #555;
//   cursor: pointer;
//   }
//   #autocompleteList div:hover {
//   background-color: #555;
//   }
//   button {
//   background-color: #007acc;
//   color: white;
//   padding: 0.6rem 1rem;
//   border: none;
//   border-radius: 6px;
//   cursor: pointer;
//   margin-top: 0.5rem;
//   margin-right: 0.5rem;
//   transition: background-color 0.2s;
//   }
//   button:hover {
//   background-color: #005f9e;
//   }
//   button[disabled] {
//    background-color: #666 !important;
//    cursor: not-allowed;
//    position: relative;
//   }
//   button[disabled]::after {
//    content: attr(data-tooltip);
//    position: absolute;
//    top: -2rem;
//    left: 0;
//    width: max-content;
//    background: #444;
//    color: #fff;
//    padding: 4px 8px;
//    font-size: 0.8rem;
//    border-radius: 4px;
//    opacity: 0;
//    transition: opacity 0.2s;
//    pointer-events: none;
//    white-space: nowrap;
//   }
//   button[disabled]:hover::after {
//    opacity: 1;
//   }
//   .relative {
//   position: relative;
//   }
//   .issue-detail {
//   margin-top: 2rem;
//   background-color: #1b1b1b;
//   border-left: 4px solid #4fc3f7;
//   padding: 1rem;
//   border-radius: 6px;
//   }
//   .issue-header p {
//   margin: 0.3rem 0;
//   color: #ccc;
//   }
//   .issue-description, .issue-BDDSpecification {
//   margin-top: 1rem;
//   max-height: 200px;
//   overflow-y: auto;
//   background-color: #2d2d2d;
//   padding: 1rem;
//   border-radius: 6px;
//   border-left: 4px solid #4fc3f7;
//   }
//   .issue-attachments {
//   margin-top: 1rem;
//   padding: 0.5rem 0;
//   border-top: 1px dashed #4fc3f7;
//   }
//   .issue-attachments a {
//   display: block;
//   margin: 0.3rem 0;
//   color: #64b5f6;
//   text-decoration: none;
//   }
//   .issue-attachments a:hover {
//   text-decoration: underline;
//   }
//   textarea {
//     width: 95%;
//     background-color: #111;
//     color: #fff;
//     padding: 1rem;
//     border-radius: 6px;
//     border: 1px solid #555;
//     margin-top: 1rem;
//     min-height: 150px;
//   }
//   .tooltip {
//     position: relative;
//     display: inline-block;
//   }
// .tooltip .tooltiptext {
//  visibility: hidden;
//  width: 200px;
//  background-color: #333;
//  color: #fff;
//  text-align: center;
//  border-radius: 6px;
//  padding: 0.5rem;
//  position: absolute;
//  z-index: 1;
//  bottom: 125%;
//  left: 50%;
//  margin-left: -100px;
//  opacity: 0;
//  transition: opacity 0.3s;
// }
// .tooltip:hover .tooltiptext {
//  visibility: visible;
//  opacity: 1;
// }
//   #iaResultado {
//   margin-top: 2rem;
//   background-color: #111;
//   padding: 1rem;
//   border-radius: 6px;
//   white-space: pre-wrap;
//   border-left: 4px solid #9ccc65;
//   }
//   #iaLoading {
//   display: none;
//   margin-top: 2rem;
//   padding: 1rem;
//   background-color: #111;
//   border-left: 4px solid #fbc02d;
//   border-radius: 6px;
//   color: #fff176;
//   font-style: italic;
//   }
//   </style>
//   </head>
//   <body>
//   <div id="loading">
//   <img src="https://cssbud.com/wp-content/uploads/2021/08/beepboop.gif" alt="Carregando..." />
//   <p>🔄 Carregando dados do Jira...</p>
//   </div>
//   <div class="container">
//   <h2 id="ola"></h2>
//   <label>📁 Projeto Jira:</label>
//   <select id="projetos"><option value="">Carregando...</option></select>
//   <label for="issueKey">🔍 Buscar Issue:</label>
//   <div class="relative">
//   <input type="text" id="issueKey" placeholder="Ex: SGC-123" autocomplete="off" />
//   <div id="autocompleteList"></div>
//   </div>
//   <button onclick="buscarIssue()">Buscar</button>
//   <div id="mensagemErro" style="display: none; color: #ff4f4f; margin-top: 1rem;"></div>
//   <div id="detalhesIssue" class="issue-detail" style="display:none;">
//   <div id="issueHeader" class="issue-header"></div>
//   <div id="issueDescription" class="issue-description"></div>
//   <div id="issueBDDSpecification" class="issue-BDDSpecification"></div>
//   <div id="issueAttachments" class="issue-attachments"></div>
//   <button onclick="analisarIA()">🧠 Analisar com IA QA</button>
//   <button onclick="abrirZephyr()" id="btnZephyrTopo" data-tooltip="👀 Veja o final da página após a análise">📝 Zephyr</button>
//   <div id="iaLoading">🔍 A IA está analisando a sua issue...</div>
//   <div id="iaResultado" style="display: none;"></div>
//   <textarea id="iaTexto" style="display:none;"></textarea>
//   <button id="btnEditarComentario" style="display:none;" onclick="habilitarEdicao()">✏️ Editar</button>
//   <button id="btnEnviarComentario" style="display:none;" onclick="enviarComentarioIssue()">📤 Enviar comentários para a issue</button>
//   <button id="btnZephyrFinal" style="display:none;" onclick="abrirZephyr()">📝 Zephyr</button>
//   </div>
//   </div>
//   <script>
//   const vscode = acquireVsCodeApi();
//   let nomeRecebido = false;
//   let projetosRecebidos = false;
//   let timeout;
//   let issueId;
//   const state = vscode.getState();
//   if (state?.nome) {
//   document.getElementById('ola').textContent = '👋 Olá ' + state.nome;
//   nomeRecebido = true;
//   }
//   if (state?.issue) {
//   preencherDetalhesIssue(state.issue);
//   document.getElementById('issueKey').value = state.issue.key || '';
//   }
//   if (state?.iaRespostaQa) {
//     document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
//     document.getElementById('iaResultado').style.display = 'block';
//     document.getElementById('iaResultado').innerHTML = '<h4>💡 Sugestões da IA:</h4>' + state.iaRespostaQa;
//     document.getElementById('btnEditarComentario').style.display = 'inline-block';
//     document.getElementById('btnEnviarComentario').style.display = 'inline-block';
//     document.getElementById('btnZephyrFinal').style.display = 'inline-block';
//   }
//   vscode.postMessage({ type: 'carregarNome' });
//   vscode.postMessage({ type: 'carregarProjetos' });
//   function abrirZephyr() {
//     const issueKey = document.getElementById('issueKey').value;
//     const comentario = document.getElementById('iaTexto').value;
//     if (comentario && comentario.trim() !== '') {
//       // IA QA já rodou: envia o comentário como sugestão
//       vscode.postMessage({
//         type: 'openZephyr',
//         issueId,
//         issueKey,
//         comentario
//       });
//     } else {
//       // IA QA ainda não rodou: envia description + bddSpecification
//       const description = document.getElementById('issueDescription')?.innerText || '';
//       const bddSpecification = document.getElementById('issueBDDSpecification')?.innerText || '';
//       vscode.postMessage({
//         type: 'openZephyr',
//         issueId,
//         issueKey,
//         description,
//         bddSpecification
//       });
//     }
//   }
//   function enviarComentarioIssue() {
//     const issueKey = document.getElementById('issueKey').value;
//     const comentario = document.getElementById('iaTexto').value;
//     vscode.postMessage({ type: 'enviarComentarioIa', issueKey, comentario });
//   }
//   function habilitarEdicao() {
//     document.getElementById('iaTexto').style.display = 'block';
//   }
//   function mostrarLoading() {
//   document.getElementById('loading').style.display = 'block';
//   document.querySelector('.container').style.display = 'none';
//   }
//   function esconderLoading() {
//   document.getElementById('loading').style.display = 'none';
//   document.querySelector('.container').style.display = 'block';
//   }
//   function mostrarMensagemErro(mensagem) {
//   const erroBox = document.getElementById('mensagemErro');
//   erroBox.innerText = mensagem;
//   erroBox.style.display = 'block';
//   }
//   function esconderMensagemErro() {
//   const erroBox = document.getElementById('mensagemErro');
//   erroBox.innerText = '';
//   erroBox.style.display = 'none';
//   }
//   function buscarIssue() {
//   const issueKey = document.getElementById('issueKey').value.trim().toUpperCase();
//   const selectedProjectKey = document.getElementById('projetos').value.trim().toUpperCase();
//   esconderMensagemErro();
//   if (!issueKey) return;
//   const [prefix] = issueKey.split('-');
//   if (prefix !== selectedProjectKey) {
//   vscode.postMessage({ type: 'issuePrefixInvalido', issueKey, selectedProjectKey });
//   return;
//   }
//   vscode.setState({ ...vscode.getState(), iaRespostaQa: undefined }); // limpa sugestão ao mudar issue
//   document.getElementById('iaResultado').style.display = 'none';
//   document.getElementById('iaResultado').innerHTML = '';
//   mostrarLoading();
//   vscode.postMessage({ type: 'buscarIssue', key: issueKey });
//   }
//   function tentarExibirConteudo() {
//   if (nomeRecebido && projetosRecebidos) esconderLoading();
//   }
//   function analisarIA() {
//   const desc = document.getElementById('issueDescription')?.innerText || '';
//   const bdd = document.getElementById('issueBDDSpecification')?.innerText || '';
//   document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
//   document.getElementById('iaResultado').style.display = 'none';
//   document.getElementById('iaLoading').style.display = 'block';
//   vscode.postMessage({ type: 'analisarIA', description: desc, bdd });
//   }
//   function preencherDetalhesIssue(i) {
//   const container = document.getElementById('detalhesIssue');
//   const header = document.getElementById('issueHeader');
//   const desc = document.getElementById('issueDescription');
//   const bddSpecification = document.getElementById('issueBDDSpecification');
//   const attach = document.getElementById('issueAttachments');
//   if (!i) {
//   header.innerHTML = "<p>❌ Issue não encontrada.</p>";
//   desc.innerHTML = '';
//   attach.innerHTML = '';
//   return;
//   }
//   header.innerHTML = \`
//   <h3>\${i.key}: \${i.summary}</h3>
//   <p><strong>Status:</strong> \${i.status || '<i>Não informado</i>'}</p>
//   <p><strong>Type:</strong> \${i.issuetype || '<i>Desconhecido</i>'}</p>
//   <p><strong>Responsável:</strong> \${i.assignee || '<i>Não atribuído</i>'}</p>
//   <p><strong>Reportado por:</strong> \${i.reporter || '<i>Desconhecido</i>'}</p>
//   \`;
//   desc.innerHTML = \`
//   <p><strong>Descrição:</strong></p>
//   <p>\${i.description || '<i>Sem descrição</i>'}</p>
//   \`;
//   function formatJiraText(text) {
//   if (!text) return '<i>Sem descrição</i>';
//   return text
//   .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
//   .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
//   .replace(/^h1\\. (.*)$/gm, '<h3>$1</h3>')
//   .replace(/^# (.*)$/gm, '<li>$1</li>')
//   .replace(/^\\d+\\. (.*)$/gm, '<li>$1</li>')
//   .replace(/\\n/g, '<br>');
//   }
//   bddSpecification.innerHTML = \`
//   <p><strong>BDD Specification:</strong></p>
//   <div>\${formatJiraText(i.bddSpecification)}</div>
//   \`;
//   attach.innerHTML = \`
//   <p><strong>Anexos:</strong></p>
//   \${
//   Array.isArray(i.attachments) && i.attachments.length > 0
//   ? i.attachments.map(att => \`<a href="\${att.url}" target="_blank">📎 \${att.filename}</a>\`).join('')
//   : '<i>Sem anexos</i>'
//   }
//   \`;
//   container.style.display = 'block';
//   }
//   window.addEventListener('message', event => {
//   const message = event.data;
//   if (message.type === 'nomeUsuario') {
//   document.getElementById('ola').textContent = '👋 Olá ' + message.nome;
//   nomeRecebido = true;
//   vscode.setState({ ...vscode.getState(), nome: message.nome });
//   tentarExibirConteudo();
//   }
//   if (message.type === 'listaProjetos') {
//   const select = document.getElementById('projetos');
//   select.innerHTML = '';
//   message.projetos.forEach(p => {
//   const opt = document.createElement('option');
//   opt.value = p.key;
//   opt.textContent = p.name;
//   select.appendChild(opt);
//   });
//   if (state?.issue) {
//   select.value = state.issue.key.split('-')[0];
//   }
//   projetosRecebidos = true;
//   tentarExibirConteudo();
//   }
//   if (message.type === 'sugestoesIssue') {
//   const list = document.getElementById('autocompleteList');
//   list.innerHTML = '';
//   message.sugestoes.forEach(issue => {
//   const div = document.createElement('div');
//   div.textContent = issue.key + ' - ' + issue.summary;
//   div.onclick = () => {
//   document.getElementById('issueKey').value = issue.key;
//   list.innerHTML = '';
//   buscarIssue();
//   };
//   list.appendChild(div);
//   });
//   }
//   if (message.type === 'erroIssue') {
//   esconderLoading();
//   mostrarMensagemErro(message.mensagem || '❌ Erro ao buscar a issue.');
//   document.getElementById('detalhesIssue').style.display = 'none';
//   }
//   if (message.type === 'detalhesIssue') {
//   esconderLoading();
//   esconderMensagemErro();
//   vscode.setState({ ...vscode.getState(), issue: message.issue });
//   preencherDetalhesIssue(message.issue);
//   document.getElementById('issueKey').value = message.issue.key;
//   issueId = message.issue.id;
//   }
//   if (message.type === 'resultadoIA') {
//     document.getElementById('iaLoading').style.display = 'none';
//     const div = document.getElementById('iaResultado');
//     div.style.display = 'block';
//     div.innerHTML = '<h4>💡 Sugestões da IA:</h4>' + message.resultado;
//     document.getElementById('iaTexto').value = message.resultado;
//     document.getElementById('btnEditarComentario').style.display = 'inline-block';
//     document.getElementById('btnEnviarComentario').style.display = 'inline-block';
//     document.getElementById('btnZephyrFinal').style.display = 'inline-block';
//     vscode.setState({ ...vscode.getState(), iaRespostaQa: message.resultado });
//   }
//   });
//   document.getElementById('issueKey').addEventListener('input', (e) => {
//   clearTimeout(timeout);
//   const texto = e.target.value;
//   const projeto = document.getElementById('projetos').value;
//   if (texto.length < 2 || !projeto) return;
//   timeout = setTimeout(() => {
//   vscode.postMessage({ type: 'buscarSugestoesIssue', texto, projeto });
//   }, 400);
//   });
//   document.getElementById('projetos').addEventListener('change', () => {
//  document.getElementById('issueKey').value = '';
//  document.getElementById('autocompleteList').innerHTML = '';
//  document.getElementById('detalhesIssue').style.display = 'none';
//  document.getElementById('mensagemErro').style.display = 'none';
//  document.getElementById('iaResultado').style.display = 'none';
//  document.getElementById('iaResultado').innerHTML = '';
// // Restaurar estado inicial do botão Zephyr
//  const zephyrButton = document.getElementById('btnZephyrTopo');
//  if (zephyrButton) {
//    zephyrButton.disabled = false;
//    zephyrButton.classList.remove('disabled'); // caso use alguma classe para desabilitado
//    zephyrButton.title = ''; // remove tooltip de desabilitado
//    zephyrButton.style.opacity = '1'; // visualmente reativa
//  }
//  document.getElementById('btnEditarComentario').style.display = 'none';
//  document.getElementById('btnEnviarComentario').style.display = 'none';
//  document.getElementById('btnZephyrFinal').style.display = 'none';
//  // ⚠️ NÃO limpa o vscode.setState inteiro
//  const previousState = vscode.getState() || {};
//  vscode.setState({ ...previousState, issue: undefined, iaRespostaQa: undefined });
// });
//   </script>
//   </body>
//   </html>
//   `;
// }
