export function getJiraViewContent(): string {
  return `
  <!DOCTYPE html>
  <html lang="pt-br">
  <head>
  <meta charset="UTF-8" />
  <style>
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

  /* Mantém sua área atual */
  #iaResultado { margin-top: 2rem; background-color: #111; padding: 1rem; border-radius: 6px; white-space: pre-wrap; border-left: 4px solid #9ccc65; }
  #iaLoading { display: none; margin-top: 2rem; padding: 1rem; background-color: #111; border-left: 4px solid #fbc02d; border-radius: 6px; color: #fff176; font-style: italic; }

  /* ===== NOVO: cards bonitos, mas coerentes com seu visual ===== */
  .ai-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .ai-card { background: #161616; border: 1px solid #2a2a2a; border-radius: 10px; padding: 12px; }
  .ai-card h4 { margin: 0 0 8px; color: #9ccc65; font-size: 1rem; }
  .ai-muted { color: #c7c7c7; font-size: 0.92rem; }
  .ai-list { margin: 8px 0 0; padding-left: 18px; }
  .ai-row { display:flex; justify-content: space-between; align-items: center; gap: 10px; }
  .ai-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: .82rem; border: 1px solid #333; background: #222; }
  .ai-badge.ok { border-color: #2e7d32; background: rgba(46,125,50,0.15); }
  .ai-badge.warn { border-color: #e53935; background: rgba(229,57,53,0.12); }
  .ai-chips { display:flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .ai-chip { border: 1px solid #333; background: #202020; padding: 8px 10px; border-radius: 10px; min-width: 96px; }
  .ai-chip b { display:block; font-size: .78rem; color: #bdbdbd; margin-bottom: 2px; }
  .ai-pre { background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px; white-space: pre-wrap; overflow-x: auto; margin-top: 8px; }
  </style>
  </head>
  <body>
  <div id="loading">
    <img src="https://cssbud.com/wp-content/uploads/2021/08/beepboop.gif" alt="Carregando..." />
    <p>&#x1f504; Carregando dados do Jira...</p>
  </div>

  <div class="container">
    <h2 id="ola"></h2>

    <label>&#x1f4c1; Projeto Jira:</label>
    <select id="projetos"><option value="">Carregando...</option></select>

    <label for="issueKey">&#x1f50d; Buscar Issue:</label>
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

      <button onclick="analisarIA()">&#x1f9e0; Analisar com IA QA</button>
      <button onclick="abrirZephyr()" id="btnZephyrTopo" data-tooltip="&#x1f440; Veja o final da página após a análise">&#x1f4dd; Zephyr</button>

      <div id="iaLoading">&#x1f50d; A IA está analisando a sua issue...</div>
      <div id="iaResultado" style="display: none;"></div>

      <textarea id="iaTexto" style="display:none;"></textarea>
      <button id="btnEditarComentario" style="display:none;" onclick="habilitarEdicao()">✏️ Editar</button>
      <button id="btnEnviarComentario" style="display:none;" onclick="enviarComentarioIssue()">&#x1f4e4; Enviar comentários para a issue</button>
      <button id="btnZephyrFinal" style="display:none;" onclick="abrirZephyr()">&#x1f4dd; Zephyr</button>
    </div>
  </div>

  <script>
  const vscode = acquireVsCodeApi();
  let nomeRecebido = false;
  let projetosRecebidos = false;
  let timeout;
  let issueId;

  // ===== utils =====
  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function badgeForStatus(status) {
    const s = String(status || '');
    const ok = s.toLowerCase().includes('pronta');
    const cls = ok ? 'ok' : 'warn';
    return '<span class="ai-badge ' + cls + '">' + escapeHtml(status || '—') + '</span>';
  }

  function toMarkdownFromJson(payload) {
    const notas = payload?.notas || {};
    const invest = payload?.invest || {};
    const bdd = payload?.bdd || {};
    const parecer = payload?.parecer || {};
    const sug = payload?.sugestao_melhoria || {};

    const criteriosAceite =
      Array.isArray(sug?.criterios_aceite_gherkin) ? sug.criterios_aceite_gherkin :
      Array.isArray(sug?.criterios_aceite) ? sug.criterios_aceite :
      [];

    
    const estrategia = String(sug?.estrategia || 'manter_unica');
    const motivoEstrategia = sug?.motivo_estrategia ? String(sug.motivo_estrategia) : '';
    const fatiamento = Array.isArray(sug?.fatiamento) ? sug.fatiamento : [];

    const lines = [];

    lines.push('## &#x1f4a1; Sugestões da IA');
    lines.push('');

    lines.push('### 1) Notas por critério (1 a 5)');
    lines.push('- Clareza de requisitos funcionais: ' + (notas?.clareza_requisitos_funcionais?.nota ?? '—') + '/5 — ' + (notas?.clareza_requisitos_funcionais?.motivo ?? ''));
    lines.push('- Visão centrada no cliente: ' + (notas?.visao_centrada_no_cliente?.nota ?? '—') + '/5 — ' + (notas?.visao_centrada_no_cliente?.motivo ?? ''));
    lines.push('- Viabilidade de extração de cenários (funcional/E2E): ' + (notas?.viabilidade_cenarios_funcional_e2e?.nota ?? '—') + '/5 — ' + (notas?.viabilidade_cenarios_funcional_e2e?.motivo ?? ''));
    lines.push('');

    lines.push('### 2) INVEST (1 a 5 por letra)');
    ['I','N','V','E','S','T'].forEach(k => {
      const item = invest?.[k] || {};
      lines.push('- ' + k + ': ' + (item.nota ?? '—') + '/5 — ' + (item.motivo ?? ''));
    });
    lines.push('');

    lines.push('### 3) BDD');
    lines.push('- Avaliação: ' + (bdd?.avaliacao ?? '—') + ' — ' + (bdd?.motivo ?? ''));
    if (Array.isArray(bdd?.riscos_ambiguidades) && bdd.riscos_ambiguidades.length) {
      lines.push('- Riscos:');
      bdd.riscos_ambiguidades.forEach(r => lines.push('  - ' + r));
    }
    lines.push('');

    lines.push('### 4) Parecer de prontidão');
    lines.push('- Status: ' + (parecer?.status ?? '—'));
    if (Array.isArray(parecer?.lacunas_principais) && parecer.lacunas_principais.length) {
      lines.push('- Lacunas principais:');
      parecer.lacunas_principais.forEach(l => lines.push('  - ' + l));
    }
    if (Array.isArray(parecer?.perguntas_refinamento) && parecer.perguntas_refinamento.length) {
      lines.push('- Perguntas para refinamento:');
      parecer.perguntas_refinamento.forEach((p, idx) => lines.push('  ' + (idx+1) + '. ' + p));
    }
    lines.push('');

    lines.push('### 5) Classificação geral');
    lines.push(String(payload?.classificacao_geral ?? '—'));
    lines.push('');
    
    lines.push('### 6) Sugestão de melhoria');

    if (estrategia) {
      lines.push('**Estratégia:** ' + estrategia);
      if (motivoEstrategia) lines.push('**Motivo:** ' + motivoEstrategia);
      lines.push('');
    }

    if (sug?.nova_descricao) {
      lines.push('**Nova versão da Story:**');
      lines.push(String(sug.nova_descricao));
      lines.push('');
    }

    // ✅ NOVO: Premissas
    if (Array.isArray(sug?.premissas) && sug.premissas.length) {
      lines.push('**Premissas:**');
      sug.premissas.forEach(p => lines.push('- ' + p));
      lines.push('');
    }

    // ✅ NOVO: Benefício esperado
    if (sug?.beneficio_esperado) {
      lines.push('**Benefício esperado:**');
      lines.push(String(sug.beneficio_esperado));
      lines.push('');
    }

    if (criteriosAceite.length) {
      lines.push('**Critérios de aceite (Gherkin):**');
      criteriosAceite.forEach(c => lines.push('- ' + c));
      lines.push('');
    }

    return lines.join('\\n');
  }

  function renderAiFromJson(payload) {
    const notas = payload?.notas || {};
    const invest = payload?.invest || {};
    const bdd = payload?.bdd || {};
    const parecer = payload?.parecer || {};
    const sug = payload?.sugestao_melhoria || {};
    const estrategia = String(sug?.estrategia || 'manter_unica');
    const motivoEstrategia = sug?.motivo_estrategia ? String(sug.motivo_estrategia) : '';
    const fatiamento = Array.isArray(sug?.fatiamento) ? sug.fatiamento : [];

    const c1 = notas?.clareza_requisitos_funcionais || {};
    const c2 = notas?.visao_centrada_no_cliente || {};
    const c3 = notas?.viabilidade_cenarios_funcional_e2e || {};

    const statusBadge = badgeForStatus(parecer?.status);
    const classificacao = escapeHtml(payload?.classificacao_geral || '—');

    const riscos = Array.isArray(bdd?.riscos_ambiguidades) ? bdd.riscos_ambiguidades : [];
    const lacunas = Array.isArray(parecer?.lacunas_principais) ? parecer.lacunas_principais : [];
    const perguntas = Array.isArray(parecer?.perguntas_refinamento) ? parecer.perguntas_refinamento : [];

    // ✅ Novo schema + fallback legado (não quebra)
    const criteriosAceite =
      Array.isArray(sug?.criterios_aceite_gherkin) ? sug.criterios_aceite_gherkin :
      Array.isArray(sug?.criterios_aceite) ? sug.criterios_aceite :
      [];

    function chip(label, obj) {
      const nota = obj?.nota ?? '—';
      const motivo = obj?.motivo ? '<div class="ai-muted">' + escapeHtml(obj.motivo) + '</div>' : '';
      return (
        '<div class="ai-chip">' +
          '<b>' + escapeHtml(label) + '</b>' +
          '<span>' + escapeHtml(nota) + '/5</span>' +
          motivo +
        '</div>'
      );
    }
    
    const INVEST_LABELS = [
      { key: 'I', label: 'I - Independente' },
      { key: 'N', label: 'N - Negociável' },
      { key: 'V', label: 'V - Valiosa' },
      { key: 'E', label: 'E - Estimável' },
      { key: 'S', label: 'S - Pequena' },
      { key: 'T', label: 'T - Testável' }
    ];

    const investChips = INVEST_LABELS
      .map(({ key, label }) => chip(label, invest?.[key]))
      .join('');

    const notasList =
      '<ul class="ai-list" style="margin-top:8px">' +
        '<li><b>Clareza de requisitos funcionais</b>: ' + escapeHtml(c1?.nota ?? '—') + '/5 — <span class="ai-muted">' + escapeHtml(c1?.motivo ?? '') + '</span></li>' +
        '<li><b>Visão centrada no cliente</b>: ' + escapeHtml(c2?.nota ?? '—') + '/5 — <span class="ai-muted">' + escapeHtml(c2?.motivo ?? '') + '</span></li>' +
        '<li><b>Viabilidade de cenários (funcional/E2E)</b>: ' + escapeHtml(c3?.nota ?? '—') + '/5 — <span class="ai-muted">' + escapeHtml(c3?.motivo ?? '') + '</span></li>' +
      '</ul>';

    const bddRiscosHtml =
      riscos.length
        ? ('<ul class="ai-list" style="margin-top:8px">' + riscos.map(r => '<li>' + escapeHtml(r) + '</li>').join('') + '</ul>')
        : '<div class="ai-muted" style="margin-top:8px">Sem riscos listados.</div>';

    const lacunasHtml =
      lacunas.length
        ? ('<div style="margin-top:8px"><b>Lacunas:</b><ul class="ai-list">' + lacunas.map(l => '<li>' + escapeHtml(l) + '</li>').join('') + '</ul></div>')
        : '<div class="ai-muted" style="margin-top:8px">Sem lacunas listadas.</div>';

    const perguntasHtml =
      perguntas.length
        ? ('<div style="margin-top:10px"><b>Perguntas para refinamento:</b><ol class="ai-list">' + perguntas.map(p => '<li>' + escapeHtml(p) + '</li>').join('') + '</ol></div>')
        : '';

    const criteriosAceiteHtml =
      criteriosAceite.length
        ? (
            '<div style="margin-top:10px"><b>Critérios de aceite</b>' +
              criteriosAceite.map(c => {
                // mostra cada cenário em um bloco separado
                return '<div class="ai-pre" style="margin-top:8px">' + escapeHtml(c) + '</div>';
              }).join('') +
            '</div>'
          )
        : '';

    const novaDescricaoHtml =
      sug?.nova_descricao
        ? (
            '<div style="margin-top:8px"><b>Descrição</b>' +
              '<div class="ai-muted" style="margin-top:6px">' + escapeHtml(sug.nova_descricao) + '</div>' +
            '</div>'
          )
        : '<div class="ai-muted" style="margin-top:8px">Sem reescrita sugerida.</div>';

    const premissas = Array.isArray(sug?.premissas) ? sug.premissas : [];

    const premissasHtml =
      premissas.length
        ? ('<div style="margin-top:10px"><b>Premissas</b><ul class="ai-list">' + premissas.map(p => '<li>' + escapeHtml(p) + '</li>').join('') + '</ul></div>')
        : '';

    const beneficioEsperadoHtml =
      sug?.beneficio_esperado
        ? (
            '<div style="margin-top:10px"><b>Benefício esperado</b>' +
              '<div class="ai-muted" style="margin-top:6px">' + escapeHtml(sug.beneficio_esperado) + '</div>' +
            '</div>'
          )
        : '';

    const estrategiaHtml =
      estrategia
        ? (
            '<div class="ai-muted" style="margin-top:8px">' +
              '<b>Estratégia:</b> ' + escapeHtml(estrategia) +
              (motivoEstrategia ? ('<div class="ai-muted" style="margin-top:6px"><b>Motivo:</b> ' + escapeHtml(motivoEstrategia) + '</div>') : '') +
            '</div>'
          )
        : '';

    // Render do fatiamento (schema 1.2)
const fatiamentoHtml =
  (estrategia === 'fatiar')
    ? (() => {
        const fatiamentoSorted = fatiamento
          .slice()
          .sort((a, b) => Number(a?.ordem_sugerida ?? 0) - Number(b?.ordem_sugerida ?? 0));

        if (!fatiamentoSorted.length) {
          return '<div class="ai-muted" style="margin-top:10px">Fatiamento não fornecido pela IA.</div>';
        }

        function listBlock(title, arr) {
          const items = Array.isArray(arr) ? arr : [];
          if (!items.length) return '';
          return (
            '<div class="ai-muted" style="margin-top:8px">' +
              '<b>' + escapeHtml(title) + '</b>' +
              '<ul class="ai-list">' +
                items.map(x => '<li>' + escapeHtml(x) + '</li>').join('') +
              '</ul>' +
            '</div>'
          );
        }

        function gherkinBlock(cenarios) {
          const cs = Array.isArray(cenarios) ? cenarios : [];
          if (!cs.length) return '';
          return (
            '<div style="margin-top:8px"><b>Critérios de aceite (Gherkin):</b>' +
              cs.map(c => '<div class="ai-pre" style="margin-top:8px">' + escapeHtml(c) + '</div>').join('') +
            '</div>'
          );
        }

        return (
          '<div style="margin-top:10px">' +
            '<b>Fatiamento sugerido</b>' +
            fatiamentoSorted.map((fat, idx) => {
              const ordem = fat?.ordem_sugerida ?? (idx + 1);
              const titulo = fat?.titulo ?? '—';
              const story = fat?.story ?? '';
              const valor = fat?.valor ?? '';

              return (
                '<div class="ai-card" style="margin-top:10px">' +
                  '<h4 style="margin:0;color:#9ccc65">#' + escapeHtml(ordem) + ' — ' + escapeHtml(titulo) + '</h4>' +
                  (story ? '<div class="ai-muted" style="margin-top:6px"><b>Story:</b> ' + escapeHtml(story) + '</div>' : '') +
                  (valor ? '<div class="ai-muted" style="margin-top:6px"><b>Valor:</b> ' + escapeHtml(valor) + '</div>' : '') +
                  listBlock('Inclui:', fat?.escopo_in) +
                  listBlock('Fora do escopo:', fat?.escopo_out) +
                  listBlock('Premissas:', fat?.premissas) +
                  gherkinBlock(fat?.criterios_aceite_gherkin) +
                '</div>'
              );
            }).join('') +
          '</div>'
        );
      })()
    : '';

    const conteudoSugestaoHtml =
  estrategiaHtml +
  (estrategia === 'fatiar'
    ? fatiamentoHtml
    : (novaDescricaoHtml + beneficioEsperadoHtml + premissasHtml + criteriosAceiteHtml)
  );
     
    
    const html =
      '<div class="ai-grid">' +

        '<div class="ai-card">' +
          '<details open>' +
            '<summary><b>Resumo</b></summary>' +
            '<div style="margin-top:8px">' +
              '<div class="ai-row">' +
                '<div class="ai-muted">Status</div>' +
                statusBadge +
              '</div>' +
              '<div class="ai-muted" style="margin-top:6px">Classificação geral: <b>' + classificacao + '</b></div>' +
            '</div>' +
          '</details>' +
        '</div>' +

        '<div class="ai-card">' +
          '<details>' +
            '<summary><b>Notas por critério</b></summary>' +
            notasList +
          '</details>' +
        '</div>' +

        '<div class="ai-card">' +
          '<details>' +
            '<summary><b>INVEST</b></summary>' +
            '<div class="ai-chips" style="margin-top:8px">' + investChips + '</div>' +
          '</details>' +
        '</div>' +

        '<div class="ai-card">' +
          '<details>' +
            '<summary><b>BDD</b></summary>' +
            '<div class="ai-muted" style="margin-top:8px"><b>Avaliação:</b> ' + escapeHtml(bdd?.avaliacao ?? '—') + ' — ' + escapeHtml(bdd?.motivo ?? '') + '</div>' +
            bddRiscosHtml +
          '</details>' +
        '</div>' +

        '<div class="ai-card">' +
          '<details>' +
            '<summary><b>Parecer de prontidão</b></summary>' +
            lacunasHtml +
            perguntasHtml +
          '</details>' +
        '</div>' +

        '<div class="ai-card">' +
          '<details>' +
            '<summary><b>Sugestão de melhoria</b></summary>' +
            conteudoSugestaoHtml +
          '</details>' +
        '</div>' +

      '</div>';

    return { html, markdown: toMarkdownFromJson(payload) };
  }

  // ===== restauração de estado =====
  const state = vscode.getState();
  if (state?.nome) {
    document.getElementById('ola').textContent = '&#x1f44b; Olá ' + state.nome;
    nomeRecebido = true;
  }
  if (state?.issue) {
    preencherDetalhesIssue(state.issue);
    document.getElementById('issueKey').value = state.issue.key || '';
  }
  if (state?.issueId) {
    issueId = state.issueId;
  } else if (state?.issue?.id) {
    issueId = state.issue.id;
  }

  // Novo: restaura JSON se existir; senão, legado
  if (state?.iaRespostaQaJson) {
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    const div = document.getElementById('iaResultado');
    div.style.display = 'block';
    const rendered = renderAiFromJson(state.iaRespostaQaJson);
    div.innerHTML = '<h4>&#x1f4a1; Sugestões da IA:</h4>' + rendered.html;
    document.getElementById('iaTexto').value = rendered.markdown;
    document.getElementById('btnEditarComentario').style.display = 'inline-block';
    document.getElementById('btnEnviarComentario').style.display = 'inline-block';
    document.getElementById('btnZephyrFinal').style.display = 'inline-block';
  } else if (state?.iaRespostaQa) {
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    document.getElementById('iaResultado').style.display = 'block';
    document.getElementById('iaResultado').innerHTML = '<h4>&#x1f4a1; Sugestões da IA:</h4>' + state.iaRespostaQa;
    document.getElementById('iaTexto').value = state.iaRespostaQa;
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

    const prev = vscode.getState() || {};
    vscode.setState({ ...prev, iaRespostaQa: undefined, iaRespostaQaJson: undefined });

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
          ? i.attachments.map(att => \`<a href="\${att.url}" target="_blank">&#x1f4ce; \${att.filename}</a>\`).join('')
          : '<i>Sem anexos</i>'
      }
    \`;

    container.style.display = 'block';
  }

  window.addEventListener('message', event => {
    const message = event.data;

    if (message.type === 'nomeUsuario') {
      document.getElementById('ola').textContent = '&#x1f44b; Olá ' + message.nome;
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

      const prev = vscode.getState() || {};
      vscode.setState({ ...prev, issue: message.issue, issueId: message.issue?.id });

      preencherDetalhesIssue(message.issue);
      document.getElementById('issueKey').value = message.issue.key;

      issueId = message.issue.id;
    }

    if (message.type === 'resultadoIA') {
      document.getElementById('iaLoading').style.display = 'none';
      const div = document.getElementById('iaResultado');
      div.style.display = 'block';

      // ✅ Novo: se vier JSON, renderiza bonito; se não, mantém comportamento atual
      if (message.resultadoJson && typeof message.resultadoJson === 'object') {
        const rendered = renderAiFromJson(message.resultadoJson);
        div.innerHTML = '<h4>&#x1f4a1; Sugestões da IA:</h4>' + rendered.html;
        document.getElementById('iaTexto').value = rendered.markdown;
        vscode.setState({
          ...vscode.getState(),
          iaRespostaQa: message.resultado,          // backup/raw
          iaRespostaQaJson: message.resultadoJson   // principal
        });
      } else {
        div.innerHTML = '<h4>&#x1f4a1; Sugestões da IA:</h4>' + message.resultado;
        document.getElementById('iaTexto').value = message.resultado;
        vscode.setState({ ...vscode.getState(), iaRespostaQa: message.resultado, iaRespostaQaJson: undefined });
      }

      document.getElementById('btnEditarComentario').style.display = 'inline-block';
      document.getElementById('btnEnviarComentario').style.display = 'inline-block';
      document.getElementById('btnZephyrFinal').style.display = 'inline-block';
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

    const previousState = vscode.getState() || {};
    vscode.setState({ ...previousState, issue: undefined, issueId: undefined, iaRespostaQa: undefined, iaRespostaQaJson: undefined });
  });
  </script>
  </body>
  </html>
  `;
}