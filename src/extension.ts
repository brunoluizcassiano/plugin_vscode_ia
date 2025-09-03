// src/extension.ts
// -------------------------------------------------------------
// Extensão VS Code AUTÔNOMA (sem depender da extensão do Copilot)
// - Não usa vscode.authentication, nem APIs do Copilot Chat
// - Usa apenas chamadas HTTPS diretas com o cookie salvo em Settings
// - Compatível com Node 16 (usa https nativo, sem fetch global)
// -------------------------------------------------------------

import * as vscode from 'vscode';
import { HomeViewProvider } from './homeViewProvider';
import { BackendPanel } from './panel/backendPanel';
import { ZephyrPanel } from './panel/zephyrPanel';
import { JiraPanel } from './panel/jiraPanel';
import { SettingsPanel } from './panel/settingsPanel';
import { request as httpsRequest } from 'https';
import { URL } from 'url';

// =========================
// Estado global (somente sessão atual do VS Code)
// =========================
let globalToken: string | null = null;
let globalThreadId: string | null = null;

// =========================
// Ativação
// =========================
export async function activate(context: vscode.ExtensionContext) {
  // Providers de Webview
  // Criação da instância da HomeViewProvider
    const homeViewProvider = new HomeViewProvider(context.extensionUri);
    // Registro da webview com o ID que deve coincidir com o package.json
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'homeView', // << TEM QUE BATER COM O ID DO `package.json`
        homeViewProvider
      )
    );

  // Deixa a barra e a home visíveis (não é obrigatório, mas mantém seu fluxo)
  try {
    await vscode.commands.executeCommand('workbench.view.extension.formSidebar');
    await vscode.commands.executeCommand('homeView.focus', { preserveFocus: true });
  } catch {
    /* silencioso */
  }

  // ===== Comandos principais =====

  // Abrir Jira
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.openJira', () => {
      JiraPanel.createOrShow(context.extensionUri);
    })
  );

  // Abrir Zephyr
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.openZephyr', (issueId?: string, issueKey?: string, comentario?: string, description?: string, bddSpecification?: string) => {
      if (!comentario) {
        comentario = `Descrição:\n${description}\n\nEspecificação BDD:\n${bddSpecification}`;
      }
      ZephyrPanel.createOrShow(context.extensionUri, issueId, issueKey, comentario);
    })
  );

  // Abrir Backend
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.backend', () => {
      BackendPanel.createOrShow(context.extensionUri);
    })
  );

  // Abrir Settings
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.settings', () => {
      SettingsPanel.createOrShow(context.extensionUri);
    })
  );

  // ====== Integrações JIRA / ZEPHYR ======

  // Nome do usuário logado no Jira
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraUser', async () => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      try {
        const res = await httpJson(`https://${jiraDomain}/rest/api/2/myself`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
          timeoutMs: 15000,
        });
        return (res?.displayName || res?.name || 'usuário');
      } catch (err: any) {
        vscode.window.showErrorMessage('Erro ao conectar no Jira: ' + (err?.message || err));
        return 'usuário';
      }
    })
  );

  // Projetos Jira (exemplo com filtro fixo que você usa)
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraProjects', async () => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      try {
        // const response = await fetch(`https://${jiraDomain}/rest/api/3/project/search?categoryId=10018`, {
        const response = await fetch(`https://${jiraDomain}/rest/api/3/project`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
          // timeoutMs: 20000,
        });
        // const values = Array.isArray(res?.values) ? res.values : [];
        // return values.map((p: any) => ({ key: p.key, name: p.name }));
        const data = await response.json();
        // return data.values.map((p: any) => ({ key: p.key, name: p.name }));
        return data.map((p: any) => ({ key: p.key, name: p.name }));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar projetos do Jira: ${err?.message || err}`);
        return [];
      }
    })
  );

  // Enviar comentário em issue Jira
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.enviarComentarioIssue', async (issueKey: string, comentario: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      try {
        const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}/comment`;
        await httpRaw(url, {
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
      } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Falha ao enviar comentário para a issue ${issueKey}: ${err?.message || err}`);
      }
    })
  );

  // Sugestões de issues pelo summary
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.buscarSugestoesIssue', async (keyPrefix: string, projectKey: string) => {
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
        const json = await httpJson(url, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
          timeoutMs: 20000,
        });
        const issues = Array.isArray(json?.issues) ? json.issues : [];
        return issues.map((issue: any) => ({
          key: issue.key,
          summary: issue.fields?.summary,
        }));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar issues do Jira: ${err?.message || err}`);
        return [];
      }
    })
  );

  // Detalhes de issue Jira (com pequenos checks)
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getJiraIssue', async (issueKey: string) => {
      const { jiraDomain, jiraEmail, jiraToken } = getJiraSettings();
      const auth = encodeAuth(jiraEmail, jiraToken);
      const url = `https://${jiraDomain}/rest/api/2/issue/${issueKey}`;
      try {
        const data = await httpJson(url, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
          timeoutMs: 20000,
        });

        const tipo = data?.fields?.issuetype?.name;
        const tiposPermitidos = ['Functionality', 'Funcionalidade', 'Epic', 'Story'];
        if (!tiposPermitidos.includes(tipo)) {
          vscode.window.showErrorMessage(`Tipo de issue "${tipo}" não suportado para esta funcionalidade.`);
          return null;
        }

        return {
          id: data?.id,
          key: data?.key,
          issuetype: tipo,
          summary: data?.fields?.summary,
          description: data?.fields?.description,
          bddSpecification: data?.fields?.customfield_10553,
          status: data?.fields?.status?.name || 'Sem status',
          assignee: data?.fields?.assignee?.displayName || 'Não atribuído',
          reporter: data?.fields?.reporter?.displayName || 'Desconhecido',
          attachments: (data?.fields?.attachment || []).map((att: any) => ({
            filename: att.filename,
            url: att.content
          }))
        };
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar detalhes da issue: ${err?.message || err}`);
        return null;
      }
    })
  );

  // ============ Copilot AUTÔNOMO (cookie do settings) ============

  // Story/Epic/Fun – análise
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.analiseIaQa', async (description: string, bdd: string) => {
      const { copilotCookie } = getCopilotSettings();
      if (!copilotCookie) {
        vscode.window.showWarningMessage('Copilot Cookie não configurado em Settings.');
        return '❌ Cookie não configurado.';
      }
      try {
        if (!globalToken || !globalThreadId) {
          await criarTokenECriarThread(copilotCookie);
        }
        try {
          return await analiseStoryEpicFunCopilot(globalToken!, globalThreadId!, description, bdd);
        } catch {
          // tenta renovar uma vez
          await criarTokenECriarThread(copilotCookie);
          return await analiseStoryEpicFunCopilot(globalToken!, globalThreadId!, description, bdd);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${error?.message || error}`);
        return '❌ Erro ao obter resposta da IA.';
      }
    })
  );

  // Análise de cenários – avaliação + reescrita
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.analiseCenariosIaQa', async (userStory: string, cenario: string) => {
      const { copilotCookie } = getCopilotSettings();
      if (!copilotCookie) {
        vscode.window.showWarningMessage('Copilot Cookie não configurado em Settings.');
        return '❌ Cookie não configurado.';
      }
      try {
        if (!globalToken || !globalThreadId) {
          await criarTokenECriarThread(copilotCookie);
        }
        try {
          return await enviarCenarioParaCopilot(globalToken!, globalThreadId!, userStory, cenario);
        } catch {
          await criarTokenECriarThread(copilotCookie);
          return await enviarCenarioParaCopilot(globalToken!, globalThreadId!, userStory, cenario);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${error?.message || error}`);
        return '❌ Erro ao obter resposta da IA.';
      }
    })
  );

  // Criação de cenários
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.criarCenariosIaQa', async (userStory: string, cenario: string) => {
      const { copilotCookie } = getCopilotSettings();
      if (!copilotCookie) {
        vscode.window.showWarningMessage('Copilot Cookie não configurado em Settings.');
        return '❌ Cookie não configurado.';
      }
      try {
        if (!globalToken || !globalThreadId) {
          await criarTokenECriarThread(copilotCookie);
        }
        try {
          return await enviarCriarCenarioComCopilot(globalToken!, globalThreadId!, userStory, cenario);
        } catch {
          await criarTokenECriarThread(copilotCookie);
          return await enviarCriarCenarioComCopilot(globalToken!, globalThreadId!, userStory, cenario);
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Erro ao consultar IA Copilot: ${error?.message || error}`);
        return '❌ Erro ao obter resposta da IA.';
      }
    })
  );

  // ====== Zephyr (exemplos) ======

  // Criar teste Zephyr
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.criarTesteZephyr', async (
      texto: string,
      issueId: string,
      issueKey: string,
      automationStatus: string,
      testClass: string,
      testType: string,
      testGroup: string,
      folderId: number
    ) => {
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
            "Test Type": testType?.trim(),
            "Test Class": testClass?.trim(),
            "Automation Status": automationStatus?.trim(),
            "Test Group": testGroup?.trim()
          }
        };

        const zephyrData = await httpJson(urlBase, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${zephyrToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(createBody),
          timeoutMs: 30000,
        });

        const key = zephyrData?.key;
        if (!key) throw new Error('Não foi possível obter a chave do test case criado.');

        // Linkar issue
        try {
          await httpRaw(`${urlBase}/${key}/links/issues`, {
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
        } catch (err) {
          // Log leve; não bloquear
          console.warn('Falha ao linkar issue ao test case:', err);
        }

        // Escrever script (remove 1ª linha "Scenario: ...")
        const semPrimeira = texto.split('\n').slice(1).join('\n');
        try {
          await httpRaw(`${urlBase}/${key}/testscript`, {
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
        } catch (err) {
          console.warn('Falha ao salvar script do test case:', err);
        }

        return key;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao criar test case no Zephyr: ${err?.message || err}`);
        return null;
      }
    })
  );

  // Atualizar script de um teste Zephyr
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.atualizarTesteZephyr', async (
      key: string,
      texto: string,
    ) => {
      const { zephyrToken, zephyrDomain } = getZephyrSettings();
      const urlBase = `https://${zephyrDomain}/v2/testcases`;
      const semPrimeira = texto.split('\n').slice(1).join('\n');

      try {
        await httpRaw(`${urlBase}/${key}/testscript`, {
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
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao atualizar script no Zephyr: ${err?.message || err}`);
        return null;
      }
    })
  );

  // Pastas do Zephyr (paginadas)
  context.subscriptions.push(
    vscode.commands.registerCommand('plugin-vscode.getZephyrFolders', async (issueKey: string) => {
      const { zephyrToken, zephyrDomain } = getZephyrSettings();

      let startAt = 0;
      const maxResults = 100;
      let isLast = false;
      const projectKey = issueKey.slice(0, 4);
      const all: any[] = [];

      try {
        while (!isLast) {
          const url = `https://${zephyrDomain}/v2/folders?maxResults=${maxResults}&startAt=${startAt}&projectKey=${projectKey}&folderType=TEST_CASE`;
          const data = await httpJson(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${zephyrToken}`,
              'Accept': 'application/json',
            },
            timeoutMs: 25000,
          });

          const values = Array.isArray(data?.values) ? data.values : [];
          for (const p of values) {
            all.push({ key: p.id, parentId: p.parentId, name: p.name });
          }
          isLast = !!data?.isLast;
          startAt += maxResults;
        }
        return all;
      } catch (err: any) {
        vscode.window.showErrorMessage(`Erro ao buscar pastas no Zephyr: ${err?.message || err}`);
        return [];
      }
    })
  );
}

// =========================
// Copilot: cliente HTTP autônomo
// =========================

async function criarTokenECriarThread(cookie: string): Promise<{ token: string; threadId: string }> {
  // 1) Obter token
  const tokenRes = await httpJson('https://github.com/github-copilot/chat/token', {
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
  const token = tokenRes?.token;
  if (!token) throw new Error('Não foi possível obter o token do Copilot (verifique o cookie)');

  // 2) Criar thread
  const threadRes = await httpJson('https://api.business.githubcopilot.com/github/chat/threads', {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: '{}',
    timeoutMs: 15000,
  });
  const threadId = threadRes?.thread_id;
  if (!threadId) throw new Error('Não foi possível criar a thread do Copilot');

  // Cache global
  globalToken = token;
  globalThreadId = threadId;
  return { token, threadId };
}

async function enviarCriarCenarioComCopilot(token: string, threadId: string, userStory: string, _cenarioOriginal: string): Promise<string> {
  const payload = {
    responseMessageID: randomId(),
    content:
      `Com base na análise da user story abaixo, crie cenários de testes e realize as seguintes ações:
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

  await httpRaw(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
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
  const msgs = await httpJson(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'content-type': 'application/json',
    },
    timeoutMs: 20000,
  });
  const list = Array.isArray(msgs?.messages) ? msgs.messages : [];
  const last = list[list.length - 1];
  return last?.content || '⚠️ Nenhuma resposta recebida.';
}

async function enviarCenarioParaCopilot(token: string, threadId: string, userStory: string, cenarioOriginal: string): Promise<string> {
  const payload = {
    responseMessageID: randomId(),
    content:
      `Com base na análise da user story abaixo, avalie também o cenário de teste fornecido e:
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

  await httpRaw(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeoutMs: 20000,
    expectJson: true,
  });

  const msgs = await httpJson(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'content-type': 'application/json',
    },
    timeoutMs: 20000,
  });
  const list = Array.isArray(msgs?.messages) ? msgs.messages : [];
  const last = list[list.length - 1];
  return last?.content || '⚠️ Nenhuma resposta recebida.';
}

async function analiseStoryEpicFunCopilot(token: string, threadId: string, description: string, bdd: string): Promise<string> {
  const payload = {
    responseMessageID: randomId(),
    content:
      `Analise a user story abaixo e:
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

  await httpRaw(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeoutMs: 20000,
    expectJson: true,
  });

  const msgs = await httpJson(`https://api.business.githubcopilot.com/github/chat/threads/${threadId}/messages`, {
    method: 'GET',
    headers: {
      'authorization': `GitHub-Bearer ${token}`,
      'content-type': 'application/json',
    },
    timeoutMs: 20000,
  });
  const list = Array.isArray(msgs?.messages) ? msgs.messages : [];
  const last = list[list.length - 1];
  return last?.content || '⚠️ Nenhuma resposta recebida.';
}

// =========================
// Utilitários
// =========================

function getJiraSettings() {
  return {
    jiraDomain: vscode.workspace.getConfiguration().get<string>('plugin.jira.domain') || '',
    jiraEmail: vscode.workspace.getConfiguration().get<string>('plugin.jira.email') || '',
    jiraToken: vscode.workspace.getConfiguration().get<string>('plugin.jira.token') || '',
  };
}

function getZephyrSettings() {
  return {
    zephyrOwnerId: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.ownerId') || '',
    zephyrDomain: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.domain') || '',
    zephyrToken: vscode.workspace.getConfiguration().get<string>('plugin.zephyr.token') || '',
  };
}

function getCopilotSettings() {
  return {
    copilotCookie: vscode.workspace.getConfiguration().get<string>('plugin.copilot.Cookie') || '',
  };
}

function encodeAuth(email: string, token: string) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}

function randomId() {
  // Fallback simples para Node 16 (sem crypto.randomUUID nativo em todos os targets)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ---- HTTP helpers (compatíveis com Node 16, sem fetch global) ----

type HttpOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  expectJson?: boolean; // apenas para httpRaw (erro se vier não-JSON quando true)
};

function httpRaw(urlStr: string, opts: HttpOptions): Promise<{ status: number; headers: Record<string, string | string[]>; body: string; }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const method = opts.method || 'GET';
    const headers = Object.assign(
      {
        'User-Agent': 'VSCode-Extension/1.0',
        'Accept': 'application/json',
      },
      opts.headers || {}
    );

    const req = httpsRequest(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
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
                msg = parsed?.message || JSON.stringify(parsed);
              } catch { /* ignore */ }
              return reject(new Error(`HTTP ${status}: ${msg}`));
            }
            return reject(new Error(`HTTP ${status}: ${body}`));
          }
          resolve({ status, headers: resHeaders as any, body });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (opts.timeoutMs && opts.timeoutMs > 0) {
      req.setTimeout(opts.timeoutMs, () => {
        try { req.destroy(); } catch { /* ignore */ }
        reject(new Error('Timeout'));
      });
    }
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function httpJson(urlStr: string, opts: HttpOptions): Promise<any> {
  const res = await httpRaw(urlStr, { ...opts, expectJson: true });
  try {
    return JSON.parse(res.body);
  } catch (e) {
    throw new Error(`Falha ao parsear JSON de ${urlStr}: ${(e as Error).message}`);
  }
}

// =========================
// Desativação
// =========================
export function deactivate() {
  // Nada especial
}
