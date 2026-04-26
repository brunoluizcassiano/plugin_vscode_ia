"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const vscode = __importStar(require("vscode"));
const homeViewProvider_1 = require("./homeViewProvider");
const jiraPanel_1 = require("./panel/jiraPanel");
const zephyrPanel_1 = require("./panel/zephyrPanel");
const backendPanel_1 = require("./panel/backendPanel");
const settingsPanel_1 = require("./panel/settingsPanel");
const copilotLmBridge_1 = require("./copilot/copilotLmBridge");
const prompts_1 = require("./prompts");
let globalToken = null;
let globalThreadId = null;
// === GitHub Login: helpers/estado ===
const GH_SCOPES = ['read:user', 'user:email'];
let ghStatusItem;
function getStoredGitHubUser(context) {
    return context.globalState.get('plugin.github.user');
}
function fetchGitHubUser(accessToken) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' };
        const userRes = yield (0, node_fetch_1.default)('https://api.github.com/user', { headers });
        if (!userRes.ok)
            throw new Error(`Falha ao obter usuário do GitHub: ${userRes.status}`);
        const user = yield userRes.json();
        let email = user.email;
        if (!email) {
            // tenta buscar e-mail primário (público/privado)
            const emailRes = yield (0, node_fetch_1.default)('https://api.github.com/user/emails', { headers });
            if (emailRes.ok) {
                const emails = yield emailRes.json();
                const primary = Array.isArray(emails) ? emails.find((e) => e.primary) : undefined;
                email = (primary === null || primary === void 0 ? void 0 : primary.email) || ((_a = emails === null || emails === void 0 ? void 0 : emails[0]) === null || _a === void 0 ? void 0 : _a.email);
            }
        }
        return {
            login: user.login,
            name: user.name || undefined,
            email,
            avatar_url: user.avatar_url || undefined,
            html_url: user.html_url || undefined,
            id: user.id || undefined,
        };
    });
}
function showOrUpdateGitHubStatus(user) {
    if (!ghStatusItem) {
        ghStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        ghStatusItem.command = 'plugin-vscode.refreshGitHubSession';
    }
    if (user === null || user === void 0 ? void 0 : user.login) {
        ghStatusItem.text = `$(github) ${user.login}`;
        ghStatusItem.tooltip = user.name ? `GitHub: ${user.name}` : 'GitHub conectado';
    }
    else {
        ghStatusItem.text = '$(github) Entrar no GitHub';
        ghStatusItem.tooltip = 'Clique para conectar sua conta do GitHub';
    }
    ghStatusItem.show();
}
function ensureGitHubSession(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const interactive = !!(opts === null || opts === void 0 ? void 0 : opts.interactive);
        const silent = !!(opts === null || opts === void 0 ? void 0 : opts.silent);
        // 1) Tenta silencioso primeiro (não abre UI)
        if (silent) {
            const s = yield vscode.authentication.getSession('github', GH_SCOPES, { createIfNone: false, silent: true });
            if (s)
                return s;
        }
        // 2) Se pedir interativo, força criar sessão (abre UI de login)
        if (interactive) {
            return vscode.authentication.getSession('github', GH_SCOPES, { createIfNone: true });
        }
        // 3) Por padrão, tenta pegar sem criar (não abre UI)
        return vscode.authentication.getSession('github', GH_SCOPES, { createIfNone: false });
    });
}
function identifyGitHubOnStartup(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const aiProvider = vscode.workspace.getConfiguration().get('plugin.ai.provider', 'auto');
        if (aiProvider !== 'copilot') {
            showOrUpdateGitHubStatus(undefined);
            return;
        }
        try {
            // tenta silencioso
            let session = yield ensureGitHubSession({ silent: true });
            if (!session) {
                // Oferece entrar agora para não "forçar" popup automaticamente
                const choice = yield vscode.window.showInformationMessage('Para personalizar a experiência, conecte seu GitHub.', 'Entrar no GitHub', 'Agora não');
                if (choice === 'Entrar no GitHub') {
                    session = yield ensureGitHubSession({ interactive: true });
                }
            }
            if (session) {
                const ghUser = yield fetchGitHubUser(session.accessToken);
                yield context.globalState.update('plugin.github.user', ghUser);
                console.log('🔐 GitHub conectado como:', ghUser.login);
                console.log('🔐 GitHub conectado com accessToken:', session.accessToken);
                showOrUpdateGitHubStatus(ghUser);
            }
            else {
                // sem sessão
                yield context.globalState.update('plugin.github.user', undefined);
                showOrUpdateGitHubStatus(undefined);
            }
        }
        catch (err) {
            console.warn('⚠️ Não foi possível identificar o login do GitHub:', (err === null || err === void 0 ? void 0 : err.message) || err);
            showOrUpdateGitHubStatus(undefined);
        }
    });
}
function getProjectMap() {
    return vscode.workspace.getConfiguration().get('plugin.projectMap', {});
}
function getStrict() {
    return vscode.workspace.getConfiguration().get('plugin.projectMap.strict', false);
}
function jiraKeyFrom(input) {
    const k = (input || '').includes('-') ? input.split('-')[0] : input;
    return (k || '').trim().toUpperCase();
}
/** Resolve projeto Zephyr a partir de issueKey/projeto. Não lança; devolve null se não conseguir. */
function tryResolveZephyrProject(input) {
    const jiraKey = jiraKeyFrom(input);
    if (!jiraKey)
        return null;
    const map = getProjectMap();
    const raw = map[jiraKey];
    if (!raw) {
        if (getStrict())
            return null; // strict ligado e sem de/para → pedir ação ao usuário
        return { zephyrKey: jiraKey }; // fallback: usa o próprio key do Jira
    }
    if (typeof raw === 'string')
        return { zephyrKey: raw.toUpperCase() };
    return {
        zephyrKey: String(raw.zephyrKey || jiraKey).toUpperCase(),
        zephyrProjectId: raw.zephyrProjectId
    };
}
/** Se não der para resolver, pergunta ao usuário (input + botões). */
function resolveProjectOrPrompt(originLabel, issueOrProject) {
    return __awaiter(this, void 0, void 0, function* () {
        let project = tryResolveZephyrProject(issueOrProject !== null && issueOrProject !== void 0 ? issueOrProject : '');
        if (project)
            return project;
        const jiraKey = jiraKeyFrom(issueOrProject !== null && issueOrProject !== void 0 ? issueOrProject : '');
        const opts = ['Informar projeto…', 'Abrir Settings', getStrict() ? 'Desativar strict agora' : undefined]
            .filter(Boolean);
        const pick = yield vscode.window.showWarningMessage(`Projeto ${jiraKey ? `'${jiraKey}'` : '(vazio)'} sem de/para e modo estrito ${getStrict() ? 'ligado' : 'desligado'}.`, ...opts);
        if (pick === 'Desativar strict agora') {
            yield vscode.workspace.getConfiguration().update('plugin.projectMap.strict', false, vscode.ConfigurationTarget.Global);
            project = tryResolveZephyrProject(issueOrProject !== null && issueOrProject !== void 0 ? issueOrProject : '');
            if (project)
                return project;
        }
        if (pick === 'Abrir Settings') {
            yield vscode.commands.executeCommand('workbench.action.openSettingsJson');
            throw new Error(`[${originLabel}] Ação cancelada: abra as configurações e crie o de/para.`);
        }
        if (pick === 'Informar projeto…') {
            const typed = yield vscode.window.showInputBox({
                prompt: 'Informe o key do projeto Jira (ex.: TBTX) ou uma issue (ex.: TBTX-123)',
                placeHolder: 'TBTX ou TBTX-123',
                ignoreFocusOut: true
            });
            project = tryResolveZephyrProject(typed !== null && typed !== void 0 ? typed : '');
            if (!project)
                throw new Error(`[${originLabel}] Não foi possível resolver o projeto a partir de "${typed !== null && typed !== void 0 ? typed : ''}".`);
            return project;
        }
        throw new Error(`[${originLabel}] Ação cancelada pelo usuário.`);
    });
}
/** Monta URL com projectKey ou projectId, conforme disponível. */
function withProjectParam(baseUrl, project) {
    const url = new URL(baseUrl);
    if (project.zephyrProjectId)
        url.searchParams.set('projectId', String(project.zephyrProjectId));
    else
        url.searchParams.set('projectKey', project.zephyrKey);
    return url.toString();
}
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('✅ Plugin "Form Plugin" está sendo ativado...');
        // Criação da instância da HomeViewProvider
        const homeViewProvider = new homeViewProvider_1.HomeViewProvider(context.extensionUri);
        // Registro da webview com o ID que deve coincidir com o package.json
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('homeView', // << TEM QUE BATER COM O ID DO `package.json`
        homeViewProvider));
        console.log('✅ HomeViewProvider registrada.');
        // === GitHub Login: identifica somente quando Copilot estiver selecionado
        void identifyGitHubOnStartup(context);
        // Observa mudanças na sessão do GitHub (login/logout em outro lugar)
        context.subscriptions.push(vscode.authentication.onDidChangeSessions((e) => __awaiter(this, void 0, void 0, function* () {
            if (e.provider.id === 'github') {
                yield identifyGitHubOnStartup(context);
            }
        })));
        // O foco da visualização deve ser feito manualmente ou em resposta a um comando.
        // Por padrão não forçamos a abertura/foco da view ao iniciar — controlado por plugin.openOnStart
        try {
            const openOnStart = vscode.workspace.getConfiguration().get('plugin.openOnStart', false);
            if (openOnStart) {
                yield vscode.commands.executeCommand('workbench.view.extension.formSidebar');
                yield vscode.commands.executeCommand('homeView.focus', { preserveFocus: true });
            }
        }
        catch (e) {
            // não bloquear ativação em caso de erro ao ler config
            console.warn('Erro ao checar plugin.openOnStart:', e);
        }
        // Registro dos comandos
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.openJira', () => {
            jiraPanel_1.JiraPanel.createOrShow(context.extensionUri);
        }));
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.openZephyr', (issueId, issueKey, comentario, description, bddSpecification) => {
            if (!comentario) {
                comentario = `Descrição:\n${description}\n\nEspecificação BDD:\n${bddSpecification}`;
            }
            zephyrPanel_1.ZephyrPanel.createOrShow(context.extensionUri, issueId, issueKey, comentario);
        }));
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.backend', () => {
            backendPanel_1.BackendPanel.createOrShow(context.extensionUri);
        }));
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.settings', () => {
            settingsPanel_1.SettingsPanel.createOrShow(context.extensionUri);
        }));
        // Comando para obter o nome do usuário logado no Jira
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraUser', () => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            try {
                const response = yield (0, node_fetch_1.default)(`https://${jiraDomain}/rest/api/2/myself`, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                });
                const data = yield response.json();
                return data.displayName || data.name;
            }
            catch (err) {
                vscode.window.showErrorMessage('Erro ao conectar no Jira: ' + err.message);
                return 'usuário';
            }
        })));
        // Projetos Jira (exemplo com filtro fixo que você usa)
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraProjects', () => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken, jiraProjectCategoryId } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            try {
                const projectUrl = jiraProjectCategoryId
                    ? `https://${jiraDomain}/rest/api/3/project/search?categoryId=${encodeURIComponent(jiraProjectCategoryId)}`
                    : `https://${jiraDomain}/rest/api/3/project`;
                const response = yield (0, node_fetch_1.default)(projectUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                });
                const data = yield response.json();
                const projects = Array.isArray(data === null || data === void 0 ? void 0 : data.values)
                    ? data.values
                    : Array.isArray(data)
                        ? data
                        : [];
                return projects.map((p) => ({ key: p.key, name: p.name }));
                // return data.map((p: any) => ({ key: p.key, name: p.name }));
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar projetos do Jira: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return [];
            }
        })));
        // ✅ Método para enviar comentário para a issue:
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.enviarComentarioIssue', (issueKey, comentario) => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}/comment`;
            const body = JSON.stringify({
                body: comentario,
            });
            try {
                const response = yield (0, node_fetch_1.default)(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body,
                });
                if (!response.ok) {
                    const erroTexto = yield response.text();
                    throw new Error(`Erro ao enviar comentário: ${response.status} - ${erroTexto}`);
                }
                vscode.window.showInformationMessage(`✅ Comentário enviado com sucesso para a issue ${issueKey}`);
            }
            catch (err) {
                vscode.window.showErrorMessage(`❌ Falha ao enviar comentário para a issue ${issueKey}: ${err.message}`);
            }
        })));
        // 🔍 Comando para buscar sugestões de issues com base no summary
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.buscarSugestoesIssue', (texto, projectKey) => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            const term = (texto || '').trim();
            // Tipos permitidos
            const allowedTypesJQL = 'issuetype in ("Functionality", "Funcionalidade", "Epic","Story", "História")';
            const isFullKey = /^[A-Z][A-Z0-9_]*-\d+$/i.test(term);
            try {
                if (isFullKey) {
                    // match exato de chave + filtro por tipo
                    const jql = `key = "${term.toUpperCase()}" AND ${allowedTypesJQL}`;
                    const url = `https://${jiraDomain}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=5&fields=key,summary`;
                    const res = yield (0, node_fetch_1.default)(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
                    const json = yield res.json();
                    return (json.issues || []).map((i) => ({ key: i.key, summary: i.fields.summary || '' }));
                }
                else {
                    // sugestões parciais (prefixo de chave ou parte do título) + filtro por tipo
                    const scopeJQL = [
                        projectKey ? `project = ${projectKey}` : null,
                        allowedTypesJQL
                    ].filter(Boolean).join(' AND ');
                    const url = `https://${jiraDomain}/rest/api/2/issue/picker` +
                        `?query=${encodeURIComponent(term)}` +
                        (scopeJQL ? `&currentJQL=${encodeURIComponent(scopeJQL)}` : '');
                    const res = yield (0, node_fetch_1.default)(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
                    const data = yield res.json();
                    const issues = ((data === null || data === void 0 ? void 0 : data.sections) || []).flatMap((s) => s.issues || []);
                    const uniqueIssues = Array.from(new Map(issues.map((i) => [String(i.key || '').toUpperCase(), i])).values());
                    return uniqueIssues.slice(0, 10).map((i) => ({
                        key: i.key,
                        summary: i.summary || i.summaryText || i.label || ''
                    }));
                }
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar sugestões do Jira: ${err.message}`);
                return [];
            }
        })));
        // ✅ Novo comando: buscar detalhes completos da issue
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraIssue', (issueKey) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const { zephyrDomain, zephyrToken } = getZephyrSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}`;
            try {
                const response = yield (0, node_fetch_1.default)(url, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                });
                if (!response.ok)
                    return null;
                const data = yield response.json();
                // ✅ Verificar se o tipo da issue é permitido
                const tipo = data.fields.issuetype.name;
                const tiposPermitidos = ['Functionality', 'Funcionalidade', 'Epic', 'Story', "História"];
                if (!tiposPermitidos.includes(tipo)) {
                    vscode.window.showErrorMessage(`Tipo de issue "${tipo}" não suportado para esta funcionalidade.`);
                    return null;
                }
                // Retorno final com todos os dados da issue e scripts
                return {
                    id: data.id,
                    key: data.key,
                    issuetype: data.fields.issuetype.name,
                    summary: data.fields.summary,
                    description: data.fields.description,
                    bddSpecification: data.fields.customfield_10553,
                    status: ((_a = data.fields.status) === null || _a === void 0 ? void 0 : _a.name) || 'Sem status',
                    assignee: ((_b = data.fields.assignee) === null || _b === void 0 ? void 0 : _b.displayName) || 'Não atribuído',
                    reporter: ((_c = data.fields.reporter) === null || _c === void 0 ? void 0 : _c.displayName) || 'Desconhecido',
                    attachments: (data.fields.attachment || []).map((att) => ({
                        filename: att.filename,
                        url: att.content
                    }))
                };
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar detalhes da issue: ${err.message}`);
                return null;
            }
        })));
        // ✅ Novo comando: buscar detalhes completos da issue
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getZephyrTestToIssue', (issueKey) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrToken, zephyrDomain } = getZephyrSettings();
            const url = `https://${zephyrDomain}/v2/issuelinks/${issueKey}/testcases`;
            // Buscar testes vinculados no Zephyr
            let zephyrData = { values: [] };
            try {
                const zephyrRes = yield (0, node_fetch_1.default)(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Accept': 'application/json',
                    }
                });
                if (zephyrRes.ok) {
                    zephyrData = yield zephyrRes.json();
                    console.log('🔍 Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
                }
            }
            catch (zephyrErr) {
                console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
            }
            // Função para buscar os scripts de cada test case
            const fetchTestScripts = (testcases) => __awaiter(this, void 0, void 0, function* () {
                const scripts = [];
                for (const test of testcases) {
                    try {
                        const scriptRes = yield (0, node_fetch_1.default)(`https://${zephyrDomain}/v2/testcases/${test.key}/testscript`, {
                            headers: {
                                Authorization: `Bearer ${zephyrToken}`,
                                Accept: 'application/json',
                            }
                        });
                        const scriptDetails = yield (0, node_fetch_1.default)(`https://${zephyrDomain}/v2/testcases/${test.key}`, {
                            headers: {
                                Authorization: `Bearer ${zephyrToken}`,
                                Accept: 'application/json',
                            }
                        });
                        if (!scriptRes.ok) {
                            scripts.push({
                                key: test.key,
                                version: test.version,
                                script: '⚠️ Não foi possível buscar o script.'
                            });
                            continue;
                        }
                        if (!scriptDetails.ok) {
                            scripts.push({
                                key: test.key,
                                version: test.version,
                                script: '⚠️ Não foi possível buscar o detalhe do cenário.'
                            });
                            continue;
                        }
                        const scriptData = yield scriptRes.json();
                        const detailsData = yield scriptDetails.json();
                        scripts.push({
                            key: test.key,
                            version: test.version,
                            script: scriptData.text || '<i>Sem conteúdo</i>',
                            details: detailsData || '<i>Sem conteúdo</i>'
                        });
                    }
                    catch (err) {
                        scripts.push({
                            key: test.key,
                            version: test.version,
                            script: '⚠️ Erro ao buscar o script.',
                            details: '⚠️ Erro ao buscar o detalhe do cenário.'
                        });
                    }
                }
                return scripts;
            });
            const testcases = Array.isArray(zephyrData) ? zephyrData : [];
            const testesZephyr = yield fetchTestScripts(testcases);
            console.log('🔍 Dados do zephyr:', JSON.stringify(testesZephyr, null, 2));
            // Retorno final com todos os dados da issue e scripts
            return {
                key: issueKey,
                testesZephyr,
            };
        })));
        // 🔎 Estrutura de pastas do Zephyr por projectKey
        context.subscriptions.push(
        // 🔎 Estrutura de pastas do Zephyr por projectKey (sem resolver ID)
        vscode.commands.registerCommand('plugin-vscode.getZephyrFoldersByProject', (projectKeyParam) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrToken, zephyrDomain } = getZephyrSettings();
            try {
                // ✅ Resolve via de/para; se faltar, pergunta ao usuário
                const projectKey = yield resolveProjectOrPrompt('Listar pastas', projectKeyParam);
                if (!projectKey)
                    throw new Error('Project key não informada.');
                let startAt = 0;
                const maxResults = 100;
                let isLast = false;
                const allFolders = [];
                while (!isLast) {
                    const base = `https://${zephyrDomain}/v2/folders`;
                    const url = withProjectParam(base, projectKey) +
                        `&maxResults=${maxResults}&startAt=${startAt}&folderType=TEST_CASE`;
                    console.log('🔍 Zephyr folders URL:', url);
                    const res = yield (0, node_fetch_1.default)(url, {
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Accept': 'application/json',
                        }
                    });
                    if (!res.ok) {
                        const t = yield res.text();
                        throw new Error(`Falha ao listar pastas: ${res.status} - ${t}`);
                    }
                    const json = yield res.json();
                    const values = Array.isArray(json === null || json === void 0 ? void 0 : json.values) ? json.values : [];
                    values.forEach((p) => {
                        allFolders.push({
                            id: Number(p.id),
                            parentId: (p.parentId == null ? null : Number(p.parentId)),
                            name: String(p.name || ''),
                        });
                    });
                    isLast = !!json.isLast;
                    startAt += maxResults;
                }
                // monta árvore (inline — sem helper separado)
                const byId = new Map();
                const roots = [];
                allFolders.forEach(f => byId.set(f.id, { id: f.id, name: f.name, children: [] }));
                allFolders.forEach(f => {
                    const node = byId.get(f.id);
                    if (f.parentId && byId.has(f.parentId)) {
                        byId.get(f.parentId).children.push(node);
                    }
                    else {
                        roots.push(node);
                    }
                });
                return { projectKey, folders: roots, flat: allFolders };
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao carregar pastas do Zephyr: ${err.message}`);
                return { projectKey: '', folders: [], flat: [] };
            }
        })));
        // Lista os testes de uma pasta do Zephyr (sem recursão por padrão)
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getZephyrTestsByFolder', (projectKey, folderId, opts // pode expandir se quiser recursion mais tarde
        ) => __awaiter(this, void 0, void 0, function* () {
            var _d, _e, _f;
            const { zephyrToken, zephyrDomain } = getZephyrSettings();
            const maxResults = (_d = opts === null || opts === void 0 ? void 0 : opts.maxResults) !== null && _d !== void 0 ? _d : 100;
            // ✅ Resolve via de/para; se faltar, pergunta ao usuário
            const project = yield resolveProjectOrPrompt('Listar pastas', projectKey);
            if (!project || !folderId) {
                vscode.window.showErrorMessage('Projeto e pasta são obrigatórios.');
                return [];
            }
            // 1) Paginação para buscar todos os test cases da PASTA
            let startAt = 0;
            let isLast = false;
            const allTests = [];
            try {
                while (!isLast) {
                    // const url = `https://${zephyrDomain}/v2/testcases` +
                    //   `?projectKey=${encodeURIComponent(projectKey)}` +
                    //   `&folderId=${encodeURIComponent(String(folderId))}` +
                    //   `&maxResults=${maxResults}` +
                    //   `&startAt=${startAt}`;
                    const base = `https://${zephyrDomain}/v2/testcases`;
                    const url = withProjectParam(base, project) +
                        `&folderId=${encodeURIComponent(String(folderId))}` +
                        `&maxResults=${maxResults}` +
                        `&startAt=${startAt}`;
                    console.log('🔍 Zephyr folders URL:', url);
                    const res = yield (0, node_fetch_1.default)(url, {
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Accept': 'application/json',
                        }
                    });
                    if (!res.ok) {
                        const txt = yield res.text();
                        throw new Error(`Falha ao listar test cases da pasta: ${res.status} - ${txt}`);
                    }
                    const json = yield res.json();
                    const values = Array.isArray(json.values) ? json.values : [];
                    allTests.push(...values);
                    isLast = !!json.isLast || values.length === 0;
                    startAt += maxResults;
                }
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar testes da pasta no Zephyr: ${err.message}`);
                return [];
            }
            // 2) Para cada test case, buscar detalhes e script (mantém padrão do seu código)
            const out = [];
            for (const t of allTests) {
                const key = t.key || t.testCaseKey || t.name || '';
                if (!key)
                    continue;
                // detalhes
                let details = {};
                try {
                    const detRes = yield (0, node_fetch_1.default)(`https://${zephyrDomain}/v2/testcases/${encodeURIComponent(key)}`, {
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Accept': 'application/json',
                        }
                    });
                    if (detRes.ok) {
                        details = yield detRes.json();
                    }
                }
                catch (e) {
                    console.warn(`⚠️ Falha ao buscar detalhes do teste ${key}:`, (e === null || e === void 0 ? void 0 : e.message) || e);
                }
                // script (gherkin)
                let script = '';
                try {
                    const scriptRes = yield (0, node_fetch_1.default)(`https://${zephyrDomain}/v2/testcases/${encodeURIComponent(key)}/testscript`, {
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Accept': 'application/json',
                        }
                    });
                    if (scriptRes.ok) {
                        const s = yield scriptRes.json();
                        script = (s === null || s === void 0 ? void 0 : s.text) || '';
                    }
                }
                catch (e) {
                    console.warn(`⚠️ Falha ao buscar script do teste ${key}:`, (e === null || e === void 0 ? void 0 : e.message) || e);
                }
                out.push({
                    key,
                    version: (_f = (_e = t.version) !== null && _e !== void 0 ? _e : details === null || details === void 0 ? void 0 : details.version) !== null && _f !== void 0 ? _f : 1,
                    details,
                    script
                });
            }
            // 3) Retorna para o panel (quem chamou via executeCommand)
            return out;
        })));
        // ✅ Novo comando: buscar detalhes completos da issue
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraIssueDetails', (issueKey) => __awaiter(this, void 0, void 0, function* () {
            var _g, _h, _j;
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const { zephyrToken, zephyrDomain } = getZephyrSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}`;
            try {
                const response = yield (0, node_fetch_1.default)(url, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                });
                if (!response.ok)
                    return null;
                const data = yield response.json();
                console.log('🔍 Dados da issue:', JSON.stringify(data, null, 2));
                // Buscar testes vinculados no Zephyr
                let zephyrData = { values: [] };
                try {
                    const zephyrRes = yield (0, node_fetch_1.default)(`https://${zephyrDomain}/v2/issuelinks/${issueKey}/testcases`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Accept': 'application/json',
                        }
                    });
                    if (zephyrRes.ok) {
                        zephyrData = yield zephyrRes.json();
                        console.log('🔍 Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
                    }
                }
                catch (zephyrErr) {
                    console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
                }
                // Função para buscar os scripts de cada test case
                const fetchTestScripts = (testcases) => __awaiter(this, void 0, void 0, function* () {
                    const scripts = [];
                    for (const test of testcases) {
                        try {
                            const scriptRes = yield (0, node_fetch_1.default)(`https://${zephyrDomain}/v2/testcases/${test.key}/testscript`, {
                                headers: {
                                    Authorization: `Bearer ${zephyrToken}`,
                                    Accept: 'application/json',
                                }
                            });
                            if (!scriptRes.ok) {
                                scripts.push({
                                    key: test.key,
                                    version: test.version,
                                    script: '⚠️ Não foi possível buscar o script.'
                                });
                                continue;
                            }
                            const scriptData = yield scriptRes.json();
                            scripts.push({
                                key: test.key,
                                version: test.version,
                                script: scriptData.text || '<i>Sem conteúdo</i>',
                            });
                        }
                        catch (err) {
                            scripts.push({
                                key: test.key,
                                version: test.version,
                                script: '⚠️ Erro ao buscar o script.',
                            });
                        }
                    }
                    return scripts;
                });
                const testcases = Array.isArray(zephyrData) ? zephyrData : [];
                const testesZephyr = yield fetchTestScripts(testcases);
                // Retorno final com todos os dados da issue e scripts
                return {
                    key: data.key,
                    issuetype: data.fields.issuetype.name,
                    summary: data.fields.summary,
                    description: data.fields.description,
                    bddSpecification: data.fields.customfield_10553,
                    status: ((_g = data.fields.status) === null || _g === void 0 ? void 0 : _g.name) || 'Sem status',
                    assignee: ((_h = data.fields.assignee) === null || _h === void 0 ? void 0 : _h.displayName) || 'Não atribuído',
                    reporter: ((_j = data.fields.reporter) === null || _j === void 0 ? void 0 : _j.displayName) || 'Desconhecido',
                    attachments: (data.fields.attachment || []).map((att) => ({
                        filename: att.filename,
                        url: att.content
                    })),
                    testesZephyr,
                };
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar detalhes da issue: ${err.message}`);
                return null;
            }
        })));
        // 🔍 Análise Story, Epic e Func com IA QA (Copilot)
        vscode.commands.registerCommand('plugin-vscode.analiseIaQa', (description, bdd) => __awaiter(this, void 0, void 0, function* () {
            try {
                const prompt = (0, prompts_1.buildAnaliseStoryEpicFunPrompt)({ description, bdd });
                return yield (0, copilotLmBridge_1.askCopilotLm)(prompt, {});
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao consultar IA: ${error.message}`);
                return '❌ Erro ao obter resposta da IA.';
            }
        }));
        // 🔍 Análise cenarios com IA QA (Copilot)
        vscode.commands.registerCommand('plugin-vscode.analiseCenariosIaQa', (userStory, cenario) => __awaiter(this, void 0, void 0, function* () {
            try {
                const prompt = (0, prompts_1.buildAnaliseCenarioPrompt)({ userStory, cenarioOriginal: cenario });
                return yield (0, copilotLmBridge_1.askCopilotLm)(prompt, {});
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao consultar IA: ${error.message}`);
                return '❌ Erro ao obter resposta da IA.';
            }
        }));
        // 🔍 Criar cenarios com IA QA (Copilot)
        vscode.commands.registerCommand('plugin-vscode.criarCenariosIaQa', (userStory, cenario) => __awaiter(this, void 0, void 0, function* () {
            try {
                const prompt = (0, prompts_1.buildCriarCenariosPrompt)({ userStory });
                return yield (0, copilotLmBridge_1.askCopilotLm)(prompt, {});
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao consultar IA: ${error.message}`);
                return '❌ Erro ao obter resposta da IA.';
            }
        }));
        // ✅ Novo comando: Criar test case no Zephyr
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.criarTesteZephyr', (texto, issueId, issueKey, automationStatus, testClass, testType, testGroup, folderId) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
            const url = `https://${zephyrDomain}/v2/testcases`;
            console.log('🔍 issueId: ', issueId);
            console.log('🔍 titulo do teste: ', texto.split('\n')[0].replace(/^Scenario:/i, '').trim());
            console.log('🔍 projectKey: ', issueKey);
            console.log('🔍 automationStatus: ', automationStatus.trim().replace(/\s+/g, ' '));
            console.log('🔍 testClass: ', testClass.trim().replace(/\s+/g, ' '));
            console.log('🔍 testType: ', testType.trim().replace(/\s+/g, ' '));
            console.log('🔍 testGroup: ', testGroup.trim().replace(/\s+/g, ' '));
            // Buscar testes vinculados no Zephyr
            let zephyrData = { values: [] };
            let zephyrScriptData = { values: [] };
            try {
                const zephyrRes = yield (0, node_fetch_1.default)(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        name: texto.split('\n')[0].replace(/^Scenario:/i, '').trim(),
                        projectKey: issueKey.slice(0, 4),
                        folderId: folderId,
                        ownerId: zephyrOwnerId,
                        customFields: {
                            "Test Type": testType,
                            "Test Class": testClass,
                            "Automation Status": automationStatus,
                            "Test Group": testGroup
                        }
                    }),
                });
                if (zephyrRes.ok) {
                    zephyrData = yield zephyrRes.json();
                    console.log('🔍 Dados do zephyr new test case:', JSON.stringify(zephyrData, null, 2));
                }
                else {
                    console.log('🔍 zephyrRes: ', zephyrRes);
                }
            }
            catch (zephyrErr) {
                console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
            }
            console.log('🔍 Dados do zephyr:', JSON.stringify(zephyrData, null, 2));
            const semPrimeira = texto.split('\n').slice(1).join('\n');
            console.log('🔍 Texto:', semPrimeira);
            try {
                const zephyrLink = yield (0, node_fetch_1.default)(`${url}/${zephyrData.key}/links/issues`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        "issueId": issueId
                    }),
                });
                const zephyrLinkData = zephyrLink.json();
                console.log('🔍 issueId:', issueId);
                console.log('🔍 link:', JSON.stringify(zephyrLinkData, null, 2));
            }
            catch (zephyrErr) {
                console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
            }
            try {
                const zephyrRes = yield (0, node_fetch_1.default)(`${url}/${zephyrData.key}/testscript`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        "type": "bdd",
                        "text": semPrimeira
                    }),
                });
                zephyrScriptData = zephyrRes.json();
                return zephyrData.key;
            }
            catch (zephyrErr) {
                console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
            }
        })));
        // ✅ Novo comando: Criar test case no Zephyr
        vscode.commands.registerCommand('plugin-vscode.atualizarTesteZephyr', (key, texto, issueId, issueKey) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
            const url = `https://${zephyrDomain}/v2/testcases`;
            console.log('🔍 issueId: ', issueId);
            console.log('🔍 titulo do teste: ', texto.split('\n')[0].replace(/^Scenario:/i, '').trim());
            console.log('🔍 projectKey: ', issueKey);
            // Buscar testes vinculados no Zephyr
            let zephyrData = { values: [] };
            let zephyrScriptData = { values: [] };
            const semPrimeira = texto.split('\n').slice(1).join('\n');
            console.log('🔍 Texto:', semPrimeira);
            try {
                const zephyrRes = yield (0, node_fetch_1.default)(`${url}/${key}/testscript`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        "type": "bdd",
                        "text": semPrimeira
                    }),
                });
                zephyrScriptData = zephyrRes.json();
                return zephyrData.key;
            }
            catch (zephyrErr) {
                console.warn('Erro ao buscar testes no Zephyr:', zephyrErr.message);
            }
        }));
        // Comando para obter a lista de pastas
        vscode.commands.registerCommand('plugin-vscode.getZephyrFolders', (issueKey) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
            let startAt = 0;
            let allFolders = [];
            let isLast = false;
            const maxResults = 100;
            // const projectKey = issueKey.slice(0, 4);
            // ✅ Resolve via de/para; se faltar, pergunta ao usuário
            const project = yield resolveProjectOrPrompt('Listar pastas', issueKey);
            try {
                while (!isLast) {
                    // const url = `https://${zephyrDomain}/v2/folders?maxResults=${maxResults}&startAt=${startAt}&projectKey=${projectKey}&folderType=TEST_CASE`;
                    const base = `https://${zephyrDomain}/v2/folders`;
                    // projectKey ou projectId + outros params
                    const url = withProjectParam(base, project) +
                        `&maxResults=${maxResults}&startAt=${startAt}&folderType=TEST_CASE`;
                    console.log('🔍 Zephyr folders URL:', url);
                    const zephyrRes = yield (0, node_fetch_1.default)(url, {
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        }
                    });
                    const zephyrData = yield zephyrRes.json();
                    const folders = zephyrData.values.map((p) => ({
                        key: p.id,
                        parentId: p.parentId,
                        name: p.name
                    }));
                    allFolders = allFolders.concat(folders);
                    isLast = zephyrData.isLast;
                    startAt += maxResults;
                }
                console.log('🔍 Dados do zephyr folders:', allFolders);
                return allFolders;
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar pastas no Zephyr: ${err.message}`);
                return [];
            }
        }));
    });
}
exports.activate = activate;
function getJiraSettings() {
    return {
        jiraDomain: vscode.workspace.getConfiguration().get('plugin.jira.domain') || '',
        jiraEmail: vscode.workspace.getConfiguration().get('plugin.jira.email') || '',
        jiraToken: vscode.workspace.getConfiguration().get('plugin.jira.token') || '',
        jiraProjectCategoryId: vscode.workspace.getConfiguration().get('plugin.jira.projectCategoryId') || '',
    };
}
function getZephyrSettings() {
    return {
        zephyrOwnerId: vscode.workspace.getConfiguration().get('plugin.zephyr.ownerId') || '',
        zephyrDomain: vscode.workspace.getConfiguration().get('plugin.zephyr.domain') || '',
        zephyrToken: vscode.workspace.getConfiguration().get('plugin.zephyr.token') || '',
    };
}
function encodeAuth(email, token) {
    return Buffer.from(`${email}:${token}`).toString('base64');
}
