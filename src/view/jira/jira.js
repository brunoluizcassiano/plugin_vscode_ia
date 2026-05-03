const vscode = acquireVsCodeApi();
let nomeRecebido = false;
let projetosRecebidos = false;
let timeout;
let issueId;

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
    const lines = [];

    lines.push('## Sugestões da IA');
    lines.push('');
    lines.push('### 1) Notas por critério (1 a 5)');
    lines.push('- Clareza de requisitos funcionais: ' + (notas?.clareza_requisitos_funcionais?.nota ?? '—') + '/5 — ' + (notas?.clareza_requisitos_funcionais?.motivo ?? ''));
    lines.push('- Visão centrada no cliente: ' + (notas?.visao_centrada_no_cliente?.nota ?? '—') + '/5 — ' + (notas?.visao_centrada_no_cliente?.motivo ?? ''));
    lines.push('- Viabilidade de extração de cenários (funcional/E2E): ' + (notas?.viabilidade_cenarios_funcional_e2e?.nota ?? '—') + '/5 — ' + (notas?.viabilidade_cenarios_funcional_e2e?.motivo ?? ''));
    lines.push('');
    lines.push('### 2) INVEST (1 a 5 por letra)');
    ['I', 'N', 'V', 'E', 'S', 'T'].forEach(k => {
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
        parecer.perguntas_refinamento.forEach((p, idx) => lines.push('  ' + (idx + 1) + '. ' + p));
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

    if (Array.isArray(sug?.premissas) && sug.premissas.length) {
        lines.push('**Premissas:**');
        sug.premissas.forEach(p => lines.push('- ' + p));
        lines.push('');
    }

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

    return lines.join('\n');
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
                criteriosAceite.map(c => '<div class="ai-pre" style="margin-top:8px">' + escapeHtml(c) + '</div>').join('') +
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

const state = vscode.getState();
if (state?.nome) {
    document.getElementById('ola').textContent = 'Olá ' + state.nome;
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

if (state?.iaRespostaQaJson) {
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    const div = document.getElementById('iaResultado');
    div.style.display = 'block';
    div.classList.add('ai-ready');
    const rendered = renderAiFromJson(state.iaRespostaQaJson);
    div.innerHTML = '<h4>Sugestões da IA</h4>' + rendered.html;
    document.getElementById('iaTexto').value = rendered.markdown;
    document.getElementById('btnEditarComentario').style.display = 'inline-block';
    document.getElementById('btnEnviarComentario').style.display = 'inline-block';
    document.getElementById('btnZephyrFinal').style.display = 'inline-block';
} else if (state?.iaRespostaQa) {
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    document.getElementById('iaResultado').style.display = 'block';
    document.getElementById('iaResultado').classList.add('ai-ready');
    document.getElementById('iaResultado').innerHTML = '<h4>Sugestões da IA</h4>' + state.iaRespostaQa;
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

function habilitarEdicao() {
    document.getElementById('iaTexto').style.display = 'block';
}

function mostrarLoading() {
    document.getElementById('loading').style.display = 'block';
    document.querySelector('.container').style.display = 'none';
}

function esconderLoading() {
    document.getElementById('loading').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
}

function mostrarMensagemErro(mensagem) {
    const e = document.getElementById('mensagemErro');
    e.innerText = mensagem;
    e.style.display = 'block';
}

function esconderMensagemErro() {
    const e = document.getElementById('mensagemErro');
    e.innerText = '';
    e.style.display = 'none';
}

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

function tentarExibirConteudo() {
    if (nomeRecebido && projetosRecebidos) esconderLoading();
}

function analisarIA() {
    const desc = document.getElementById('issueDescription')?.innerText || '';
    const bdd = document.getElementById('issueBDDSpecification')?.innerText || '';
    document.getElementById('btnZephyrTopo').setAttribute('disabled', 'true');
    document.getElementById('iaResultado').style.display = 'none';
    document.getElementById('iaResultado').classList.remove('ai-ready');
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
        header.innerHTML = '<p>Issue não encontrada.</p>';
        desc.innerHTML = '';
        attach.innerHTML = '';
        return;
    }

    header.innerHTML = `
    <h3>${i.key}: ${i.summary}</h3>
    <p><strong>Status:</strong> ${i.status || '<i>Não informado</i>'}</p>
    <p><strong>Type:</strong> ${i.issuetype || '<i>Desconhecido</i>'}</p>
    <p><strong>Responsável:</strong> ${i.assignee || '<i>Não atribuído</i>'}</p>
    <p><strong>Reportado por:</strong> ${i.reporter || '<i>Desconhecido</i>'}</p>
  `;

    desc.innerHTML = `
    <p><strong>Descrição:</strong></p>
    <p>${i.description || '<i>Sem descrição</i>'}</p>
  `;

    function formatJiraText(text) {
        if (!text) return '<i>Sem descrição</i>';
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^h1\. (.*)$/gm, '<h3>$1</h3>')
            .replace(/^# (.*)$/gm, '<li>$1</li>')
            .replace(/^\d+\. (.*)$/gm, '<li>$1</li>')
            .replace(/\n/g, '<br>');
    }

    bddSpecification.innerHTML = `
    <p><strong>BDD Specification:</strong></p>
    <div>${formatJiraText(i.bddSpecification)}</div>
  `;

    attach.innerHTML = `
    <p><strong>Anexos:</strong></p>
    ${Array.isArray(i.attachments) && i.attachments.length > 0
            ? i.attachments.map(att => `<a href="${att.url}" target="_blank">${att.filename}</a>`).join('')
            : '<i>Sem anexos</i>'
        }
  `;

    container.style.display = 'block';
}

window.addEventListener('message', event => {
    const message = event.data;

    if (message.type === 'nomeUsuario') {
        document.getElementById('ola').textContent = 'Olá ' + message.nome;
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
        if (state?.issue) {
            select.value = state.issue.key.split('-')[0];
        }
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
        mostrarMensagemErro(message.mensagem || 'Erro ao buscar a issue.');
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
        div.classList.add('ai-ready');

        if (message.resultadoJson && typeof message.resultadoJson === 'object') {
            const rendered = renderAiFromJson(message.resultadoJson);
            div.innerHTML = '<h4>Sugestões da IA</h4>' + rendered.html;
            document.getElementById('iaTexto').value = rendered.markdown;
            vscode.setState({
                ...vscode.getState(),
                iaRespostaQa: message.resultado,
                iaRespostaQaJson: message.resultadoJson
            });
        } else {
            div.innerHTML = '<h4>Sugestões da IA</h4>' + message.resultado;
            document.getElementById('iaTexto').value = message.resultado;
            vscode.setState({ ...vscode.getState(), iaRespostaQa: message.resultado, iaRespostaQaJson: undefined });
        }

        document.getElementById('btnEditarComentario').style.display = 'inline-block';
        document.getElementById('btnEnviarComentario').style.display = 'inline-block';
        document.getElementById('btnZephyrFinal').style.display = 'inline-block';
    }
});

document.getElementById('issueKey').addEventListener('input', e => {
    clearTimeout(timeout);
    const texto = e.target.value;
    const projeto = document.getElementById('projetos').value;
    if (texto.length < 2 || !projeto) return;
    timeout = setTimeout(() => {
        vscode.postMessage({ type: 'buscarSugestoesIssue', texto, projeto });
    }, 400);
});

document.getElementById('btnBuscarIssue')?.addEventListener('click', buscarIssue);
document.getElementById('btnAnalisarIa')?.addEventListener('click', analisarIA);
document.getElementById('btnZephyrTopo')?.addEventListener('click', abrirZephyr);
document.getElementById('btnEditarComentario')?.addEventListener('click', habilitarEdicao);
document.getElementById('btnEnviarComentario')?.addEventListener('click', enviarComentarioIssue);
document.getElementById('btnZephyrFinal')?.addEventListener('click', abrirZephyr);

document.getElementById('projetos').addEventListener('change', () => {
    document.getElementById('issueKey').value = '';
    document.getElementById('autocompleteList').innerHTML = '';
    document.getElementById('detalhesIssue').style.display = 'none';
    document.getElementById('mensagemErro').style.display = 'none';
    document.getElementById('iaResultado').style.display = 'none';
    document.getElementById('iaResultado').classList.remove('ai-ready');
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

window.abrirZephyr = abrirZephyr;
window.enviarComentarioIssue = enviarComentarioIssue;
window.habilitarEdicao = habilitarEdicao;
window.buscarIssue = buscarIssue;
window.analisarIA = analisarIA;
