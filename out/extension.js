"use strict";
// src/extension.ts
// -------------------------------------------------------------
// Extensão VS Code AUTÔNOMA (sem depender da extensão do Copilot)
// - Não usa vscode.authentication, nem APIs do Copilot Chat
// - Usa apenas chamadas HTTPS diretas com o cookie salvo em Settings
// - Compatível com Node 16 (usa https nativo, sem fetch global)
// -------------------------------------------------------------
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const homeViewProvider_1 = require("./homeViewProvider");
const backendPanel_1 = require("./panel/backendPanel");
const zephyrPanel_1 = require("./panel/zephyrPanel");
const jiraPanel_1 = require("./panel/jiraPanel");
const settingsPanel_1 = require("./panel/settingsPanel");
const https_1 = require("https");
const url_1 = require("url");
// =========================
// Estado global (somente sessão atual do VS Code)
// =========================
let globalToken = null;
let globalThreadId = null;
// =========================
// Ativação
// =========================
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // Providers de Webview
        // Criação da instância da HomeViewProvider
        const homeViewProvider = new homeViewProvider_1.HomeViewProvider(context.extensionUri);
        // Registro da webview com o ID que deve coincidir com o package.json
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('homeView', // << TEM QUE BATER COM O ID DO `package.json`
        homeViewProvider));
        // Deixa a barra e a home visíveis (não é obrigatório, mas mantém seu fluxo)
        try {
            yield vscode.commands.executeCommand('workbench.view.extension.formSidebar');
            yield vscode.commands.executeCommand('homeView.focus', { preserveFocus: true });
        }
        catch (_a) {
            /* silencioso */
        }
        // ===== Comandos principais =====
        // Abrir Jira
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.openJira', () => {
            jiraPanel_1.JiraPanel.createOrShow(context.extensionUri);
        }));
        // Abrir Zephyr
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.openZephyr', (issueId, issueKey, comentario, description, bddSpecification) => {
            if (!comentario) {
                comentario = `Descrição:\n${description}\n\nEspecificação BDD:\n${bddSpecification}`;
            }
            zephyrPanel_1.ZephyrPanel.createOrShow(context.extensionUri, issueId, issueKey, comentario);
        }));
        // Abrir Backend
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.backend', () => {
            backendPanel_1.BackendPanel.createOrShow(context.extensionUri);
        }));
        // Abrir Settings
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.settings', () => {
            settingsPanel_1.SettingsPanel.createOrShow(context.extensionUri);
        }));
        // ====== Integrações JIRA / ZEPHYR ======
        // Nome do usuário logado no Jira
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraUser', () => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            try {
                const res = yield httpJson(`https://${jiraDomain}/rest/api/2/myself`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                    timeoutMs: 15000,
                });
                return ((res === null || res === void 0 ? void 0 : res.displayName) || (res === null || res === void 0 ? void 0 : res.name) || 'usuário');
            }
            catch (err) {
                vscode.window.showErrorMessage('Erro ao conectar no Jira: ' + ((err === null || err === void 0 ? void 0 : err.message) || err));
                return 'usuário';
            }
        })));
        // Projetos Jira (exemplo com filtro fixo que você usa)
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraProjects', () => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            try {
                // const response = await fetch(`https://${jiraDomain}/rest/api/3/project/search?categoryId=10018`, {
                const response = yield fetch(`https://${jiraDomain}/rest/api/3/project`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                    // timeoutMs: 20000,
                });
                // const values = Array.isArray(res?.values) ? res.values : [];
                // return values.map((p: any) => ({ key: p.key, name: p.name }));
                const data = yield response.json();
                // return data.values.map((p: any) => ({ key: p.key, name: p.name }));
                return data.map((p) => ({ key: p.key, name: p.name }));
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar projetos do Jira: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return [];
            }
        })));
        // Enviar comentário em issue Jira
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.enviarComentarioIssue', (issueKey, comentario) => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            try {
                const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}/comment`;
                yield httpRaw(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ body: comentario }),
                    timeoutMs: 20000,
                    expectJson: true,
                });
                vscode.window.showInformationMessage(`✅ Comentário enviado com sucesso para a issue ${issueKey}`);
            }
            catch (err) {
                vscode.window.showErrorMessage(`❌ Falha ao enviar comentário para a issue ${issueKey}: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            }
        })));
        // Sugestões de issues pelo summary
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.buscarSugestoesIssue', (keyPrefix, projectKey) => __awaiter(this, void 0, void 0, function* () {
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            const jql = `
        project = ${projectKey}
        AND summary ~ "${keyPrefix}*"
        AND issuetype IN ("Functionality", "Epic", "Story")
        ORDER BY updated DESC
      `;
            try {
                const url = `https://${jiraDomain}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=5&fields=key,summary`;
                const json = yield httpJson(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                    timeoutMs: 20000,
                });
                const issues = Array.isArray(json === null || json === void 0 ? void 0 : json.issues) ? json.issues : [];
                return issues.map((issue) => {
                    var _a;
                    return ({
                        key: issue.key,
                        summary: (_a = issue.fields) === null || _a === void 0 ? void 0 : _a.summary,
                    });
                });
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar issues do Jira: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return [];
            }
        })));
        // Detalhes de issue Jira (com pequenos checks)
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getJiraIssue', (issueKey) => __awaiter(this, void 0, void 0, function* () {
            var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
            const auth = encodeAuth(jiraEmail, jiraToken);
            const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}`;
            try {
                const data = yield httpJson(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json',
                    },
                    timeoutMs: 20000,
                });
                const tipo = (_c = (_b = data === null || data === void 0 ? void 0 : data.fields) === null || _b === void 0 ? void 0 : _b.issuetype) === null || _c === void 0 ? void 0 : _c.name;
                const tiposPermitidos = ['Functionality', 'Funcionalidade', 'Epic', 'Story'];
                if (!tiposPermitidos.includes(tipo)) {
                    vscode.window.showErrorMessage(`Tipo de issue "${tipo}" não suportado para esta funcionalidade.`);
                    return null;
                }
                return {
                    id: data === null || data === void 0 ? void 0 : data.id,
                    key: data === null || data === void 0 ? void 0 : data.key,
                    issuetype: tipo,
                    summary: (_d = data === null || data === void 0 ? void 0 : data.fields) === null || _d === void 0 ? void 0 : _d.summary,
                    description: (_e = data === null || data === void 0 ? void 0 : data.fields) === null || _e === void 0 ? void 0 : _e.description,
                    bddSpecification: (_f = data === null || data === void 0 ? void 0 : data.fields) === null || _f === void 0 ? void 0 : _f.customfield_10553,
                    status: ((_h = (_g = data === null || data === void 0 ? void 0 : data.fields) === null || _g === void 0 ? void 0 : _g.status) === null || _h === void 0 ? void 0 : _h.name) || 'Sem status',
                    assignee: ((_k = (_j = data === null || data === void 0 ? void 0 : data.fields) === null || _j === void 0 ? void 0 : _j.assignee) === null || _k === void 0 ? void 0 : _k.displayName) || 'Não atribuído',
                    reporter: ((_m = (_l = data === null || data === void 0 ? void 0 : data.fields) === null || _l === void 0 ? void 0 : _l.reporter) === null || _m === void 0 ? void 0 : _m.displayName) || 'Desconhecido',
                    attachments: (((_o = data === null || data === void 0 ? void 0 : data.fields) === null || _o === void 0 ? void 0 : _o.attachment) || []).map((att) => ({
                        filename: att.filename,
                        url: att.content
                    }))
                };
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar detalhes da issue: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return null;
            }
        })));
        // ============ Copilot AUTÔNOMO (cookie do settings) ============
        // Story/Epic/Fun – análise
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.analiseIaQa', (description, bdd) => __awaiter(this, void 0, void 0, function* () {
            const { copilotCookie } = getCopilotSettings();
            if (!copilotCookie) {
                vscode.window.showWarningMessage('Copilot Cookie não configurado em Settings.');
                return '❌ Cookie não configurado.';
            }
            try {
                if (!globalToken || !globalThreadId) {
                    yield criarTokenECriarThread(copilotCookie);
                }
                try {
                    return yield analiseStoryEpicFunCopilot(globalToken, globalThreadId, description, bdd);
                }
                catch (_p) {
                    // tenta renovar uma vez
                    yield criarTokenECriarThread(copilotCookie);
                    return yield analiseStoryEpicFunCopilot(globalToken, globalThreadId, description, bdd);
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                return '❌ Erro ao obter resposta da IA.';
            }
        })));
        // Análise de cenários – avaliação + reescrita
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.analiseCenariosIaQa', (userStory, cenario) => __awaiter(this, void 0, void 0, function* () {
            const { copilotCookie } = getCopilotSettings();
            if (!copilotCookie) {
                vscode.window.showWarningMessage('Copilot Cookie não configurado em Settings.');
                return '❌ Cookie não configurado.';
            }
            try {
                if (!globalToken || !globalThreadId) {
                    yield criarTokenECriarThread(copilotCookie);
                }
                try {
                    return yield enviarCenarioParaCopilot(globalToken, globalThreadId, userStory, cenario);
                }
                catch (_q) {
                    yield criarTokenECriarThread(copilotCookie);
                    return yield enviarCenarioParaCopilot(globalToken, globalThreadId, userStory, cenario);
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                return '❌ Erro ao obter resposta da IA.';
            }
        })));
        // Criação de cenários
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.criarCenariosIaQa', (userStory, cenario) => __awaiter(this, void 0, void 0, function* () {
            const { copilotCookie } = getCopilotSettings();
            if (!copilotCookie) {
                vscode.window.showWarningMessage('Copilot Cookie não configurado em Settings.');
                return '❌ Cookie não configurado.';
            }
            try {
                if (!globalToken || !globalThreadId) {
                    yield criarTokenECriarThread(copilotCookie);
                }
                try {
                    return yield enviarCriarCenarioComCopilot(globalToken, globalThreadId, userStory, cenario);
                }
                catch (_r) {
                    yield criarTokenECriarThread(copilotCookie);
                    return yield enviarCriarCenarioComCopilot(globalToken, globalThreadId, userStory, cenario);
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                return '❌ Erro ao obter resposta da IA.';
            }
        })));
        // ====== Zephyr (exemplos) ======
        // Criar teste Zephyr
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.criarTesteZephyr', (texto, issueId, issueKey, automationStatus, testClass, testType, testGroup, folderId) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrOwnerId, zephyrToken, zephyrDomain } = getZephyrSettings();
            const urlBase = `https://${zephyrDomain}/v2/testcases`;
            try {
                // Criar test case
                const createBody = {
                    name: texto.split('\n')[0].replace(/^Scenario:/i, '').trim(),
                    projectKey: issueKey.slice(0, 4),
                    folderId: folderId,
                    ownerId: zephyrOwnerId,
                    customFields: {
                        "Test Type": testType === null || testType === void 0 ? void 0 : testType.trim(),
                        "Test Class": testClass === null || testClass === void 0 ? void 0 : testClass.trim(),
                        "Automation Status": automationStatus === null || automationStatus === void 0 ? void 0 : automationStatus.trim(),
                        "Test Group": testGroup === null || testGroup === void 0 ? void 0 : testGroup.trim()
                    }
                };
                const zephyrData = yield httpJson(urlBase, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify(createBody),
                    timeoutMs: 30000,
                });
                const key = zephyrData === null || zephyrData === void 0 ? void 0 : zephyrData.key;
                if (!key)
                    throw new Error('Não foi possível obter a chave do test case criado.');
                // Linkar issue
                try {
                    yield httpRaw(`${urlBase}/${key}/links/issues`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({ issueId }),
                        timeoutMs: 20000,
                        expectJson: true,
                    });
                }
                catch (err) {
                    // Log leve; não bloquear
                    console.warn('Falha ao linkar issue ao test case:', err);
                }
                // Escrever script (remove 1ª linha "Scenario: ...")
                const semPrimeira = texto.split('\n').slice(1).join('\n');
                try {
                    yield httpRaw(`${urlBase}/${key}/testscript`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({ type: 'bdd', text: semPrimeira }),
                        timeoutMs: 30000,
                        expectJson: true,
                    });
                }
                catch (err) {
                    console.warn('Falha ao salvar script do test case:', err);
                }
                return key;
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao criar test case no Zephyr: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return null;
            }
        })));
        // Atualizar script de um teste Zephyr
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.atualizarTesteZephyr', (key, texto) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrToken, zephyrDomain } = getZephyrSettings();
            const urlBase = `https://${zephyrDomain}/v2/testcases`;
            const semPrimeira = texto.split('\n').slice(1).join('\n');
            try {
                yield httpRaw(`${urlBase}/${key}/testscript`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${zephyrToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ type: 'bdd', text: semPrimeira }),
                    timeoutMs: 30000,
                    expectJson: true,
                });
                return key;
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao atualizar script no Zephyr: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return null;
            }
        })));
        // Pastas do Zephyr (paginadas)
        context.subscriptions.push(vscode.commands.registerCommand('plugin-vscode.getZephyrFolders', (issueKey) => __awaiter(this, void 0, void 0, function* () {
            const { zephyrToken, zephyrDomain } = getZephyrSettings();
            let startAt = 0;
            const maxResults = 100;
            let isLast = false;
            const projectKey = issueKey.slice(0, 4);
            const all = [];
            try {
                while (!isLast) {
                    const url = `https://${zephyrDomain}/v2/folders?maxResults=${maxResults}&startAt=${startAt}&projectKey=${projectKey}&folderType=TEST_CASE`;
                    const data = yield httpJson(url, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${zephyrToken}`,
                            'Accept': 'application/json',
                        },
                        timeoutMs: 25000,
                    });
                    const values = Array.isArray(data === null || data === void 0 ? void 0 : data.values) ? data.values : [];
                    for (const p of values) {
                        all.push({ key: p.id, parentId: p.parentId, name: p.name });
                    }
                    isLast = !!(data === null || data === void 0 ? void 0 : data.isLast);
                    startAt += maxResults;
                }
                return all;
            }
            catch (err) {
                vscode.window.showErrorMessage(`Erro ao buscar pastas no Zephyr: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
                return [];
            }
        })));
    });
}
exports.activate = activate;
// =========================
// Copilot: cliente HTTP autônomo
// =========================
function criarTokenECriarThread(cookie) {
    return __awaiter(this, void 0, void 0, function* () {
        // 1) Obter token
        const tokenRes = yield httpJson('https://github.com/github-copilot/chat/token', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'cookie': cookie,
                'origin': 'https://github.com',
                'GitHub-Verified-Fetch': 'true',
            },
            body: '{}',
            timeoutMs: 15000,
        });
        const token = tokenRes === null || tokenRes === void 0 ? void 0 : tokenRes.token;
        if (!token)
            throw new Error('Não foi possível obter o token do Copilot (verifique o cookie)');
        // 2) Criar thread
        const threadRes = yield httpJson('https://api.business.githubcopilot.com/github/chat/threads', {
            method: 'POST',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: '{}',
            timeoutMs: 15000,
        });
        const threadId = threadRes === null || threadRes === void 0 ? void 0 : threadRes.thread_id;
        if (!threadId)
            throw new Error('Não foi possível criar a thread do Copilot');
        // Cache global
        globalToken = token;
        globalThreadId = threadId;
        return { token, threadId };
    });
}
function enviarCriarCenarioComCopilot(token, threadId, userStory, _cenarioOriginal) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = {
            responseMessageID: randomId(),
            content: `Com base na análise da user story abaixo, crie cenários de testes e realize as seguintes ações:
1. Classifique o tipo do teste criado (**Test Type**): escolha entre *End to End*, *Regression*, *Acceptance* ou *UI*.
2. Classifique o cenário como **Test Class**: *Positive* ou *Negative*.
3. Classifique o cenário como **Test Group**: *Backend*, *Front-End* ou *Desktop*.
⚠️ Importante: os campos acima devem ser retornados exatamente como exemplo:
**Test Type:** Acceptance
**Test Class:** Positive
**Test Group:** Front-End
4. Avalie se o cenário cobre o comportamento esperado da user story.
5. Aponte se há pontos técnicos ou termos inadequados para testes de aceitação.
6. Reescreva o cenário utilizando **boas práticas do Gherkin com as palavras-chave em inglês** (Scenario, Given, And, When, Then) mantendo o cenário em português, evitando qualquer linguagem técnica ou de implementação.
⚠️ Coloque o novo cenário em um bloco \`\`\`gherkin ... \`\`\`.
---
📝 **User Story**:
${userStory}`,
            intent: 'conversation',
            references: [],
            context: [],
            currentURL: 'https://github.com/copilot',
            streaming: false,
            confirmations: [],
            customInstructions: [],
            model: 'gpt-4.1',
            mode: 'immersive',
            parentMessageID: randomId(),
            tools: [],
            mediaContent: [],
            skillOptions: { deepCodeSearch: false }
        };
        yield httpRaw(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
            method: 'POST',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeoutMs: 20000,
            expectJson: true,
        });
        // busca última resposta
        const msgs = yield httpJson(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
            method: 'GET',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            timeoutMs: 20000,
        });
        const list = Array.isArray(msgs === null || msgs === void 0 ? void 0 : msgs.messages) ? msgs.messages : [];
        const last = list[list.length - 1];
        return (last === null || last === void 0 ? void 0 : last.content) || '⚠️ Nenhuma resposta recebida.';
    });
}
function enviarCenarioParaCopilot(token, threadId, userStory, cenarioOriginal) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = {
            responseMessageID: randomId(),
            content: `Com base na análise da user story abaixo, avalie também o cenário de teste fornecido e:
1. Classifique o tipo do teste: **funcional, integração ou end-to-end**.
2. Avalie cobertura em relação à user story.
3. Aponte termos técnicos inadequados para aceitação.
4. Reescreva o cenário em **gherkin** (Scenario, Given, And, When, Then) mantendo o português.
---
📝 **User Story**:
${userStory}
---
🧪 **Cenário Original**:
${cenarioOriginal}`,
            intent: 'conversation',
            references: [],
            context: [],
            currentURL: 'https://github.com/copilot',
            streaming: false,
            confirmations: [],
            customInstructions: [],
            model: 'gpt-4.1',
            mode: 'immersive',
            parentMessageID: randomId(),
            tools: [],
            mediaContent: [],
            skillOptions: { deepCodeSearch: false }
        };
        yield httpRaw(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
            method: 'POST',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeoutMs: 20000,
            expectJson: true,
        });
        const msgs = yield httpJson(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
            method: 'GET',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            timeoutMs: 20000,
        });
        const list = Array.isArray(msgs === null || msgs === void 0 ? void 0 : msgs.messages) ? msgs.messages : [];
        const last = list[list.length - 1];
        return (last === null || last === void 0 ? void 0 : last.content) || '⚠️ Nenhuma resposta recebida.';
    });
}
function analiseStoryEpicFunCopilot(token, threadId, description, bdd) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = {
            responseMessageID: randomId(),
            content: `Analise a user story abaixo e:
1. Atribua notas (1-5) para clareza, foco no cliente e viabilidade de cenários.
2. Comente aderência ao INVEST.
3. Diga se está pronta para desenvolvimento/testes.
4. Classifique como ótima, boa, regular ou ruim.
5. Reescreva uma sugestão de melhoria (clara, orientada a valor, com BDD se possível).
---
Descrição:
${description}

BDD:
${bdd}`,
            intent: 'conversation',
            references: [],
            context: [],
            currentURL: 'https://github.com/copilot',
            streaming: false,
            confirmations: [],
            customInstructions: [],
            model: 'gpt-4.1',
            mode: 'immersive',
            parentMessageID: randomId(),
            tools: [],
            mediaContent: [],
            skillOptions: { deepCodeSearch: false }
        };
        yield httpRaw(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
            method: 'POST',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeoutMs: 20000,
            expectJson: true,
        });
        const msgs = yield httpJson(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
            method: 'GET',
            headers: {
                'authorization': `GitHub-Bearer ${token}`,
                'content-type': 'application/json',
            },
            timeoutMs: 20000,
        });
        const list = Array.isArray(msgs === null || msgs === void 0 ? void 0 : msgs.messages) ? msgs.messages : [];
        const last = list[list.length - 1];
        return (last === null || last === void 0 ? void 0 : last.content) || '⚠️ Nenhuma resposta recebida.';
    });
}
// =========================
// Utilitários
// =========================
function getJiraSettings() {
    return {
        jiraDomain: vscode.workspace.getConfiguration().get('plugin.jira.domain') || '',
        jiraEmail: vscode.workspace.getConfiguration().get('plugin.jira.email') || '',
        jiraToken: vscode.workspace.getConfiguration().get('plugin.jira.token') || '',
    };
}
function getZephyrSettings() {
    return {
        zephyrOwnerId: vscode.workspace.getConfiguration().get('plugin.zephyr.ownerId') || '',
        zephyrDomain: vscode.workspace.getConfiguration().get('plugin.zephyr.domain') || '',
        zephyrToken: vscode.workspace.getConfiguration().get('plugin.zephyr.token') || '',
    };
}
function getCopilotSettings() {
    return {
        copilotCookie: vscode.workspace.getConfiguration().get('plugin.copilot.Cookie') || '',
    };
}
function encodeAuth(email, token) {
    return Buffer.from(`${email}:${token}`).toString('base64');
}
function randomId() {
    // Fallback simples para Node 16 (sem crypto.randomUUID nativo em todos os targets)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function httpRaw(urlStr, opts) {
    return new Promise((resolve, reject) => {
        const u = new url_1.URL(urlStr);
        const method = opts.method || 'GET';
        const headers = Object.assign({
            'User-Agent': 'VSCode-Extension/1.0',
            'Accept': 'application/json',
        }, opts.headers || {});
        const req = (0, https_1.request)({
            protocol: u.protocol,
            hostname: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname + (u.search || ''),
            method,
            headers,
        }, (res) => {
            const chunks = [];
            res.on('data', (d) => chunks.push(Buffer.from(d)));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                const status = res.statusCode || 0;
                const resHeaders = res.headers;
                if (status >= 400) {
                    // Se caller quer JSON e resposta não for JSON, ainda assim retornamos erro coerente
                    if (opts.expectJson) {
                        let msg = body;
                        try {
                            const parsed = JSON.parse(body);
                            msg = (parsed === null || parsed === void 0 ? void 0 : parsed.message) || JSON.stringify(parsed);
                        }
                        catch ( /* ignore */_a) { /* ignore */ }
                        return reject(new Error(`HTTP ${status}: ${msg}`));
                    }
                    return reject(new Error(`HTTP ${status}: ${body}`));
                }
                resolve({ status, headers: resHeaders, body });
            });
        });
        req.on('error', (err) => reject(err));
        if (opts.timeoutMs && opts.timeoutMs > 0) {
            req.setTimeout(opts.timeoutMs, () => {
                try {
                    req.destroy();
                }
                catch ( /* ignore */_a) { /* ignore */ }
                reject(new Error('Timeout'));
            });
        }
        if (opts.body)
            req.write(opts.body);
        req.end();
    });
}
function httpJson(urlStr, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield httpRaw(urlStr, Object.assign(Object.assign({}, opts), { expectJson: true }));
        try {
            return JSON.parse(res.body);
        }
        catch (e) {
            throw new Error(`Falha ao parsear JSON de ${urlStr}: ${e.message}`);
        }
    });
}
// =========================
// Desativação
// =========================
function deactivate() {
    // Nada especial
}
exports.deactivate = deactivate;
